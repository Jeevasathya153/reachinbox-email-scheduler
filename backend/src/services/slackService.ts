import axios from 'axios';
import { pool } from '../config/database';
import { SlackConnection } from '../types';
import { RowDataPacket } from 'mysql2';

export async function getSlackConnectionForUser(userId: string): Promise<SlackConnection | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM slack_connections WHERE user_id = ? AND connected = 1 LIMIT 1`,
    [userId]
  );
  return (rows[0] as SlackConnection) || null;
}

export async function sendSlackRateLimitNotification(
  userId: string,
  senderEmail: string,
  hourlyLimit: number
): Promise<boolean> {
  try {
    const connection = await getSlackConnectionForUser(userId);
    if (!connection) {
      console.log(`[Slack] No active Slack connection for user ${userId}. Skipping notification.`);
      return false;
    }

    const messageText = `⚠️ *Email Rate Limit Reached*\nSender: *${senderEmail}*\nHourly Limit: *${hourlyLimit} emails/hour*\nStatus: Remaining scheduled emails have been safely moved to the next available window.`;

    if (connection.webhook_url) {
      await axios.post(connection.webhook_url, { text: messageText }, { timeout: 5000 });
      console.log(`[Slack] Notification sent via webhook for user ${userId}.`);
      return true;
    }

    if (connection.access_token) {
      const channel = connection.channel_id || '#general';
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel,
          text: messageText,
        },
        {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      console.log(`[Slack] Notification sent via API for user ${userId}.`);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error(`[Slack] Error sending notification for user ${userId}:`, err.message);
    return false;
  }
}
