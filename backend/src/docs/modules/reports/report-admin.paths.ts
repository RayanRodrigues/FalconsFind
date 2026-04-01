import { errorResponseRefs } from '../common.openapi.js';

const idPathParameter = (description: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
  },
  description,
});

export const reportAdminPaths = {
  '/api/v1/admin/reports': {
    get: {
      tags: ['Reports'],
      summary: 'List all lost and found reports for the centralized admin dashboard',
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
          description: 'Page number (1-based)',
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: 'Reports per page',
        },
        {
          name: 'kind',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['LOST', 'FOUND'],
          },
          description: 'Filter reports by kind',
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          schema: {
            $ref: '#/components/schemas/ItemStatus',
          },
          description: 'Filter reports by current status',
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
          },
          description: 'Case-insensitive search over title, description, reference code, location, and contact email',
        },
        {
          name: 'flagged',
          in: 'query',
          required: false,
          schema: {
            type: 'boolean',
          },
          description: 'Filter reports by suspicious flag status',
        },
      ],
      responses: {
        200: {
          description: 'Reports listed successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminReportsListResponse',
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
  '/api/v1/admin/reports/{id}/flag': {
    patch: {
      tags: ['Reports'],
      summary: 'Flag or unflag a report as suspicious',
      parameters: [idPathParameter('Report document id')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/FlagReportRequest',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Suspicious flag updated successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FlagReportResponse',
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
        400: {
          ...errorResponseRefs.badRequest,
        },
        404: {
          ...errorResponseRefs.notFound,
        },
        500: {
          ...errorResponseRefs.internalServerError,
        },
      },
    },
  },
  '/api/v1/admin/reports/merge': {
    post: {
      tags: ['Reports'],
      summary: 'Merge duplicate reports into a primary report',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MergeDuplicateReportsRequest',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Duplicate reports merged successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MergeDuplicateReportsResponse',
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
  '/api/v1/reports/found/{id}/validate': {
    patch: {
      tags: ['Reports'],
      summary: 'Validate a pending found-item report before publication',
      parameters: [idPathParameter('Found report document id')],
      responses: {
        200: {
          description: 'Found report validated successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidateFoundReportResponse',
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
} as const;
