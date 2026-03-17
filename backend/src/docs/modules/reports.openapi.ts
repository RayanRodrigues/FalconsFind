import type { OpenApiModule } from '../openapi.types.js';

export const reportsOpenApi: OpenApiModule = {
  tags: [{ name: 'Reports', description: 'Lost and found report operations' }],
  paths: {
    '/api/v1/admin/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List all lost and found reports for the centralized admin dashboard',
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            description: 'Page number (1-based)',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Reports per page',
          },
          {
            name: 'kind',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['LOST', 'FOUND'],
            },
            description: 'Filter reports by kind',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              $ref: '#/components/schemas/ItemStatus',
            },
            description: 'Filter reports by current status',
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Case-insensitive search over title, description, reference code, location, and contact email',
          },
        ],
        responses: {
          200: {
            description: 'Reports listed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminReportsListResponse',
                },
              },
            },
          },
          400: {
            description: 'Invalid query parameter',
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
    ItemStatus: {
      type: 'string',
      enum: ['REPORTED', 'PENDING_VALIDATION', 'VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
    },
    AdminReportResponse: {
      type: 'object',
      required: ['id', 'kind', 'title', 'status', 'referenceCode', 'dateReported'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        kind: { type: 'string', enum: ['LOST', 'FOUND'], example: 'FOUND' },
        title: { type: 'string', example: 'Black Backpack' },
        category: { type: 'string', example: 'Accessories' },
        description: { type: 'string', example: 'Black backpack with laptop sleeve' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        referenceCode: { type: 'string', example: 'FND-20260214-ABC12345' },
        location: { type: 'string', example: 'Library' },
        dateReported: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
        photoUrl: { type: 'string' },
      },
    },
    AdminReportsListResponse: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPrevPage', 'filters', 'summary', 'reports'],
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 42 },
        totalPages: { type: 'integer', example: 3 },
        hasNextPage: { type: 'boolean', example: true },
        hasPrevPage: { type: 'boolean', example: false },
        filters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['LOST', 'FOUND'], nullable: true },
            status: { $ref: '#/components/schemas/ItemStatus' },
            search: { type: 'string', nullable: true },
          },
        },
        summary: {
          type: 'object',
          required: ['totalReports', 'lostReports', 'foundReports', 'byStatus'],
          properties: {
            totalReports: { type: 'integer', example: 42 },
            lostReports: { type: 'integer', example: 18 },
            foundReports: { type: 'integer', example: 24 },
            byStatus: {
              type: 'object',
              additionalProperties: {
                type: 'integer',
              },
              example: {
                REPORTED: 5,
                PENDING_VALIDATION: 7,
                VALIDATED: 20,
                CLAIMED: 6,
                RETURNED: 3,
                ARCHIVED: 1,
              },
            },
          },
        },
        reports: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/AdminReportResponse',
          },
        },
      },
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
