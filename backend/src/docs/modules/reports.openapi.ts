import type { OpenApiModule } from '../openapi.types.js';

export const reportsOpenApi: OpenApiModule = {
  tags: [{ name: 'Reports', description: 'Lost and found report operations' }],
  paths: {
    '/api/v1/reports/lost': {
      post: {
        tags: ['Reports'],
        summary: 'Create a lost-item report',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateLostReportRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Lost report created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateLostReportResponse',
                },
              },
            },
          },
          400: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          500: {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/reports/found': {
      post: {
        tags: ['Reports'],
        summary: 'Create a found-item report',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/CreateFoundReportRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Found report created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateFoundReportResponse',
                },
              },
            },
          },
          400: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          500: {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/reports/found/{id}/validate': {
      patch: {
        tags: ['Reports'],
        summary: 'Validate a pending found-item report before publication',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Found report document id',
          },
        ],
        responses: {
          200: {
            description: 'Found report validated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidateFoundReportResponse',
                },
              },
            },
          },
          400: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          500: {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  schemas: {
    CreateLostReportRequest: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        lastSeenLocation: { type: 'string', minLength: 1 },
        lastSeenAt: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
        photoDataUrl: { type: 'string', description: 'Image encoded as data URL' },
      },
    },
    CreateLostReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: { type: 'string', example: 'LST-20260214-ABC12345' },
      },
    },
    CreateFoundReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: { type: 'string', example: 'FND-20260214-ABC12345' },
      },
    },
    ValidateFoundReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode', 'status'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: { type: 'string', example: 'FND-20260214-ABC12345' },
        status: { type: 'string', enum: ['VALIDATED'], example: 'VALIDATED' },
      },
    },
    CreateFoundReportRequest: {
      type: 'object',
      required: ['title', 'foundLocation', 'photo'],
      properties: {
        title: { type: 'string', minLength: 1 },
        category: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        foundLocation: { type: 'string', minLength: 1 },
        foundAt: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
        photo: { type: 'string', format: 'binary' },
      },
    },
  },
};
