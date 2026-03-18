import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from './request-helper.mjs';
import { createClaimsRouter } from '../../dist/src/routes/claims.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createDocSnapshot = (ref, source) => ({
  ref,
  id: ref.id,
  exists: source !== undefined,
  data: () => source,
});

const createFakeDb = ({ claims = {}, items = {}, reports = {} } = {}) => {
  const savedClaims = [];
  let counter = 0;

  const db = {
    collection: (collectionName) => {
      if (collectionName === 'claims') {
        return {
          doc: (id) => {
            if (id) {
              return {
                id,
                collectionName,
                get: async () => createDocSnapshot({ id, collectionName }, claims[id]),
              };
            }

            counter += 1;
            const generatedId = `claim-${counter}`;
            return {
              id: generatedId,
              collectionName,
              set: async (data) => {
                claims[generatedId] = data;
                savedClaims.push({ id: generatedId, data });
              },
            };
          },
        };
      }

      if (collectionName === 'items') {
        return {
          doc: (id) => ({
            id,
            collectionName,
            get: async () => createDocSnapshot({ id, collectionName }, items[id]),
          }),
          where: (field, operator, value) => {
            assert.equal(operator, '==');

            const matches = Object.entries(items)
              .filter(([, item]) => item[field] === value)
              .map(([id, item]) => createDocSnapshot({ id, collectionName: 'items' }, item));

            return {
              limit: (limitValue) => {
                assert.equal(limitValue, 1);
                return {
                  get: async () => {
                    const docs = matches.slice(0, limitValue);
                    return {
                      empty: docs.length === 0,
                      docs,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (collectionName === 'reports') {
        return {
          doc: (id) => ({
            id,
            collectionName,
            get: async () => createDocSnapshot({ id, collectionName }, reports[id]),
          }),
          where: (field, operator, value) => {
            assert.equal(operator, '==');

            const matches = Object.entries(reports)
              .filter(([, report]) => report[field] === value)
              .map(([id, report]) => createDocSnapshot({ id, collectionName: 'reports' }, report));

            return {
              limit: (limitValue) => ({
                get: async () => {
                  const docs = matches.slice(0, limitValue);
                  return { empty: docs.length === 0, docs };
                },
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${collectionName}`);
    },
    runTransaction: async (handler) => {
      const transaction = {
        get: async (target) => target.get(),
        update: (ref, patch) => {
          const store =
            ref.collectionName === 'claims' ? claims
            : ref.collectionName === 'items' ? items
            : ref.collectionName === 'reports' ? reports
            : null;

          if (!store?.[ref.id]) {
            throw new Error(`Cannot update missing doc ${ref.collectionName}/${ref.id}`);
          }

          store[ref.id] = {
            ...store[ref.id],
            ...patch,
          };
        },
      };

      return handler(transaction);
    },
  };

  return { db, savedClaims, claims, items, reports };
};

const buildTestApp = (db) => {
  const app = express();
  app.use(express.json());
  app.use(createClaimsRouter(db, {
    requireStaffUser: (_req, _res, next) => next(),
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('POST /api/v1/claims creates a pending claim for a validated item found by referenceCode', async () => {
  const { db, savedClaims } = createFakeDb({
    reports: {
      'report-1': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00001',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00001',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
      message: 'I can identify the item.',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.id, 'claim-1');
  assert.equal(response.body.status, 'PENDING');
  assert.match(response.body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(savedClaims.length, 1);
  assert.equal(savedClaims[0].data.itemId, 'report-1');
  assert.equal(savedClaims[0].data.status, 'PENDING');
  assert.equal(savedClaims[0].data.claimantName, 'Jane Doe');
});

test('POST /api/v1/claims creates a pending claim when item is in the items collection', async () => {
  const { db, savedClaims } = createFakeDb({
    items: {
      'item-ref': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00099',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00099',
      claimantName: 'John Smith',
      claimantEmail: 'john@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(savedClaims[0].data.itemId, 'item-ref');
  assert.equal(savedClaims[0].data.status, 'PENDING');
});

test('POST /api/v1/claims returns 404 when no item has that referenceCode', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-MISSING',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('POST /api/v1/claims returns 409 when the target item is not validated', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-2': {
        kind: 'FOUND',
        status: 'CLAIMED',
        referenceCode: 'FF-2024-00002',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00002',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM');
});

test('POST /api/v1/claims returns 409 when the target item is not a found item', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-3': {
        kind: 'LOST',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00003',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00003',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM');
});

test('POST /api/v1/claims returns 400 for invalid request payload', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: '',
      claimantName: '',
      claimantEmail: 'not-an-email',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('PATCH /api/v1/claims/:id/status approves a pending claim and marks the item as claimed', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-1': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-1': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-1/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-1');
  assert.equal(response.body.status, 'APPROVED');
  assert.equal(response.body.itemStatus, 'CLAIMED');
  assert.equal(claims['claim-1'].status, 'APPROVED');
  assert.match(claims['claim-1'].reviewedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(items['item-1'].status, 'CLAIMED');
  assert.equal(items['item-1'].claimStatus, 'APPROVED');
  assert.match(items['item-1'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/status approves a claim after additional proof was requested', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-proof': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-proof': {
        itemId: 'item-proof',
        status: 'NEEDS_PROOF',
        additionalProofRequest: 'Please send a photo of the serial number.',
        proofRequestedAt: '2026-03-17T12:00:00.000Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-proof/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'APPROVED');
  assert.equal(items['item-proof'].status, 'CLAIMED');
  assert.equal(items['item-proof'].claimStatus, 'APPROVED');
  assert.equal(claims['claim-proof'].status, 'APPROVED');
});

test('PATCH /api/v1/claims/:id/status rejects a pending claim and keeps the item validated', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-2': {
        reportId: 'report-2',
        status: 'CLAIMED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-2': {
        itemId: 'report-2',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-2/status')
    .send({ status: 'REJECTED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'REJECTED');
  assert.equal(response.body.itemId, 'report-2');
  assert.equal(response.body.itemStatus, 'VALIDATED');
  assert.equal(claims['claim-2'].status, 'REJECTED');
  assert.equal(items['item-2'].status, 'VALIDATED');
  assert.equal(items['item-2'].claimStatus, 'REJECTED');
});

test('PATCH /api/v1/claims/:id/status updates legacy report docs when no item doc exists', async () => {
  const { db, reports } = createFakeDb({
    reports: {
      'report-legacy': {
        status: 'VALIDATED',
      },
    },
    claims: {
      'claim-legacy': {
        itemId: 'report-legacy',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-legacy/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(reports['report-legacy'].status, 'CLAIMED');
  assert.equal(reports['report-legacy'].claimStatus, 'APPROVED');
});

test('PATCH /api/v1/claims/:id/status returns 409 when the claim is already reviewed', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-closed': {
        itemId: 'item-closed',
        status: 'APPROVED',
      },
    },
    items: {
      'item-closed': {
        status: 'CLAIMED',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-closed/status')
    .send({ status: 'REJECTED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/status returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-orphan': {
        itemId: 'missing-item',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-orphan/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/status returns 400 for unsupported review status', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-1/status')
    .send({ status: 'CANCELLED' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('PATCH /api/v1/claims/:id/proof-request stores the additional proof request and marks the claim as NEEDS_PROOF', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-1': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-proof-request': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-proof-request/proof-request')
    .send({
      message: 'Please provide a photo of the serial number or describe a unique item inside the bag.',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-proof-request');
  assert.equal(response.body.status, 'NEEDS_PROOF');
  assert.match(response.body.proofRequestedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    response.body.additionalProofRequest,
    'Please provide a photo of the serial number or describe a unique item inside the bag.',
  );
  assert.equal(claims['claim-proof-request'].status, 'NEEDS_PROOF');
  assert.equal(
    claims['claim-proof-request'].additionalProofRequest,
    'Please provide a photo of the serial number or describe a unique item inside the bag.',
  );
  assert.match(claims['claim-proof-request'].proofRequestedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(items['item-1'].claimStatus, 'NEEDS_PROOF');
  assert.match(items['item-1'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/proof-request returns 404 when the claim does not exist', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/missing-claim/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/proof-request returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-missing-item': {
        itemId: 'missing-item',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-missing-item/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/proof-request returns 409 when the claim is already finalized', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-final': {
        itemId: 'item-1',
        status: 'APPROVED',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-final/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/proof-request returns 400 for invalid request payload', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-invalid-proof-request': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-invalid-proof-request/proof-request')
    .send({
      message: '',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('PATCH /api/v1/claims/:id/cancel cancels a pending claim and keeps the item validated', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-cancel': {
        itemId: 'item-cancel',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-cancel/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-cancel');
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(response.body.itemId, 'item-cancel');
  assert.equal(response.body.itemStatus, 'VALIDATED');
  assert.equal(claims['claim-cancel'].status, 'CANCELLED');
  assert.equal(items['item-cancel'].status, 'VALIDATED');
  assert.equal(items['item-cancel'].claimStatus, 'CANCELLED');
  assert.match(items['item-cancel'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/cancel cancels a proof-requested claim', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel-proof': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-cancel-proof': {
        itemId: 'item-cancel-proof',
        status: 'NEEDS_PROOF',
        additionalProofRequest: 'Please provide the serial number.',
        proofRequestedAt: '2026-03-17T12:00:00.000Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-cancel-proof/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(claims['claim-cancel-proof'].status, 'CANCELLED');
  assert.equal(items['item-cancel-proof'].status, 'VALIDATED');
  assert.equal(items['item-cancel-proof'].claimStatus, 'CANCELLED');
});

test('PATCH /api/v1/claims/:id/cancel returns 404 when the claim does not exist', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/missing-claim/cancel')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/cancel returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-cancel-missing-item': {
        itemId: 'missing-item',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-cancel-missing-item/cancel')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/cancel returns 409 when the claim is already finalized', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-cancel-final': {
        itemId: 'item-cancel-final',
        status: 'APPROVED',
      },
    },
    items: {
      'item-cancel-final': {
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-cancel-final/cancel')
    .send();

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/cancel preserves the current item status when it is already terminal', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel-terminal': {
        status: 'ARCHIVED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-cancel-terminal': {
        itemId: 'item-cancel-terminal',
        status: 'NEEDS_PROOF',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-cancel-terminal/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(response.body.itemStatus, 'ARCHIVED');
  assert.equal(claims['claim-cancel-terminal'].status, 'CANCELLED');
  assert.equal(items['item-cancel-terminal'].status, 'ARCHIVED');
  assert.equal(items['item-cancel-terminal'].claimStatus, 'CANCELLED');
});
