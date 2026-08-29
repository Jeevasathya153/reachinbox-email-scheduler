import { pool } from '../config/database';
import { emailQueue } from '../queues/emailQueue';
import { isRedisConnected } from '../config/redis';
import { indexEmailInElasticsearch, searchEmailsInElasticsearch } from './searchService';
import { EmailRecord, ScheduleRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function scheduleEmails(
  userId: string,
  senderEmail: string,
  request: ScheduleRequest
): Promise<EmailRecord[]> {
  if (!isRedisConnected()) {
    throw new Error('Scheduling service unavailable: Redis is not connected to 127.0.0.1:6379');
  }

  const { recipients, subject, body, startTime, delayBetweenEmails, hourlyLimit } = request;

  const startMs = new Date(startTime).getTime();
  const nowMs = Date.now();
  const baseDelay = Math.max(0, startMs - nowMs);

  const scheduledRecords: EmailRecord[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i].trim().toLowerCase();
    if (!recipient) continue;

    const recipientDelayMs = baseDelay + i * delayBetweenEmails;
    const scheduledAt = new Date(nowMs + recipientDelayMs);
    const emailId = uuidv4();
    const idempotencyKey = `email_${userId}_${recipient}_${startMs}_${i}_${uuidv4().substring(0, 8)}`;

    // 1. Insert record into MySQL database
    await pool.query<ResultSetHeader>(
      `INSERT INTO emails (
        id, user_id, sender_email, recipient_email, subject, body,
        scheduled_at, status, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [emailId, userId, senderEmail, recipient, subject, body, scheduledAt, idempotencyKey]
    );

    // Fetch inserted record
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM emails WHERE id = ?`, [emailId]);
    const emailRecord = rows[0] as EmailRecord;

    // 2. Create delayed job in BullMQ backed by Redis
    const jobData = {
      emailId: emailRecord.id,
      userId,
      senderEmail,
      recipientEmail: recipient,
      subject,
      body,
      scheduledAt: scheduledAt.toISOString(),
      idempotencyKey,
      delayBetweenEmailsMs: delayBetweenEmails,
      hourlyLimit,
    };

    const bullJob = await emailQueue.add('send-email', jobData, {
      delay: recipientDelayMs,
      jobId: idempotencyKey, // BullMQ native jobId deduplication
    });

    if (bullJob && bullJob.id) {
      await pool.query(`UPDATE emails SET bullmq_job_id = ? WHERE id = ?`, [bullJob.id, emailRecord.id]);
      emailRecord.bullmq_job_id = bullJob.id;
    }

    // 3. Index in Elasticsearch (safe non-blocking)
    indexEmailInElasticsearch(emailRecord).catch(() => {});

    scheduledRecords.push(emailRecord);
  }

  return scheduledRecords;
}

export async function updateScheduledEmailTime(
  emailId: string,
  userId: string,
  newStartTime: string
): Promise<EmailRecord> {
  if (!isRedisConnected()) {
    throw new Error('Scheduling service unavailable: Redis is not connected to 127.0.0.1:6379');
  }

  // 1. Find email in MySQL
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM emails WHERE id = ? AND user_id = ? LIMIT 1`,
    [emailId, userId]
  );

  if (rows.length === 0) {
    throw new Error('Scheduled email not found or unauthorized');
  }

  const email = rows[0] as EmailRecord;

  if (email.status !== 'scheduled') {
    throw new Error(`Cannot reschedule email with status '${email.status}'`);
  }

  const newStartMs = new Date(newStartTime).getTime();
  const newDelayMs = Math.max(0, newStartMs - Date.now());
  const newScheduledAt = new Date(newStartMs);

  // 2. Cancel old BullMQ delayed job safely if job ID exists
  if (email.bullmq_job_id) {
    try {
      const oldJob = await emailQueue.getJob(email.bullmq_job_id);
      if (oldJob) {
        await oldJob.remove();
        console.log(`[Scheduler] Removed old BullMQ job '${email.bullmq_job_id}' for email ${emailId}`);
      }
    } catch (err: any) {
      console.warn(`[Scheduler] Could not remove old BullMQ job ${email.bullmq_job_id}:`, err.message);
    }
  }

  // 3. Create new BullMQ delayed job with new delay
  const newJobId = `rescheduled_${email.id}_${newStartMs}_${uuidv4().substring(0, 6)}`;
  const jobData = {
    emailId: email.id,
    userId: email.user_id,
    senderEmail: email.sender_email,
    recipientEmail: email.recipient_email,
    subject: email.subject,
    body: email.body,
    scheduledAt: newScheduledAt.toISOString(),
    idempotencyKey: email.idempotency_key,
    delayBetweenEmailsMs: 0,
    hourlyLimit: 200,
  };

  const newBullJob = await emailQueue.add('send-email', jobData, {
    delay: newDelayMs,
    jobId: newJobId,
  });

  // 4. Update MySQL database
  await pool.query(
    `UPDATE emails SET scheduled_at = ?, bullmq_job_id = ?, updated_at = NOW() WHERE id = ?`,
    [newScheduledAt, newBullJob.id, emailId]
  );

  const [updatedRows] = await pool.query<RowDataPacket[]>(`SELECT * FROM emails WHERE id = ?`, [emailId]);
  const updatedRecord = updatedRows[0] as EmailRecord;

  // 5. Update Elasticsearch (safe non-blocking)
  indexEmailInElasticsearch(updatedRecord).catch(() => {});

  return updatedRecord;
}

export async function getScheduledEmails(userId: string): Promise<EmailRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM emails WHERE user_id = ? AND status IN ('scheduled', 'processing') ORDER BY scheduled_at ASC`,
    [userId]
  );
  return rows as EmailRecord[];
}

export async function getSentEmails(userId: string): Promise<EmailRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM emails WHERE user_id = ? AND status IN ('sent', 'failed') ORDER BY updated_at DESC`,
    [userId]
  );
  return rows as EmailRecord[];
}

export async function searchEmails(userId: string, queryText: string): Promise<EmailRecord[]> {
  if (!queryText || queryText.trim() === '') {
    return getScheduledEmails(userId);
  }

  // 1. Try Elasticsearch
  try {
    const esResults = await searchEmailsInElasticsearch(userId, queryText);
    if (esResults && esResults.length > 0) {
      const ids = esResults.map((item) => item.id).filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM emails WHERE id IN (${placeholders}) AND user_id = ? ORDER BY created_at DESC`,
          [...ids, userId]
        );
        if (rows.length > 0) return rows as EmailRecord[];
      }
    }
  } catch (e) {}

  // 2. Fallback MySQL LIKE Search
  const pattern = `%${queryText}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM emails 
     WHERE user_id = ? AND (
       recipient_email LIKE ? OR
       sender_email LIKE ? OR
       subject LIKE ? OR
       body LIKE ?
     )
     ORDER BY created_at DESC LIMIT 50`,
    [userId, pattern, pattern, pattern, pattern]
  );
  return rows as EmailRecord[];
}
