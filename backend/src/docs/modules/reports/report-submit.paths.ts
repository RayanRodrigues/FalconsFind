import { errorResponseRefs } from '../common.openapi.js';

export const reportSubmitPaths = {
  '/api/v1/reports/lost': {
    post: {
      tags: ['Reports'],
      summary: 'Create a lost-item report',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateLostReportRequest',
            },
            encoding: {
              photo: {
                contentType: 'image/jpeg, image/png',
              },
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
            encoding: {
              photo: {
                contentType: 'image/jpeg, image/png',
              },
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
                $ref: '#/components/schemas/CreateFoundReportResponse',
              },
            },
          },
        },
        400: {
          ...errorResponseRefs.badRequest,
        },
        500: {
          ...errorResponseRefs.internalServerError,
        },
      },
    },
  },
} as const;
