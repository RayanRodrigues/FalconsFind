import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import type { RedisClient } from '../bootstrap/redis.js';
import { UserRole } from '../contracts/index.js';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../contracts/index.js';
import { HttpError, API_PREFIX } from './route-utils.js';
import { parseBodyOrThrow } from './schema-validation.js';
import { createLoginAttemptsService } from '../services/login-attempts.service.js';
import {
  EmailAlreadyInUseError,
  InvalidLoginCredentialsError,
  LoginConfigurationError,
  LoginForbiddenError,
  RegistrationError,
  loginUser,
  registerStudentUser,
  revokeStaffSession,
} from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';

type AuthService = {
  loginUser: (db: Firestore, payload: LoginRequest) => Promise<LoginResponse>;
  registerStudentUser: (db: Firestore, payload: RegisterRequest) => Promise<RegisterResponse>;
  revokeStaffSession: (uid: string) => Promise<void>;
  EmailAlreadyInUseError: typeof EmailAlreadyInUseError;
  InvalidLoginCredentialsError: typeof InvalidLoginCredentialsError;
  LoginConfigurationError: typeof LoginConfigurationError;
  LoginForbiddenError: typeof LoginForbiddenError;
  RegistrationError: typeof RegistrationError;
};

const defaultAuthService: AuthService = {
  loginUser,
  registerStudentUser,
  revokeStaffSession,
  EmailAlreadyInUseError,
  InvalidLoginCredentialsError,
  LoginConfigurationError,
  LoginForbiddenError,
  RegistrationError,
};

type AuthRouterOptions = {
  requireStaffUser?: RequestHandler;
};

export const createAuthRouter = (
  db: Firestore,
  redis: RedisClient | null,
  authService: AuthService = defaultAuthService,
  options: AuthRouterOptions = {},
): Router => {
  const router = Router();
  const attempts = createLoginAttemptsService(redis);
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      },
    },
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window — tighter than login
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many registration attempts. Please try again later.',
      },
    },
  });

  router.post(`${API_PREFIX}/auth/login`, loginLimiter, async (req, res) => {
    const payload = parseBodyOrThrow(loginSchema, req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const lockState = await attempts.getLockState(payload.email, clientIp);
    if (lockState.locked) {
      if (lockState.retryAfterSeconds) {
        res.setHeader('Retry-After', String(lockState.retryAfterSeconds));
      }
      throw new HttpError(429, 'AUTH_LOCKED', 'Too many failed login attempts. Please try again later.');
    }

    let result: LoginResponse;
    try {
      result = await authService.loginUser(db, payload);
      await attempts.clear(payload.email, clientIp);
    } catch (error) {
      if (error instanceof authService.InvalidLoginCredentialsError) {
        const failureState = await attempts.recordFailure(payload.email, clientIp);
        if (failureState.locked && failureState.retryAfterSeconds) {
          res.setHeader('Retry-After', String(failureState.retryAfterSeconds));
          throw new HttpError(429, 'AUTH_LOCKED', 'Too many failed login attempts. Please try again later.');
        }

        throw new HttpError(401, 'INVALID_CREDENTIALS', error.message);
      }

      if (error instanceof authService.LoginForbiddenError) {
        throw new HttpError(403, 'FORBIDDEN', error.message);
      }

      if (error instanceof authService.LoginConfigurationError) {
        throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', error.message);
      }

      throw error;
    }

    res.status(200).json(result);
  });

  router.post(`${API_PREFIX}/auth/register`, registerLimiter, async (req, res) => {
    const payload = parseBodyOrThrow(registerSchema, req.body);

    try {
      const result = await authService.registerStudentUser(db, payload);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof authService.EmailAlreadyInUseError) {
        throw new HttpError(409, 'EMAIL_ALREADY_IN_USE', error.message);
      }
      if (error instanceof authService.RegistrationError) {
        throw new HttpError(503, 'REGISTRATION_FAILED', error.message);
      }
      throw error;
    }
  });

  router.post(`${API_PREFIX}/auth/logout`, requireStaffUser, async (_req, res) => {
    const authUser = res.locals.authUser as { uid?: string } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    await authService.revokeStaffSession(uid);
    res.status(204).end();
  });

  return router;
};
