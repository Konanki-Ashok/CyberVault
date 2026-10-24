# TrustVault — 5-Minute Evaluation & Demonstration Script

This script walks through the core security features, role-based workflows, tamper-evident audit verification, and non-negotiable authorization checks in **TrustVault**.

---

## Preparation (30 Seconds)

1. Ensure the database is seeded:
   ```bash
   cd backend
   npm run seed
   npm start
   ```
2. In a second terminal, start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open your browser at `http://localhost:5173`.

---

## Act 1: Document Owner Workflow (1 Minute)

1. **Sign In as Owner (Alice):**
   - On the login screen, click the **"Owner (Alice)"** demo button (or enter `owner@trustvault.local` / `Owner@TrustVault2026!`).
   - Click **Sign In**.
2. **Review Uploaded Vault Documents:**
   - Observe the pre-seeded documents: *Q3 Financial Audit & Balance Sheet*, *TrustVault System Security Architecture v2*, and *Standard Mutual NDA*.
   - Notice that each document displays the user's role badge: **OWNER**.
3. **Upload a New Document:**
   - Click **Upload Document** in the top right.
   - Choose or drag a sample file (e.g., a `.txt` or `.pdf` file).
   - Enter title `Confidential Board Strategy 2026`, choose Category `Executive`, and add tags `strategy, board`.
   - Click **Upload to Vault**. Observe instantaneous SHA-256 computation and secure storage.

---

## Act 2: Granular Access Control & Ephemeral Tickets (1 Minute)

1. **Inspect Document Details & Preview:**
   - Click on `Confidential Board Strategy 2026`.
   - In the modal, observe the **SHA-256 Hash**, **MIME Type**, and **Storage Key**.
   - Click the **Secure Preview** tab: observe the ephemeral 60-second ticket generation and inline rendering.
2. **Grant Access to Bob Viewer:**
   - Click the **Access Control (ACL)** tab.
   - Enter `viewer@trustvault.local` in the user email field, select **Viewer (Read & Download)**, and click **Grant Access**.
   - Observe the new grant appears in the active grants table.
3. **Test AI-Assisted Sharing Advisor:**
   - Click the **AI Sharing Advisor** tab.
   - Enter purpose: `Looking for technical architecture review`.
   - Click **Generate Recommendations**.
   - Observe candidate users with confidence scores and rationale.
   - Click **Accept & Share** on a candidate or click **Reject** to test human oversight.

---

## Act 3: Enforcing Authorization Boundaries & Revocation (1 Minute)

1. **Sign In as Viewer (Bob):**
   - Click the logout icon in the top navigation bar.
   - On the login screen, click **"Viewer (Bob)"** (`viewer@trustvault.local` / `Viewer@TrustVault2026!`).
   - Click **Sign In**.
2. **Verify Viewer Restrictions:**
   - Notice that Bob **only sees documents explicitly shared with him** (e.g. *Standard Mutual NDA* and the document Alice shared). Unshared documents do not appear in the list or search.
   - Open the document: Bob has the **VIEWER** role badge.
   - Notice that **Edit Metadata**, **Access Control (ACL)**, and **Delete Document** options are unavailable.
   - Click **Download** or **Secure Preview** to verify that read access functions smoothly.
3. **Test Immediate Revocation:**
   - In an incognito window or separate browser tab, log in as Alice Owner (`owner@trustvault.local`).
   - Open the shared document, go to **Access Control**, and click **Revoke Grant** for Bob.
   - Switch back to Bob's browser window and try to download or preview the file.
   - **Result:** Bob is **immediately denied (HTTP 403 Forbidden)**.

---

## Act 4: Admin Isolation & Tamper-Evident Audit Verification (1.5 Minutes)

1. **Sign In as Security Admin:**
   - Log out and sign in using the **"Admin"** demo button (`admin@trustvault.local` / `Admin@TrustVault2026!`).
2. **Verify Admin Content Isolation:**
   - Navigate to `/documents`.
   - **Security Highlight:** Notice that Admin **cannot view or read Alice's private documents**! Admin only sees documents they explicitly own or are granted access to. Administrative privilege does not silently bypass document ACLs.
3. **Inspect the Tamper-Evident Audit Trail:**
   - Click **Audit Trail** in the top navigation bar.
   - Observe the append-only event ledger: every login, upload, permission grant, revocation, and denied attempt is recorded with UTC timestamp, actor, action, and SHA-256 entry hash.
4. **Cryptographically Verify Audit Chain:**
   - Click the green **Verify Chain Integrity** button in the top right.
   - Observe the live verification banner:
     > *"Cryptographic Audit Chain Integrity Verified: Audit chain verified successfully across N records."*
   - Every block's $H_n = \text{SHA256}(\text{Payload} + H_{n-1})$ is recalculated and confirmed unbroken.

---

## Act 6: Live Evidence & Tamper-Resistance Demonstration (1 Minute)

To provide verifiable proof against a live running database and server without manual clicks:
1. Run the live verification script:
   ```bash
   cd backend
   npm run verify
   ```
2. **Review Output:**
   - **Private File Isolation:** Verifies files are stored in `backend/uploads` outside the web root, and asserts that direct unauthenticated requests return 401 and cross-user requests return 403.
   - **Immediate Revocation:** Issues an ephemeral 60-second download ticket to Bob, revokes Bob's access in the database, and attempts to redeem the ticket. Verifies that the server immediately blocks file streaming with `HTTP 403 Forbidden: Access permissions have been revoked`.
   - **Cryptographic Hash Chain:** Recalculates and verifies $H_n = \text{SHA256}(\text{CanonicalPayload}_n + H_{n-1})$ across all sequential entries.
   - **Live Tamper Detection:** Directly mutates an audit entry payload inside the raw MongoDB database (simulating a rogue DBA attack) and re-runs `verifyChainIntegrity()`. Observes that cryptographic verification pinpointed the tampered event ID and link breakdown.
