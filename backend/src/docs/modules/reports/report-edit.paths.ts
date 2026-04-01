import { errorResponseRefs } from '../common.openapi.js';

const referenceCodeParameter = {
  name: 'referenceCode',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
  },
  description: 'Report reference code',
} as const;

export const reportEditPaths = {
  '/api/v1/reports/{referenceCode}': {
    get: {
      tags: ['Reports'],
      summary: 'Get a report by reference code',
      parameters: [referenceCodeParameter],
      responses: {
        200: {
          description: 'Report retrieved successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EditableReportResponse',
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
        500: {
          ...errorResponseRefs.internalServerError,
        },
      },
    },
    patch: {
      tags: ['Reports'],
      summary: 'Edit a report by reference code',
      parameters: [referenceCodeParameter],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateReportByReferenceRequest',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Report updated successfully',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EditableReportResponse',
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
