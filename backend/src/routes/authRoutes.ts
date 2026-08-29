import { Router } from 'express';
import {
  handleGoogleLogin,
  handleGoogleCallback,
  getMe,
  handleLogout,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/auth/google', handleGoogleLogin);
router.get('/auth/google/callback', handleGoogleCallback);
router.post('/auth/logout', handleLogout);
router.post('/api/auth/logout', handleLogout);
router.get('/api/auth/me', requireAuth, getMe);

export default router;
