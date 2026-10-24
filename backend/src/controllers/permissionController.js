import { User } from '../models/User.js';
import { auditService } from '../services/auditService.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, USER_STATUS, PERMISSIONS } from '../constants/index.js';
import { grantPermissionSchema } from '../utils/validators.js';

export async function grantAccess(req, res, next) {
  try {
    const validated = grantPermissionSchema.parse(req.body);
    const doc = req.document; // verified owner via requireDocumentOwner

    // 1. Look up target user
    const targetUser = await User.findOne({ email: validated.email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found. Can only share with registered users.',
      });
    }

    // 2. Prevent sharing with disabled accounts
    if (targetUser.status === USER_STATUS.DISABLED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot share documents with a disabled user account.',
      });
    }

    // 3. Prevent sharing with self (document owner already has full access)
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You are the document owner and already have full access.',
      });
    }

    // 4. Update or add ACL grant
    const existingIndex = doc.acls.findIndex(
      (a) => a.user.toString() === targetUser._id.toString()
    );

    if (existingIndex > -1) {
      doc.acls[existingIndex].permission = validated.permission;
      doc.acls[existingIndex].grantedBy = req.user._id;
      doc.acls[existingIndex].grantedAt = new Date();
    } else {
      doc.acls.push({
        user: targetUser._id,
        permission: validated.permission,
        grantedBy: req.user._id,
        grantedAt: new Date(),
      });
    }

    await doc.save();

    // 5. Log audit event
    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.ACL_GRANT,
      documentId: doc._id,
      documentTitle: doc.title,
      targetUserId: targetUser._id,
      targetUserEmail: targetUser.email,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        permission: validated.permission,
      },
    });

    res.json({
      success: true,
      message: `Access granted (${validated.permission}) to ${targetUser.email}.`,
      grant: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
        },
        permission: validated.permission,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeAccess(req, res, next) {
  try {
    const { targetUserId } = req.params;
    const doc = req.document; // verified owner

    const targetUser = await User.findById(targetUserId);
    const existingIndex = doc.acls.findIndex(
      (a) => a.user.toString() === targetUserId.toString()
    );

    if (existingIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Specified user does not have an active grant on this document.',
      });
    }

    const previousGrant = doc.acls[existingIndex];
    doc.acls.splice(existingIndex, 1);
    await doc.save();

    // Log revocation to audit trail
    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.ACL_REVOKE,
      documentId: doc._id,
      documentTitle: doc.title,
      targetUserId: targetUser ? targetUser._id : targetUserId,
      targetUserEmail: targetUser ? targetUser.email : 'UNKNOWN',
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        revokedPermission: previousGrant.permission,
      },
    });

    res.json({
      success: true,
      message: 'Access grant revoked successfully. Subsequent access attempts will be blocked immediately.',
    });
  } catch (err) {
    next(err);
  }
}

export async function listGrants(req, res, next) {
  try {
    const doc = await req.document.populate('acls.user', 'name email role status');
    res.json({
      success: true,
      acls: doc.acls,
    });
  } catch (err) {
    next(err);
  }
}
