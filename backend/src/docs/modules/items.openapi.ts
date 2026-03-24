import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

export const itemsOpenApi: OpenApiModule = {
  tags: [{ name: 'Items', description: 'Public item details operations' }],
  paths: {
    '/api/v1/items': {
      get: {
        tags: ['Items'],
        summary: 'List publicly visible found items',
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
              maximum: 50,
              default: 10,
            },
            description: 'Items per page',
          },
          {
            name: 'keyword',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              minLength: 1,
            },
            description: 'Case-insensitive keyword search over item title and description',
          },
          {
            name: 'category',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Exact found-item category match',
          },
          {
            name: 'location',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Exact found-item location match',
          },
          {
            name: 'dateFrom',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date-time',
            },
            description: 'Inclusive start of the reported date range. Also accepts YYYY-MM-DD.',
          },
          {
            name: 'dateTo',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date-time',
            },
            description: 'Inclusive end of the reported date range. Also accepts YYYY-MM-DD.',
          },
        ],
        responses: {
          200: {
            description: 'Found items listed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ItemPublicListResponse',
                },
              },
            },
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/items/{id}': {
      get: {
        tags: ['Items'],
        summary: 'Get item details by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Item document id',
          },
        ],
        responses: {
          200: {
            description: 'Item details retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ItemDetailsResponse',
                },
              },
            },
          },
          400: {
            ...errorResponseRefs.badRequest,
          },
          403: {
            ...errorResponseRefs.forbidden,
          },
          404: {
            ...errorResponseRefs.notFound,
          },
          422: {
            ...errorResponseRefs.unprocessableEntity,
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/admin/items/{id}/status': {
      patch: {
        tags: ['Items'],
        summary: 'Update an item status for operational reality',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Item or report document id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateItemStatusRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Item status updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateItemStatusResponse',
                },
              },
            },
          },
          400: {
            ...errorResponseRefs.badRequest,
          },
          403: {
            ...errorResponseRefs.forbidden,
          },
          404: {
            ...errorResponseRefs.notFound,
          },
          409: {
            ...errorResponseRefs.conflict,
          },
          422: {
            ...errorResponseRefs.unprocessableEntity,
          },
          500: {
            ...errorResponseRefs.internalServerError,
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
    ClaimStatus: {
      type: 'string',
      enum: ['PENDING', 'NEEDS_PROOF', 'APPROVED', 'REJECTED', 'CANCELLED'],
    },
    UpdateItemStatusRequest: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
          example: 'RETURNED',
        },
      },
    },
    UpdateItemStatusResponse: {
      type: 'object',
      required: ['id', 'previousStatus', 'status', 'updatedAt', 'updatedByUid', 'updatedByRole'],
      properties: {
        id: { type: 'string', example: 'item-abc123' },
        previousStatus: { $ref: '#/components/schemas/ItemStatus' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        updatedAt: { type: 'string', format: 'date-time' },
        updatedByUid: { type: 'string', example: 'security-1' },
        updatedByEmail: { type: 'string', format: 'email', nullable: true, example: 'security@example.com' },
        updatedByRole: { type: 'string', enum: ['ADMIN', 'SECURITY'], example: 'SECURITY' },
      },
    },
    ItemPublicResponse: {
      type: 'object',
      required: ['id', 'title', 'status', 'referenceCode', 'dateReported'],
      properties: {
        id: { type: 'string', example: 'item-abc123' },
        title: { type: 'string', example: 'Black Backpack' },
        category: { type: 'string', example: 'Accessories' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260225-ABC12345',
        },
        location: { type: 'string', example: 'Library' },
        dateReported: { type: 'string', format: 'date-time' },
        thumbnailUrl: { type: 'string', format: 'uri' },
      },
    },
    ItemPublicListResponse: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPrevPage', 'items'],
      properties: {
        page: { type: 'integer', minimum: 1, example: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 50, example: 10 },
        total: { type: 'integer', minimum: 0, example: 42 },
        totalPages: { type: 'integer', minimum: 1, example: 5 },
        hasNextPage: { type: 'boolean', example: true },
        hasPrevPage: { type: 'boolean', example: false },
        filters: {
          type: 'object',
          properties: {
            keyword: { type: 'string', example: 'backpack' },
            category: { type: 'string', example: 'Accessories' },
            location: { type: 'string', example: 'Library' },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
          },
        },
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/ItemPublicResponse',
          },
        },
      },
    },
    ItemDetailsResponse: {
      type: 'object',
      required: ['id', 'title', 'status', 'referenceCode', 'dateReported'],
      properties: {
        id: { type: 'string', example: 'item-abc123' },
        title: { type: 'string', example: 'Black Backpack' },
        category: { type: 'string', example: 'Accessories' },
        description: { type: 'string', example: 'Black backpack with laptop sleeve' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        referenceCode: {
          type: 'string',
          pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
          description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
          example: 'FND-20260225-ABC12345',
        },
        location: { type: 'string', example: 'Library' },
        dateReported: { type: 'string', format: 'date-time' },
        imageUrls: {
          type: 'array',
          items: { type: 'string' },
          example: ['https://storage.googleapis.com/.../image.jpg'],
        },
        claimStatus: { $ref: '#/components/schemas/ClaimStatus' },
      },
    },
  },
};
