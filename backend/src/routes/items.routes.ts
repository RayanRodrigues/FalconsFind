import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import { UserRole } from '../contracts/index.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';
import { registerPublicItemRoutes } from './items/public-items.routes.js';
import { registerAdminItemRoutes } from './items/admin-items.routes.js';

type ItemsRouterOptions = {
  requireStaffUser?: RequestHandler;
};

export const createItemsRouter = (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  options: ItemsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);

  const deps = {
    router,
    db,
    bucket,
    redis,
    requireStaffUser,
  };

  registerPublicItemRoutes(deps);
  registerAdminItemRoutes(deps);

  return router;
};
