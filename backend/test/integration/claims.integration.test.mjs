import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createClaimsRouter } from '../../dist/src/routes/claims.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = ({ items = {}, reports = {} } = {}) => {
  const savedClaims = [];
  let counter = 0;

  const normalizeDoc = (id, source) => ({
    id,
    exists: source !== undefined,
    data: () => source,
  });

  return {
    db: {
      collection: (collectionName) => {
        if (collectionName === 'claims') {
          return {
            doc: () => {
              counter += 1;
              const id = `claim-${counter}`;
              return {
                id,
                set: async (data) => {
                  savedClaims.push({ id, data });
                },
              };
            },
          };
        }

        if (collectionName === 'items') {
          return {
            doc: (id) => ({
              get: async () => normalizeDoc(id, items[id]),
            }),
            where: (field, operator, value) => {
              assert.equal(field, 'reportId');
              assert.equal(operator, '==');
              return {
                limit: (limitValue) => {
                  assert.equal(limitValue, 1);
                  return {
                    get: async () => {
                      const docs = Object.entries(items)
                        .filter(([, item]) => item.reportId === value)
                        .slice(0, limitValue)
                        .map(([id, item]) => ({ ref: { id }, ...normalizeDoc(id, item), data: () => item }));

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
              get: async () => normalizeDoc(id, reports[id]),
            }),
          };
        }

        throw new Error(`Unexpected collection: ${collectionName}`);
      },
    },
    savedClaims,
  };
};

const buildTestApp = (db) => {
  const app = express();
  app.use(express.json());
  app.use(createClaimsRouter(db));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('POST /api/v1/claims creates a pending claim for a validated item', async () => {
  const { db, savedClaims } = createFakeDb({
    reports: {
      'report-1': {
        kind: 'FOUND',
        status: 'VALIDATED',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      itemId: 'report-1',
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

test('POST /api/v1/claims returns 404 when the target item does not exist', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      itemId: 'missing-item',
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
      },
    },
  });

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      itemId: 'report-2',
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
      itemId: '',
      claimantName: '',
      claimantEmail: 'not-an-email',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
