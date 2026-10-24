# 🚀 How to Run TrustVault in Visual Studio Code

This guide explains how to open and run **TrustVault** inside **Visual Studio Code (VS Code)**.

---

## ⚡ Method 1: The 1-Click VS Code Debugger (Easiest)

1. Open **VS Code**.
2. Go to **File > Open Folder...** and select the unzipped `TrustVault` project folder.
3. Press **`F5`** on your keyboard (or click **Run > Start Debugging** from the top menu).
4. Select **`🚀 Start TrustVault (Full App)`**.
5. VS Code will automatically start:
   - In-memory zero-config MongoDB
   - Seed database with users and documents
   - Express REST API & React Frontend on **http://localhost:5000**
   - Automatically launch your web browser!

---

## 💻 Method 2: Using the VS Code Integrated Terminal

1. Open **VS Code** with the project folder.
2. Open the terminal by pressing **`Ctrl + \``** (or click **Terminal > New Terminal**).
3. Type:
   ```bash
   npm start
   ```
   *(or `node dev-start.js` or `.\start.bat` on Windows)*
4. Open your browser and go to:
   - **Web Application:** [http://localhost:5000](http://localhost:5000)
   - **Swagger API Docs:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
   - **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🔑 Demo Login Credentials (Click to Instant-Fill on Login Page)

| Role | Email | Password | Permissions & Features |
| :--- | :--- | :--- | :--- |
| 🔴 **Admin** | `admin@trustvault.local` | `Admin@TrustVault2026!` | Audit Explorer, User Management, Chain Verification |
| 🔵 **Owner** (Alice) | `owner@trustvault.local` | `Owner@TrustVault2026!` | Upload documents, Share with users, Revoke grants |
| 🟢 **Viewer** (Bob) | `viewer@trustvault.local` | `Viewer@TrustVault2026!` | View & download permitted documents |
| 🟡 **Collaborator** | `collaborator@trustvault.local` | `Collab@TrustVault2026!` | Edit document metadata |
| ⚪ **Suspended** | `disabled@trustvault.local` | `Disabled@TrustVault2026!` | Access denied test account |

---

## 🧪 How to Run Security Tests in VS Code

In the VS Code terminal, run:
```bash
npm test
```
*(or run `.\test.bat`)*

This runs all **19 automated security integration tests** verifying:
- Cross-user access isolation
- IDOR / BOLA prevention
- Immediate ACL revocation
- Ephemeral download tickets & cross-user spoofing prevention
- SHA-256 hash-chained audit log integrity
- Executable rejection & magic-byte validation
