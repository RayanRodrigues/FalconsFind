import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createItemsRouter } from '../../dist/src/routes/items.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = ({ items = {}, reports = {} } = {}) => {
  const normalizeDoc = (id, source) => ({
    id,
    exists: true,
    data: () => source,
  });

  return {
    collection: (collectionName) => {
      if (collectionName === 'items') {
        return {
          doc: (id) => ({
            get: async () => {
              const source = items[id];
              if (!source) {
                return { exists: false, id, data: () => undefined };
              }
              return normalizeDoc(id, source);
            },
          }),
          where: (field, operator, value) => {
            assert.equal(field, 'reportId');
            assert.equal(operator, '==');
            const matches = Object.entries(items)
              .filter(([, item]) => item.reportId === value)
              .map(([id, item]) => normalizeDoc(id, item));

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
            get: async () => {
              const source = reports[id];
              if (!source) {
                return { exists: false, id, data: () => undefined };
              }
              return normalizeDoc(id, source);
            },
          }),
        };
      }

      throw new Error(`Unexpected collection: ${collectionName}`);
    },
  };
};

const createFakeBucket = () => ({
  name: 'test-bucket',
  file: (filePath) => ({
    getSignedUrl: async () => [`https://signed.local/${filePath}`],
  }),
  storage: {
    bucket: (bucketName) => ({
      file: (filePath) => ({
        getSignedUrl: async () => [`https://signed.local/${bucketName}/${filePath}`],
      }),
    }),
  },
});

const buildTestApp = ({ items = {}, reports = {} } = {}) => {
  const app = express();
  app.use(express.json());
  app.use(createItemsRouter(createFakeDb({ items, reports }), createFakeBucket()));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('GET /api/v1/items/:id returns 200 for validated item id', async () => {
  const app = buildTestApp({
    items: {
      'item-1': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ABC12345',
        dateReported: '2026-02-25T12:00:00.000Z',
        location: 'Library',
        photoUrl: 'gs://test-bucket/reports/found/item-1.jpg',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-1');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-1');
  assert.equal(response.body.status, 'VALIDATED');
  assert.equal(response.body.referenceCode, 'FND-20260225-ABC12345');
  assert.ok(Array.isArray(response.body.imageUrls));
  assert.match(response.body.imageUrls[0], /^https:\/\/signed\.local\//);
});

test('GET /api/v1/items/:id resolves item by reportId relation', async () => {
  const app = buildTestApp({
    items: {
      'item-2': {
        reportId: 'report-2',
        title: 'Blue water bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-REL00002',
        dateReported: '2026-02-25T13:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/report-2');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-2');
  assert.equal(response.body.referenceCode, 'FND-20260225-REL00002');
});

test('GET /api/v1/items/:id resolves backward-compatible reports document', async () => {
  const app = buildTestApp({
    reports: {
      'legacy-report-id': {
        title: 'Lost charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LEGACY01',
        dateReported: '2026-02-25T14:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/legacy-report-id');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'legacy-report-id');
  assert.equal(response.body.status, 'VALIDATED');
});

test('GET /api/v1/items/:id returns 403 when item exists but is not public', async () => {
  const app = buildTestApp({
    items: {
      'item-review': {
        title: 'Headphones',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-REVIEW01',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-review');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(
    response.body.error.message,
    'This item is currently under review by Campus Security.',
  );
});

test('GET /api/v1/items/:id returns 404 when no matching item exists', async () => {
  const app = buildTestApp();
  const response = await request(app).get('/api/v1/items/unknown-id');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('GET /api/v1/items/:id returns 422 for malformed item payload', async () => {
  const app = buildTestApp({
    items: {
      'item-bad-data': {
        title: 'Unstructured item',
        status: 'VALIDATED',
        // Missing required fields: referenceCode/dateReported
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-bad-data');

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ITEM_DATA');
  assert.match(
    response.body.error.message,
    /incorrectly reported|contact Campus Security/i,
  );
});
