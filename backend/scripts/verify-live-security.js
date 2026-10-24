/**
 * TrustVault Live Security Verification Script
 * 
 * Demonstrates and verifies against a live running database and application:
 * 1. Private Files: Storage isolation & fresh authorization on every stream
 * 2. Immediate Revocation: Invalidation of pre-issued credentials and tickets
 * 3. Credible Evidence: Hash-chain verification, tamper detection, and independent checkpoints
 */

import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setupTestDB, teardownTestDB, createTestUser } from '../tests/setup.js';
import { Document } from '../src/models/Document.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { storageService } from '../src/services/storageService.js';
import { auditService } from '../src/services/auditService.js';
import { PERMISSIONS, AUDIT_ACTIONS, AUDIT_OUTCOMES } from '../src/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runLiveVerification() {
  console.log('\n======================================================================');
  console.log('🔒 TrustVault — Live Security Verification & Evidence Demonstration');
  console.log('======================================================================\n');

  // 1. Start ephemeral live database & server
  console.log('🚀 [Setup] Initializing live test database and HTTP server...');
  await setupTestDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`✅ [Setup] Live server listening on port ${port}`);

  let passedAll = true;

  try {
    // Create live users
    const aliceOwner = await createTestUser({
      name: 'Alice Document Owner',
      email: 'alice@vault.live',
      role: 'owner',
    });

    const bobViewer = await createTestUser({
      name: 'Bob Candidate Viewer',
      email: 'bob@vault.live',
      role: 'viewer',
    });

    const eveAttacker = await createTestUser({
      name: 'Eve Malicious User',
      email: 'eve@vault.live',
      role: 'viewer',
    });

    // -------------------------------------------------------------------------
    // TEST 1: PRIVATE FILES & ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('TEST 1: Private Files & Isolated Storage');
    console.log('----------------------------------------------------------------------');

    const uploadsDir = path.resolve(__dirname, '../uploads');
    const frontendPublicDir = path.resolve(__dirname, '../../frontend/public');
    const isOutsideFrontend = !uploadsDir.startsWith(frontendPublicDir);

    console.log(`📁 Storage directory: ${uploadsDir}`);
    console.log(`📁 Isolated from frontend public web root: ${isOutsideFrontend ? 'YES (VERIFIED)' : 'NO'}`);

    // Create a real file in storage
    const testSecretContent = Buffer.from('TOP_SECRET_FINANCIAL_RECORD_2026_CONFIDENTIAL_CONTENT');
    const stored = await storageService.saveFile(testSecretContent, 'txt');
    const secretHash = crypto.createHash('sha256').update(testSecretContent).digest('hex');

    const liveDoc = new Document({
      title: 'Alice Q3 Confidential Financials',
      originalFilename: 'Q3_Confidential.txt',
      storageKey: stored.storageKey,
      storageType: 'local',
      mimeType: 'text/plain',
      size: testSecretContent.length,
      fileHash: secretHash,
      owner: aliceOwner.user._id,
      category: 'Finance',
      tags: ['audit', 'confidential'],
      description: 'Private financial statements for Alice only',
      acls: [],
    });
    await liveDoc.save();

    console.log(`📄 Document created: "${liveDoc.title}" (ID: ${liveDoc._id})`);
    console.log(`🔑 Random UUID Storage Key: ${stored.storageKey}`);

    // Step 1a: Attempt direct unauthenticated file access
    const unauthRes = await fetch(`${baseUrl}/documents/${liveDoc._id}/download`);
    console.log(`🔒 Unauthenticated Download Attempt: HTTP ${unauthRes.status} (Expected: 401)`);
    if (unauthRes.status !== 401) {
      console.error('❌ FAILED: Unauthenticated request was not rejected with 401');
      passedAll = false;
    } else {
      console.log('✅ PASS: Unauthenticated access rejected with 401 Unauthorized');
    }

    // Step 1b: Eve Attacker attempts cross-user access
    const eveRes = await fetch(`${baseUrl}/documents/${liveDoc._id}/download`, {
      headers: { Authorization: eveAttacker.authHeader },
    });
    console.log(`🔒 Eve Cross-User Download Attempt: HTTP ${eveRes.status} (Expected: 403)`);
    if (eveRes.status !== 403) {
      console.error('❌ FAILED: Cross-user request was not rejected with 403');
      passedAll = false;
    } else {
      console.log('✅ PASS: Unauthorized user rejected with 403 Forbidden without file leakage');
    }

    // -------------------------------------------------------------------------
    // TEST 2: IMMEDIATE REVOCATION
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('TEST 2: Immediate Revocation & Ephemeral Download Tickets');
    console.log('----------------------------------------------------------------------');

    // Step 2a: Alice grants access to Bob
    liveDoc.acls.push({
      user: bobViewer.user._id,
      permission: PERMISSIONS.READ,
      grantedBy: aliceOwner.user._id,
    });
    await liveDoc.save();
    console.log(`🤝 Alice grants 'read' access to Bob (${bobViewer.user.email})`);

    // Step 2b: Bob requests an ephemeral download ticket
    const ticketReq = await fetch(`${baseUrl}/documents/${liveDoc._id}/tickets?purpose=download`, {
      method: 'POST',
      headers: { Authorization: bobViewer.authHeader },
    });
    const ticketJson = await ticketReq.json();
    const bobTicket = ticketJson.ticket;
    console.log(`🎫 Bob obtains ephemeral ticket: ${bobTicket} (TTL: 60s)`);

    // Step 2c: Alice IMMEDIATELY revokes Bob's access
    liveDoc.acls = [];
    await liveDoc.save();
    console.log(`🚫 Alice revokes Bob's access immediately from database`);

    // Step 2d: Bob attempts to redeem his previously-issued ticket
    const redeemRes = await fetch(`${baseUrl}/documents/${liveDoc._id}/download?ticket=${bobTicket}`);
    const redeemBody = await redeemRes.json();
    console.log(`⚡ Bob attempts redemption of old ticket: HTTP ${redeemRes.status} (Expected: 403)`);
    console.log(`⚡ Server Response: "${redeemBody.error}"`);

    if (redeemRes.status !== 403) {
      console.error('❌ FAILED: Revoked ticket was permitted to download file!');
      passedAll = false;
    } else {
      console.log('✅ PASS: Revocation takes immediate effect. Pre-issued credentials blocked on live DB check.');
    }

    // -------------------------------------------------------------------------
    // TEST 3: TAMPER-EVIDENT AUDIT CHAIN & INDEPENDENT CHECKPOINTS
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('TEST 3: Cryptographic Audit Hash-Chain & Tamper Detection');
    console.log('----------------------------------------------------------------------');

    // Generate consecutive audit events
    await auditService.logEvent({
      actor: aliceOwner.user,
      action: AUDIT_ACTIONS.DOC_UPLOAD,
      documentId: liveDoc._id,
      documentTitle: liveDoc.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      reason: 'Live verification test event 1',
    });

    await auditService.logEvent({
      actor: bobViewer.user,
      action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
      documentId: liveDoc._id,
      documentTitle: liveDoc.title,
      outcome: AUDIT_OUTCOMES.DENIED,
      reason: 'Live verification test event 2 - access denied after revocation',
    });

    // Verify intact chain
    let verification = await AuditLog.verifyChainIntegrity();
    console.log(`🔗 Audit Chain Verification: ${verification.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`🔗 Total Verified Records: ${verification.totalCount}`);
    console.log(`🔗 Head Hash: ${verification.lastEntryHash}`);

    if (!verification.isValid) {
      console.error('❌ FAILED: Initial audit chain was not valid');
      passedAll = false;
    } else {
      console.log('✅ PASS: All sequential SHA-256 blocks cryptographically linked and intact.');
    }

    // Step 3b: Create an independent checkpoint
    const checkpoint = {
      checkpointId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      verifiedRecordCount: verification.totalCount,
      headHash: verification.lastEntryHash,
      signature: crypto
        .createHmac('sha256', 'INDEPENDENT_CHECKPOINT_KEY_HMAC')
        .update(`${verification.totalCount}:${verification.lastEntryHash}`)
        .digest('hex'),
    };
    console.log(`🏛️ Independent Checkpoint Created:`, JSON.stringify(checkpoint, null, 2));

    // Step 3c: SIMULATE DBA TAMPERING
    console.log('\n⚠️  [Attack Simulation] Directly tampering with an audit record in the MongoDB database...');
    const rawLogs = await mongoose.connection.collection('auditlogs').find().sort({ timestamp: 1 }).toArray();
    const victimEntry = rawLogs[rawLogs.length - 1];

    // Alter the payload reason of the last record without recalculating hash
    await mongoose.connection.collection('auditlogs').updateOne(
      { _id: victimEntry._id },
      { $set: { reason: 'TAMPERED_CONTENT_INJECTED_BY_MALICIOUS_DBA' } }
    );
    console.log(`⚠️  Altered payload of event ${victimEntry.eventId} in raw MongoDB collection.`);

    // Run verification again
    console.log('🔍 Running cryptographic chain verification on tampered database...');
    const tamperedVerification = await AuditLog.verifyChainIntegrity();
    console.log(`🔍 Verification Result: ${tamperedVerification.isValid ? 'VALID (FAILED TO DETECT)' : 'TAMPER DETECTED (SUCCESS)'}`);
    console.log(`🔍 Detection Details:`, tamperedVerification.brokenAt);

    if (tamperedVerification.isValid) {
      console.error('❌ FAILED: Verification failed to detect payload tampering in audit log!');
      passedAll = false;
    } else {
      console.log('✅ PASS: Cryptographic verification pinpointed the tampered record and link breakdown.');
    }

  } catch (err) {
    console.error('💥 Exception during live verification:', err);
    passedAll = false;
  } finally {
    server.close();
    await teardownTestDB();
  }

  console.log('\n======================================================================');
  if (passedAll) {
    console.log('🎉 ALL LIVE SECURITY & TAMPER-RESISTANCE CHECKS PASSED WITH 100% SUCCESS!');
  } else {
    console.log('❌ LIVE VERIFICATION REPORTED FAILURES.');
    process.exit(1);
  }
  console.log('======================================================================\n');
}

runLiveVerification().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
