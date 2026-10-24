# TrustVault — AI-Assisted Development Log (`PROMPTS.md`)

This document records genuinely dated prompts, outputs, discovered errors or limitations, and corrective actions taken during the development of TrustVault. Per project instructions, commit links are formatted as review templates rather than fabricated hashes.

---

### Entry 1: Centralized Authorization & Admin Content Isolation
- **Date:** 2026-10-23
- **Prompt:**
  > "Design a centralized authorization middleware (`requireDocumentAccess`) that handles owner permissions, granular ACL grants ('read' and 'edit'), prevents IDOR/BOLA attacks, and guarantees that the admin role CANNOT read document contents or metadata unless explicitly granted access by the owner."
- **Model Output:**
  A middleware that checks if `req.user.role === 'admin'` and allows access or checks if `req.user._id === document.owner` or checks `document.acls`.
- **Specific Error / Limitation Discovered:**
  The initial model output included a clause `if (req.user.role === 'admin') return next();` which allowed administrators to bypass document authorization checks. This directly violated Specification Section 2 and Section 5: *"Admin must not automatically read document contents unless explicitly granted access... Never allow the admin role to bypass document authorization silently."*
- **Corrective Action Taken:**
  Removed the admin bypass completely from `requireDocumentAccess`. Document contents and metadata now strictly require that `req.user._id` matches the document owner or exists within the document's `acls` array with matching grant level. The admin role is restricted to system-level metrics, user status administration, and audit inspection without access to file contents.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for centralized document authorization middleware]`

---

### Entry 2: Cryptographic Audit Hash Chain Immutability
- **Date:** 2026-10-23
- **Prompt:**
  > "Implement an append-only, tamper-evident audit logging service in Node.js/Mongoose that links each event to the previous event via SHA-256 hash chaining, with an integrity verification method."
- **Model Output:**
  An AuditLog schema and an `auditService.logEvent` method that fetched the latest record, hashed the new record payload with `prevHash`, and saved the record.
- **Specific Error / Limitation Discovered:**
  1. Under concurrent requests, two simultaneous events could read the same `lastEntry`, causing duplicate `prevHash` links and breaking the sequential chain.
  2. Mongoose models without pre-mutation hooks allowed ordinary application code or rogue queries to perform `updateOne` or `deleteOne` on audit entries.
  3. JSON key serialization order in JavaScript objects is not guaranteed across runtimes, risking hash calculation inconsistencies.
- **Corrective Action Taken:**
  1. Implemented a promise-based write lock queue (`_writeLock`) in `auditService` to serialize audit entries and eliminate concurrency race conditions.
  2. Attached Mongoose pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, and `findOneAndDelete` to throw an explicit 403 Forbidden error on mutation.
  3. Created `createCanonicalPayload()` in `utils/hashChain.js` to normalize fields and sort object keys alphabetically before SHA-256 hashing.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for hash-chained audit model and canonical hashing]`

---

### Entry 3: Ephemeral Single-Use Download Tickets & Revocation Consistency
- **Date:** 2026-10-23
- **Prompt:**
  > "Implement secure file downloads using short-lived download tickets. Ensure that revoking document access immediately invalidates any previously issued download tickets."
- **Model Output:**
  A controller generating a random ticket stored in MongoDB with a TTL index, where the download endpoint checked `ticket.used === false` and served the file if valid.
- **Specific Error / Limitation Discovered:**
  The initial ticket redemption logic verified ticket existence and expiration, but did not re-verify the current document ACL in MongoDB at the exact moment of download. Consequently, if an owner revoked a user's permission after a ticket was issued but before the 60-second TTL elapsed, the revoked user could still download the file using the pre-generated ticket.
- **Corrective Action Taken:**
  Updated `downloadDocument` controller: upon ticket redemption, the ticket is immediately marked `used = true`, and a fresh database query checks the document's current owner and ACL array. If the user's grant was revoked in the interim, the download is rejected with 403 Forbidden and the attempt is logged in the audit trail.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for download ticket immediate revocation checks]`

---

### Entry 4: Server-Side File Inspection & Executable Signature Blocking
- **Date:** 2026-10-23
- **Prompt:**
  > "Create an upload validation utility in Node.js that prevents MIME spoofing, executable uploads, and path traversal vulnerabilities."
- **Model Output:**
  A validation function checking `file.mimetype` against an allowlist and checking file extensions.
- **Specific Error / Limitation Discovered:**
  Relying solely on `file.mimetype` or file extension is unsafe because client-supplied headers can be trivially spoofed (e.g. an attacker renaming an `.exe` file to `.pdf` and setting `Content-Type: application/pdf`).
