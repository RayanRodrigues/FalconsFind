import type { OpenApiModule } from '../openapi.types.js';
import { reportAdminPaths } from './reports/report-admin.paths.js';
import { reportEditPaths } from './reports/report-edit.paths.js';
import { reportSubmitPaths } from './reports/report-submit.paths.js';
import { reportAdminSchemas } from './reports/report-admin.schemas.js';
import { reportCoreSchemas } from './reports/report-core.schemas.js';
import { reportSubmitSchemas } from './reports/report-submit.schemas.js';

export const reportsOpenApi: OpenApiModule = {
  tags: [{ name: 'Reports', description: 'Lost and found report operations' }],
  paths: {
    ...reportEditPaths,
    ...reportAdminPaths,
    ...reportSubmitPaths,
  },
  schemas: {
    ...reportCoreSchemas,
    ...reportAdminSchemas,
    ...reportSubmitSchemas,
  },
};
