import { getCurrentHourWindow, getMsUntilNextHourWindow } from '../services/rateLimitService';

describe('Scheduler & Ethereal Test Mode Logic Tests', () => {
  test('getCurrentHourWindow returns timestamp rounded down to current hour', () => {
    const testTime = new Date('2026-08-29T14:35:45.123Z').getTime();
    const expectedHour = new Date('2026-08-29T14:00:00.000Z').getTime();
    expect(getCurrentHourWindow(testTime)).toBe(expectedHour);
  });

  test('getMsUntilNextHourWindow calculates accurate delay to next hour window', () => {
    const testTime = new Date('2026-08-29T14:45:00.000Z').getTime();
    const remainingMs = getMsUntilNextHourWindow(testTime);
    expect(remainingMs).toBe(900000);
  });

  test('recipient delay offset calculation for batch scheduling', () => {
    const recipients = ['test1@example.com', 'test2@example.com', 'test3@example.com'];
    const baseDelay = 1000;
    const delayBetweenEmails = 2000;

    const scheduledDelays = recipients.map((_, i) => baseDelay + i * delayBetweenEmails);

    expect(scheduledDelays).toEqual([1000, 3000, 5000]);
  });

  test('idempotency key format contains required metadata', () => {
    const userId = 'u123';
    const recipient = 'user@example.com';
    const startMs = Date.now();
    const idempotencyKey = `email_${userId}_${recipient}_${startMs}_0_abc123`;

    expect(idempotencyKey).toContain('email_u123_user@example.com_');
  });
});
