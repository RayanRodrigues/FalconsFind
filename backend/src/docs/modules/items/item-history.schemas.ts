export const itemHistorySchemas = {
  ItemHistoryActor: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['SYSTEM', 'USER', 'SECURITY', 'ADMIN'],
      },
      uid: { type: 'string' },
      role: { type: 'string' },
      email: { type: 'string', format: 'email' },
    },
  },
  ItemHistoryChange: {
    type: 'object',
    required: ['field'],
    properties: {
      field: { type: 'string', example: 'status' },
      previousValue: {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'null' },
        ],
      },
      newValue: {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'null' },
        ],
      },
    },
  },
  ItemHistoryEventResponse: {
    type: 'object',
    required: ['id', 'itemId', 'entityType', 'entityId', 'actionType', 'timestamp', 'summary'],
    properties: {
      id: { type: 'string', example: 'history-1' },
      itemId: { type: 'string', example: 'report-1' },
      entityType: {
        type: 'string',
        enum: ['REPORT', 'ITEM', 'CLAIM'],
      },
      entityId: { type: 'string', example: 'claim-1' },
      actionType: {
        type: 'string',
        enum: [
          'REPORT_CREATED',
          'REPORT_UPDATED',
          'REPORT_VALIDATED',
          'REPORT_MERGED',
          'ITEM_ARCHIVED',
          'ITEM_STATUS_RESTORED',
          'CLAIM_CREATED',
          'CLAIM_UPDATED',
          'CLAIM_PROOF_REQUESTED',
          'CLAIM_PROOF_SUBMITTED',
          'CLAIM_APPROVED',
          'CLAIM_REJECTED',
          'CLAIM_CANCELLED',
        ],
      },
      timestamp: { type: 'string', format: 'date-time' },
      summary: { type: 'string', example: 'Claim approved by staff.' },
      actor: { $ref: '#/components/schemas/ItemHistoryActor' },
      metadata: {
        type: 'object',
        additionalProperties: {
          oneOf: [
            { type: 'string' },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'null' },
          ],
        },
      },
      changes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ItemHistoryChange',
        },
      },
    },
  },
  ItemHistoryResponse: {
    type: 'object',
    required: ['itemId', 'resolvedFrom', 'total', 'events'],
    properties: {
      itemId: { type: 'string', example: 'report-1' },
      resolvedFrom: { type: 'string', example: 'item-1' },
      title: { type: 'string', example: 'Black backpack' },
      referenceCode: { type: 'string', example: 'FND-20260225-ABC12345' },
      currentStatus: { $ref: '#/components/schemas/ItemStatus' },
      total: { type: 'integer', minimum: 0, example: 4 },
      events: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ItemHistoryEventResponse',
        },
      },
    },
  },
} as const;
