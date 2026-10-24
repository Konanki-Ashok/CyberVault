import { Router } from 'express';
import {
  getSystemStats,
  listUsers,
  updateUserStatus,
  revokeUserSessions,
  listAuditLogs,
  verifyAuditChain,
} from '../controllers/adminController.js';
import { requireAuth, requireRole, requireCsrf } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// Restrict entire admin route tree to authenticated admins
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/stats', getSystemStats);
router.get('/users', listUsers);
router.patch('/users/:userId/status', requireCsrf, updateUserStatus);
router.post('/users/:userId/revoke-sessions', requireCsrf, revokeUserSessions);
router.get('/audit', listAuditLogs);
router.post('/audit/verify', requireCsrf, verifyAuditChain);

export default router;
