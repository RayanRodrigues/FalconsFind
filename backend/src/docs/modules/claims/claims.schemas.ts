export const claimSchemas = {
  CreateClaimRequest: {
    type: 'object',
    required: ['referenceCode', 'itemName', 'claimReason', 'proofDetails', 'claimantName', 'claimantEmail'],
    properties: {
      referenceCode: { type: 'string', example: 'FF-2024-00001' },
      itemName: { type: 'string', example: 'Black backpack' },
      claimReason: { type: 'string', example: 'I lost this after class in B1040 and came back for it later.' },
      proofDetails: { type: 'string', example: 'It has my initials inside and a silver water bottle in the side pocket.' },
      claimantName: { type: 'string', example: 'Jane Doe' },
      claimantEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
      phone: { type: 'string', example: '519-555-0100' },
    },
  },
  CreateClaimResponse: {
    type: 'object',
    required: ['id', 'status', 'createdAt'],
    properties: {
      id: { type: 'string', example: 'claim-123' },
      status: { type: 'string', enum: ['PENDING'], example: 'PENDING' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AdminClaimResponse: {
    type: 'object',
    required: ['id', 'itemId', 'referenceCode', 'itemName', 'claimantName', 'claimantEmail', 'claimReason', 'proofDetails', 'status', 'createdAt'],
    properties: {
      id: { type: 'string', example: 'claim-123' },
      itemId: { type: 'string', example: 'item-abc123' },
      referenceCode: { type: 'string', example: 'FF-2024-00001' },
      itemName: { type: 'string', example: 'Black backpack' },
      claimantName: { type: 'string', example: 'Jane Doe' },
      claimantEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
      claimReason: { type: 'string', example: 'I lost this after class in B1040 and came back for it later.' },
      proofDetails: { type: 'string', example: 'It has my initials inside and a silver water bottle in the side pocket.' },
      phone: { type: 'string', example: '519-555-0100' },
      status: { type: 'string', enum: ['PENDING', 'NEEDS_PROOF', 'APPROVED', 'REJECTED', 'CANCELLED'], example: 'PENDING' },
      additionalProofRequest: { type: 'string', example: 'Please provide a photo of the serial number.' },
      proofRequestedAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AdminClaimsListResponse: {
    type: 'object',
    required: ['claims', 'total', 'summary'],
    properties: {
      claims: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/AdminClaimResponse',
        },
      },
      total: { type: 'integer', example: 12 },
      summary: {
        type: 'object',
        required: ['totalClaims', 'pendingClaims', 'needsProofClaims', 'approvedClaims', 'rejectedClaims', 'cancelledClaims'],
        properties: {
          totalClaims: { type: 'integer', example: 12 },
          pendingClaims: { type: 'integer', example: 4 },
          needsProofClaims: { type: 'integer', example: 2 },
          approvedClaims: { type: 'integer', example: 3 },
          rejectedClaims: { type: 'integer', example: 2 },
          cancelledClaims: { type: 'integer', example: 1 },
        },
      },
    },
  },
  RequestAdditionalProofRequest: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        example: 'Please provide a photo of the serial number or identify the contents inside the item.',
      },
    },
  },
  RequestAdditionalProofResponse: {
    type: 'object',
    required: ['id', 'status', 'additionalProofRequest', 'proofRequestedAt'],
    properties: {
      id: { type: 'string', example: 'claim-123' },
      status: { type: 'string', enum: ['NEEDS_PROOF'], example: 'NEEDS_PROOF' },
      additionalProofRequest: {
        type: 'string',
        example: 'Please provide a photo of the serial number or identify the contents inside the item.',
      },
      proofRequestedAt: { type: 'string', format: 'date-time' },
    },
  },
  UpdateClaimStatusRequest: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['APPROVED', 'REJECTED'],
        example: 'APPROVED',
      },
    },
  },
  ClaimStatusUpdateResponse: {
    type: 'object',
    required: ['id', 'status', 'itemId', 'itemStatus'],
    properties: {
      id: { type: 'string', example: 'claim-123' },
      status: { type: 'string', enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' },
      itemId: { type: 'string', example: 'item-abc123' },
      itemStatus: {
        type: 'string',
        enum: ['CLAIMED', 'VALIDATED'],
        example: 'CLAIMED',
      },
    },
  },
  CancelClaimResponse: {
    type: 'object',
    required: ['id', 'status', 'itemId', 'itemStatus'],
    properties: {
      id: { type: 'string', example: 'claim-123' },
      status: { type: 'string', enum: ['CANCELLED'], example: 'CANCELLED' },
      itemId: { type: 'string', example: 'item-abc123' },
      itemStatus: {
        type: 'string',
        enum: ['VALIDATED'],
        example: 'VALIDATED',
      },
    },
  },
} as const;
