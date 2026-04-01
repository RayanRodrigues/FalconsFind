export const reportSubmitSchemas = {
  CreateLostReportRequest: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      category: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      additionalInfo: { type: 'string', minLength: 1 },
      lastSeenLocation: { type: 'string', minLength: 1 },
      lastSeenAt: { type: 'string', format: 'date-time' },
      contactEmail: { type: 'string', format: 'email' },
      photo: {
        type: 'string',
        format: 'binary',
        description: 'Optional JPEG or PNG image file uploaded as multipart form data',
      },
    },
  },
  CreateLostReportResponse: {
    type: 'object',
    required: ['id', 'referenceCode'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      referenceCode: {
        type: 'string',
        pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
        description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
        example: 'LST-20260214-ABC12345',
      },
    },
  },
  CreateFoundReportResponse: {
    type: 'object',
    required: ['id', 'referenceCode'],
    properties: {
      id: { type: 'string', example: 'AbCdEF123456' },
      referenceCode: {
        type: 'string',
        pattern: '^(LST|FND)-\\d{8}-[A-Z0-9]+$',
        description: 'Reference code formatted as PREFIX-YYYYMMDD-SUFFIX, where PREFIX is LST or FND.',
        example: 'FND-20260214-ABC12345',
      },
    },
  },
  CreateFoundReportRequest: {
    type: 'object',
    required: ['title', 'foundLocation', 'photo'],
    properties: {
      title: { type: 'string', minLength: 1 },
      category: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      foundLocation: { type: 'string', minLength: 1 },
      foundAt: { type: 'string', format: 'date-time' },
      contactEmail: { type: 'string', format: 'email' },
      photo: {
        type: 'string',
        format: 'binary',
        description: 'JPEG or PNG image file uploaded as multipart form data',
      },
    },
  },
} as const;
