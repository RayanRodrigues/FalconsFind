import type { OpenApiModule } from '../openapi.types.js';
import { errorResponseRefs } from './common.openapi.js';

export const authOpenApi: OpenApiModule = {
  tags: [{ name: 'Auth', description: 'Authentication for staff and for student claim ownership flows' }],
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
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange a refresh token for a new ID token',
        description: 'Used by the frontend to silently restore an authenticated session without requiring the user to log in again. Rate-limited to 20 requests per 15 minutes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RefreshSessionRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Session refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse',
                },
              },
            },
          },
          401: {
            ...errorResponseRefs.unauthorized,
            description: 'Refresh token is invalid or expired (`INVALID_REFRESH_TOKEN`)',
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
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new student account',
        description: 'Creates a Firebase account for a student so they can authenticate for claim ownership flows. Students receive no custom role claim and cannot access staff-only endpoints. Rate-limited to 5 requests per hour.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RegisterResponse',
                },
              },
            },
          },
          400: {
            ...errorResponseRefs.badRequest,
          },
          409: {
            description: 'Email already in use (`EMAIL_ALREADY_IN_USE`)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          429: {
            ...errorResponseRefs.tooManyRequests,
          },
          503: {
            ...errorResponseRefs.serviceUnavailable,
            description: 'Firebase registration unavailable (`REGISTRATION_FAILED`)',
          },
          500: {
            ...errorResponseRefs.internalServerError,
          },
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset email',
        description: 'Sends a password reset link to the provided email address if an account exists. Always returns 200 regardless of whether the email is registered, to prevent account enumeration. Rate-limited to 5 requests per hour.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ForgotPasswordRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Request processed (email sent if account exists)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ForgotPasswordResponse',
                },
              },
            },
          },
          400: {
            ...errorResponseRefs.badRequest,
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
        description: 'Revokes the Firebase session for the authenticated staff user. Requires a valid Bearer token. Rate-limited to 30 requests per 15 minutes.',
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
          429: {
            ...errorResponseRefs.tooManyRequests,
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
    RefreshSessionRequest: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'AMf-vBz...' },
      },
    },
    RegisterRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'student@fanshaweonline.ca' },
        password: { type: 'string', minLength: 6, example: 'securepassword123' },
        displayName: { type: 'string', example: 'Jane Smith' },
      },
    },
    RegisterResponse: {
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
            uid: { type: 'string', example: 'firebase-uid-456' },
            email: { type: 'string', format: 'email', example: 'student@fanshaweonline.ca' },
            displayName: { type: 'string', nullable: true, example: 'Jane Smith' },
            role: { $ref: '#/components/schemas/UserRole' },
            trusted: { type: 'boolean', example: false },
          },
        },
      },
    },
    ForgotPasswordRequest: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'student@fanshaweonline.ca' },
      },
    },
    ForgotPasswordResponse: {
      type: 'object',
      required: ['message'],
      properties: {
        message: {
          type: 'string',
          example: 'If an account exists for this email, a password reset link has been sent.',
        },
      },
    },
  },
};
