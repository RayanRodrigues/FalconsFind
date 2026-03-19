import type { OpenApiModule } from '../openapi.types.js';

export const errorResponseRefs = {
  badRequest: { $ref: '#/components/responses/BadRequestResponse' },
  unauthorized: { $ref: '#/components/responses/UnauthorizedResponse' },
  forbidden: { $ref: '#/components/responses/ForbiddenResponse' },
  notFound: { $ref: '#/components/responses/NotFoundResponse' },
  conflict: { $ref: '#/components/responses/ConflictResponse' },
  unprocessableEntity: { $ref: '#/components/responses/UnprocessableEntityResponse' },
  tooManyRequests: { $ref: '#/components/responses/TooManyRequestsResponse' },
  internalServerError: { $ref: '#/components/responses/InternalServerErrorResponse' },
  serviceUnavailable: { $ref: '#/components/responses/ServiceUnavailableResponse' },
} as const;

export const commonOpenApi: OpenApiModule = {
  schemas: {
    ErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', example: 'BAD_REQUEST' },
            message: { type: 'string', example: 'Invalid request payload' },
          },
        },
      },
    },
  },
  responses: {
    BadRequestResponse: {
      description: 'Request validation failed',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    ForbiddenResponse: {
      description: 'The request is not allowed',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    UnauthorizedResponse: {
      description: 'Authentication failed',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    NotFoundResponse: {
      description: 'Requested resource was not found',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    ConflictResponse: {
      description: 'The request conflicts with the current resource state',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    UnprocessableEntityResponse: {
      description: 'Resource exists but contains invalid data',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    TooManyRequestsResponse: {
      description: 'Too many requests',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    ServiceUnavailableResponse: {
      description: 'Dependent service is temporarily unavailable',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      },
    },
    InternalServerErrorResponse: {
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
};
