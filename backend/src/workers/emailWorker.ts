import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, emailQueue } from '../queues/emailQueue';
import { redisConnectionOptions } from '../config/redis';
import { config } from '../config';
import { pool } from '../config/database';
import { sendEmailViaSmtp } from '../services/smtpService';
import { checkAndIncrementRateLimit } from '../services/rateLimitService';
import { updateEmailStatusInElasticsearch } from '../services/searchService';
import { EmailJobData } from '../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export function createEmailWorker(): Worker<EmailJobData> {
  const concurrency = config.worker.concurrency;

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, userId, senderEmail, recipientEmail, subject, body, idempotencyKey, hourlyLimit } = job.data;

      console.log(`[Worker] Processing delayed email job ${job.id} for ${recipientEmail}`);

      // 1. Atomic Idempotency Check & Claim in MySQL
      const [lockResult] = await pool.query<ResultSetHeader>(
        `UPDATE emails 
         SET status = 'processing', updated_at = NOW() 
         WHERE id = ? AND status = 'scheduled'`,
        [emailId]
      );

      if (lockResult.affectedRows === 0) {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT status FROM emails WHERE id = ?`,
          [emailId]
        );
        const currentStatus = rows[0]?.status;

        if (currentStatus === 'sent') {
          console.log(`[Worker] Idempotency guard: Email ${emailId} was ALREADY SENT. Skipping duplicate execution.`);
          return { skipped: true, reason: 'already_sent' };
        } else if (currentStatus === 'processing') {
          console.log(`[Worker] Idempotency guard: Email ${emailId} is currently being processed by another worker. Skipping.`);
          return { skipped: true, reason: 'already_processing' };
        } else if (currentStatus === 'failed') {
          console.log(`[Worker] Email ${emailId} was marked failed. Skipping.`);
          return { skipped: true, reason: 'marked_failed' };
        }
      }

      // 2. Redis-Backed Atomic Rate Limit Check
      const effectiveHourlyLimit = hourlyLimit || config.worker.maxEmailsPerHour;
      const rateLimitCheck = await checkAndIncrementRateLimit(userId, senderEmail, effectiveHourlyLimit);

      if (!rateLimitCheck.allowed) {
        console.warn(
          `[Worker] Hourly rate limit reached for sender '${senderEmail}' (${rateLimitCheck.currentCount}/${effectiveHourlyLimit}). Rescheduling job in ${Math.round(rateLimitCheck.nextWindowMs / 1000)}s.`
        );

        await pool.query(
          `UPDATE emails SET status = 'scheduled', updated_at = NOW() WHERE id = ?`,
          [emailId]
        );

        const rescheduledJobId = `${idempotencyKey}_rescheduled_${Date.now()}`;
        await emailQueue.add('send-email', job.data, {
          delay: rateLimitCheck.nextWindowMs,
          jobId: rescheduledJobId,
        });

        return { rescheduled: true, nextWindowMs: rateLimitCheck.nextWindowMs };
      }

      // 3. Enforce Minimum Send Delay
      const minDelay = config.worker.minDelayMs;
      if (minDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }

      // 4. Send Email via Ethereal SMTP
      try {
        const smtpResult = await sendEmailViaSmtp({
          from: senderEmail,
          to: recipientEmail,
          subject,
          body,
        });

        const sentAt = new Date();
        const etherealPreviewUrl = smtpResult.previewUrl || null;

        // 5. Update MySQL record to 'sent' and store ethereal_preview_url
        await pool.query(
          `UPDATE emails 
           SET status = 'sent', sent_at = ?, bullmq_job_id = ?, ethereal_preview_url = ?, updated_at = NOW() 
           WHERE id = ?`,
          [sentAt, smtpResult.messageId || job.id, etherealPreviewUrl, emailId]
        );

        updateEmailStatusInElasticsearch(emailId, 'sent', sentAt).catch(() => {});

        console.log(`[Worker] Email ${emailId} successfully sent via Ethereal. Preview URL: ${etherealPreviewUrl}`);
        return { success: true, messageId: smtpResult.messageId, previewUrl: etherealPreviewUrl };
      } catch (err: any) {
        const failureReason = err.message || 'Ethereal SMTP send error';
        console.error(`[Worker] Failed Ethereal test send for email ${emailId} to ${recipientEmail}:`, failureReason);

        await pool.query(
          `UPDATE emails 
           SET status = 'failed', failure_reason = ?, updated_at = NOW() 
           WHERE id = ?`,
          [failureReason, emailId]
        );

        updateEmailStatusInElasticsearch(emailId, 'failed').catch(() => {});
        throw err;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency,
    }
  );

  let lastWorkerErrorLogged = false;

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  worker.on('error', (err) => {
    if (!lastWorkerErrorLogged) {
      console.error(`[Worker] Redis connection lost. Waiting for Redis on ${config.redis.host}:${config.redis.port}...`);
      lastWorkerErrorLogged = true;
    }
  });

  worker.on('ready', () => {
    lastWorkerErrorLogged = false;
  });

  return worker;
}
