import { Router } from 'express';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  updateMetadata,
  createDownloadTicket,
  downloadDocument,
  previewDocument,
  deleteDocument,
} from '../controllers/documentController.js';
import {
  grantAccess,
  revokeAccess,
  listGrants,
} from '../controllers/permissionController.js';
import { requireAuth, requireCsrf } from '../middleware/authMiddleware.js';
import {
  requireDocumentAccess,
  requireDocumentOwner,
} from '../middleware/documentAuthMiddleware.js';
import { upload, validateUploadedFile } from '../middleware/fileUpload.js';
import { PERMISSIONS } from '../constants/index.js';
import { TokenService } from '../services/tokenService.js';
import { User } from '../models/User.js';

const router = Router();

// Dynamic middleware for download/preview: ticket-based or session-based
const ticketOrAuthRead = async (req, res, next) => {
  // If credentials are provided on a ticket request, populate req.user for identity validation
  let token = null;
  if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = TokenService.verifyAccessToken(token);
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId).lean();
        if (user) req.user = user;
      }
    } catch {}
  }

  if (req.query.ticket) {
    return next();
  }

  return requireAuth(req, res, () => {
    return requireDocumentAccess(PERMISSIONS.READ)(req, res, next);
  });
};

// Document CRUD & Listing
router.post(
  '/',
  requireAuth,
  requireCsrf,
  upload.single('file'),
  validateUploadedFile,
  uploadDocument
);

router.get('/', requireAuth, listDocuments);

router.get('/:id', requireAuth, requireDocumentAccess(PERMISSIONS.READ), getDocument);

router.patch(
  '/:id',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.EDIT),
  updateMetadata
);

router.delete(
  '/:id',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.READ),
  requireDocumentOwner,
  deleteDocument
);

// Secure Download Tickets & File Streaming
router.post(
  '/:id/tickets',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.READ),
  createDownloadTicket
);

router.get('/:id/download', ticketOrAuthRead, downloadDocument);
router.get('/:id/preview', ticketOrAuthRead, previewDocument);

// Document Access Control List (ACL) Permissions
router.get(
  '/:id/permissions',
  requireAuth,
  requireDocumentAccess(PERMISSIONS.READ),
  listGrants
);

router.post(
  '/:id/permissions',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.READ),
  requireDocumentOwner,
  grantAccess
);

router.delete(
  '/:id/permissions/:targetUserId',
  requireAuth,
  requireCsrf,
  requireDocumentAccess(PERMISSIONS.READ),
  requireDocumentOwner,
  revokeAccess
);

export default router;
