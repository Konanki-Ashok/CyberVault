import mongoose from 'mongoose';
import { Document } from '../models/Document.js';
import { PERMISSIONS, AUDIT_ACTIONS, AUDIT_OUTCOMES } from '../constants/index.js';
import { auditService } from '../services/auditService.js';

/**
 * Centralized Document Authorization Middleware:
 * Verifies that the authenticated user has the necessary access rights (read or edit)
 * to the requested document.
 * 
 * Rules:
 * 1. Owner always has full access (read, edit, share, delete).
 * 2. Edit permission grant includes read access.
 * 3. Read permission grant allows read only.
 * 4. ADMIN role DOES NOT silently bypass document contents or metadata access.
 *    (Admin must be an owner or explicitly granted access via ACL).
 * 5. Unauthorized access attempts are recorded in the audit trail.
 */
export function requireDocumentAccess(requiredPermission = PERMISSIONS.READ) {
  return async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({
          success: false,
          error: 'Document not found.',
        });
      }

      // Fetch document
      const document = await Document.findOne({ _id: id, isDeleted: false });
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found.',
        });
      }

      const userIdStr = req.user._id.toString();
      const ownerIdStr = document.owner.toString();

      // 1. Is user the owner?
      if (userIdStr === ownerIdStr) {
        req.document = document;
        req.effectivePermission = 'owner';
        return next();
      }

      // 2. Is user granted access in document ACL?
      const userGrant = document.acls.find((acl) => acl.user.toString() === userIdStr);

      if (userGrant) {
        // If required is 'read', both 'read' and 'edit' grants satisfy
        if (requiredPermission === PERMISSIONS.READ) {
          req.document = document;
          req.effectivePermission = userGrant.permission;
          return next();
        }

        // If required is 'edit', only 'edit' grant satisfies
        if (requiredPermission === PERMISSIONS.EDIT && userGrant.permission === PERMISSIONS.EDIT) {
          req.document = document;
          req.effectivePermission = PERMISSIONS.EDIT;
          return next();
        }
      }

      // 3. User does not have permission - log denied access to audit trail!
      await auditService.logEvent({
        actor: req.user,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
        documentId: document._id,
        documentTitle: document.title,
        outcome: AUDIT_OUTCOMES.DENIED,
        reason: `User lacks required '${requiredPermission}' permission on document.`,
        correlationId: req.correlationId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        metadata: {
          requestedPermission: requiredPermission,
          userRole: req.user.role,
        },
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to access this document.',
      });
    } catch (err) {
      console.error('[requireDocumentAccess] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Document authorization error.',
      });
    }
  };
}

/**
 * Enforces that only the document owner can manage permissions or delete the document.
 */
export function requireDocumentOwner(req, res, next) {
  if (!req.document) {
    return res.status(500).json({
      success: false,
      error: 'Authorization error: document not loaded in request context.',
    });
  }

  const userIdStr = req.user._id.toString();
  const ownerIdStr = req.document.owner.toString();

  if (userIdStr !== ownerIdStr) {
    // Audit denied attempt
    auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
      documentId: req.document._id,
      documentTitle: req.document.title,
      outcome: AUDIT_OUTCOMES.DENIED,
      reason: 'Non-owner attempted owner-only operation.',
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        attemptedAction: req.method + ' ' + req.originalUrl,
      },
    }).catch(console.error);

    return res.status(403).json({
      success: false,
      error: 'Access denied: Only the document owner can perform this operation.',
    });
  }

  next();
}

/**
 * Builds the database filter for listing and searching documents.
 * Ensures that users only see documents they own or have explicit ACL grants for.
 * Prevents unauthorized document discovery!
 */
export function getAccessibleDocumentsFilter(user) {
  return {
    isDeleted: false,
    $or: [
      { owner: user._id },
      { 'acls.user': user._id },
    ],
  };
}
