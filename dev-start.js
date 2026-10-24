/**
 * TrustVault Dev Launcher (VS Code Ready)
 * -----------------------------------------
 * Starts an in-memory MongoDB via MongoMemoryServer, seeds demo accounts,
 * and launches the TrustVault Express server (serving API + React frontend).
 *
 * Automatically verifies dependencies and builds frontend if needed!
 *
 * Usage:
 *   node dev-start.js
 *   OR in VS Code: Press F5 or run 'npm start' in the integrated terminal
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// Helper to run a command synchronously with output streamed
function runSync(command, cwd, title) {
  console.log(`\n📦 [Setup] ${title}...`);
  try {
    execSync(command, { cwd, stdio: 'inherit', shell: true });
    console.log(`✅ [Setup] ${title} completed.`);
  } catch (err) {
    console.error(`❌ [Setup] Failed: ${title}`, err.message);
    throw err;
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('   🔐 TRUSTVAULT - SECURE DOCUMENT SHARING PLATFORM');
  console.log('   Zero-Trust Architecture | Tamper-Evident Audit Trail');
  console.log('═'.repeat(60));

  // 1. Check Backend Dependencies
  const backendModules = path.join(backendDir, 'node_modules');
  if (!fs.existsSync(backendModules)) {
    runSync('npm install', backendDir, 'Installing backend dependencies');
  }

  // 2. Check Frontend Build / Dependencies
  const frontendDist = path.join(frontendDir, 'dist');
  if (!fs.existsSync(frontendDist)) {
    const frontendModules = path.join(frontendDir, 'node_modules');
    if (!fs.existsSync(frontendModules)) {
      runSync('npm install', frontendDir, 'Installing frontend dependencies');
    }
    runSync('npm run build', frontendDir, 'Building production frontend assets');
  }

  // 3. Dynamically resolve MongoMemoryServer
  const require = createRequire(path.join(backendDir, 'package.json'));
  let MongoMemoryServer;
  try {
    const mms = require('mongodb-memory-server');
    MongoMemoryServer = mms.MongoMemoryServer;
  } catch (err) {
    console.log('\n⏳ Installing mongodb-memory-server for zero-config database...');
    runSync('npm install mongodb-memory-server --save-dev', backendDir, 'Installing MongoMemoryServer');
    const mms = require('mongodb-memory-server');
    MongoMemoryServer = mms.MongoMemoryServer;
  }

  // 4. Start in-memory MongoDB
  console.log('\n⏳ Starting in-memory MongoDB (MongoMemoryServer)...');
  const mongod = await MongoMemoryServer.create({
    binary: { arch: 'x64' },
    instance: { port: 27018 },
  });
  const mongoUri = mongod.getUri();
  console.log(`✅ MongoDB running at: ${mongoUri}`);

  // 5. Environment configuration for backend
  const backendEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '5000',
    MONGODB_URI: mongoUri,
    JWT_ACCESS_SECRET: 'trustvault_dev_access_secret_key_32chars_min!!',
    JWT_REFRESH_SECRET: 'trustvault_dev_refresh_secret_key_32chars_min!',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    COOKIE_SECRET: 'trustvault_dev_cookie_signing_secret_min32!!',
    FRONTEND_ORIGIN: 'http://localhost:5000',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: 'uploads',
    RATE_LIMIT_MAX: '1000',
    AI_SERVICE_ENABLED: 'false',
  };

  // 6. Seed demo accounts & audit logs
  console.log('\n⏳ Seeding demo accounts, ACLs, and initial audit chain...');
  const seed = spawn('node', ['seed/seed.js'], {
    cwd: backendDir,
    env: backendEnv,
    stdio: 'inherit',
    shell: true,
  });

  await new Promise((resolve, reject) => {
    seed.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Seed exited with code ${code}`));
    });
  });

  // 7. Start backend server (serves REST API + React frontend)
  console.log('\n⏳ Starting TrustVault server on port 5000...');
  const backend = spawn('node', ['src/server.js'], {
    cwd: backendDir,
    env: backendEnv,
    stdio: 'inherit',
    shell: true,
  });

  // Wait a brief moment for server to bind
  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n' + '═'.repeat(60));
  console.log('  🚀 TRUSTVAULT IS LIVE & READY IN VS CODE!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  🖥️  Web Application:  http://localhost:5000');
  console.log('  📖  Swagger API Docs: http://localhost:5000/api/docs');
  console.log('  💚  Health Endpoint:  http://localhost:5000/api/health');
  console.log('');
  console.log('─'.repeat(60));
  console.log('  Demo Logins (Click any button on login page to instant-fill):');
  console.log('  ┌───────────────┬───────────────────────────────┬─────────────────────────┐');
  console.log('  │ Role          │ Email                         │ Password                │');
  console.log('  ├───────────────┼───────────────────────────────┼─────────────────────────┤');
  console.log('  │ 🔴 Admin      │ admin@trustvault.local         │ Admin@TrustVault2026!   │');
  console.log('  │ 🔵 Owner      │ owner@trustvault.local         │ Owner@TrustVault2026!   │');
  console.log('  │ 🟢 Viewer     │ viewer@trustvault.local        │ Viewer@TrustVault2026!  │');
  console.log('  │ 🟡 Collab     │ collaborator@trustvault.local  │ Collab@TrustVault2026!  │');
  console.log('  │ ⚪ Suspended  │ disabled@trustvault.local      │ Disabled@TrustVault2026!│');
  console.log('  └───────────────┴───────────────────────────────┴─────────────────────────┘');
  console.log('═'.repeat(60));
  console.log('\n  👉 Open http://localhost:5000 in your browser to begin.');
  console.log('  👉 Press Ctrl + C in this terminal to stop the servers.\n');

  // Automatically open browser on Windows/Mac/Linux
  try {
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    execSync(`${startCmd} http://localhost:5000`, { stdio: 'ignore' });
  } catch {
    // Ignore browser launch failure if headless
  }

  // Graceful cleanup on exit
  const cleanup = async () => {
    console.log('\n🛑 Stopping TrustVault services...');
    backend.kill();
    await mongod.stop();
    console.log('✅ All services stopped.\n');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', async (err) => {
    console.error('Fatal error:', err);
    await cleanup();
  });
}

main().catch(async (err) => {
  console.error('❌ Failed to start TrustVault:', err.message);
  process.exit(1);
});
