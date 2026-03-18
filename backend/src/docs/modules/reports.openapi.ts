import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

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
            ...errorResponseRefs.badRequest,
          },
          404: {
            ...errorResponseRefs.notFound,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
            ...errorResponseRefs.badRequest,
          },
          404: {
            ...errorResponseRefs.notFound,
          },
          409: {
            ...errorResponseRefs.conflict,
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
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
            ...errorResponseRefs.badRequest,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/CreateLostReportRequest',
              },
              encoding: {
                photo: {
                  contentType: 'image/jpeg, image/png',
                },
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
            ...errorResponseRefs.badRequest,
          },
          429: {
            ...errorResponseRefs.tooManyRequests,
          },
          503: {
            ...errorResponseRefs.serviceUnavailable,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
              encoding: {
                photo: {
                  contentType: 'image/jpeg, image/png',
                },
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
            ...errorResponseRefs.badRequest,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
            ...errorResponseRefs.badRequest,
          },
          429: {
            ...errorResponseRefs.tooManyRequests,
          },
          503: {
            ...errorResponseRefs.serviceUnavailable,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260214-ABC12345',
        },
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
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260214-ABC12345',
        },
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
        category: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        additionalInfo: { type: 'string', minLength: 1 },
        lastSeenLocation: { type: 'string', minLength: 1 },
        lastSeenAt: { type: 'string', format: 'date-time' },
        contactEmail: { type: 'string', format: 'email' },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Optional JPEG or PNG image file uploaded as multipart form data',
        },
      },
    },
    CreateLostReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'LST-20260214-ABC12345',
        },
      },
    },
    CreateFoundReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260214-ABC12345',
        },
      },
    },
    ValidateFoundReportResponse: {
      type: 'object',
      required: ['id', 'referenceCode', 'status'],
      properties: {
        id: { type: 'string', example: 'AbCdEF123456' },
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260214-ABC12345',
        },
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
        photo: {
          type: 'string',
          format: 'binary',
          description: 'JPEG or PNG image file uploaded as multipart form data',
        },
      },
    },
  },
};
