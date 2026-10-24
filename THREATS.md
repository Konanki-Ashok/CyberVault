# TrustVault Threat Model & Security Architecture Analysis

This document details the threat landscape, attack vectors, defensive mitigations, residual risks, accepted trade-offs, and automated test validations implemented in TrustVault.

---

## 1. Threat Scenarios & Mitigations Matrix

| Threat / Attack Scenario | Severity | Mitigation Architecture | Residual Risk | Validating Test |
|---|---|---|---|---|
| **1. BOLA / IDOR (Broken Object Level Authorization)**<br>Attacker guesses or changes `documentId` in request URL to access or modify another user's document. | **CRITICAL** | `requireDocumentAccess` middleware resolves the document and strictly verifies ownership or an explicit ACL grant. Returns safe 403/404 without disclosing metadata. | None at application level. | `security.test.js` #2, #4 |
| **2. Admin Document Content Snooping**<br>System administrator abuses administrative privileges to read sensitive executive or confidential documents. | **HIGH** | Strict role isolation: the `admin` role has privileges for user management and audit inspection, but is **explicitly denied** access to document contents unless granted by document owner. | A DBA with direct database access can bypass application code. Documented in trade-offs. | `security.test.js` #10 |
| **3. Document Metadata / Title Discovery**<br>Unprivileged user uses list, search, or filter queries to infer the existence, titles, or owners of confidential documents. | **HIGH** | `getAccessibleDocumentsFilter` enforces database-level query filtering (`$or: [{ owner: user._id }, { 'acls.user': user._id }]`). Unshared documents are never returned. | None. Query never retrieves unauthorized rows. | `security.test.js` #3 |
| **4. Insecure Direct File Access**<br>Attacker accesses raw file path or predictable storage filename. | **CRITICAL** | Storage keys are generated as random UUID v4 values. Files are saved in a private storage directory outside the web root. File access requires fresh authorization. | Local filesystem breach on host server. | `security.test.js` #2, #13 |
| **5. Stale Ticket / Post-Revocation Access**<br>User obtains a download ticket, owner revokes access, but user redeems ticket afterwards. | **HIGH** | Download tickets are single-use, 60-second TTL, and checked against a fresh database authorization query at the moment of redemption. Revocation immediately invalidates tickets. | Race condition during active TCP streaming (analyzed below). | `security.test.js` #8, #15 |
| **6. MIME Spoofing & Malicious Executable Upload**<br>Attacker renames an `.exe` or ELF binary to `.pdf` to exploit preview renderers or host users. | **CRITICAL** | Strict server-side magic byte inspection (`validateFileBuffer`). Explicitly rejects PE (`MZ`), ELF, shell script shebangs (`#!`), Java classes, and verifies file signatures. | 0-day format parser vulnerabilities in client PDF viewers. | `security.test.js` #13 |
| **7. Path Traversal (`../`) & Null Byte Injection**<br>Attacker uploads a file with name `../../etc/passwd` to overwrite system files or escape directories. | **HIGH** | Filename sanitization (`sanitizeFilename`) strips directory components via `path.basename`, removes null bytes, and generates a random UUID storage key for storage. | None. User-supplied filename is never used as a filesystem path. | `security.test.js` #13 |
| **8. Audit Log Tampering / Deletion**<br>Attacker or compromised user attempts to modify or delete logs to cover their tracks. | **HIGH** | Mongoose pre-hooks (`updateOne`, `deleteOne`, `findOneAndUpdate`) throw errors on modification. Each entry contains a cryptographic SHA-256 hash chained to the preceding event hash. | A privileged DBA altering raw MongoDB collections. | `security.test.js` #12 |
| **9. Cross-Site Request Forgery (CSRF)**<br>Malicious third-party site tricks user browser into sending state-changing requests using ambient cookies. | **MEDIUM** | Double-submit CSRF protection: state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via cookie require a matching `X-CSRF-Token` header. SameSite cookie attribute enabled. | Subdomain takeover could potentially manipulate cookies. | `security.test.js` #14 |
| **10. Brute Force Login & Account Enumeration**<br>Attacker attempts automated password guessing or tests email existence. | **MEDIUM** | Strict rate limiting on authentication routes (15 attempts per 15 minutes) and uniform error messages ("Invalid email address or password") prevent enumeration. | Distributed slow attacks across large IP pools. | `security.test.js` #1, #14 |
| **11. Access Evasion by Disabled Accounts**<br>Admin disables an account, but the user continues accessing documents via existing session tokens. | **HIGH** | `requireAuth` validates the user status (`status === 'active'`) and session validity in the database on every protected request. Inactivating an account invalidates all sessions. | Latency between disable action and subsequent request (sub-millisecond in MongoDB). | `security.test.js` #9 |

