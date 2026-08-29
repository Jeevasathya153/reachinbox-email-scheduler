export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  google_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailRecord {
  id: string;
  user_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: Date | string;
  sent_at: Date | string | null;
  status: EmailStatus;
  bullmq_job_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  ethereal_preview_url?: string | null;
  preview_url?: string | false | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SlackConnection {
  id: string;
  user_id: string;
  access_token: string | null;
  bot_user_id: string | null;
  channel_id: string | null;
  webhook_url: string | null;
  connected: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailJobData {
  emailId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  idempotencyKey: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface ScheduleRequest {
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}
