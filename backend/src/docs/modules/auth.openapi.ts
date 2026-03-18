import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

export const authOpenApi: OpenApiModule = {
  tags: [{ name: 'Auth', description: 'Internal staff authentication' }],
  paths: {
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in an internal staff account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Staff login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse',
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
          429: {
            ...errorResponseRefs.tooManyRequests,
          },
          503: {
            ...errorResponseRefs.serviceUnavailable,
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out the current staff session',
        responses: {
          204: {
            description: 'Staff logout successful',
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
  },
  schemas: {
    UserRole: {
      type: 'string',
      enum: ['SECURITY', 'ADMIN'],
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'security@fanshawe.ca' },
        password: { type: 'string', minLength: 1, example: 'password123' },
      },
    },
    LoginResponse: {
      type: 'object',
      required: ['idToken', 'refreshToken', 'expiresIn', 'user'],
      properties: {
        idToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'integer', example: 3600 },
        user: {
          type: 'object',
          required: ['uid', 'email', 'role'],
          properties: {
            uid: { type: 'string', example: 'firebase-uid-123' },
            email: { type: 'string', format: 'email', example: 'security@fanshawe.ca' },
            role: { $ref: '#/components/schemas/UserRole' },
          },
        },
      },
    },
  },
};
