import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDB(uri = env.MONGODB_URI) {
  if (isConnected) return mongoose.connection;
  
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
    });
    isConnected = true;
    console.log(`[TrustVault Database] Connected to MongoDB at ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[TrustVault Database] Connection failed: ${error.message}`);
    throw error;
  }
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[TrustVault Database] Disconnected');
}
