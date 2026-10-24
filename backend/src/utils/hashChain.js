import crypto from 'crypto';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Creates a deterministic canonical representation of the audit event payload
 */
export function createCanonicalPayload(data) {
  const normalized = {
    eventId: data.eventId ? String(data.eventId) : '',
    timestamp: data.timestamp instanceof Date ? data.timestamp.toISOString() : new Date(data.timestamp).toISOString(),
    actor: data.actor ? String(data.actor) : 'SYSTEM',
    action: String(data.action || ''),
    documentId: data.documentId ? String(data.documentId) : null,
    targetUserId: data.targetUserId ? String(data.targetUserId) : null,
    outcome: String(data.outcome || ''),
    reason: String(data.reason || ''),
    correlationId: String(data.correlationId || ''),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  };

  // Sort keys recursively for canonical JSON
  const sortedString = JSON.stringify(normalized, Object.keys(normalized).sort());
  return sortedString;
}

/**
 * Calculates the entry hash given canonical payload and previous entry hash
 */
export function calculateEntryHash(canonicalPayload, prevHash) {
  const hash = crypto.createHash('sha256');
  hash.update(prevHash);
  hash.update(canonicalPayload);
  return hash.digest('hex');
}
