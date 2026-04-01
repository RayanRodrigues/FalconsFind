import { errorResponseRefs } from '../common.openapi.js';

const itemIdParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
  },
  description: 'Item id or related report id',
} as const;

export const itemPublicPaths = {
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
        {
          name: 'sort',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['most_recent', 'oldest'],
            default: 'most_recent',
          },
          description: 'Sort found items by reported date. Defaults to newest first.',
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
        400: {
          ...errorResponseRefs.badRequest,
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
      parameters: [itemIdParameter],
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
  '/api/v1/items/{id}/status': {
    get: {
      tags: ['Items'],
      summary: 'Get public item availability status by id',
      parameters: [itemIdParameter],
      responses: {
        200: {
          description: 'Item status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ItemStatusResponse',
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
} as const;
