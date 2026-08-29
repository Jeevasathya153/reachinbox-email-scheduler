import { Request, Response } from 'express';
import { pool } from '../config/database';
import { config } from '../config';
import { User as AppUser } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export async function handleGoogleLogin(req: Request, res: Response) {
  const clientId = config.google.clientId;
  const callbackUrl = config.google.callbackUrl;

  if (!clientId || clientId.trim() === '' || clientId === 'mock_google_client_id') {
    return res.status(500).json({
      success: false,
      error: 'Google OAuth configuration missing',
      message: 'Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in backend/.env',
    });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    callbackUrl
  )}&response_type=code&scope=openid%20email%20profile&access_type=offline`;

  res.redirect(googleAuthUrl);
}

export async function handleGoogleCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  const frontendUrl = config.frontendUrl;

  if (!code) {
    return res.redirect(`${frontendUrl}?error=missing_code`);
  }

  try {
    // 1. Exchange authorization code for Google access token
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    });

    const accessToken = tokenRes.data.access_token;

    // 2. Fetch Google profile info
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id: googleId, name, email, picture: avatarUrl } = profileRes.data;

    if (!email) {
      return res.redirect(`${frontendUrl}?error=email_not_provided`);
    }

    // 3. MySQL User Resolution
    // Check by google_id first
    const [googleRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE google_id = ? LIMIT 1`,
      [googleId]
    );

    let user: AppUser;

    if (googleRows.length > 0) {
      user = googleRows[0] as AppUser;
      // Update name and avatar if changed
      await pool.query(
        `UPDATE users SET name = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?`,
        [name, avatarUrl || user.avatar_url, user.id]
      );
    } else {
      // Check by email
      const [emailRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM users WHERE email = ? LIMIT 1`,
        [email]
      );

      if (emailRows.length > 0) {
        user = emailRows[0] as AppUser;
        // Associate Google account with existing user
        await pool.query(
          `UPDATE users SET google_id = ?, name = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?`,
          [googleId, name, avatarUrl || user.avatar_url, user.id]
        );
      } else {
        // Create new user in MySQL
        const newUserId = uuidv4();
        await pool.query<ResultSetHeader>(
          `INSERT INTO users (id, google_id, name, email, avatar_url) VALUES (?, ?, ?, ?, ?)`,
          [newUserId, googleId, name, email, avatarUrl || null]
        );
        const [newRows] = await pool.query<RowDataPacket[]>(`SELECT * FROM users WHERE id = ?`, [newUserId]);
        user = newRows[0] as AppUser;
      }
    }

    // 4. Save session
    (req.session as any).userId = user.id;

    res.redirect(frontendUrl);
  } catch (err: any) {
    console.error('[Google OAuth] Callback error:', err.response?.data || err.message);
    res.redirect(`${frontendUrl}?error=auth_failed`);
  }
}

export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });
}

export async function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}
