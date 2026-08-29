import { IUserRepository } from '../types';
import { User } from '../../types';
import { pool } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export class MysqlUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0] as User;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE google_id = ? LIMIT 1`,
      [googleId]
    );
    if (rows.length === 0) return null;
    return rows[0] as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [email]
    );
    if (rows.length === 0) return null;
    return rows[0] as User;
  }

  async upsertGoogleUser(
    googleId: string,
    name: string,
    email: string,
    avatarUrl?: string | null
  ): Promise<User> {
    const existing = await this.findByGoogleId(googleId);

    if (existing) {
      await pool.query(
        `UPDATE users SET name = ?, email = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?`,
        [name, email, avatarUrl || existing.avatar_url, existing.id]
      );
      const updated = await this.findById(existing.id);
      return updated!;
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO users (id, google_id, name, email, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, googleId, name, email, avatarUrl || null]
    );

    const user = await this.findById(id);
    return user!;
  }
}
