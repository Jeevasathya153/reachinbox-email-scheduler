import { IEmailRepository } from '../types';
import { EmailRecord, EmailStatus } from '../../types';

export class InMemoryEmailRepository implements IEmailRepository {
  private emails: Map<string, EmailRecord> = new Map();

  async create(data: Omit<EmailRecord, 'created_at' | 'updated_at'>): Promise<EmailRecord> {
    const now = new Date();
    const record: EmailRecord = {
      ...data,
      created_at: now,
      updated_at: now,
    };
    this.emails.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<EmailRecord | null> {
    return this.emails.get(id) || null;
  }

  async getScheduled(userId: string): Promise<EmailRecord[]> {
    const results: EmailRecord[] = [];
    for (const email of this.emails.values()) {
      if (email.user_id === userId && (email.status === 'scheduled' || email.status === 'processing')) {
        results.push(email);
      }
    }
    return results.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }

  async getSent(userId: string): Promise<EmailRecord[]> {
    const results: EmailRecord[] = [];
    for (const email of this.emails.values()) {
      if (email.user_id === userId && (email.status === 'sent' || email.status === 'failed')) {
        results.push(email);
      }
    }
    return results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  async search(userId: string, query: string): Promise<EmailRecord[]> {
    if (!query || query.trim() === '') {
      return this.getScheduled(userId);
    }
    const lower = query.toLowerCase();
    const results: EmailRecord[] = [];
    for (const email of this.emails.values()) {
      if (
        email.user_id === userId &&
        (email.recipient_email.toLowerCase().includes(lower) ||
          email.sender_email.toLowerCase().includes(lower) ||
          email.subject.toLowerCase().includes(lower) ||
          email.body.toLowerCase().includes(lower))
      ) {
        results.push(email);
      }
    }
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateStatus(
    id: string,
    status: EmailStatus,
    updates?: Partial<EmailRecord>
  ): Promise<EmailRecord | null> {
    const record = this.emails.get(id);
    if (!record) return null;

    record.status = status;
    record.updated_at = new Date();

    if (updates) {
      Object.assign(record, updates);
    }

    this.emails.set(id, record);
    return record;
  }

  async claimForProcessing(id: string): Promise<EmailRecord | null> {
    const record = this.emails.get(id);
    if (!record || record.status !== 'scheduled') {
      return null;
    }

    record.status = 'processing';
    record.updated_at = new Date();
    this.emails.set(id, record);
    return record;
  }

  async updateSchedule(id: string, scheduledAt: Date): Promise<EmailRecord | null> {
    const record = this.emails.get(id);
    if (!record || record.status !== 'scheduled') return null;
    record.scheduled_at = scheduledAt;
    record.updated_at = new Date();
    this.emails.set(id, record);
    return record;
  }
}
