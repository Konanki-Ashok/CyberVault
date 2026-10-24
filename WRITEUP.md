# TrustVault Architecture & Security Decisions Write-Up

## 1. Permission & Access Control Model

TrustVault enforces a strict **zero-trust, document-centric permission architecture** based on two orthogonal dimensions:
1. **System Roles:**
   - **Admin:** Manages user account lifecycles (enabling/disabling users), revokes active sessions, and inspects the tamper-evident audit ledger. **Admin has no inherent privilege to inspect or download document contents.**
   - **Owner:** End users who create and own documents. Owners possess unconditional authority over their documents (editing metadata, granting/revoking user access, deleting files, generating AI recommendations).
   - **Viewer:** End users who access documents explicitly shared with them. By default, access is read-only.
2. **Document-Level Access Control Lists (ACLs):**
   - Each document maintains an array of named grants: `{ user: ObjectId, permission: 'read' | 'edit', grantedBy, grantedAt }`.
   - **Read Grant:** Permits viewing metadata, generating ephemeral download/preview tickets, and streaming file contents.
   - **Edit Grant:** Permits updating document title, category, tags, and description. An edit grant implicitly satisfies read requirements, but does **not** permit deleting documents or modifying ACL grants.
   - **Deny-by-Default:** Any user not matching the document owner ID and having no grant entry is denied with HTTP 403.
   - **Server-Side Discovery Suppression:** Database queries for search and listing are filtered at the MongoDB layer using `{ $or: [{ owner }, { 'acls.user' }] }`. Unauthorized documents are never returned to client queries.

---

## 2. Security Design Decisions

- **Centralized Authorization Middlewares:**
  Instead of scattered UI checks, authorization is enforced exclusively through `requireAuth`, `requireDocumentAccess(permissionLevel)`, and `requireDocumentOwner`.
- **Session Revocability & Immediate Account Disabling:**
  JWT access tokens have short lifespans (15 minutes). Every request checks the database session document (`isValid: true`) and user status (`status: 'active'`). Disabling an account immediately invalidates all active sessions across all devices.
- **CSRF & Cookie Protection:**
  Session cookies are marked `HttpOnly`, `SameSite=Lax`, and `Secure` (in production). State-changing requests (`POST`, `PATCH`, `DELETE`) require a matching `X-CSRF-Token` header derived from a client-readable CSRF cookie.
- **Server-Side Magic Bytes & Storage Isolation:**
  Files are never stored under their original user-provided names. A cryptographically random UUID v4 key is generated, and the file is stored in a private directory outside the web root. File buffers are inspected for file headers (`%PDF`, PNG, JPEG, ZIP/DOCX) and explicitly scanned for executable signatures (Windows PE `MZ`, Linux ELF, scripts `#!`).
- **Cryptographic Hash-Chained Audit Trail:**
  Every security event is hashed with the previous event's SHA-256 hash ($H_n = \text{SHA256}(\text{CanonicalPayload}_n + H_{n-1})$). Mongoose pre-hooks block application-layer updates or deletions, and a built-in verification function detects record tampering or link breaks.
- **Ephemeral Download Tickets:**
  Download and preview URLs do not expose permanent links or secrets. Single-use 60-second tickets are issued upon authenticated request and re-validated against current database permissions at the exact millisecond of file streaming.

---

## 3. AI Usage & Guardrails

TrustVault features an **AI-Assisted Sharing Advisor** designed under strict safety boundaries:
1. **Confidentiality:** Document binary contents and private file text are **never transmitted** to AI services. Only sanitized metadata (title, category, tags, and owner-specified collaboration purpose) is processed.
2. **No Autonomous Grants:** The AI engine is strictly advisory. It cannot modify document ACLs or expand access automatically.
3. **Mandatory Human Review:** The document owner must review each recommended recipient, confidence score, and rationale, and explicitly click "Accept" or "Reject".
4. **Audit Trail Accountability:** Both the recommendation generation event and the owner's accept/reject decision are permanently logged into the hash-chained audit trail.
5. **Deterministic Heuristic Fallback:** When external LLM APIs are disabled or offline, a rule-based domain heuristic engine automatically provides recipient suggestions.

---

## 4. Limitations & Future Roadmap

- **Privileged DBA Threat:**
  Application-level hash chaining prevents web attackers or regular developers from tampering with logs. However, a rogue database administrator with direct MongoDB shell access could hypothetically recalculate the entire chain. Future roadmap includes exporting block checkpoints to AWS S3 Object Lock (WORM storage) and signing checkpoints with AWS KMS or an HSM key.
- **Active TCP Socket Streaming:**
  When access is revoked during an active multi-gigabyte file download, data packets already in the operating system network buffer may finish transmitting. Future enhancements will integrate an in-memory active connection registry to forcibly abort active TCP sockets upon ACL revocation.
- **Folder Hierarchies:**
  Per specifications, folder inheritance is omitted in this version to avoid transitive permission leaks; documents are organized via categories and tags. Future versions may evaluate capability-based hierarchical delegation.
