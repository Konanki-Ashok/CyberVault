# TrustVault — Secure Zero-Trust Document Sharing Platform

TrustVault is a production-minded web application engineered with a **zero-trust architecture** for sensitive document sharing. It enforces non-negotiable server-side authorization, immutable cryptographic audit logging, ephemeral single-use download tickets, and strict server-side file inspection.

---

## Key Security Features

- **Centralized Server-Side Authorization (`requireDocumentAccess`, `requireDocumentOwner`):**
  - Deny access by default.
  - Granular document ACLs (`read`, `edit`).
  - Strict isolation: **Admin role cannot view or download documents unless explicitly granted access by the owner.**
  - Safe 403 / 404 responses preventing BOLA / IDOR enumeration.
  - Server-side database query filtering (`$or: [{ owner }, { 'acls.user' }]`): users never discover documents they are not authorized to view.
- **Tamper-Evident Hash-Chained Audit Trail:**
  - Append-only event ledger chaining each event's canonical representation with the previous event's SHA-256 hash.
  - Immutability enforced at the database application layer (Mongoose hooks block updates and deletes).
  - Built-in audit verification tool (`verifyChainIntegrity`) detecting record deletion, payload modification, and reordering.
- **Ephemeral Single-Use Download & Preview Tickets:**
  - Short-lived (60-second TTL), single-use cryptographic tokens.
  - Fresh database authorization check upon ticket redemption — revoking a grant immediately invalidates in-flight and issued tickets.
  - No permanent public URLs or direct file exposure.
- **Server-Side File Validation & Storage Isolation:**
  - MIME type allowlist and file signature (magic bytes) validation.
  - Explicit rejection of executable files (PE MZ, ELF, shell shebang, Mach-O).
  - Storage under cryptographically generated UUID keys outside the web root.
  - Filename sanitization preventing path traversal and null byte injections.
- **Session Security & Authentication:**
  - Passwords hashed with bcrypt (work factor 12).
  - Short-lived JWT access tokens in HttpOnly, Secure, SameSite cookies.
  - Revocable server-side sessions tracked in database.
  - Double-submit CSRF cookie + `X-CSRF-Token` header protection on all state-changing endpoints.
  - Strict rate limiting on authentication and API routes.
- **AI-Assisted Sharing Advisor:**
  - Recommends collaborators based purely on document metadata (category, tags, description) without transmitting file contents.
  - Zero auto-grant: Requires explicit human review and confirmation by the document owner.
  - Full audit trail recording of recommendations and human accept/reject decisions.
  - Offline heuristic rule-based engine fallback.

---

## Technology Stack

- **Frontend:** React 18, Vite, React Router v7, Tailwind CSS, Axios, Lucide Icons
- **Backend:** Node.js (v20+ / v26), Express.js REST API
- **Database:** MongoDB 7.0 + Mongoose
- **Validation:** Zod schemas
- **Security:** Helmet, bcryptjs, jsonwebtoken, express-rate-limit, cookie-parser
- **Testing:** Jest, Supertest, MongoDB Memory Server
- **Documentation:** OpenAPI 3.0 / Swagger UI (`/api/docs`)
- **Containers:** Docker, Docker Compose, Nginx multi-stage build

---

## Seeded Demo Credentials

Run `npm run seed` in `backend` to initialize demo accounts:

| Role | Email | Password | Description |
|---|---|---|---|
| **Admin** | `admin@trustvault.local` | `Admin@TrustVault2026!` | System administrator. Can manage users, revoke sessions, and inspect audit logs. **Cannot read private document contents.** |
| **Owner** | `owner@trustvault.local` | `Owner@TrustVault2026!` | Alice Owner. Owns confidential reports, manages ACL grants, uploads documents. |
| **Viewer** | `viewer@trustvault.local` | `Viewer@TrustVault2026!` | Bob Viewer. Has explicit `read` grant on sample NDA. Cannot edit or delete. |
| **Collaborator** | `collaborator@trustvault.local` | `Collab@TrustVault2026!` | Charlie Collaborator. Has explicit `edit` grant on Architecture Spec. Can update metadata, but cannot delete or share. |
| **Disabled** | `disabled@trustvault.local` | `Disabled@TrustVault2026!` | Dave Suspended. Disabled account. Immediately rejected on all protected endpoints. |

---

## Quickstart & Local Installation

### Prerequisites
- Node.js 18+ (tested on Node.js 20 and Node.js 26)
- MongoDB instance (local or MongoDB Atlas connection string)

### 1. Backend Setup
```bash
cd backend
npm install

# (Optional) Seed the database with demo users & documents
npm run seed

# Run the test suite (19 security integration scenarios)
npm test

# Run the live evidence verification script (Private storage, immediate revocation & live DBA tamper detection)
npm run verify

# Start backend server (starts on http://localhost:5000)
npm start
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Start Vite development server (starts on http://localhost:5173)
npm run dev

# Or build for production
npm run build
```

Open `http://localhost:5173` in your browser. Quick-login buttons on the login screen allow one-click role switching between Admin, Owner, Viewer, and Disabled accounts.

### Deploying the frontend and backend separately

The frontend is a static site and does not host the API. When deploying it to Netlify, deploy the backend and MongoDB separately, then set this Netlify environment variable to the backend's public API URL:

```text
VITE_API_URL=https://<your-backend-host>/api
```

Set the backend's `FRONTEND_ORIGIN` to `https://trustvavaultify.netlify.app` and `MONGODB_URI` to a reachable MongoDB deployment. Configure strong, unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` values in the backend host. Redeploy the Netlify site after changing its environment variables so Vite embeds the API URL in the frontend build.

---

## Running with Docker Compose

To deploy the entire production stack (MongoDB 7.0, Node.js Backend API, and Nginx-served React SPA):

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application is accessible at:
- **Web Dashboard:** `http://localhost:80`
- **Backend API:** `http://localhost:5000/api`
- **Swagger Documentation:** `http://localhost:5000/api/docs`

---

## API Documentation

Interactive Swagger/OpenAPI documentation is available at `/api/docs`.
The complete OpenAPI 3.0 specification file is located at [`openapi.yaml`](file:///c:/Users/ashok/OneDrive/Desktop/TRUST%20VAULT/openapi.yaml).

---

## Architectural Limitations & Known Trade-offs

1. **Hash Chain vs. Privileged DBA:** A hash chain detects application-level modifications and external tampering. However, a rogue database administrator with full write access to the underlying MongoDB collection could hypothetically recalculate the entire hash chain from a modified block forward. Production mitigations include periodic key-signed checkpoints and exporting audit blocks to Write-Once-Read-Many (WORM) storage (e.g. AWS S3 Object Lock).
2. **Streaming Race Conditions:** When permission is revoked while a large multi-gigabyte file is already actively streaming across an open TCP socket, chunk transmission that began prior to revocation completes for that specific stream. New stream connections or subsequent requests are blocked immediately.
