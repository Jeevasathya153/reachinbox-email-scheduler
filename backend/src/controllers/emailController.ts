import { Request, Response } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  searchEmails,
  updateScheduledEmailTime,
} from '../services/emailService';
import { z } from 'zod';

const scheduleSchema = z.object({
  recipients: z.array(z.string().email('Invalid recipient email format')).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Email body cannot be empty'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start time format' }),
  delayBetweenEmails: z.number().min(0, 'Delay must be non-negative'),
  hourlyLimit: z.number().min(1, 'Hourly limit must be at least 1'),
});

const updateTimeSchema = z.object({
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start time format' }),
});

export async function handleScheduleEmails(req: Request, res: Response) {
  try {
    const parseResult = scheduleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const userId = req.user!.id;
    const senderEmail = req.user!.email;

    const scheduledRecords = await scheduleEmails(userId, senderEmail, parseResult.data);

    res.status(201).json({
      success: true,
      message: `Emails scheduled successfully`,
      count: scheduledRecords.length,
      emails: scheduledRecords,
    });
  } catch (err: any) {
    console.error('[Email Controller] Error scheduling emails:', err.message);
    const statusCode = err.message.includes('Redis is not connected') ? 503 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to schedule emails',
    });
  }
}

export async function handleUpdateScheduleTime(req: Request, res: Response) {
  try {
    const emailId = req.params.id;
    const parseResult = updateTimeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const userId = req.user!.id;
    const updatedEmail = await updateScheduledEmailTime(emailId, userId, parseResult.data.startTime);

    res.json({
      success: true,
      message: 'Successfully updated scheduled email time',
      email: updatedEmail,
    });
  } catch (err: any) {
    console.error('[Email Controller] Error updating scheduled time:', err.message);
    const statusCode = err.message.includes('Redis is not connected') ? 503 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to update scheduled email time',
    });
  }
}

export async function handleGetScheduled(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const emails = await getScheduledEmails(userId);
    res.json({ success: true, emails });
  } catch (err: any) {
    console.error('[Email Controller] Error fetching scheduled emails:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled emails: ' + err.message });
  }
}

export async function handleGetSent(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const emails = await getSentEmails(userId);
    res.json({ success: true, emails });
  } catch (err: any) {
    console.error('[Email Controller] Error fetching sent emails:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch sent emails: ' + err.message });
  }
}

export async function handleSearch(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const queryText = (req.query.q as string) || '';
    const emails = await searchEmails(userId, queryText);
    res.json({ success: true, emails, query: queryText });
  } catch (err: any) {
    console.error('[Email Controller] Error searching emails:', err.message);
    res.status(500).json({ success: false, error: 'Failed to search emails: ' + err.message });
  }
}
