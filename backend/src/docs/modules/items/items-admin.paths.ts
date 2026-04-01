import { errorResponseRefs } from '../common.openapi.js';

const adminItemIdParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
  },
  description: 'Item or report document id',
} as const;

const itemHistoryIdParameter = {
  ...adminItemIdParameter,
  description: 'Item id or related report id',
} as const;

export const itemAdminPaths = {
  '/api/v1/admin/items/{id}/history': {
    get: {
      tags: ['Items'],
      summary: 'Get the full administrative history for an item',
      security: [{ bearerAuth: [] }],
      parameters: [itemHistoryIdParameter],
      responses: {
        200: {
          description: 'Item history retrieved successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ItemHistoryResponse',
              },
            },
          },
        },
        400: {
          ...errorResponseRefs.badRequest,
        },
        401: {
          ...errorResponseRefs.unauthorized,
        },
        403: {
          ...errorResponseRefs.forbidden,
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
  '/api/v1/admin/items/{id}/status': {
    patch: {
      tags: ['Items'],
      summary: 'Update an item status for operational reality',
      security: [{ bearerAuth: [] }],
      parameters: [adminItemIdParameter],
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
        401: {
          ...errorResponseRefs.unauthorized,
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
  '/api/v1/admin/items/{id}/restore-status': {
    post: {
      tags: ['Items'],
      summary: 'Restore an item to a selected previous status from its history',
      security: [{ bearerAuth: [] }],
      parameters: [adminItemIdParameter],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RestoreItemStatusRequest',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Item status restored successfully',
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
        401: {
          ...errorResponseRefs.unauthorized,
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
} as const;
