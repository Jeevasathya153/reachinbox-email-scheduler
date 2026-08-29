import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 1, // Handled explicitly with rescheduling in worker
    removeOnComplete: false, // Retain completed job records in Redis for visibility
    removeOnFail: false,
  },
});
