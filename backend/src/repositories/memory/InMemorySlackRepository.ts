import { ISlackRepository } from '../types';
import { SlackConnection } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class InMemorySlackRepository implements ISlackRepository {
  private connections: Map<string, SlackConnection> = new Map();

  async findByUserId(userId: string): Promise<SlackConnection | null> {
    return this.connections.get(userId) || null;
  }

  async upsert(userId: string, data: Partial<SlackConnection>): Promise<SlackConnection> {
    const existing = await this.findByUserId(userId);
    const now = new Date();

    if (existing) {
      Object.assign(existing, data, { updated_at: now });
      this.connections.set(userId, existing);
      return existing;
    }

    const newConn: SlackConnection = {
      id: uuidv4(),
      user_id: userId,
      access_token: data.access_token || null,
      bot_user_id: data.bot_user_id || null,
      channel_id: data.channel_id || null,
      webhook_url: data.webhook_url || null,
      connected: data.connected !== undefined ? data.connected : true,
      created_at: now,
      updated_at: now,
    };
    this.connections.set(userId, newConn);
    return newConn;
  }

  async disconnect(userId: string): Promise<void> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      existing.connected = false;
      existing.updated_at = new Date();
      this.connections.set(userId, existing);
    }
  }
}
