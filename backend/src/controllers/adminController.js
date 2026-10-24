import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Session } from '../models/Session.js';
import { AuditLog } from '../models/AuditLog.js';
import { auditService } from '../services/auditService.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, USER_STATUS } from '../constants/index.js';
import { updateUserStatusSchema } from '../utils/validators.js';

export async function getSystemStats(req, res, next) {
  try {
    const [totalUsers, totalDocs, totalAuditLogs, deniedAttempts, activeSessions] =
      await Promise.all([
        User.countDocuments(),
        Document.countDocuments({ isDeleted: false }),
        AuditLog.countDocuments(),
        AuditLog.countDocuments({ outcome: AUDIT_OUTCOMES.DENIED }),
        Session.countDocuments({ isValid: true, expiresAt: { $gt: new Date() } }),
      ]);

    // Aggregate category distribution
    const categoryStats = await Document.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 }, totalSize: { $sum: '$size' } } },
    ]);

    // Aggregate recent 24h event counts
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivityCount = await AuditLog.countDocuments({ timestamp: { $gte: past24h } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalDocs,
        totalAuditLogs,
        deniedAttempts,
        activeSessions,
        recentActivityCount,
        categoryStats,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await User.find()
      .select('name email role status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    // Get document count per user
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const docCount = await Document.countDocuments({ owner: u._id, isDeleted: false });
        const sessionCount = await Session.countDocuments({
          userId: u._id,
          isValid: true,
          expiresAt: { $gt: new Date() },
        });
        return {
          ...u,
          documentsCount: docCount,
          activeSessionsCount: sessionCount,
        };
      })
    );

    res.json({
      success: true,
      users: usersWithStats,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;
    const validated = updateUserStatusSchema.parse(req.body);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    // Prevent admin from disabling themselves
    if (user._id.toString() === req.user._id.toString() && validated.status === USER_STATUS.DISABLED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot disable your own administrative account.',
      });
    }

    const oldStatus = user.status;
    user.status = validated.status;
    await user.save();

    // If disabling account, immediately invalidate all active sessions!
    if (validated.status === USER_STATUS.DISABLED) {
      await Session.updateMany({ userId: user._id }, { isValid: false });
    }

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
      targetUserId: user._id,
      targetUserEmail: user.email,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        oldStatus,
        newStatus: user.status,
      },
    });

    res.json({
      success: true,
      message: `User account status updated to ${user.status}. All active sessions invalidated if disabled.`,
      user: {
        id: user._id,
        email: user.email,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeUserSessions(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    const result = await Session.updateMany({ userId: user._id, isValid: true }, { isValid: false });

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      targetUserId: user._id,
      targetUserEmail: user.email,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: { revokedCount: result.modifiedCount },
    });

    res.json({
      success: true,
      message: `Revoked ${result.modifiedCount} active session(s) for user ${user.email}.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogs(req, res, next) {
  try {
    const {
      action,
      outcome,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (action) query.action = action;
    if (outcome) query.outcome = outcome;

    if (search && search.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [
        { actorEmail: reg },
        { targetUserEmail: reg },
        { documentTitle: reg },
        { reason: reg },
        { eventId: reg },
      ];
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyAuditChain(req, res, next) {
  try {
    const verification = await auditService.verifyChain();

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.AUDIT_VERIFY,
      outcome: verification.isValid ? AUDIT_OUTCOMES.SUCCESS : AUDIT_OUTCOMES.FAILED,
      reason: verification.message,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        totalVerified: verification.verifiedCount,
        chainValid: verification.isValid,
      },
    });

    res.json({
      success: true,
      verification,
    });
  } catch (err) {
    next(err);
  }
}
