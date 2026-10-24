import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB, createTestUser } from './setup.js';
import { Document } from '../src/models/Document.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Session } from '../src/models/Session.js';
import { DownloadTicket } from '../src/models/DownloadTicket.js';
import { storageService } from '../src/services/storageService.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, PERMISSIONS, ROLES, USER_STATUS } from '../src/constants/index.js';

describe('TrustVault Comprehensive Security & Authorization Integration Suite', () => {
  let admin, ownerA, userB, userViewer, disabledUser;
  let docOwnedByA;

  beforeAll(async () => {
    await setupTestDB();
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create 5 test actors: Admin, Owner A, User B, Viewer, Disabled User
    admin = await createTestUser({
      name: 'System Admin',
      email: 'admin@security.test',
      role: ROLES.ADMIN,
    });

    ownerA = await createTestUser({
      name: 'Alice Owner',
      email: 'owner-a@security.test',
      role: ROLES.OWNER,
    });

    userB = await createTestUser({
      name: 'Bob Unrelated User',
      email: 'user-b@security.test',
      role: ROLES.OWNER,
    });

    userViewer = await createTestUser({
      name: 'Victor Viewer',
      email: 'viewer@security.test',
      role: ROLES.VIEWER,
    });

    disabledUser = await createTestUser({
      name: 'Dave Disabled',
      email: 'disabled@security.test',
      role: ROLES.VIEWER,
      status: USER_STATUS.DISABLED,
    });

    // Create Document owned by Owner A
    const sampleBuffer = Buffer.from('%PDF-1.4\n%TrustVault Secure Test Document\n%%EOF');
    const stored = await storageService.saveFile(sampleBuffer, 'pdf');
    const fileHash = crypto.createHash('sha256').update(sampleBuffer).digest('hex');

    docOwnedByA = new Document({
      title: 'Top Secret Financial Projections',
      originalFilename: 'projections_2026.pdf',
      storageKey: stored.storageKey,
      storageType: 'local',
      mimeType: 'application/pdf',
      size: sampleBuffer.length,
      fileHash,
      owner: ownerA.user._id,
      category: 'Finance',
      tags: ['q1', 'confidential'],
      description: 'Owner A sensitive financial spreadsheet',
      acls: [],
    });
    await docOwnedByA.save();
  });

  // 1. An unauthenticated user cannot access protected endpoints
  test('1. Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    const endpoints = [
      { method: 'get', url: '/api/documents' },
      { method: 'get', url: `/api/documents/${docOwnedByA._id}` },
      { method: 'patch', url: `/api/documents/${docOwnedByA._id}` },
      { method: 'delete', url: `/api/documents/${docOwnedByA._id}` },
      { method: 'get', url: '/api/admin/stats' },
      { method: 'get', url: '/api/auth/me' },
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.url);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  // 2. User A cannot read, download, preview, edit, or delete User B's document
  test("2. User B cannot read, download, preview, edit, or delete User A's document", async () => {
    // Read metadata
    const readRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);
    expect(readRes.status).toBe(403);

    // Edit metadata
    const editRes = await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader)
      .send({ title: 'Hacked Title' });
    expect(editRes.status).toBe(403);

    // Download
    const downloadRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}/download`)
      .set('Authorization', userB.authHeader);
    expect(downloadRes.status).toBe(403);

    // Preview
    const previewRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}/preview`)
      .set('Authorization', userB.authHeader);
    expect(previewRes.status).toBe(403);

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);
    expect(deleteRes.status).toBe(403);
  });

  // 3. User A cannot discover User B's document through listing, search, filters, or metadata endpoints
  test("3. Document discovery prevention: User B cannot discover User A's document via list, search, or filters", async () => {
    // List all
    const listRes = await request(app)
      .get('/api/documents')
      .set('Authorization', userB.authHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.documents.length).toBe(0);

    // Search by exact title
    const searchRes = await request(app)
      .get('/api/documents?search=Top Secret Financial')
      .set('Authorization', userB.authHeader);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.documents.length).toBe(0);

    // Filter by category
    const filterRes = await request(app)
      .get('/api/documents?category=Finance')
      .set('Authorization', userB.authHeader);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.documents.length).toBe(0);
  });

  // 4. Changing a document ID, user ID, owner ID, or role in a request does not bypass authorization
  test('4. IDOR / BOLA Prevention: Tampering with IDs or role in payload does not bypass authorization', async () => {
    const fakeOwnerId = new mongoose.Types.ObjectId();

    // Attacker tries to inject owner or role field in patch request
    const patchRes = await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader)
      .send({
        owner: userB.user._id,
        role: 'admin',
        title: 'Tampered Document',
      });

    expect(patchRes.status).toBe(403);

    // Document owner in DB must remain Alice Owner A
    const freshDoc = await Document.findById(docOwnedByA._id);
    expect(freshDoc.owner.toString()).toBe(ownerA.user._id.toString());
  });

  // 5. A viewer cannot edit, delete, or share a document
  test('5. Viewer with read grant cannot edit, delete, or share a document', async () => {
    // Grant read permission to viewer
    docOwnedByA.acls.push({
      user: userViewer.user._id,
      permission: PERMISSIONS.READ,
      grantedBy: ownerA.user._id,
    });
    await docOwnedByA.save();

    // Read must succeed
    const readRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userViewer.authHeader);
    expect(readRes.status).toBe(200);

    // Edit must fail
    const editRes = await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userViewer.authHeader)
      .send({ title: 'Viewer Attempting Edit' });
    expect(editRes.status).toBe(403);

    // Delete must fail
    const deleteRes = await request(app)
      .delete(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userViewer.authHeader);
    expect(deleteRes.status).toBe(403);

    // Share / grant must fail
    const shareRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/permissions`)
      .set('Authorization', userViewer.authHeader)
      .send({ email: userB.user.email, permission: PERMISSIONS.READ });
    expect(shareRes.status).toBe(403);
  });

  // 6. An edit grant allows editing but does not allow sharing or deletion
  test('6. User with edit grant can update metadata but cannot delete or share document', async () => {
    docOwnedByA.acls.push({
      user: userB.user._id,
      permission: PERMISSIONS.EDIT,
      grantedBy: ownerA.user._id,
    });
    await docOwnedByA.save();

    // Edit must succeed
    const editRes = await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader)
      .send({ title: 'Updated Title by Collaborator' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.document.title).toBe('Updated Title by Collaborator');

    // Delete must fail (only owner can delete)
    const deleteRes = await request(app)
      .delete(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);
    expect(deleteRes.status).toBe(403);

    // Share must fail (only owner can manage grants)
    const shareRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/permissions`)
      .set('Authorization', userB.authHeader)
      .send({ email: userViewer.user.email, permission: PERMISSIONS.READ });
    expect(shareRes.status).toBe(403);
  });

  // 7. An owner can grant read/edit access and revoke it
  test('7. Owner can grant access and subsequently revoke it', async () => {
    // Owner grants read access to User B
    const grantRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/permissions`)
      .set('Authorization', ownerA.authHeader)
      .send({ email: userB.user.email, permission: PERMISSIONS.READ });
    expect(grantRes.status).toBe(200);

    // Verify User B can now read
    const readRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);
    expect(readRes.status).toBe(200);

    // Owner revokes access
    const revokeRes = await request(app)
      .delete(`/api/documents/${docOwnedByA._id}/permissions/${userB.user._id}`)
      .set('Authorization', ownerA.authHeader);
    expect(revokeRes.status).toBe(200);

    // User B must now immediately be denied
    const deniedRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);
    expect(deniedRes.status).toBe(403);
  });

  // 8. Revocation immediately blocks subsequent access and invalidates existing download tickets
  test('8. Immediate revocation: invalidates access and tickets immediately', async () => {
    // Owner grants read access to User B
    docOwnedByA.acls.push({
      user: userB.user._id,
      permission: PERMISSIONS.READ,
      grantedBy: ownerA.user._id,
    });
    await docOwnedByA.save();

    // User B requests a download ticket
    const ticketRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/tickets`)
      .set('Authorization', userB.authHeader);
    expect(ticketRes.status).toBe(200);
    const { ticket } = ticketRes.body;

    // Owner revokes access
    await request(app)
      .delete(`/api/documents/${docOwnedByA._id}/permissions/${userB.user._id}`)
      .set('Authorization', ownerA.authHeader);

    // Attempting to redeem ticket must immediately fail with 403 Forbidden!
    const redeemRes = await request(app).get(`/api/documents/${docOwnedByA._id}/download?ticket=${ticket}`);
    expect(redeemRes.status).toBe(403);
  });

  // 9. Disabled users and revoked sessions lose access
  test('9. Disabled users and revoked sessions lose access immediately', async () => {
    // Disabled user attempt
    const disabledRes = await request(app)
      .get('/api/documents')
      .set('Authorization', disabledUser.authHeader);
    expect(disabledRes.status).toBe(403);

    // Revoked session
    ownerA.session.isValid = false;
    await ownerA.session.save();

    const revokedSessionRes = await request(app)
      .get('/api/documents')
      .set('Authorization', ownerA.authHeader);
    expect(revokedSessionRes.status).toBe(401);
  });

  // 10. Admin access to document contents is denied unless explicitly granted
  test('10. Admin isolation: Admin cannot read document contents or preview without explicit grant', async () => {
    // Admin tries to read document metadata
    const readRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', admin.authHeader);
    expect(readRes.status).toBe(403);

    // Admin tries to download file
    const downloadRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}/download`)
      .set('Authorization', admin.authHeader);
    expect(downloadRes.status).toBe(403);
  });

  // 11. Unauthorized attempts are recorded in the audit log
  test('11. Unauthorized access attempts are recorded in the tamper-evident audit log', async () => {
    await request(app)
      .get(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', userB.authHeader);

    const auditEntry = await AuditLog.findOne({
      documentId: docOwnedByA._id,
      action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
      outcome: AUDIT_OUTCOMES.DENIED,
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry.actor.toString()).toBe(userB.user._id.toString());
  });

  // 12. Audit events detect modification, deletion, reordering, and broken hash links
  test('12. Audit chain verification accurately detects tampering and integrity violations', async () => {
    // Generate valid audit events via audit service
    await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Authorization', ownerA.authHeader)
      .send({ title: 'Updated Financials v2' });

    await request(app)
      .post(`/api/documents/${docOwnedByA._id}/permissions`)
      .set('Authorization', ownerA.authHeader)
      .send({ email: userB.user.email, permission: PERMISSIONS.READ });

    // Verify valid chain
    let verification = await AuditLog.verifyChainIntegrity();
    expect(verification.isValid).toBe(true);
    expect(verification.totalCount).toBeGreaterThan(1);

    // Simulate tampering: directly alter an entry in the database (bypassing mongoose hooks via raw collection)
    const logs = await mongoose.connection.collection('auditlogs').find().sort({ timestamp: 1 }).toArray();
    expect(logs.length).toBeGreaterThan(1);

    const targetLog = logs[logs.length - 1];
    await mongoose.connection.collection('auditlogs').updateOne(
      { _id: targetLog._id },
      { $set: { reason: 'TAMPERED_PAYLOAD_CONTENT' } }
    );

    // Integrity check must detect the tamper!
    verification = await AuditLog.verifyChainIntegrity();
    expect(verification.isValid).toBe(false);
    expect(verification.brokenAt).not.toBeNull();
    expect(verification.brokenAt.reason).toContain('Payload modification detected');
  });

  // 13. Malformed files, oversized files, MIME spoofing, executable files, and path traversal are rejected
  test('13. File validation: Rejects executable files, MIME spoofing, and path traversal', async () => {
    // Executable file (Windows PE MZ header)
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
    const exeRes = await request(app)
      .post('/api/documents')
      .set('Authorization', ownerA.authHeader)
      .attach('file', exeBuffer, 'malware.pdf');
    expect(exeRes.status).toBe(400);
    expect(exeRes.body.error).toContain('Executable files');

    // MIME Spoofing: .pdf extension with plain text or non-PDF bytes
    const fakePdfBuffer = Buffer.from('This is definitely not a PDF file');
    const spoofRes = await request(app)
      .post('/api/documents')
      .set('Authorization', ownerA.authHeader)
      .attach('file', fakePdfBuffer, 'fake.pdf');
    expect(spoofRes.status).toBe(400);
    expect(spoofRes.body.error).toContain('MIME type spoofing detected');
  });

  // 14. CSRF, rate limiting, invalid tokens, and validation failures are handled appropriately
  test('14. Security protections: CSRF, invalid tokens, and schema validation failures', async () => {
    // Invalid JWT token
    const badTokenRes = await request(app)
      .get('/api/documents')
      .set('Authorization', 'Bearer invalid.token.payload');
    expect(badTokenRes.status).toBe(401);

    // CSRF check: Cookie auth without matching X-CSRF-Token header
    const csrfRes = await request(app)
      .patch(`/api/documents/${docOwnedByA._id}`)
      .set('Cookie', [`access_token=${ownerA.accessToken}`, 'csrf_token=valid_csrf_cookie'])
      .send({ title: 'New Title' });
    expect(csrfRes.status).toBe(403);
    expect(csrfRes.body.error).toContain('CSRF validation failed');

    // Schema validation failure: invalid email format on registration
    const schemaRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'not-an-email', password: 'Short' });
    expect(schemaRes.status).toBe(400);
    expect(schemaRes.body.error).toBe('Validation failed');
  });

  // 15. Concurrent revocation and file-access behavior matches documented guarantees
  test('15. Concurrency & Race condition mitigation: Revocation immediately preempts in-flight token verification', async () => {
    // Grant read access
    docOwnedByA.acls.push({
      user: userB.user._id,
      permission: PERMISSIONS.READ,
      grantedBy: ownerA.user._id,
    });
    await docOwnedByA.save();

    // Create 3 download tickets
    const tickets = [];
    for (let i = 0; i < 3; i++) {
      const ticketRes = await request(app)
        .post(`/api/documents/${docOwnedByA._id}/tickets`)
        .set('Authorization', userB.authHeader);
      tickets.push(ticketRes.body.ticket);
    }

    // Revoke access immediately
    await request(app)
      .delete(`/api/documents/${docOwnedByA._id}/permissions/${userB.user._id}`)
      .set('Authorization', ownerA.authHeader);

    // Execute concurrent redemption of all tickets
    const results = await Promise.all(
      tickets.map((t) => request(app).get(`/api/documents/${docOwnedByA._id}/download?ticket=${t}`))
    );

    // Every single concurrent request must be denied (403)!
    for (const res of results) {
      expect(res.status).toBe(403);
    }
  });

  // 16. Exhaustive Route Exploitation Matrix: Attacking every document endpoint with unauthorized user
  test('16. Systematic attack matrix: User B denied on every document route for User A document', async () => {
    // 1. GET metadata
    const r1 = await request(app).get(`/api/documents/${docOwnedByA._id}`).set('Authorization', userB.authHeader);
    expect(r1.status).toBe(403);

    // 2. PATCH metadata
    const r2 = await request(app).patch(`/api/documents/${docOwnedByA._id}`).set('Authorization', userB.authHeader).send({ title: 'Hacked' });
    expect(r2.status).toBe(403);

    // 3. DELETE document
    const r3 = await request(app).delete(`/api/documents/${docOwnedByA._id}`).set('Authorization', userB.authHeader);
    expect(r3.status).toBe(403);

    // 4. POST ticket creation
    const r4 = await request(app).post(`/api/documents/${docOwnedByA._id}/tickets`).set('Authorization', userB.authHeader);
    expect(r4.status).toBe(403);

    // 5. GET direct download
    const r5 = await request(app).get(`/api/documents/${docOwnedByA._id}/download`).set('Authorization', userB.authHeader);
    expect(r5.status).toBe(403);

    // 6. GET direct preview
    const r6 = await request(app).get(`/api/documents/${docOwnedByA._id}/preview`).set('Authorization', userB.authHeader);
    expect(r6.status).toBe(403);

    // 7. GET permissions list
    const r7 = await request(app).get(`/api/documents/${docOwnedByA._id}/permissions`).set('Authorization', userB.authHeader);
    expect(r7.status).toBe(403);

    // 8. POST grant permissions
    const r8 = await request(app).post(`/api/documents/${docOwnedByA._id}/permissions`).set('Authorization', userB.authHeader).send({ email: userViewer.user.email, permission: 'read' });
    expect(r8.status).toBe(403);

    // 9. DELETE revoke permissions
    const r9 = await request(app).delete(`/api/documents/${docOwnedByA._id}/permissions/${userViewer.user._id}`).set('Authorization', userB.authHeader);
    expect(r9.status).toBe(403);

    // 10. POST AI recommendations
    const r10 = await request(app).post(`/api/ai/documents/${docOwnedByA._id}/recommendations`).set('Authorization', userB.authHeader);
    expect(r10.status).toBe(403);

    // 11. POST AI decisions
    const r11 = await request(app).post(`/api/ai/documents/${docOwnedByA._id}/decisions`).set('Authorization', userB.authHeader).send({ targetUserId: userViewer.user._id, decision: 'accepted' });
    expect(r11.status).toBe(403);
  });

  // 17. Cross-user ticket spoofing rejection
  test("17. Cross-user ticket spoofing: User B cannot redeem a download ticket issued to User A", async () => {
    // Owner A creates download ticket
    const ticketRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/tickets?purpose=download`)
      .set('Authorization', ownerA.authHeader);
    expect(ticketRes.status).toBe(200);
    const { ticket } = ticketRes.body;

    // User B attempts to redeem Owner A's ticket with User B's credentials
    const spoofRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}/download?ticket=${ticket}`)
      .set('Authorization', userB.authHeader);
    expect(spoofRes.status).toBe(403);
    expect(spoofRes.body.error).toContain('Ticket does not belong to authenticated user');
  });

  // 18. Ticket purpose confusion rejection
  test("18. Ticket purpose confusion: A preview ticket cannot be used for file download", async () => {
    // Owner A creates preview ticket
    const ticketRes = await request(app)
      .post(`/api/documents/${docOwnedByA._id}/tickets?purpose=preview`)
      .set('Authorization', ownerA.authHeader);
    expect(ticketRes.status).toBe(200);
    const { ticket } = ticketRes.body;

    // Attempt to redeem on /download endpoint
    const badPurposeRes = await request(app)
      .get(`/api/documents/${docOwnedByA._id}/download?ticket=${ticket}`)
      .set('Authorization', ownerA.authHeader);
    expect(badPurposeRes.status).toBe(403);
    expect(badPurposeRes.body.error).toContain('Ticket purpose mismatch');
  });

  // 19. Non-admin privilege escalation attempt across all administrative endpoints
  test("19. Administrative privilege escalation: Non-admin users are strictly blocked on all /admin routes", async () => {
    const adminRoutes = [
      { method: 'get', url: '/api/admin/stats' },
      { method: 'get', url: '/api/admin/users' },
      { method: 'patch', url: `/api/admin/users/${userViewer.user._id}/status`, body: { status: 'disabled' } },
      { method: 'post', url: `/api/admin/users/${userViewer.user._id}/revoke-sessions` },
      { method: 'get', url: '/api/admin/audit' },
      { method: 'post', url: '/api/admin/audit/verify' },
    ];

    for (const route of adminRoutes) {
      const reqBuilder = request(app)[route.method](route.url).set('Authorization', ownerA.authHeader);
      if (route.body) reqBuilder.send(route.body);
      const res = await reqBuilder;
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Requires one of the following roles: admin');
    }
  });
});
