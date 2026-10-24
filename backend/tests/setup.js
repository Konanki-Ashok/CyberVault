import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { TokenService } from '../src/services/tokenService.js';
import { USER_STATUS } from '../src/constants/index.js';

let mongoServer;

export async function setupTestDB() {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create({
    binary: { arch: 'x64' },
    spawnTimeoutMS: 60000,
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

export async function teardownTestDB() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Creates a test user in the database, generates a valid session and returns tokens
 */
export async function createTestUser({
  name = 'Test User',
  email,
  password = 'TestPassword123!',
  role = 'viewer',
  status = USER_STATUS.ACTIVE,
}) {
  const passwordHash = await User.hashPassword(password);
  const user = new User({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    status,
  });
  await user.save();

  // Create active session
  const rawRefreshToken = TokenService.generateRefreshToken();
  const refreshTokenHash = Session.hashToken(rawRefreshToken);
  const session = new Session({
    userId: user._id,
    refreshTokenHash,
    isValid: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await session.save();

  const accessToken = TokenService.generateAccessToken({
    userId: user._id,
    email: user.email,
    role: user.role,
    sessionId: session._id,
  });

  const csrfToken = TokenService.generateCsrfToken();

  return {
    user,
    session,
    accessToken,
    csrfToken,
    authHeader: `Bearer ${accessToken}`,
    cookies: {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      csrf_token: csrfToken,
    },
  };
}
