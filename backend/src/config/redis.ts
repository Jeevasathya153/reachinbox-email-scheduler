import Redis from 'ioredis';
import { config } from './index';

export const redisConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,

  ...(config.redis.tls ? { tls: {} } : {}),

  retryStrategy(times: number) {
    return Math.min(times * 500, 5000);
  },
};


export const redisClient = new Redis(redisConnectionOptions);

let lastLogState: 'connected' | 'disconnected' | null = null;

redisClient.on('connect', () => {
  if (lastLogState !== 'connected') {
    console.log(
      `[Redis] Connecting to ${config.redis.host}:${config.redis.port}...`
    );

    console.log('[Redis] Connected successfully.');

    lastLogState = 'connected';
  }
});

redisClient.on('ready', () => {
  console.log(
    `[Redis] Ready - ${config.redis.host}:${config.redis.port}`
  );
});

redisClient.on('error', (err) => {
  if (lastLogState !== 'disconnected') {
    console.error(
      `[Redis] ERROR: Redis is unavailable at ${config.redis.host}:${config.redis.port}. (${err.message})`
    );

    console.error(
      '[Redis] BullMQ scheduling cannot operate until Redis is available.'
    );

    lastLogState = 'disconnected';
  }
});

redisClient.on('close', () => {
  if (lastLogState !== 'disconnected') {
    console.error('[Redis] Connection closed.');
    lastLogState = 'disconnected';
  }
});

export function isRedisConnected(): boolean {
  return (
    redisClient.status === 'ready' ||
    redisClient.status === 'connect'
  );
}