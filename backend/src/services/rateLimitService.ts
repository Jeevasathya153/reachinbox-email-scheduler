import { redisClient } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  remainingQuota: number;
  nextWindowMs: number;
  shouldNotifySlack: boolean;
}

/**
 * Gets the current hour timestamp window (epoch ms at start of current hour).
 */
export function getCurrentHourWindow(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 3600000) * 3600000;
}

/**
 * Gets milliseconds remaining until the next hour window starts.
 */
export function getMsUntilNextHourWindow(nowMs: number = Date.now()): number {
  const currentHourStart = getCurrentHourWindow(nowMs);
  const nextHourStart = currentHourStart + 3600000;
  return Math.max(1000, nextHourStart - nowMs);
}

/**
 * Atomically checks and reserves hourly quota using Redis.
 * Key format: `ratelimit:{userId}:{senderEmail}:{hourTimestamp}`
 */
export async function checkAndIncrementRateLimit(
  userId: string,
  senderEmail: string,
  hourlyLimit: number,
  nowMs: number = Date.now()
): Promise<RateLimitCheckResult> {
  const hourWindow = getCurrentHourWindow(nowMs);
  const rateLimitKey = `ratelimit:${userId}:${senderEmail}:${hourWindow}`;
  const alertKey = `slack_alert:${userId}:${senderEmail}:${hourWindow}`;

  // Atomic Lua script to check and increment if within limit
  // Returns [currentCount, isAllowed]
  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    if not current then
      redis.call('SET', KEYS[1], 1, 'EX', 3600)
      return {1, 1}
    end
    local count = tonumber(current)
    if count < tonumber(ARGV[1]) then
      count = redis.call('INCR', KEYS[1])
      return {count, 1}
    else
      return {count, 0}
    end
  `;

  const [currentCount, allowedFlag] = (await redisClient.eval(
    luaScript,
    1,
    rateLimitKey,
    hourlyLimit
  )) as [number, number];

  const allowed = allowedFlag === 1;
  const nextWindowMs = getMsUntilNextHourWindow(nowMs);

  let shouldNotifySlack = false;

  if (!allowed) {
    // Check if Slack notification has already been triggered for this hour window
    const alertSent = await redisClient.set(alertKey, '1', 'EX', 3600, 'NX');
    if (alertSent === 'OK') {
      shouldNotifySlack = true;
    }
  }

  return {
    allowed,
    currentCount,
    remainingQuota: Math.max(0, hourlyLimit - currentCount),
    nextWindowMs,
    shouldNotifySlack,
  };
}
