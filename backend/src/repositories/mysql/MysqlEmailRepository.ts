import { IEmailRepository } from '../types';
import { EmailRecord, EmailStatus } from '../../types';
import { pool } from '../../config/database';
import { searchEmailsInElasticsearch } from '../../services/searchService';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class MysqlEmailRepository implements IEmailRepository {
  async create(data: Omit<EmailRecord, 'created_at' | 'updated_at'>): Promise<EmailRecord> {
    const scheduledAtStr = new Date(data.scheduled_at).toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      `INSERT INTO emails (
        id, user_id, sender_email, recipient_email, subject, body,
        scheduled_at, status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.id,
        data.user_id,
        data.sender_email,
        data.recipient_email,
        data.subject,
        data.body,
        scheduledAtStr,
        data.status || 'scheduled',
        data.idempotency_key,
      ]
    );

    const record = await this.findById(data.id);
    return record!;
  }

  async findById(id: string): Promise<EmailRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM emails WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0] as EmailRecord;
  }

  async getScheduled(userId: string): Promise<EmailRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM emails WHERE user_id = ? AND status IN ('scheduled', 'processing') ORDER BY scheduled_at ASC`,
      [userId]
    );
    return rows as EmailRecord[];
  }

  async getSent(userId: string): Promise<EmailRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM emails WHERE user_id = ? AND status IN ('sent', 'failed') ORDER BY updated_at DESC`,
      [userId]
    );
    return rows as EmailRecord[];
  }

  async search(userId: string, query: string): Promise<EmailRecord[]> {
    if (!query || query.trim() === '') {
      return this.getScheduled(userId);
    }

    try {
      const esResults = await searchEmailsInElasticsearch(userId, query);
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

    const pattern = `%${query}%`;
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

  async updateStatus(
    id: string,
    status: EmailStatus,
    updates?: Partial<EmailRecord>
  ): Promise<EmailRecord | null> {
    const setClauses: string[] = ['status = ?', 'updated_at = NOW()'];
    const params: any[] = [status];

    if (updates) {
      if (updates.sent_at) {
        setClauses.push('sent_at = ?');
        params.push(new Date(updates.sent_at).toISOString().slice(0, 19).replace('T', ' '));
      }
      if (updates.bullmq_job_id !== undefined) {
        setClauses.push('bullmq_job_id = ?');
        params.push(updates.bullmq_job_id);
      }
      if (updates.ethereal_preview_url !== undefined) {
        setClauses.push('ethereal_preview_url = ?');
        params.push(updates.ethereal_preview_url);
      }
      if (updates.failure_reason !== undefined) {
        setClauses.push('failure_reason = ?');
        params.push(updates.failure_reason);
      }
    }

    params.push(id);

    await pool.query(
      `UPDATE emails SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  async claimForProcessing(id: string): Promise<EmailRecord | null> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE emails SET status = 'processing', updated_at = NOW() WHERE id = ? AND status = 'scheduled'`,
      [id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  async updateSchedule(id: string, scheduledAt: Date): Promise<EmailRecord | null> {
    const scheduledAtStr = new Date(scheduledAt).toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `UPDATE emails SET scheduled_at = ?, updated_at = NOW() WHERE id = ? AND status = 'scheduled'`,
      [scheduledAtStr, id]
    );
    return this.findById(id);
  }
}
