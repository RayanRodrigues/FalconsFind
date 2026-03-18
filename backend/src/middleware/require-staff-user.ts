import type { NextFunction, Request, RequestHandler, Response } from 'express';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { UserRole } from '../contracts/index.js';
import { HttpError } from '../routes/route-utils.js';

type DecodedToken = {
  uid: string;
  email?: string;
  role?: unknown;
};

type AuthDependencies = {
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<DecodedToken>;
};

const isUserRole = (value: unknown): value is UserRole =>
  value === UserRole.ADMIN || value === UserRole.SECURITY;

const defaultDependencies: AuthDependencies = {
  verifyIdToken: async (token, checkRevoked) => admin.auth().verifyIdToken(token, checkRevoked),
};

const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const resolveStaffRole = async (
  db: Firestore,
  uid: string,
  roleCandidate: unknown,
): Promise<UserRole | null> => {
  if (isUserRole(roleCandidate)) {
    return roleCandidate;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  const storedRole = userDoc.data()?.['role'];
  return isUserRole(storedRole) ? storedRole : null;
};

export const createRequireStaffRoles = (
  db: Firestore,
  allowedRoles: readonly UserRole[],
  dependencies: AuthDependencies = defaultDependencies,
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.header('authorization'));
      if (!token) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
      }

      let decoded: DecodedToken;
      try {
        decoded = await dependencies.verifyIdToken(token, true);
      } catch (error) {
        const authCode = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';

        if (authCode === 'auth/id-token-revoked') {
          throw new HttpError(401, 'AUTH_TOKEN_REVOKED', 'Authentication token has been revoked. Please sign in again.');
        }

        throw new HttpError(401, 'INVALID_AUTH_TOKEN', 'Authentication token is invalid or expired.');
      }

      const role = await resolveStaffRole(db, decoded.uid, decoded.role);
      if (!role) {
        throw new HttpError(403, 'FORBIDDEN', 'This account is not authorized for staff access.');
      }

      if (!allowedRoles.includes(role)) {
        throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
      }

      res.locals.authUser = {
        uid: decoded.uid,
        email: decoded.email ?? null,
        role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
