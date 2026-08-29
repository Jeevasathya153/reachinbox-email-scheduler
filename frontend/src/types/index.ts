export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  google_id?: string | null;
  name: string;
  email: string;
  avatar_url?: string | null;
  avatar?: string | null;
}

export interface EmailRecord {
  id: string;
  user_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  bullmq_job_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  ethereal_preview_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRequest {
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface SlackStatus {
  connected: boolean;
  channel?: string | null;
  hasWebhook?: boolean;
}
