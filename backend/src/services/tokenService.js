import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export class TokenService {
  /**
   * Signs an access JWT containing user id, email, role, and sessionId
   */
  static generateAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    });
  }

  /**
   * Verifies an access JWT
   */
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      return null;
    }
  }

  /**
   * Generates a random cryptographic refresh token (64 hex chars)
   */
  static generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a cryptographically random CSRF token
   */
  static generateCsrfToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Cookie configuration for access & refresh tokens
   */
  static getCookieOptions(isRefreshToken = false) {
    const isProd = env.NODE_ENV === 'production';
    const maxAge = isRefreshToken
      ? 7 * 24 * 60 * 60 * 1000 // 7 days
      : 15 * 60 * 1000; // 15 mins

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    };
  }
}
