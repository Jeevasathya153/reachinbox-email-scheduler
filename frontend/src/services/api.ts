import axios from 'axios';
import { User, EmailRecord, ScheduleRequest, SlackStatus } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  withCredentials: true,
});

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await api.get('/api/auth/me');
    if (res.data && res.data.success && res.data.user) {
      return res.data.user;
    }
    return res.data.user || null;
  } catch (err) {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch (e) {
    await api.post('/auth/logout');
  }
}

export async function scheduleEmailsApi(request: ScheduleRequest): Promise<{ count: number; emails: EmailRecord[] }> {
  const res = await api.post('/api/emails/schedule', request);
  return res.data;
}

export async function updateScheduledEmailTimeApi(emailId: string, startTime: string): Promise<EmailRecord> {
  const res = await api.put(`/api/emails/${emailId}/schedule`, { startTime });
  return res.data.email;
}

export async function getScheduledEmailsApi(): Promise<EmailRecord[]> {
  const res = await api.get('/api/emails/scheduled');
  return res.data.emails;
}

export async function getSentEmailsApi(): Promise<EmailRecord[]> {
  const res = await api.get('/api/emails/sent');
  return res.data.emails;
}

export async function searchEmailsApi(query: string): Promise<EmailRecord[]> {
  const res = await api.get(`/api/emails/search?q=${encodeURIComponent(query)}`);
  return res.data.emails;
}

export async function getSlackStatusApi(): Promise<SlackStatus> {
  const res = await api.get('/api/slack/status');
  return res.data;
}

export async function disconnectSlackApi(): Promise<void> {
  await api.post('/api/slack/disconnect');
}

export default api;
