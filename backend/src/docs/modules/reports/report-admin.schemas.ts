export const reportAdminSchemas = {
  AdminReportResponse: {
    type: 'object',
    required: ['id', 'kind', 'title', 'status', 'referenceCode', 'dateReported', 'isSuspicious'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      kind: { type: 'string', enum: ['LOST', 'FOUND'], example: 'FOUND' },
      title: { type: 'string', example: 'Black Backpack' },
      category: { type: 'string', example: 'Accessories' },
      description: { type: 'string', example: 'Black backpack with laptop sleeve' },
      status: { $ref: '#/components/schemas/ItemStatus' },
      referenceCode: {
        type: 'string',
        pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
        description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
        example: 'FND-20260214-ABC12345',
      },
      location: { type: 'string', example: 'Library' },
      dateReported: { type: 'string', format: 'date-time' },
      contactEmail: { type: 'string', format: 'email' },
      photoUrl: { type: 'string' },
      photoUrls: {
        type: 'array',
        items: { type: 'string' },
      },
      isSuspicious: { type: 'boolean', example: false },
      flagReason: { type: 'string', nullable: true },
      flaggedAt: { type: 'string', format: 'date-time', nullable: true },
      suspiciousReason: { type: 'string', nullable: true },
      suspiciousFlaggedByUid: { type: 'string', nullable: true },
      suspiciousFlaggedByEmail: { type: 'string', format: 'email', nullable: true },
      suspiciousFlaggedByRole: { type: 'string', nullable: true, enum: ['ADMIN', 'SECURITY'] },
      suspiciousFlaggedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  AdminReportsListResponse: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPrevPage', 'filters', 'summary', 'reports'],
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 42 },
      totalPages: { type: 'integer', example: 3 },
      hasNextPage: { type: 'boolean', example: true },
      hasPrevPage: { type: 'boolean', example: false },
      filters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['LOST', 'FOUND'], nullable: true },
          status: { $ref: '#/components/schemas/ItemStatus' },
          search: { type: 'string', nullable: true },
          flagged: { type: 'boolean', nullable: true },
        },
      },
      summary: {
        type: 'object',
        required: ['totalReports', 'lostReports', 'foundReports', 'byStatus'],
        properties: {
          totalReports: { type: 'integer', example: 42 },
          lostReports: { type: 'integer', example: 18 },
          foundReports: { type: 'integer', example: 24 },
          byStatus: {
            type: 'object',
            additionalProperties: {
              type: 'integer',
            },
            example: {
              REPORTED: 5,
              PENDING_VALIDATION: 7,
              VALIDATED: 20,
              CLAIMED: 6,
              RETURNED: 3,
              ARCHIVED: 1,
            },
          },
        },
      },
      reports: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/AdminReportResponse',
        },
      },
    },
  },
} as const;
