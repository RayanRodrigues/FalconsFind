import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

export const healthOpenApi: OpenApiModule = {
  tags: [{ name: 'Health', description: 'Service and Firebase health checks' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Get service health status',
        responses: {
          200: {
            description: 'Service is reachable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Get backend health status',
        responses: {
          200: {
            description: 'Backend is reachable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health/firebase': {
      get: {
        tags: ['Health'],
        summary: 'Get Firebase connectivity status',
        responses: {
          200: {
            description: 'Firebase health document was found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FirebaseHealthResponse',
                },
              },
            },
          },
          404: {
            ...errorResponseRefs.notFound,
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
  },
  schemas: {
    HealthResponse: {
      type: 'object',
      required: ['ok', 'service'],
      properties: {
        ok: { type: 'boolean', example: true },
        service: { type: 'string', example: 'backend' },
      },
    },
    FirebaseHealthResponse: {
      type: 'object',
      required: ['ok', 'firebase'],
      properties: {
        ok: { type: 'boolean', example: true },
        firebase: { type: 'boolean', example: true },
        data: { type: 'object', additionalProperties: true },
      },
    },
  },
};
