import { openApiModules } from './modules/index.js';
import type { OpenApiTag } from './openapi.types.js';

const tagsMap = new Map<string, OpenApiTag>();
const paths: Record<string, Record<string, unknown>> = {};
const schemas: Record<string, Record<string, unknown>> = {};

for (const moduleDoc of openApiModules) {
  for (const tag of moduleDoc.tags ?? []) {
    tagsMap.set(tag.name, tag);
  }

  Object.assign(paths, moduleDoc.paths ?? {});
  Object.assign(schemas, moduleDoc.schemas ?? {});
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'FalconFind Backend API',
    version: '1.0.0',
    description: 'API documentation for FalconsFind backend routes.',
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  tags: Array.from(tagsMap.values()),
  paths,
  components: {
    schemas,
  },
} as const;
