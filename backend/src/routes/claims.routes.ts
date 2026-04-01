import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import { UserRole } from '../contracts/index.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';
import { registerAdminClaimsRoutes } from './claims/admin-claims.routes.js';
import { registerPublicClaimsRoutes } from './claims/public-claims.routes.js';
import { claimsServiceModule, schemaModule } from './claims/claims-router-modules.js';

type ClaimsRouterOptions = {
  requireStaffUser?: RequestHandler;
  requireAuthenticatedUser?: RequestHandler;
  requireClaimAccessUser?: RequestHandler;
};

export const createClaimsRouter = (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  options: ClaimsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);
  const requireAuthenticatedUser = options.requireAuthenticatedUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY, UserRole.STUDENT]);
  const requireClaimAccessUser = options.requireClaimAccessUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY, UserRole.STUDENT]);
  const deps = {
    router,
    db,
    bucket,
    redis,
    requireStaffUser,
    requireAuthenticatedUser,
    requireClaimAccessUser,
    schemaModule,
    claimsServiceModule,
  };

  registerPublicClaimsRoutes(deps);
  registerAdminClaimsRoutes(deps);

  return router;
};
