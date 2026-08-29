import { Request, Response } from 'express';
import { pool } from '../config/database';
import { config } from '../config';
import { SlackConnection } from '../types';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export async function handleSlackConnect(req: Request, res: Response) {
  const clientId = config.slack.clientId;
  const redirectUri = config.slack.redirectUri;

  if (!clientId || clientId === 'mock_slack_client_id' || clientId.trim() === '') {
    return res.status(500).json({
      error: 'Slack OAuth is not configured.',
      message: 'Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in backend/.env',
    });
  }

  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=chat:write,incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(slackAuthUrl);
}

export async function handleSlackCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  const userId = (req.session as any)?.userId;
  const frontendUrl = config.frontendUrl;

  if (!userId) {
    return res.redirect(`${frontendUrl}?error=auth_required`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}?slack=failed`);
  }

  try {
    const tokenRes = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        code,
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        redirect_uri: config.slack.redirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (!tokenRes.data.ok) {
      console.error('[Slack OAuth] Slack error response:', tokenRes.data.error);
      return res.redirect(`${frontendUrl}?slack=failed`);
    }

    const accessToken = tokenRes.data.access_token;
    const botUserId = tokenRes.data.bot_user_id;
    const webhookUrl = tokenRes.data.incoming_webhook?.url || null;
    const channelId = tokenRes.data.incoming_webhook?.channel_id || null;

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM slack_connections WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE slack_connections 
         SET access_token = ?, bot_user_id = ?, channel_id = ?, webhook_url = ?, connected = 1, updated_at = NOW() 
         WHERE user_id = ?`,
        [accessToken, botUserId, channelId, webhookUrl, userId]
      );
    } else {
      const connId = uuidv4();
      await pool.query(
        `INSERT INTO slack_connections (id, user_id, access_token, bot_user_id, channel_id, webhook_url, connected) 
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [connId, userId, accessToken, botUserId, channelId, webhookUrl]
      );
    }

    res.redirect(`${frontendUrl}?slack=connected`);
  } catch (err: any) {
    console.error('[Slack OAuth] Exception:', err.message);
    res.redirect(`${frontendUrl}?slack=failed`);
  }
}

export async function handleSlackDisconnect(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    await pool.query(`UPDATE slack_connections SET connected = 0, updated_at = NOW() WHERE user_id = ?`, [userId]);
    res.json({ message: 'Slack disconnected successfully' });
  } catch (err: any) {
    console.error('[Slack Disconnect] Error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Slack: ' + err.message });
  }
}

export async function getSlackStatus(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM slack_connections WHERE user_id = ? AND connected = 1 LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ connected: false, channel: null });
    }

    const conn = rows[0] as SlackConnection;
    res.json({
      connected: true,
      channel: conn.channel_id || '#general',
      hasWebhook: !!conn.webhook_url,
    });
  } catch (err: any) {
    console.error('[Slack Status] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Slack status: ' + err.message });
  }
}
