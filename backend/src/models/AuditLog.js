import mongoose from 'mongoose';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '../constants/index.js';
import { calculateEntryHash, createCanonicalPayload, GENESIS_HASH } from '../utils/hashChain.js';

const AuditLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      default: 'ANONYMOUS',
    },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true,
    },
    documentTitle: {
      type: String,
      default: null,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetUserEmail: {
      type: String,
      default: null,
    },
    outcome: {
      type: String,
      enum: Object.values(AUDIT_OUTCOMES),
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: '',
    },
    correlationId: {
      type: String,
      default: '',
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    prevHash: {
      type: String,
      required: true,
    },
    entryHash: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Prevent modification or deletion at the Mongoose / Application level
const disallowMutation = function (next) {
  const err = new Error('Tamper-evident audit logs are immutable and cannot be updated or deleted.');
  err.statusCode = 403;
  next(err);
};

AuditLogSchema.pre('updateOne', disallowMutation);
AuditLogSchema.pre('updateMany', disallowMutation);
AuditLogSchema.pre('findOneAndUpdate', disallowMutation);
AuditLogSchema.pre('deleteOne', disallowMutation);
AuditLogSchema.pre('deleteMany', disallowMutation);
AuditLogSchema.pre('findOneAndDelete', disallowMutation);
AuditLogSchema.pre('findOneAndRemove', disallowMutation);

/**
 * Verify chain integrity for the whole audit collection or a range
 */
AuditLogSchema.statics.verifyChainIntegrity = async function () {
  const logs = await this.find().sort({ timestamp: 1, _id: 1 }).lean();
  
  if (logs.length === 0) {
    return {
      isValid: true,
      totalCount: 0,
      brokenAt: null,
      message: 'Audit chain is empty.',
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    // 1. Verify prevHash link
    if (entry.prevHash !== expectedPrevHash) {
      return {
        isValid: false,
        totalCount: logs.length,
        verifiedCount: i,
        brokenAt: {
          index: i,
          eventId: entry.eventId,
          expectedPrevHash,
          actualPrevHash: entry.prevHash,
          reason: 'Broken link to previous event hash (possible record deletion, insertion, or reordering)',
        },
        message: `Audit chain verification failed at record index ${i}: hash link mismatch`,
      };
    }

    // 2. Recompute and verify entryHash
    const canonicalPayload = createCanonicalPayload(entry);
    const computedHash = calculateEntryHash(canonicalPayload, entry.prevHash);

    if (computedHash !== entry.entryHash) {
      return {
        isValid: false,
        totalCount: logs.length,
        verifiedCount: i,
        brokenAt: {
          index: i,
          eventId: entry.eventId,
          expectedEntryHash: computedHash,
          actualEntryHash: entry.entryHash,
          reason: 'Payload modification detected (record content was tampered with)',
        },
        message: `Audit chain verification failed at record index ${i}: payload tamper detected`,
      };
    }

    expectedPrevHash = entry.entryHash;
  }

  return {
    isValid: true,
    totalCount: logs.length,
    verifiedCount: logs.length,
    lastEntryHash: expectedPrevHash,
    message: `Audit chain verified successfully across ${logs.length} records.`,
  };
};

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
