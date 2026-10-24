import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../models/AuditLog.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '../constants/index.js';
import { calculateEntryHash, createCanonicalPayload, GENESIS_HASH } from '../utils/hashChain.js';

class AuditService {
  constructor() {
    this._writeLock = Promise.resolve();
  }

  /**
   * Appends an audit event to the hash chain.
   * Uses an in-process serial execution chain to avoid race conditions when multiple
   * simultaneous requests append to the audit log.
   */
  async logEvent({
    actor = null,
    actorEmail = 'ANONYMOUS',
    action,
    documentId = null,
    documentTitle = null,
    targetUserId = null,
    targetUserEmail = null,
    outcome = AUDIT_OUTCOMES.SUCCESS,
    reason = '',
    correlationId = '',
    ipAddress = 'Unknown',
    userAgent = 'Unknown',
    metadata = {},
  }) {
    // Chain sequentially to guarantee unbroken hash links in high concurrency
    const executeWrite = async () => {
      try {
        const eventId = uuidv4();
        const timestamp = new Date();

        // 1. Fetch latest audit log entry to get prevHash
        const lastEntry = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 }).lean();
        const prevHash = lastEntry ? lastEntry.entryHash : GENESIS_HASH;

        // 2. Build sanitized metadata without passwords, tokens, or secret keys
        const cleanMetadata = this._sanitizeMetadata(metadata);

        // 3. Compute canonical representation & hash
        const canonicalData = {
          eventId,
          timestamp,
          actor: actor ? String(actor._id || actor) : 'SYSTEM',
          action,
          documentId: documentId ? String(documentId) : null,
          targetUserId: targetUserId ? String(targetUserId) : null,
          outcome,
          reason,
          correlationId,
          metadata: cleanMetadata,
        };

        const canonicalPayload = createCanonicalPayload(canonicalData);
        const entryHash = calculateEntryHash(canonicalPayload, prevHash);

        // 4. Save audit log record
        const logDoc = new AuditLog({
          eventId,
          timestamp,
          actor: actor ? (actor._id || actor) : null,
          actorEmail: actorEmail || (actor?.email || 'ANONYMOUS'),
          action,
          documentId,
          documentTitle,
          targetUserId,
          targetUserEmail,
          outcome,
          reason,
          correlationId,
          ipAddress,
          userAgent,
          metadata: cleanMetadata,
          prevHash,
          entryHash,
        });

        await logDoc.save();
        return logDoc;
      } catch (err) {
        console.error('[AuditService] Critical failure logging audit event:', err);
        // Requirement 6: Ensure audit failures cannot silently turn a protected operation into an unaudited success
        throw new Error(`Audit logging failed: ${err.message}`);
      }
    };

    // Queue sequentially behind the lock
    this._writeLock = this._writeLock.then(executeWrite, executeWrite);
    return this._writeLock;
  }

  /**
   * Redacts sensitive fields from metadata
   */
  _sanitizeMetadata(meta) {
    if (!meta || typeof meta !== 'object') return {};
    const sanitized = { ...meta };
    const forbiddenKeys = [
      'password',
      'passwordHash',
      'candidatePassword',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'cookie',
      'authorization',
      'fileBuffer',
      'content',
    ];

    for (const key of Object.keys(sanitized)) {
      if (forbiddenKeys.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        delete sanitized[key];
      }
    }
    return sanitized;
  }

  /**
   * Run verification check across the chain
   */
  async verifyChain() {
    return AuditLog.verifyChainIntegrity();
  }
}

export const auditService = new AuditService();
