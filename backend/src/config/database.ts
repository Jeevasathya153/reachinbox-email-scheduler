import mysql from 'mysql2/promise';
import { config } from './index';

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function initDatabase(): Promise<void> {
  // 1. Verify connection to MySQL server and ensure database exists
  try {
    const rootConnection = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\`;`);
    await rootConnection.end();

    // 2. Connect to application database and initialize tables
    const connection = await pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          avatar_url TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS emails (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          sender_email VARCHAR(255) NOT NULL,
          recipient_email VARCHAR(255) NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          scheduled_at DATETIME NOT NULL,
          sent_at DATETIME NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
          bullmq_job_id VARCHAR(255) NULL,
          idempotency_key VARCHAR(255) UNIQUE NOT NULL,
          failure_reason TEXT NULL,
          ethereal_preview_url TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS slack_connections (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) UNIQUE NOT NULL,
          access_token TEXT NULL,
          bot_user_id VARCHAR(255) NULL,
          channel_id VARCHAR(255) NULL,
          webhook_url TEXT NULL,
          connected TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      console.log('[MySQL] Database tables & indexes verified successfully.');
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error(`[MySQL] Initialization error: ${err.message}`);
    throw err;
  }
}
