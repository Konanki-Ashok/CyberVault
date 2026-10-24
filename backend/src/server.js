import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`🔒 TrustVault Secure Document API running on port ${env.PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`📖 API Documentation: http://localhost:${env.PORT}/api/docs`);
      console.log(`====================================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[TrustVault] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await disconnectDB();
        console.log('[TrustVault] Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[TrustVault] Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
