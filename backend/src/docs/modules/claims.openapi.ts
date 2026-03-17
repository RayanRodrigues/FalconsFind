import type { OpenApiModule } from '../openapi.types.js';

export const claimsOpenApi: OpenApiModule = {
  tags: [{ name: 'Claims', description: 'Structured claim request operations' }],
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
  },
};
