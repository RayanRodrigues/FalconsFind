import type { OpenApiModule } from '../openapi.types.js';

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
            description: 'Invalid item id parameter',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          403: {
            description: 'Item exists but is not publicly visible yet',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          404: {
            description: 'Item was not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          422: {
            description: 'Item data exists but is malformed/incomplete',
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
    ClaimStatus: {
      type: 'string',
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    },
    ItemPublicResponse: {
      type: 'object',
      required: ['id', 'title', 'status', 'referenceCode', 'dateReported'],
      properties: {
        id: { type: 'string', example: 'item-abc123' },
        title: { type: 'string', example: 'Black Backpack' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        referenceCode: { type: 'string', example: 'FND-20260225-ABC12345' },
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
        description: { type: 'string', example: 'Black backpack with laptop sleeve' },
        status: { $ref: '#/components/schemas/ItemStatus' },
        referenceCode: { type: 'string', example: 'FND-20260225-ABC12345' },
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