---

## 2. In-Depth Analysis: Hash Chaining vs. Privileged DBA Attack

### Threat
A privileged database administrator or an attacker who gains root access to the MongoDB daemon can bypass Mongoose application-level hooks and write directly to the database. They could alter an audit record and recompute all downstream hashes:
$$\text{entryHash}_i = \text{SHA256}(\text{canonicalPayload}_i + \text{prevHash}_i)$$

### Application-Level Guarantees
- Detects unauthorized row modifications, insertions, deletions, and record reordering made by application code, SQL/NoSQL injection, or external scripts.
- Prevents ordinary users and application code from mutating audit records via Mongoose middleware rejection.

### Stronger Production Countermeasures
To guarantee non-repudiation against a rogue DBA in production environments:
1. **Periodic Key-Signed Checkpoints:** Periodically (e.g. every hour or every 100 blocks), sign the current head hash with a private key stored in an external Hardware Security Module (HSM) or AWS KMS. Publish the checkpoint signature to an external immutable ledger or log service.
2. **Immutable WORM (Write-Once-Read-Many) Storage:** Stream audit records asynchronously to immutable cloud storage (e.g., AWS S3 with Object Lock in Compliance Mode), where objects cannot be overwritten or deleted even by the root AWS account until the retention period elapses.

---

## 3. Race Conditions: Permission Revocation vs. Active File Delivery

### Threat
An owner revokes a user's access while the user is actively downloading or previewing a large file over HTTP.

### System Guarantees & Consistency
1. **Pre-Stream Authorization:** Authorization is verified immediately before opening the read stream and generating HTTP headers. Revocation prior to stream initiation immediately blocks the request (HTTP 403).
2. **Download Ticket Consumption:** When download tickets are used, the ticket is marked `used: true` and current database permissions are verified atomically before streaming commences.
3. **Active TCP Streaming Limitation:** Once chunks have begun streaming over an open TCP socket, Node.js streams directly from disk to the network buffer. To abort active multi-gigabyte transfers in flight, a distributed socket registry would be required to forcefully destroy open sockets upon ACL revocation events.

---

## 4. Test Suite Mapping

All 15 scenarios from Section 10 are automated and verified in [`backend/tests/security.test.js`](file:///c:/Users/ashok/OneDrive/Desktop/TRUST%20VAULT/backend/tests/security.test.js):
- Test 1: Unauthenticated endpoint rejection (401)
- Test 2: Cross-user document access rejection (403)
- Test 3: Document discovery prevention in search/listing
- Test 4: Payload ID/role tampering prevention
- Test 5: Viewer edit/share/delete prohibition
- Test 6: Editor share/delete prohibition
- Test 7: Owner grant and revocation lifecycle
- Test 8: Immediate download ticket invalidation upon revocation
- Test 9: Disabled user and revoked session blocking
- Test 10: Admin document content isolation
- Test 11: Audit logging of denied attempts
- Test 12: Cryptographic detection of audit log payload tampering
- Test 13: Magic bytes file format and executable rejection
- Test 14: CSRF token and schema validation enforcement
- Test 15: Concurrency and race condition mitigation verification
