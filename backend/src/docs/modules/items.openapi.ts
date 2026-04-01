import type { OpenApiModule } from '../openapi.types.js';
import { itemAdminPaths } from './items/items-admin.paths.js';
import { itemPublicPaths } from './items/items-public.paths.js';
import { itemCoreSchemas } from './items/items-core.schemas.js';
import { itemHistorySchemas } from './items/item-history.schemas.js';
import { itemPublicSchemas } from './items/items-public.schemas.js';

export const itemsOpenApi: OpenApiModule = {
  tags: [{ name: 'Items', description: 'Public and admin item operations' }],
  paths: {
    ...itemPublicPaths,
    ...itemAdminPaths,
  },
  schemas: {
    ...itemCoreSchemas,
    ...itemPublicSchemas,
    ...itemHistorySchemas,
  },
};
