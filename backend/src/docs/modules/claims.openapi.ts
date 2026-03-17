import type { OpenApiModule } from '../openapi.types.js';

export const claimsOpenApi: OpenApiModule = {
  tags: [{ name: 'Claims', description: 'Claim request and lifecycle operations' }],
  paths: {
    '/api/v1/claims': {
      post: {
        tags: ['Claims'],
        summary: 'Submit a structured claim request for a found item',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateClaimRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Claim request submitted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateClaimResponse',
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
          404: {
            description: 'Target item was not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          409: {
            description: 'Target item is not eligible for claim requests',
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
    CreateClaimRequest: {
      type: 'object',
      required: ['itemId', 'claimantName', 'claimantEmail'],
      properties: {
        itemId: { type: 'string', example: 'report-123' },
        claimantName: { type: 'string', example: 'Jane Doe' },
        claimantEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
        message: { type: 'string', example: 'I can describe a sticker on the back.' },
      },
    },
    CreateClaimResponse: {
      type: 'object',
      required: ['id', 'status', 'createdAt'],
      properties: {
        id: { type: 'string', example: 'claim-123' },
        status: { type: 'string', enum: ['PENDING'], example: 'PENDING' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
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
