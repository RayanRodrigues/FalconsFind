import type { OpenApiModule } from '../openapi.types.js';
import { claimPaths } from './claims/claims.paths.js';
import { claimSchemas } from './claims/claims.schemas.js';

export const claimsOpenApi: OpenApiModule = {
  tags: [{ name: 'Claims', description: 'Claim request and lifecycle operations' }],
  paths: claimPaths,
  schemas: claimSchemas,
};
