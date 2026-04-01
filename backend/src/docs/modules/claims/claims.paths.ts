import { errorResponseRefs } from '../common.openapi.js';

export const claimPaths = {
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
} as const;
