import { IUserRepository } from '../types';
import { User } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  constructor() {
    // Pre-seed default demo user for instant testing before Google OAuth keys are added
    const demoUser: User = {
      id: '11111111-1111-1111-1111-111111111111',
      google_id: 'demo_google_123',
      name: 'Demo User',
      email: 'demo.user@reachinbox.com',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.users.set(demoUser.id, demoUser);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.google_id === googleId) return user;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) return user;
    }
    return null;
  }

  async upsertGoogleUser(
    googleId: string,
    name: string,
    email: string,
    avatarUrl?: string | null
  ): Promise<User> {
    const existing = await this.findByGoogleId(googleId);
    const now = new Date();

    if (existing) {
      existing.name = name;
      existing.email = email;
      existing.avatar_url = avatarUrl || existing.avatar_url;
      existing.updated_at = now;
      this.users.set(existing.id, existing);
      return existing;
    }

    const newUser: User = {
      id: uuidv4(),
      google_id: googleId,
      name,
      email,
      avatar_url: avatarUrl || null,
      created_at: now,
      updated_at: now,
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }
}
