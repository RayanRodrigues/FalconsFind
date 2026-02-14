export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'FalconFind Backend API',
    version: '1.0.0',
    description: 'API documentation for FalconsFind backend routes.',
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service and Firebase health checks' },
    { name: 'Reports', description: 'Lost and found report operations' },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Get backend health status',
        responses: {
          200: {
            description: 'Backend is reachable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health/firebase': {
      get: {
        tags: ['Health'],
        summary: 'Get Firebase connectivity status',
        responses: {
          200: {
            description: 'Firebase health document was found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FirebaseHealthResponse',
                },
              },
            },
          },
          404: {
            description: 'Firebase health document is missing',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          500: {
            description: 'Unexpected Firebase check error',
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
    '/api/v1/reports/lost': {
      post: {
        tags: ['Reports'],
        summary: 'Create a lost-item report',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateLostReportRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Lost report created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateLostReportResponse',
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
    '/api/v1/reports/found': {
      post: {
        tags: ['Reports'],
        summary: 'Create a found-item report',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/CreateFoundReportRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Found report created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateLostReportResponse',
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
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['ok', 'service'],
        properties: {
          ok: { type: 'boolean', example: true },
          service: { type: 'string', example: 'backend' },
        },
      },
      FirebaseHealthResponse: {
        type: 'object',
        required: ['ok', 'firebase'],
        properties: {
          ok: { type: 'boolean', example: true },
          firebase: { type: 'boolean', example: true },
          data: { type: 'object', additionalProperties: true },
        },
      },
      CreateLostReportRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          lastSeenLocation: { type: 'string', minLength: 1 },
          lastSeenAt: { type: 'string', format: 'date-time' },
          contactEmail: { type: 'string', format: 'email' },
          photoDataUrl: { type: 'string', description: 'Image encoded as data URL' },
        },
      },
      CreateLostReportResponse: {
        type: 'object',
        required: ['id', 'referenceCode'],
        properties: {
          id: { type: 'string', example: 'AbCdEF123456' },
          referenceCode: { type: 'string', example: 'LST-20260214-ABC12345' },
        },
      },
      CreateFoundReportRequest: {
        type: 'object',
        required: ['title', 'foundLocation', 'photo'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          foundLocation: { type: 'string', minLength: 1 },
          foundAt: { type: 'string', format: 'date-time' },
          contactEmail: { type: 'string', format: 'email' },
          photo: { type: 'string', format: 'binary' },
        },
      },
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
  },
} as const;
