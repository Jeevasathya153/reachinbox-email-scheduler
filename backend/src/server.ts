import app from './app';
import { config } from './config';
import { initDatabase } from './config/database';
import { getSmtpTransporter } from './services/smtpService';
import { isRedisConnected } from './config/redis';
import { createEmailWorker } from './workers/emailWorker';
import { EMAIL_QUEUE_NAME } from './queues/emailQueue';

async function startServer() {
  console.log('[Server] Starting ReachInbox Backend Server...');

  // 1. Initialize MySQL database
  await initDatabase();
  console.log('[DB] MySQL connected (localhost:3306)');

  // 2. Redis connection status
  if (isRedisConnected()) {
    console.log(`[Redis] Connected (${config.redis.host}:${config.redis.port})`);
  } else {
    console.warn(`[Redis] Warning: Not connected to ${config.redis.host}:${config.redis.port}. Scheduling API will return HTTP 503 until Redis is running.`);
  }

  // 3. Initialize Ethereal SMTP transporter & verify connection
  const transporter = await getSmtpTransporter();
  if (transporter) {
    const authUser = (transporter.options as any)?.auth?.user || 'Ethereal Test User';
    console.log(`[SMTP] Ethereal connected (User: ${authUser})`);
  }

  // 4. Initialize BullMQ Email Worker so worker processes jobs automatically
  if (isRedisConnected()) {
    createEmailWorker();
    console.log(`[Worker] Listening on queue '${EMAIL_QUEUE_NAME}' (Concurrency: ${config.worker.concurrency})`);
  }

  app.listen(config.port, () => {
    console.log(`[Server] Server is running on http://localhost:${config.port}`);
    console.log(`[Server] BullMQ Dashboard available at http://localhost:${config.port}/admin/queues`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});
