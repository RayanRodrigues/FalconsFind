import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

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
            ...errorResponseRefs.badRequest,
          },
          401: {
            ...errorResponseRefs.unauthorized,
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
    '/api/v1/claims/{id}/status': {
      patch: {
        tags: ['Claims'],
        summary: 'Approve or reject a pending or proof-requested claim and sync the related item status',
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
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/admin/claims': {
      get: {
        tags: ['Claims'],
        summary: 'List all claims for the admin dashboard',
        responses: {
          200: {
            description: 'Claims retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminClaimsListResponse',
                },
              },
            },
          },
          401: {
            ...errorResponseRefs.unauthorized,
          },
          403: {
            ...errorResponseRefs.forbidden,
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/claims/{id}/proof-request': {
      patch: {
        tags: ['Claims'],
        summary: 'Request additional proof from the claimant',
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
                $ref: '#/components/schemas/RequestAdditionalProofRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Additional proof requested successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RequestAdditionalProofResponse',
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
    '/api/v1/claims/{id}/cancel': {
      patch: {
        tags: ['Claims'],
        summary: 'Cancel a pending or proof-requested claim',
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
        responses: {
          200: {
            description: 'Claim cancelled successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CancelClaimResponse',
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
  },
  schemas: {
    CreateClaimRequest: {
      type: 'object',
      required: ['referenceCode', 'itemName', 'claimReason', 'proofDetails', 'claimantName', 'claimantEmail'],
      properties: {
        referenceCode: { type: 'string', example: 'FF-2024-00001' },
        itemName: { type: 'string', example: 'Black backpack' },
        claimReason: { type: 'string', example: 'I lost this after class in B1040 and came back for it later.' },
        proofDetails: { type: 'string', example: 'It has my initials inside and a silver water bottle in the side pocket.' },
        claimantName: { type: 'string', example: 'Jane Doe' },
        claimantEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
        phone: { type: 'string', example: '519-555-0100' },
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
    AdminClaimResponse: {
      type: 'object',
      required: ['id', 'itemId', 'referenceCode', 'itemName', 'claimantName', 'claimantEmail', 'claimReason', 'proofDetails', 'status', 'createdAt'],
      properties: {
        id: { type: 'string', example: 'claim-123' },
        itemId: { type: 'string', example: 'item-abc123' },
        referenceCode: { type: 'string', example: 'FF-2024-00001' },
        itemName: { type: 'string', example: 'Black backpack' },
        claimantName: { type: 'string', example: 'Jane Doe' },
        claimantEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
        claimReason: { type: 'string', example: 'I lost this after class in B1040 and came back for it later.' },
        proofDetails: { type: 'string', example: 'It has my initials inside and a silver water bottle in the side pocket.' },
        phone: { type: 'string', example: '519-555-0100' },
        status: { type: 'string', enum: ['PENDING', 'NEEDS_PROOF', 'APPROVED', 'REJECTED', 'CANCELLED'], example: 'PENDING' },
        additionalProofRequest: { type: 'string', example: 'Please provide a photo of the serial number.' },
        proofRequestedAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    AdminClaimsListResponse: {
      type: 'object',
      required: ['claims', 'total', 'summary'],
      properties: {
        claims: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/AdminClaimResponse',
          },
        },
        total: { type: 'integer', example: 12 },
        summary: {
          type: 'object',
          required: ['totalClaims', 'pendingClaims', 'needsProofClaims', 'approvedClaims', 'rejectedClaims', 'cancelledClaims'],
          properties: {
            totalClaims: { type: 'integer', example: 12 },
            pendingClaims: { type: 'integer', example: 4 },
            needsProofClaims: { type: 'integer', example: 2 },
            approvedClaims: { type: 'integer', example: 3 },
            rejectedClaims: { type: 'integer', example: 2 },
            cancelledClaims: { type: 'integer', example: 1 },
          },
        },
      },
    },
    RequestAdditionalProofRequest: {
      type: 'object',
      required: ['message'],
      properties: {
        message: {
          type: 'string',
          example: 'Please provide a photo of the serial number or identify the contents inside the item.',
        },
      },
    },
    RequestAdditionalProofResponse: {
      type: 'object',
      required: ['id', 'status', 'additionalProofRequest', 'proofRequestedAt'],
      properties: {
        id: { type: 'string', example: 'claim-123' },
        status: { type: 'string', enum: ['NEEDS_PROOF'], example: 'NEEDS_PROOF' },
        additionalProofRequest: {
          type: 'string',
          example: 'Please provide a photo of the serial number or identify the contents inside the item.',
        },
        proofRequestedAt: { type: 'string', format: 'date-time' },
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
    CancelClaimResponse: {
      type: 'object',
      required: ['id', 'status', 'itemId', 'itemStatus'],
      properties: {
        id: { type: 'string', example: 'claim-123' },
        status: { type: 'string', enum: ['CANCELLED'], example: 'CANCELLED' },
        itemId: { type: 'string', example: 'item-abc123' },
        itemStatus: {
          type: 'string',
          enum: ['VALIDATED'],
          example: 'VALIDATED',
        },
      },
    },
  },
};
