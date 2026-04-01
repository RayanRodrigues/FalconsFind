import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { UserRole } from '../contracts/index.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';
import { registerPublicReportRoutes } from './reports/public-reports.routes.js';
import { registerAdminReportRoutes } from './reports/admin-reports.routes.js';
import { reportsServiceModule, schemaModule } from './reports/reports-router-modules.js';

type ReportsRouterOptions = {
  requireStaffUser?: RequestHandler;
};

export const createReportsRouter = (
  db: Firestore,
  bucket: Bucket,
  options: ReportsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);

  const deps = {
    router,
    db,
    bucket,
    requireStaffUser,
    schemaModule,
    reportsServiceModule,
  };

  registerPublicReportRoutes(deps);
  registerAdminReportRoutes(deps);

  return router;
};
