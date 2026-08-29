import { createEmailWorker } from './workers/emailWorker';
import { initDatabase } from './config/database';
import { getSmtpTransporter } from './services/smtpService';
import { config } from './config';
import { isRedisConnected } from './config/redis';
import { EMAIL_QUEUE_NAME } from './queues/emailQueue';

async function startWorker() {
  console.log('[Worker Runner] Starting standalone BullMQ Email Worker Process...');

  await initDatabase();
  console.log('[DB] MySQL connected (localhost:3306)');

  if (isRedisConnected()) {
    console.log(`[Redis] Connected (${config.redis.host}:${config.redis.port})`);
  }

  const transporter = await getSmtpTransporter();
  if (transporter) {
    const authUser = (transporter.options as any)?.auth?.user || 'Ethereal Test User';
    console.log(`[SMTP] Ethereal connected (User: ${authUser})`);
  }

  const worker = createEmailWorker();
  console.log(`[Worker] Listening on ${EMAIL_QUEUE_NAME} (Concurrency: ${config.worker.concurrency})`);

  process.on('SIGINT', async () => {
    console.log('[Worker Runner] Gracefully shutting down worker...');
    if (worker) {
      await worker.close();
    }
    process.exit(0);
  });
}

startWorker().catch((err) => {
  console.error('[Worker Runner] Fatal worker error:', err.message);
  process.exit(1);
});
