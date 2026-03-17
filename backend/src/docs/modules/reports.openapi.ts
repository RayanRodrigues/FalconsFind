import type { OpenApiModule } from '../openapi.types.js';

export const reportsOpenApi: OpenApiModule = {
  tags: [{ name: 'Reports', description: 'Lost and found report operations' }],
  paths: {
    '/api/v1/reports/reference/{referenceCode}': {
      get: {
        tags: ['Reports'],
        summary: 'Get a report by reference code',
        parameters: [
          {
            name: 'referenceCode',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Report reference code',
          },
        ],
        responses: {
          200: {
            description: 'Report retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EditableReportResponse',
                },
              },
            },
          },
          400: {
            description: 'Invalid reference code parameter',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          404: {
            description: 'Report not found',
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
      patch: {
        tags: ['Reports'],
        summary: 'Edit a report by reference code',
        parameters: [
          {
            name: 'referenceCode',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Report reference code',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateReportByReferenceRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Report updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EditableReportResponse',
                },
              },
            },
          },
          400: {
            description: 'Invalid reference code or request payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          404: {
            description: 'Report not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          409: {
            description: 'Report can no longer be edited',
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
  },
  schemas: {
    EditableReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode', 'kind', 'status', 'title', 'dateReported'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: { type: 'string', example: 'FND-20260214-ABC12345' },
        kind: { type: 'string', enum: ['LOST', 'FOUND'], example: 'FOUND' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        title: { type: 'string', example: 'Black Backpack' },
        category: { type: 'string', example: 'Accessories' },
        description: { type: 'string', example: 'Black backpack with laptop sleeve' },
        location: { type: 'string', example: 'Library' },
        dateReported: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
      },
    },
    UpdateReportByReferenceRequest: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1 },
        category: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        location: { type: 'string', minLength: 1 },
        dateReported: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
      },
      minProperties: 1,
    },
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
