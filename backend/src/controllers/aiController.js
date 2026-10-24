import { aiService } from '../services/aiService.js';
import { auditService } from '../services/auditService.js';
import { User } from '../models/User.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, PERMISSIONS } from '../constants/index.js';
import { aiRecommendSchema, aiDecisionSchema } from '../utils/validators.js';

export async function getRecommendations(req, res, next) {
  try {
    const validated = aiRecommendSchema.parse(req.body);
    const doc = req.document; // verified owner

    const result = await aiService.recommendRecipients({
      document: doc,
      purpose: validated.purpose || '',
      currentUserId: req.user._id,
    });

    // Log AI recommendation generation in audit trail
    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.AI_RECIPIENT_RECOMMENDATION,
      documentId: doc._id,
      documentTitle: doc.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        engine: result.engine,
        candidateCount: result.recommendations.length,
        purpose: validated.purpose || '',
      },
    });

    res.json({
      success: true,
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function recordDecision(req, res, next) {
  try {
    const validated = aiDecisionSchema.parse(req.body);
    const doc = req.document; // verified owner

    const targetUser = await User.findById(validated.targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found.',
      });
    }

    let grantCreated = false;

    // If accepted, explicitly grant the permission requested by the owner
    if (validated.decision === 'accepted') {
      const permToGrant = validated.permission || PERMISSIONS.READ;

      const existingIndex = doc.acls.findIndex(
        (a) => a.user.toString() === targetUser._id.toString()
      );

      if (existingIndex > -1) {
        doc.acls[existingIndex].permission = permToGrant;
        doc.acls[existingIndex].grantedBy = req.user._id;
        doc.acls[existingIndex].grantedAt = new Date();
      } else {
        doc.acls.push({
          user: targetUser._id,
          permission: permToGrant,
          grantedBy: req.user._id,
          grantedAt: new Date(),
        });
      }

      await doc.save();
      grantCreated = true;
    }

    // Log human review decision in audit trail
    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.AI_RECOMMENDATION_DECISION,
      documentId: doc._id,
      documentTitle: doc.title,
      targetUserId: targetUser._id,
      targetUserEmail: targetUser.email,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        decision: validated.decision,
        grantedPermission: grantCreated ? validated.permission || PERMISSIONS.READ : null,
        reason: validated.reason || '',
      },
    });

    res.json({
      success: true,
      message: `AI recommendation ${validated.decision}.${grantCreated ? ` Access granted (${validated.permission || 'read'}) to ${targetUser.email}.` : ''}`,
      grantCreated,
    });
  } catch (err) {
    next(err);
  }
}
