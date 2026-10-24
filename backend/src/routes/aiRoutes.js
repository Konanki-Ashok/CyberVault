import { Router } from 'express';
import { getRecommendations, recordDecision } from '../controllers/aiController.js';
import { requireAuth, requireCsrf } from '../middleware/authMiddleware.js';
import {
  requireDocumentAccess,
  requireDocumentOwner,
} from '../middleware/documentAuthMiddleware.js';
import { PERMISSIONS } from '../constants/index.js';

const router = Router();

router.post(
  '/documents/:id/recommendations',
  requireAuth,
  requireDocumentAccess(PERMISSIONS.READ),
  requireDocumentOwner,
  getRecommendations
);

router.post(
  '/documents/:id/decisions',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.READ),
  requireDocumentOwner,
  recordDecision
);

export default router;
