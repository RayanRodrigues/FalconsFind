import type { OpenApiModule } from '../openapi.types.js';
import { healthOpenApi } from './health.openapi.js';
import { itemsOpenApi } from './items.openapi.js';
import { reportsOpenApi } from './reports.openapi.js';

export const openApiModules: OpenApiModule[] = [healthOpenApi, reportsOpenApi, itemsOpenApi];
