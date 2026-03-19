import type { OpenApiModule } from '../openapi.types.js';
import { authOpenApi } from './auth.openapi.js';
import { claimsOpenApi } from './claims.openapi.js';
import { commonOpenApi } from './common.openapi.js';
import { healthOpenApi } from './health.openapi.js';
import { itemsOpenApi } from './items.openapi.js';
import { reportsOpenApi } from './reports.openapi.js';

export const openApiModules: OpenApiModule[] = [
  commonOpenApi,
  authOpenApi,
  healthOpenApi,
  reportsOpenApi,
  itemsOpenApi,
  claimsOpenApi,
];
