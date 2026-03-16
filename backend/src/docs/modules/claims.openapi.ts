import type { OpenApiModule } from '../openapi.types.js';

export const claimsOpenApi: OpenApiModule = {
  tags: [{ name: 'Claims', description: 'Claim review and lifecycle operations' }],
  paths: {
    '/api/v1/claims/{id}/status': {
      patch: {
        tags: ['Claims'],
        summary: 'Approve or reject a pending claim and sync the related item status',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Claim document id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateClaimStatusRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Claim and item statuses updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ClaimStatusUpdateResponse',
                },
              },
            },
          },
          400: {
            description: 'Invalid claim id or request payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          404: {
            description: 'Claim or related item was not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          409: {
            description: 'Claim is not pending anymore',
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
    UpdateClaimStatusRequest: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['APPROVED', 'REJECTED'],
          example: 'APPROVED',
        },
      },
    },
    ClaimStatusUpdateResponse: {
      type: 'object',
      required: ['id', 'status', 'itemId', 'itemStatus'],
      properties: {
        id: { type: 'string', example: 'claim-123' },
        status: { type: 'string', enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' },
        itemId: { type: 'string', example: 'item-abc123' },
        itemStatus: {
          type: 'string',
          enum: ['CLAIMED', 'VALIDATED'],
          example: 'CLAIMED',
        },
      },
    },
  },
};
