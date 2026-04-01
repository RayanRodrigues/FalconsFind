export const reportCoreSchemas = {
  EditableReportResponse: {
    type: 'object',
    required: ['id', 'referenceCode', 'kind', 'status', 'title', 'dateReported'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      referenceCode: {
        type: 'string',
        pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
        description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
        example: 'FND-20260214-ABC12345',
      },
      kind: { type: 'string', enum: ['LOST', 'FOUND'], example: 'FOUND' },
      status: { $ref: '#/components/schemas/ItemStatus' },
      title: { type: 'string', example: 'Black Backpack' },
      category: { type: 'string', example: 'Accessories' },
      description: { type: 'string', example: 'Black backpack with laptop sleeve' },
      location: { type: 'string', example: 'Library' },
      dateReported: { type: 'string', format: 'date-time' },
      contactEmail: { type: 'string', format: 'email' },
    },
  },
  UpdateReportByReferenceRequest: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      category: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      location: { type: 'string', minLength: 1 },
      dateReported: { type: 'string', format: 'date-time' },
      contactEmail: { type: 'string', format: 'email' },
    },
    minProperties: 1,
  },
  FlagReportRequest: {
    oneOf: [
      {
        type: 'object',
        required: ['flagged'],
        properties: {
          flagged: { type: 'boolean', example: true },
          reason: { type: 'string', minLength: 1, example: 'Repeated duplicate submissions from the same reporter' },
        },
      },
      {
        type: 'object',
        required: ['suspiciousReason'],
        properties: {
          suspiciousReason: { type: 'string', minLength: 1, example: 'Repeated duplicate submissions from the same reporter' },
        },
      },
    ],
  },
  FlagReportResponse: {
    type: 'object',
    required: ['id', 'isSuspicious'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      isSuspicious: { type: 'boolean', example: true },
      flagReason: { type: 'string', nullable: true, example: 'Repeated duplicate submissions from the same reporter' },
      flaggedAt: { type: 'string', format: 'date-time', nullable: true },
      suspiciousReason: { type: 'string', nullable: true, example: 'Repeated duplicate submissions from the same reporter' },
      suspiciousFlaggedAt: { type: 'string', format: 'date-time', nullable: true },
      suspiciousFlaggedByUid: { type: 'string', nullable: true, example: 'security-user-1' },
      suspiciousFlaggedByEmail: { type: 'string', format: 'email', nullable: true, example: 'security@example.com' },
      suspiciousFlaggedByRole: { type: 'string', nullable: true, enum: ['ADMIN', 'SECURITY'], example: 'SECURITY' },
    },
  },
  MergeDuplicateReportsRequest: {
    type: 'object',
    required: ['primaryReportId', 'duplicateReportIds'],
    properties: {
      primaryReportId: { type: 'string', example: 'report-primary-1' },
      duplicateReportIds: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: { type: 'string', example: 'report-duplicate-1' },
      },
    },
  },
  MergeDuplicateReportsResponse: {
    type: 'object',
    required: ['primaryReportId', 'mergedReportIds', 'primaryReport'],
    properties: {
      primaryReportId: { type: 'string', example: 'report-primary-1' },
      mergedReportIds: {
        type: 'array',
        items: { type: 'string', example: 'report-duplicate-1' },
      },
      primaryReport: {
        type: 'object',
        required: ['id', 'referenceCode', 'kind', 'status', 'title'],
        properties: {
          id: { type: 'string', example: 'report-primary-1' },
          referenceCode: { type: 'string', example: 'FND-20260325-PRIMARY1' },
          kind: { type: 'string', enum: ['LOST', 'FOUND'], example: 'FOUND' },
          status: { $ref: '#/components/schemas/ItemStatus' },
          title: { type: 'string', example: 'Black backpack' },
        },
      },
    },
  },
  ItemStatus: {
    type: 'string',
    enum: ['REPORTED', 'PENDING_VALIDATION', 'VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
  },
  ValidateFoundReportResponse: {
    type: 'object',
    required: ['id', 'referenceCode', 'status'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      referenceCode: {
        type: 'string',
        pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
        description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
        example: 'FND-20260214-ABC12345',
      },
      status: { type: 'string', enum: ['VALIDATED'], example: 'VALIDATED' },
    },
  },
} as const;
