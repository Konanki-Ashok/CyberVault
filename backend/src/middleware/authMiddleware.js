import { TokenService } from '../services/tokenService.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { USER_STATUS } from '../constants/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a correlation ID to every request for request tracing
 */
export function correlationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

/**
 * Validates authentication token and verifies session state against database.
 * Token can arrive via HttpOnly cookie or Authorization Bearer header.
 */
export async function requireAuth(req, res, next) {
  try {
    let token = null;

    // 1. Check HttpOnly cookie first
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // 2. Check Authorization Bearer header
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No valid session or token provided.',
      });
    }

    // Verify token cryptographic signature
    const decoded = TokenService.verifyAccessToken(token);
    if (!decoded || !decoded.userId || !decoded.sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired access token.',
      });
    }

    // Verify server-side session in database (ensures immediate session revocation)
    const session = await Session.findById(decoded.sessionId).lean();
    if (!session || !session.isValid || new Date(session.expiresAt) <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Session has been revoked or expired. Please sign in again.',
      });
    }

    // Verify user exists and is still active (reject disabled users immediately)
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.',
      });
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return res.status(403).json({
        success: false,
        error: 'User account has been disabled. Access denied.',
      });
    }

    // Inject verified user and session into request
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    console.error('[requireAuth] Middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication verification failure.',
    });
  }
}

/**
 * Enforces role-based access for system-level actions (e.g., admin dashboard)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: ${roles.join(', ')}.`,
      });
    }

    next();
  };
}

/**
 * CSRF protection for cookie-authenticated state-changing requests
 */
export function requireCsrf(req, res, next) {
  // Safe HTTP methods don't require CSRF checks
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // If request uses Authorization header instead of cookie, CSRF is not applicable
  const hasAuthHeader = !!req.headers.authorization;
  const hasCookie = req.cookies && !!req.cookies.access_token;

  if (hasCookie && !hasAuthHeader) {
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies.csrf_token;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({
        success: false,
        error: 'CSRF validation failed: Missing or invalid X-CSRF-Token header.',
      });
    }
  }

  next();
}