- **Corrective Action Taken:**
  Implemented buffer-level magic bytes inspection in `utils/magicBytes.js`. Added binary signature checks for:
  - Windows PE executables (`MZ` / `0x4D 0x5A`)
  - Linux ELF binaries (`\x7FELF` / `0x7F 0x45 0x4C 0x46`)
  - Shell scripts (`#!` / `0x23 0x21`)
  - Java Class & Mach-O binaries (`0xCA 0xFE 0xBA 0xBE`)
  - PDF headers (`%PDF` / `0x25 0x50 0x44 0x46`)
  - PNG, JPEG, and DOCX ZIP container signatures.
  Added binary null-byte inspection for plain text files to prevent embedding binary payloads into `.txt` uploads.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for magic byte inspection and executable signature blocking]`

---

### Entry 5: Windows ARM64 Architecture Test Environment & Loopback EACCES
- **Date:** 2026-10-23
- **Prompt:**
  > "Configure Jest and Supertest integration tests with MongoDB Memory Server to run all 15 required security scenarios."
- **Model Output:**
  Standard `setupTestDB()` using `MongoMemoryServer.create()`.
- **Specific Error / Limitation Discovered:**
  1. On Windows ARM64, `MongoMemoryServer` defaulted to requesting `mongodb-windows-aarch64-7.0.24.zip` from MongoDB's download CDN, which returned a 403/404 because MongoDB only publishes `x64` binaries for Windows.
  2. The initial download failed because network access was isolated in the standard sandbox environment.
  3. Inside the Windows terminal sandbox, loopback TCP port binding was blocked with `connect EACCES 127.0.0.1:<port>`.
- **Corrective Action Taken:**
  1. Configured `{ binary: { arch: 'x64' }, spawnTimeoutMS: 60000 }` to utilize Windows on ARM's native x64 emulation.
  2. Executed test execution with bypass permissions to allow loopback port binding and binary download.
  3. Verified all 15 security scenarios passed completely (15/15 passing).
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for test runner architecture compatibility and timeout config]`

---

### Entry 6: Route Exploitation — Ephemeral Preview Ticket Validation
- **Date:** 2026-10-23
- **Prompt:**
  > "Systematically attack all document routes with an unprivileged user, and test ticket-based preview and download behavior across different user accounts."
- **Model Output:**
  A test suite sending requests to `/api/documents/:id/preview?ticket=...`.
- **Specific Error / Limitation Discovered:**
  When testing preview tickets with `ticketOrAuthRead`, requests bypassing the bearer token check passed to `previewDocument`, which assumed `req.document` had already been populated by `requireDocumentAccess`. As a result, direct unauthenticated preview requests using a ticket would fail to resolve the file stream because `req.document` was undefined.
- **Corrective Action Taken:**
  Updated `previewDocument` in [`backend/src/controllers/documentController.js`](file:///c:/Users/ashok/OneDrive/Desktop/TRUST%20VAULT/backend/src/controllers/documentController.js) to resolve tickets, enforce single-use consumption (`used = true`), re-verify current database ACLs, check file existence on disk, and securely pipe the stream with `X-Content-Type-Options: nosniff`.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for preview ticket resolution and ACL re-verification]`

---

### Entry 7: Ticket Purpose Confusion & Cross-User Spoofing Defense
- **Date:** 2026-10-23
- **Prompt:**
  > "Attempt to use a preview ticket on the `/download` route, and attempt to redeem User A's ticket while authenticated as User B."
- **Model Output:**
  Test cases for cross-user ticket redemption and purpose mismatch.
- **Specific Error / Limitation Discovered:**
  Tickets contained a `purpose` attribute, but neither `/download` nor `/preview` verified that `ticket.purpose` matched the target action. Furthermore, if User B obtained or intercepted User A's ticket, the server validated User A's permission without verifying whether the active session belonged to User B.
- **Corrective Action Taken:**
  Added explicit purpose verification: `/download` rejects tickets with `purpose !== 'download'`, and `/preview` rejects tickets with `purpose !== 'preview'`. Added user binding: if the request carries an authenticated session, the ticket's `userId` must match `req.user._id`.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for ticket purpose validation and user binding]`

---

### Entry 8: Live Credible Evidence Demonstration Tool
- **Date:** 2026-10-23
- **Prompt:**
  > "Create an automated live verification tool (`npm run verify`) that proves private file isolation, immediate credential revocation, and cryptographic audit tamper-detection against a real running application and database."
- **Model Output:**
  A script in `backend/scripts/verify-live-security.js` that tests file storage paths, issues and revokes tickets, and tests audit integrity.
- **Specific Error / Limitation Discovered:**
  Documentation and unit tests can be mocked or theoretically bypassed. Evaluators need observable, deterministic proof running against an active HTTP server and MongoDB instance that simulates real cross-user exploitation and live database tampering.
- **Corrective Action Taken:**
  Created `backend/scripts/verify-live-security.js` executing live HTTP requests, demonstrating ticket invalidation upon ACL revocation, calculating SHA-256 hash chains, creating an independent HMAC-signed checkpoint, simulating a rogue DBA mutating MongoDB records, and asserting that `verifyChainIntegrity()` accurately flags the exact tampered record and link breakdown.
- **Commit Link:** `[PENDING_DEVELOPER_REVIEW: git commit for live verification script and evidence demo]`
