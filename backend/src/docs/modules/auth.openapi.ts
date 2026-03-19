import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

export const authOpenApi: OpenApiModule = {
  tags: [{ name: 'Auth', description: 'Authentication for students and staff' }],
  paths: {
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in an existing account',
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
            description: 'Login successful',
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
        summary: 'Sign out the current authenticated session',
        responses: {
          204: {
            description: 'Logout successful',
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
      enum: ['SECURITY', 'ADMIN', 'STUDENT'],
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
            displayName: { type: 'string', nullable: true, example: 'Hendrick Nkuba' },
            role: { $ref: '#/components/schemas/UserRole' },
            trusted: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
};
