import crypto from 'crypto';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { TokenService } from '../services/tokenService.js';
import { auditService } from '../services/auditService.js';
import { firebaseAuthService } from '../services/firebaseAuthService.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, USER_STATUS } from '../constants/index.js';
import { registerSchema, loginSchema } from '../utils/validators.js';

export async function register(req, res, next) {
  try {
    const validated = registerSchema.parse(req.body);

    // Prevent duplicate email registration
    const existing = await User.findOne({ email: validated.email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    // Hash password with bcrypt work factor 12
    const passwordHash = await User.hashPassword(validated.password);

    const user = new User({
      name: validated.name,
      email: validated.email.toLowerCase(),
      passwordHash,
      role: validated.role || 'viewer',
      status: USER_STATUS.ACTIVE,
    });

    await user.save();

    // Log registration
    await auditService.logEvent({
      actor: user,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.AUTH_REGISTER,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: { role: user.role },
    });

    res.status(201).json({
      success: true,
      message: 'Account successfully registered.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Find user with password hash explicitly selected
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    // Generic error to prevent account enumeration
    if (!user) {
      await auditService.logEvent({
        actorEmail: email.toLowerCase(),
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        outcome: AUDIT_OUTCOMES.FAILED,
        reason: 'User not found or invalid credentials',
        correlationId: req.correlationId,
        ipAddress,
        userAgent,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email address or password.',
      });
    }

    // Check account status
    if (user.status !== USER_STATUS.ACTIVE) {
      await auditService.logEvent({
        actor: user,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        outcome: AUDIT_OUTCOMES.DENIED,
        reason: 'Account is disabled',
        correlationId: req.correlationId,
        ipAddress,
        userAgent,
      });

      return res.status(403).json({
        success: false,
        error: 'Your account has been disabled. Please contact an administrator.',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await auditService.logEvent({
        actor: user,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        outcome: AUDIT_OUTCOMES.FAILED,
        reason: 'Invalid password',
        correlationId: req.correlationId,
        ipAddress,
        userAgent,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email address or password.',
      });
    }

    // Create revocable server-side session
    const rawRefreshToken = TokenService.generateRefreshToken();
    const refreshTokenHash = Session.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = new Session({
      userId: user._id,
      refreshTokenHash,
      userAgent,
      ipAddress,
      isValid: true,
      expiresAt,
    });
    await session.save();

    // Generate short-lived access JWT (15 mins)
    const accessToken = TokenService.generateAccessToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      sessionId: session._id,
    });

    // Generate CSRF token
    const csrfToken = TokenService.generateCsrfToken();

    // Set secure HttpOnly cookies
    res.cookie('access_token', accessToken, TokenService.getCookieOptions(false));
    res.cookie('refresh_token', rawRefreshToken, TokenService.getCookieOptions(true));
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // Read by frontend to attach to X-CSRF-Token header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Log successful login
    await auditService.logEvent({
      actor: user,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress,
      userAgent,
      metadata: { sessionId: session._id },
    });

    res.json({
      success: true,
      message: 'Sign in successful.',
      accessToken,
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.session) {
      await Session.findByIdAndUpdate(req.session._id, { isValid: false });
    }

    if (req.user) {
      await auditService.logEvent({
        actor: req.user,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        correlationId: req.correlationId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('csrf_token');

    res.json({
      success: true,
      message: 'Successfully signed out.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(req, res) {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
    },
    sessionId: req.session._id,
  });
}

export async function listActiveSessions(req, res, next) {
  try {
    const sessions = await Session.find({
      userId: req.user._id,
      isValid: true,
      expiresAt: { $gt: new Date() },
    })
      .select('userAgent ipAddress createdAt lastActiveAt expiresAt')
      .lean();

    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        ...s,
        isCurrent: String(s._id) === String(req.session._id),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req, res, next) {
  try {
    const { sessionId } = req.params;

    // Verify session belongs to user or user is admin
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found.',
      });
    }

    if (session.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to revoke this session.',
      });
    }

    session.isValid = false;
    await session.save();

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      targetUserId: session.userId,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: { revokedSessionId: sessionId },
    });

    res.json({
      success: true,
      message: 'Session revoked successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function firebaseLogin(req, res, next) {
  try {
    const { idToken, role } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing Firebase ID token in request body.',
      });
    }

    // 1. Verify Firebase ID token cryptographically
    const decoded = await firebaseAuthService.verifyIdToken(idToken);
    const email = decoded.email.toLowerCase();

    // 2. Look up or auto-provision user in MongoDB
    let user = await User.findOne({ email });

    if (user) {
      // Check account status immediately
      if (user.status !== USER_STATUS.ACTIVE) {
        await auditService.logEvent({
          actor: user,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
          outcome: AUDIT_OUTCOMES.DENIED,
          reason: 'Disabled account attempted Firebase authentication',
          correlationId: req.correlationId,
          ipAddress,
          userAgent,
          metadata: { authProvider: 'firebase' },
        });

        return res.status(403).json({
          success: false,
          error: 'Your account has been disabled. Access denied.',
        });
      }
    } else {
      // Auto-provision registered user in TrustVault
      const randomPassword = crypto.randomBytes(32).toString('hex') + 'Aa1!';
      const passwordHash = await User.hashPassword(randomPassword);

      user = new User({
        name: decoded.name || email.split('@')[0],
        email,
        passwordHash,
        role: role === 'owner' ? 'owner' : 'viewer',
        status: USER_STATUS.ACTIVE,
      });
      await user.save();

      await auditService.logEvent({
        actor: user,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.AUTH_REGISTER,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        reason: 'User provisioned via Firebase Authentication',
        correlationId: req.correlationId,
        ipAddress,
        userAgent,
        metadata: { authProvider: 'firebase' },
      });
    }

    // 3. Create server-side revocable session
    const rawRefreshToken = TokenService.generateRefreshToken();
    const refreshTokenHash = Session.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = new Session({
      userId: user._id,
      refreshTokenHash,
      userAgent,
      ipAddress,
      isValid: true,
      expiresAt,
    });
    await session.save();

    // 4. Generate short-lived JWT access token & CSRF token
    const accessToken = TokenService.generateAccessToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      sessionId: session._id,
    });

    const csrfToken = TokenService.generateCsrfToken();

    // 5. Set secure HttpOnly cookies
    res.cookie('access_token', accessToken, TokenService.getCookieOptions(false));
    res.cookie('refresh_token', rawRefreshToken, TokenService.getCookieOptions(true));
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // 6. Log successful authentication in audit trail
    await auditService.logEvent({
      actor: user,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress,
      userAgent,
      metadata: {
        authProvider: 'firebase',
        sessionId: session._id,
        firebaseUid: decoded.uid,
      },
    });

    res.json({
      success: true,
      message: 'Firebase authentication successful. Secure session established.',
      accessToken,
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}
