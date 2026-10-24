import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { User } from '../src/models/User.js';
import { Document } from '../src/models/Document.js';
import { Session } from '../src/models/Session.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { DownloadTicket } from '../src/models/DownloadTicket.js';
import { storageService } from '../src/services/storageService.js';
import { auditService } from '../src/services/auditService.js';
import { ROLES, USER_STATUS, AUDIT_ACTIONS, AUDIT_OUTCOMES, PERMISSIONS } from '../src/constants/index.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSeed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Clearing existing collections...');
  await User.deleteMany({});
  await Document.deleteMany({});
  await Session.deleteMany({});
  await DownloadTicket.deleteMany({});
  
  // Directly drop audit collection for clean seed initialization
  try {
    await mongoose.connection.collection('auditlogs').drop();
  } catch {
    // Ignore if collection didn't exist
  }

  console.log('[Seed] Creating demo users...');
  const usersToCreate = [
    {
      name: 'Security Admin',
      email: 'admin@trustvault.local',
      password: 'Admin@TrustVault2026!',
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
    },
    {
      name: 'Alice Document Owner',
      email: 'owner@trustvault.local',
      password: 'Owner@TrustVault2026!',
      role: ROLES.OWNER,
      status: USER_STATUS.ACTIVE,
    },
    {
      name: 'Bob Secure Viewer',
      email: 'viewer@trustvault.local',
      password: 'Viewer@TrustVault2026!',
      role: ROLES.VIEWER,
      status: USER_STATUS.ACTIVE,
    },
    {
      name: 'Charlie Collaborator',
      email: 'collaborator@trustvault.local',
      password: 'Collab@TrustVault2026!',
      role: ROLES.OWNER,
      status: USER_STATUS.ACTIVE,
    },
    {
      name: 'Dave Suspended User',
      email: 'disabled@trustvault.local',
      password: 'Disabled@TrustVault2026!',
      role: ROLES.VIEWER,
      status: USER_STATUS.DISABLED,
    },
  ];

  const createdUsers = {};
  for (const u of usersToCreate) {
    const passwordHash = await User.hashPassword(u.password);
    const user = new User({
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      status: u.status,
    });
    await user.save();
    createdUsers[u.email] = user;

    await auditService.logEvent({
      actor: user,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.AUTH_REGISTER,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      reason: 'Demo user initialized via seed',
      metadata: { role: user.role, status: user.status },
    });
  }

  console.log('[Seed] Uploading sample documents...');
  const owner = createdUsers['owner@trustvault.local'];
  const viewer = createdUsers['viewer@trustvault.local'];
  const collaborator = createdUsers['collaborator@trustvault.local'];

  // 1. PDF File: Q3 Financial Audit
  const pdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 18 Tf 50 700 Td (TrustVault Confidential Q3 Audit) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000201 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n308\n%%EOF'
  );
  const pdfStorage = await storageService.saveFile(pdfBuffer, 'pdf');
  const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  const doc1 = new Document({
    title: 'Q3 Financial Audit & Balance Sheet',
    originalFilename: 'Q3_Financial_Audit.pdf',
    storageKey: pdfStorage.storageKey,
    storageType: pdfStorage.storageType,
    mimeType: 'application/pdf',
    size: pdfBuffer.length,
    fileHash: pdfHash,
    owner: owner._id,
    category: 'Finance',
    tags: ['audit', 'q3', 'confidential', 'balance-sheet'],
    description: 'Quarterly financial statements, balance sheet audit, and independent auditor verification.',
    acls: [],
  });
  await doc1.save();

  await auditService.logEvent({
    actor: owner,
    actorEmail: owner.email,
    action: AUDIT_ACTIONS.DOC_UPLOAD,
    documentId: doc1._id,
    documentTitle: doc1.title,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    metadata: { category: doc1.category, size: doc1.size },
  });

  // 2. Text File: Architecture Spec (Shared with Collaborator with 'edit' grant)
  const txtContent = Buffer.from(
    'TRUSTVAULT SYSTEM ARCHITECTURE v2.0\n\n1. Cryptographic Hash-Chained Audit Trail\n2. Dual-Layer Access Control (Owner + Named ACLs)\n3. Ephemeral Single-Use Download Tickets\n4. Strict Server-side Magic Byte Inspection\n'
  );
  const txtStorage = await storageService.saveFile(txtContent, 'txt');
  const txtHash = crypto.createHash('sha256').update(txtContent).digest('hex');

  const doc2 = new Document({
    title: 'TrustVault System Security Architecture v2',
    originalFilename: 'Security_Architecture_v2.txt',
    storageKey: txtStorage.storageKey,
    storageType: txtStorage.storageType,
    mimeType: 'text/plain',
    size: txtContent.length,
    fileHash: txtHash,
    owner: owner._id,
    category: 'Engineering',
    tags: ['architecture', 'security', 'spec', 'rfc'],
    description: 'Detailed cryptographic verification model and tamper-evident audit specification.',
    acls: [
      {
        user: collaborator._id,
        permission: PERMISSIONS.EDIT,
        grantedBy: owner._id,
        grantedAt: new Date(),
      },
    ],
  });
  await doc2.save();

  await auditService.logEvent({
    actor: owner,
    actorEmail: owner.email,
    action: AUDIT_ACTIONS.DOC_UPLOAD,
    documentId: doc2._id,
    documentTitle: doc2.title,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    metadata: { category: doc2.category, size: doc2.size },
  });

  await auditService.logEvent({
    actor: owner,
    actorEmail: owner.email,
    action: AUDIT_ACTIONS.ACL_GRANT,
    documentId: doc2._id,
    documentTitle: doc2.title,
    targetUserId: collaborator._id,
    targetUserEmail: collaborator.email,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    metadata: { permission: PERMISSIONS.EDIT },
  });

  // 3. Document shared with Viewer with 'read' grant
  const ndaContent = Buffer.from(
    'MUTUAL NON-DISCLOSURE AGREEMENT (NDA)\n\nThis agreement protects proprietary and confidential technical specifications exchanged between the parties.'
  );
  const ndaStorage = await storageService.saveFile(ndaContent, 'txt');
  const ndaHash = crypto.createHash('sha256').update(ndaContent).digest('hex');

  const doc3 = new Document({
    title: 'Standard Mutual Non-Disclosure Agreement (NDA)',
    originalFilename: 'Mutual_NDA_Standard.txt',
    storageKey: ndaStorage.storageKey,
    storageType: ndaStorage.storageType,
    mimeType: 'text/plain',
    size: ndaContent.length,
    fileHash: ndaHash,
    owner: owner._id,
    category: 'Legal',
    tags: ['legal', 'nda', 'contracts'],
    description: 'Standard boilerplate reciprocal non-disclosure agreement for external contractors and vendors.',
    acls: [
      {
        user: viewer._id,
        permission: PERMISSIONS.READ,
        grantedBy: owner._id,
        grantedAt: new Date(),
      },
    ],
  });
  await doc3.save();

  await auditService.logEvent({
    actor: owner,
    actorEmail: owner.email,
    action: AUDIT_ACTIONS.DOC_UPLOAD,
    documentId: doc3._id,
    documentTitle: doc3.title,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    metadata: { category: doc3.category, size: doc3.size },
  });

  await auditService.logEvent({
    actor: owner,
    actorEmail: owner.email,
    action: AUDIT_ACTIONS.ACL_GRANT,
    documentId: doc3._id,
    documentTitle: doc3.title,
    targetUserId: viewer._id,
    targetUserEmail: viewer.email,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    metadata: { permission: PERMISSIONS.READ },
  });

  // Verify the generated audit chain immediately
  console.log('[Seed] Verifying seeded audit chain integrity...');
  const verification = await auditService.verifyChain();
  console.log(`[Seed] Audit chain status: ${verification.isValid ? 'VALID' : 'INVALID'} (${verification.verifiedCount} events)`);

  console.log('----------------------------------------------------');
  console.log('✅ TrustVault Database Seed Complete!');
  console.log('Demo Credentials:');
  console.log('  Admin:        admin@trustvault.local         / Admin@TrustVault2026!');
  console.log('  Owner:        owner@trustvault.local         / Owner@TrustVault2026!');
  console.log('  Viewer:       viewer@trustvault.local        / Viewer@TrustVault2026!');
  console.log('  Collaborator: collaborator@trustvault.local  / Collab@TrustVault2026!');
  console.log('  Disabled:     disabled@trustvault.local      / Disabled@TrustVault2026!');
  console.log('----------------------------------------------------');
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(() => disconnectDB())
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
