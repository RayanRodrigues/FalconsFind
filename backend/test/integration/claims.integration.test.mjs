import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createClaimsRouter } from '../../dist/src/routes/claims.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createDocSnapshot = (ref, source) => ({
  ref,
  id: ref.id,
  exists: source !== undefined,
  data: () => source,
});

const createFakeDb = ({ claims = {}, items = {}, reports = {} } = {}) => ({
  collection: (collectionName) => {
    const collectionStore =
      collectionName === 'claims' ? claims :
        collectionName === 'items' ? items :
          collectionName === 'reports' ? reports :
            null;

    if (!collectionStore) {
      throw new Error(`Unexpected collection: ${collectionName}`);
    }

    return {
      doc: (id) => ({
        id,
        collectionName,
        get: async () => createDocSnapshot({ id, collectionName }, collectionStore[id]),
      }),
      where: (field, operator, value) => {
        assert.equal(collectionName, 'items');
        assert.equal(field, 'reportId');
        assert.equal(operator, '==');

        const matches = Object.entries(items)
          .filter(([, item]) => item.reportId === value)
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
  },
  runTransaction: async (handler) => {
    const transaction = {
      get: async (target) => target.get(),
      update: (ref, patch) => {
        const store =
          ref.collectionName === 'claims' ? claims :
            ref.collectionName === 'items' ? items :
              ref.collectionName === 'reports' ? reports :
                null;

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
});

const buildTestApp = (db) => {
  const app = express();
  app.use(express.json());
  app.use(createClaimsRouter(db));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('PATCH /api/v1/claims/:id/status approves a pending claim and marks the item as claimed', async () => {
  const items = {
    'item-1': {
      status: 'VALIDATED',
      claimStatus: 'PENDING',
    },
  };
  const claims = {
    'claim-1': {
      itemId: 'item-1',
      status: 'PENDING',
    },
  };
  const db = createFakeDb({ claims, items });

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

test('PATCH /api/v1/claims/:id/status rejects a pending claim and keeps the item validated', async () => {
  const items = {
    'item-2': {
      reportId: 'report-2',
      status: 'CLAIMED',
      claimStatus: 'PENDING',
    },
  };
  const claims = {
    'claim-2': {
      itemId: 'report-2',
      status: 'PENDING',
    },
  };
  const db = createFakeDb({ claims, items });

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
  const reports = {
    'report-legacy': {
      status: 'VALIDATED',
    },
  };
  const claims = {
    'claim-legacy': {
      itemId: 'report-legacy',
      status: 'PENDING',
    },
  };
  const db = createFakeDb({ claims, reports });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-legacy/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(reports['report-legacy'].status, 'CLAIMED');
  assert.equal(reports['report-legacy'].claimStatus, 'APPROVED');
});

test('PATCH /api/v1/claims/:id/status returns 409 when the claim is already reviewed', async () => {
  const db = createFakeDb({
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
  const db = createFakeDb({
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
  const db = createFakeDb();

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-1/status')
    .send({ status: 'CANCELLED' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
