export const itemCoreSchemas = {
  ItemStatus: {
    type: 'string',
    enum: ['REPORTED', 'PENDING_VALIDATION', 'VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
  },
  PublicItemStatus: {
    type: 'string',
    enum: ['VALIDATED', 'CLAIMED'],
  },
  ClaimStatus: {
    type: 'string',
    enum: ['PENDING', 'NEEDS_PROOF', 'APPROVED', 'REJECTED', 'CANCELLED'],
  },
  ItemAvailability: {
    type: 'string',
    enum: ['AVAILABLE', 'CLAIMED'],
  },
  UpdateItemStatusRequest: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
        example: 'RETURNED',
      },
    },
  },
  UpdateItemStatusResponse: {
    type: 'object',
    required: ['id', 'previousStatus', 'status', 'updatedAt', 'updatedByUid', 'updatedByRole'],
    properties: {
      id: { type: 'string', example: 'item-abc123' },
      previousStatus: { $ref: '#/components/schemas/ItemStatus' },
      status: { $ref: '#/components/schemas/ItemStatus' },
      updatedAt: { type: 'string', format: 'date-time' },
      updatedByUid: { type: 'string', example: 'security-1' },
      updatedByEmail: { type: 'string', format: 'email', nullable: true, example: 'security@example.com' },
      updatedByRole: { type: 'string', enum: ['ADMIN', 'SECURITY'], example: 'SECURITY' },
    },
  },
  RestoreItemStatusRequest: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['REPORTED', 'PENDING_VALIDATION', 'VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED'],
        example: 'VALIDATED',
      },
    },
  },
} as const;
