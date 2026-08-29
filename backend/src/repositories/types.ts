import { User, EmailRecord, EmailStatus, SlackConnection } from '../types';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsertGoogleUser(googleId: string, name: string, email: string, avatarUrl?: string | null): Promise<User>;
}

export interface IEmailRepository {
  create(data: Omit<EmailRecord, 'created_at' | 'updated_at'>): Promise<EmailRecord>;
  findById(id: string): Promise<EmailRecord | null>;
  getScheduled(userId: string): Promise<EmailRecord[]>;
  getSent(userId: string): Promise<EmailRecord[]>;
  search(userId: string, query: string): Promise<EmailRecord[]>;
  updateStatus(id: string, status: EmailStatus, updates?: Partial<EmailRecord>): Promise<EmailRecord | null>;
  updateSchedule(id: string, scheduledAt: Date): Promise<EmailRecord | null>;
  claimForProcessing(id: string): Promise<EmailRecord | null>;
}

export interface ISlackRepository {
  findByUserId(userId: string): Promise<SlackConnection | null>;
  upsert(userId: string, data: Partial<SlackConnection>): Promise<SlackConnection>;
  disconnect(userId: string): Promise<void>;
}
