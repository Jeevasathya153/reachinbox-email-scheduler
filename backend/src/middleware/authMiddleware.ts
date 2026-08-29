import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { User as AppUser } from '../types';
import { RowDataPacket } from 'mysql2';

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUserId = (req.session as any)?.userId;

    if (!sessionUserId) {
      return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE id = ? LIMIT 1`,
      [sessionUserId]
    );

    if (rows.length === 0) {
      (req.session as any).userId = null;
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = rows[0] as AppUser;
    next();
  } catch (err: any) {
    console.error('[Auth Middleware] Authentication check error:', err.message);
    res.status(500).json({ error: 'Database error during authentication: ' + err.message });
  }
}
