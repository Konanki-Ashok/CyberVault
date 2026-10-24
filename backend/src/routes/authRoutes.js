import { Router } from 'express';
import {
  register,
  login,
  firebaseLogin,
  logout,
  getCurrentUser,
  listActiveSessions,
  revokeSession,
} from '../controllers/authController.js';
import { requireAuth, requireCsrf } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/firebase-login', authLimiter, firebaseLogin);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getCurrentUser);
router.get('/sessions', requireAuth, listActiveSessions);
router.delete('/sessions/:sessionId', requireAuth, requireCsrf, revokeSession);

export default router;
