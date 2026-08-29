import { ISlackRepository } from '../types';
import { SlackConnection } from '../../types';
import { pool } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export class MysqlSlackRepository implements ISlackRepository {
  async findByUserId(userId: string): Promise<SlackConnection | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM slack_connections WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ...row,
      connected: Boolean(row.connected),
    } as SlackConnection;
  }

  async upsert(userId: string, data: Partial<SlackConnection>): Promise<SlackConnection> {
    const existing = await this.findByUserId(userId);

    if (existing) {
      await pool.query(
        `UPDATE slack_connections 
         SET access_token = ?, bot_user_id = ?, channel_id = ?, webhook_url = ?, connected = ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [
          data.access_token || existing.access_token,
          data.bot_user_id || existing.bot_user_id,
          data.channel_id || existing.channel_id,
          data.webhook_url || existing.webhook_url,
          data.connected !== undefined ? (data.connected ? 1 : 0) : existing.connected ? 1 : 0,
          userId,
        ]
      );
      const updated = await this.findByUserId(userId);
      return updated!;
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO slack_connections (
        id, user_id, access_token, bot_user_id, channel_id, webhook_url, connected, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        userId,
        data.access_token || null,
        data.bot_user_id || null,
        data.channel_id || null,
        data.webhook_url || null,
        data.connected !== undefined ? (data.connected ? 1 : 0) : 1,
      ]
    );

    const conn = await this.findByUserId(userId);
    return conn!;
  }

  async disconnect(userId: string): Promise<void> {
    await pool.query(
      `UPDATE slack_connections SET connected = 0, updated_at = NOW() WHERE user_id = ?`,
      [userId]
    );
  }
}
