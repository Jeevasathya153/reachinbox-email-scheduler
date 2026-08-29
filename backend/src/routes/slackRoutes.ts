import { Router } from 'express';
import {
  handleSlackConnect,
  handleSlackCallback,
  handleSlackDisconnect,
  getSlackStatus,
} from '../controllers/slackController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/api/slack/connect', requireAuth, handleSlackConnect);
router.get('/api/slack/callback', handleSlackCallback);
router.post('/api/slack/disconnect', requireAuth, handleSlackDisconnect);
router.get('/api/slack/status', requireAuth, getSlackStatus);

export default router;
