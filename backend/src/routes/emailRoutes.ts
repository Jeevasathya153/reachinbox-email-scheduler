import { Router } from 'express';
import {
  handleScheduleEmails,
  handleGetScheduled,
  handleGetSent,
  handleSearch,
  handleUpdateScheduleTime,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/api/emails/schedule', requireAuth, handleScheduleEmails);
router.put('/api/emails/:id/schedule', requireAuth, handleUpdateScheduleTime);
router.get('/api/emails/scheduled', requireAuth, handleGetScheduled);
router.get('/api/emails/sent', requireAuth, handleGetSent);
router.get('/api/emails/search', requireAuth, handleSearch);

export default router;
