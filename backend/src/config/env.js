import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustvault',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'trustvault_access_secret_super_secure_key_32bytes_min',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'trustvault_refresh_secret_super_secure_key_32bytes_min',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'trustvault_cookie_signing_secret_dev_32char',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  LOCAL_STORAGE_DIR: process.env.LOCAL_STORAGE_DIR || path.resolve(__dirname, '../../uploads'),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  AI_SERVICE_ENABLED: process.env.AI_SERVICE_ENABLED === 'true',
  AI_API_KEY: process.env.AI_API_KEY || '',
};
