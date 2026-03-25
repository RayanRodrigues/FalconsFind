import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from './request-helper.mjs';
import { createItemsRouter } from '../../dist/src/routes/items.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = ({ items = {}, reports = {}, claims = {}, itemHistory = {}, itemStatusHistory = {} } = {}) => {
  let historyCounter = 0;

  const normalizeDoc = (id, source) => ({
    id,
    exists: true,
    data: () => source,
  });

  const buildRef = (collectionName, id) => ({
    id,
    path: `${collectionName}/${id}`,
    collectionName,
  });

  const normalizeDate = (value) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    return new Date(0).toISOString();
  };

  const buildEqualsQuery = (entries, field) => ({
    where: (queryField, operator, value) => {
      assert.equal(queryField, field);
      assert.equal(operator, '==');
      const docs = entries
        .filter(([, source]) => source[field] === value)
        .map(([id, source]) => normalizeDoc(id, source));

      return {
        get: async () => ({ docs }),
      };
    },
  });

  return {
    collection: (collectionName) => {
      if (collectionName === 'items') {
        return {
          doc: (id) => ({
            ...buildRef(collectionName, id),
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
              .map(([id, item]) => ({
                ...normalizeDoc(id, item),
                ref: buildRef('items', id),
              }));

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
        const buildReportsQuery = (entries) => {
          const query = {
            where: (field, operator, value) => {
              const filtered = entries.filter(([, report]) => {
                const fieldValue = report[field];
                const normalizedFieldValue = normalizeDate(fieldValue);
                const normalizedFilterValue = typeof value === 'string' ? value : normalizeDate(value);

                if (operator === '==') {
                  return fieldValue === value;
                }
                if (operator === 'in') {
                  return Array.isArray(value) && value.includes(fieldValue);
                }
                if (operator === '>=') {
                  return normalizedFieldValue >= normalizedFilterValue;
                }
                if (operator === '<=') {
                  return normalizedFieldValue <= normalizedFilterValue;
                }

                throw new Error(`Unexpected operator: ${operator}`);
              });

              return buildReportsQuery(filtered);
            },
            get: async () => ({
              docs: entries.map(([id, data]) => normalizeDoc(id, data)),
            }),
            count: () => ({
              get: async () => ({
                data: () => ({ count: entries.length }),
              }),
            }),
            orderBy: (orderField, direction) => {
              assert.equal(orderField, 'dateReported');
              assert.ok(direction === 'desc' || direction === 'asc');

              const sorted = [...entries].sort((a, b) => {
                const aDate = normalizeDate(a[1].dateReported);
                const bDate = normalizeDate(b[1].dateReported);
                return direction === 'asc'
                  ? aDate.localeCompare(bDate)
                  : bDate.localeCompare(aDate);
              });

              return {
                get: async () => ({
                  docs: sorted.map(([id, data]) => normalizeDoc(id, data)),
                }),
                offset: (offsetValue) => ({
                  limit: (limitValue) => ({
                    get: async () => {
                      const page = sorted
                        .slice(offsetValue, offsetValue + limitValue)
                        .map(([id, data]) => normalizeDoc(id, data));

                      return { docs: page };
                    },
                  }),
                }),
                limit: (limitValue) => ({
                  get: async () => {
                    const docs = sorted
                      .slice(0, limitValue)
                      .map(([id, data]) => normalizeDoc(id, data));

                    return { docs };
                  },
                }),
              };
            },
          };

          return query;
        };

        return {
          where: (field, operator, value) => buildReportsQuery(Object.entries(reports)).where(field, operator, value),
          doc: (id) => ({
            ...buildRef(collectionName, id),
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

      if (collectionName === 'claims') {
        return buildEqualsQuery(Object.entries(claims), 'itemId');
      }

      if (collectionName === 'itemHistory') {
        return {
          ...buildEqualsQuery(Object.entries(itemHistory), 'itemId'),
          doc: (id) => ({
            ...buildRef(collectionName, id),
            set: async (data) => {
              itemHistory[id] = data;
            },
          }),
        };
      }

      if (collectionName === 'itemStatusHistory') {
        return {
          ...buildEqualsQuery(Object.entries(itemStatusHistory), 'itemId'),
          doc: (id) => {
            const generatedId = id || `history-${++historyCounter}`;
            return {
              ...buildRef(collectionName, generatedId),
              set: async (data) => {
                itemStatusHistory[generatedId] = data;
              },
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
            ref.collectionName === 'items' ? items
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
        set: (ref, data) => {
          if (ref.collectionName === 'itemStatusHistory') {
            itemStatusHistory[ref.id] = data;
            return;
          }

          if (ref.collectionName === 'itemHistory') {
            itemHistory[ref.id] = data;
            return;
          }

          throw new Error(`Unexpected set target ${ref.collectionName}/${ref.id}`);
        },
      };

      return handler(transaction);
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

const buildTestApp = ({ items = {}, reports = {}, claims = {}, itemHistory = {}, itemStatusHistory = {} } = {}) => {
  const app = express();
  app.use(express.json());
  app.use(createItemsRouter(createFakeDb({ items, reports, claims, itemHistory, itemStatusHistory }), createFakeBucket(), null, {
    requireStaffUser: (_req, res, next) => {
      res.locals.authUser = {
        uid: 'security-1',
        email: 'security@example.com',
        role: 'SECURITY',
      };
      next();
    },
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('GET /api/v1/items returns paginated public found items with availability and thumbnailUrl', async () => {
  const app = buildTestApp({
    reports: {
      'report-2': {
        kind: 'FOUND',
        title: 'Blue bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BLUE0002',
        location: 'Gym',
        dateReported: '2026-02-25T14:00:00.000Z',
        photoUrl: 'gs://test-bucket/reports/found/report-2.jpg',
      },
      'report-0': {
        kind: 'FOUND',
        title: 'Claimed phone',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-CLMD0000',
        location: 'Security Office',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
      'report-1': {
        kind: 'FOUND',
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BACK0001',
        location: 'Library',
        dateReported: '2026-02-25T12:00:00.000Z',
        photoUrl: 'https://cdn.example.com/report-1.jpg',
      },
      'report-hidden': {
        kind: 'FOUND',
        title: 'Pending item',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-HIDE0003',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
      'report-lost': {
        kind: 'LOST',
        title: 'Lost laptop',
        status: 'VALIDATED',
        referenceCode: 'LST-20260225-LOST0004',
        dateReported: '2026-02-25T16:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?page=1&limit=2');

  assert.equal(response.status, 200);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 2);
  assert.equal(response.body.total, 3);
  assert.equal(response.body.totalPages, 2);
  assert.equal(response.body.hasNextPage, true);
  assert.equal(response.body.hasPrevPage, false);
  assert.equal(response.body.items.length, 2);
  assert.equal(response.body.items[0].id, 'report-0');
  assert.equal(response.body.items[0].availability, 'CLAIMED');
  assert.equal(typeof response.body.items[0].listedDurationMs, 'number');
  assert.equal(response.body.items[1].id, 'report-2');
  assert.equal(response.body.items[1].availability, 'AVAILABLE');
  assert.equal(typeof response.body.items[1].listedDurationMs, 'number');
  assert.match(response.body.items[1].thumbnailUrl, /^https:\/\/signed\.local\//);
  assert.ok(Number.isFinite(response.body.items[0].listedDurationMs));
  assert.ok(response.body.items[0].listedDurationMs >= 0);
  assert.ok(Number.isFinite(response.body.items[1].listedDurationMs));
  assert.ok(response.body.items[1].listedDurationMs >= 0);
  assert.deepEqual(response.body.filters, {
    keyword: null,
    category: null,
    location: null,
    dateFrom: null,
    dateTo: null,
    sort: 'most_recent',
  });
});

test('GET /api/v1/items filters validated found items by category, location, and date range', async () => {
  const app = buildTestApp({
    reports: {
      'report-match': {
        kind: 'FOUND',
        title: 'Silver water bottle',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-MATCH001',
        location: 'Library',
        dateReported: '2026-02-25T10:00:00.000Z',
      },
      'report-wrong-category': {
        kind: 'FOUND',
        title: 'Blue bottle',
        category: 'Electronics',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-OTHER002',
        location: 'Library',
        dateReported: '2026-02-25T11:00:00.000Z',
      },
      'report-wrong-location': {
        kind: 'FOUND',
        title: 'Wallet',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-OTHER003',
        location: 'Gym',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
      'report-wrong-date': {
        kind: 'FOUND',
        title: 'Keys',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260220-OTHER004',
        location: 'Library',
        dateReported: '2026-02-20T10:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/items?category=Accessories&location=Library&dateFrom=2026-02-24&dateTo=2026-02-26');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'report-match');
  assert.equal(response.body.items[0].category, 'Accessories');
  assert.deepEqual(response.body.filters, {
    keyword: null,
    category: 'Accessories',
    location: 'Library',
    dateFrom: '2026-02-24T00:00:00.000Z',
    dateTo: '2026-02-26T23:59:59.999Z',
    sort: 'most_recent',
  });
});

test('GET /api/v1/items returns 400 for invalid date range filters', async () => {
  const app = buildTestApp();

  const response = await request(app).get('/api/v1/items?dateFrom=2026-02-30');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items returns 400 when dateFrom is after dateTo', async () => {
  const app = buildTestApp();

  const response = await request(app)
    .get('/api/v1/items?dateFrom=2026-02-27&dateTo=2026-02-26');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items skips malformed items from list payload', async () => {
  const app = buildTestApp({
    reports: {
      'valid-item': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-WALLET01',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
      'invalid-item': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BROKEN01',
        dateReported: '2026-02-25T13:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'valid-item');
});

test('GET /api/v1/items filters validated found items by keyword in title or description', async () => {
  const app = buildTestApp({
    reports: {
      'report-title': {
        kind: 'FOUND',
        title: 'Black Macbook Air',
        description: 'Found in Building T',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0001',
        dateReported: '2026-02-19T07:10:00.000Z',
      },
      'report-description': {
        kind: 'FOUND',
        title: 'Laptop sleeve',
        description: 'Contains notes about a MacBook charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-SLV0002',
        dateReported: '2026-02-19T07:00:00.000Z',
      },
      'report-other': {
        kind: 'FOUND',
        title: 'Blue water bottle',
        description: 'Found near the gym entrance',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-BTL0003',
        dateReported: '2026-02-19T06:50:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?keyword=macbook');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items.length, 2);
  assert.deepEqual(
    response.body.items.map((item) => item.id),
    ['report-title', 'report-description'],
  );
  assert.deepEqual(response.body.filters, {
    keyword: 'macbook',
    category: null,
    location: null,
    dateFrom: null,
    dateTo: null,
    sort: 'most_recent',
  });
});

test('GET /api/v1/items sorts validated found items by oldest first when requested', async () => {
  const app = buildTestApp({
    reports: {
      'report-newest': {
        kind: 'FOUND',
        title: 'Newest item',
        status: 'VALIDATED',
        referenceCode: 'FND-20260320-NEWEST01',
        dateReported: '2026-03-20T10:00:00.000Z',
      },
      'report-oldest': {
        kind: 'FOUND',
        title: 'Oldest item',
        status: 'VALIDATED',
        referenceCode: 'FND-20260318-OLDEST01',
        dateReported: '2026-03-18T10:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?sort=oldest');

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.items.map((item) => item.id),
    ['report-oldest', 'report-newest'],
  );
  assert.equal(response.body.filters.sort, 'oldest');
});

test('GET /api/v1/items returns 400 for invalid sort option', async () => {
  const app = buildTestApp();

  const response = await request(app).get('/api/v1/items?sort=invalid');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items paginates keyword search results after filtering', async () => {
  const app = buildTestApp({
    reports: {
      'report-3': {
        kind: 'FOUND',
        title: 'Macbook charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0003',
        dateReported: '2026-02-19T08:00:00.000Z',
      },
      'report-2': {
        kind: 'FOUND',
        title: 'Macbook sleeve',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0002',
        dateReported: '2026-02-19T07:30:00.000Z',
      },
      'report-1': {
        kind: 'FOUND',
        title: 'Macbook Air',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0001',
        dateReported: '2026-02-19T07:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?keyword=macbook&page=2&limit=1');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.totalPages, 2);
  assert.equal(response.body.hasNextPage, false);
  assert.equal(response.body.hasPrevPage, true);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'report-2');
});

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
  assert.equal(response.body.availability, 'AVAILABLE');
  assert.equal(response.body.referenceCode, 'FND-20260225-ABC12345');
  assert.equal(typeof response.body.listedDurationMs, 'number');
  assert.ok(Number.isFinite(response.body.listedDurationMs));
  assert.ok(response.body.listedDurationMs >= 0);
  assert.ok(Array.isArray(response.body.imageUrls));
  assert.match(response.body.imageUrls[0], /^https:\/\/signed\.local\//);
});

test('GET /api/v1/items/:id returns 200 for claimed item id', async () => {
  const app = buildTestApp({
    items: {
      'item-claimed': {
        title: 'Black backpack',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-CLAIM0001',
        dateReported: '2026-02-25T12:00:00.000Z',
        location: 'Library',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-claimed');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-claimed');
  assert.equal(response.body.status, 'CLAIMED');
  assert.equal(response.body.availability, 'CLAIMED');
  assert.equal(response.body.claimStatus, 'APPROVED');
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

test('GET /api/v1/items/:id returns an archived message when the item is archived', async () => {
  const app = buildTestApp({
    items: {
      'item-archived': {
        title: 'Headphones',
        status: 'ARCHIVED',
        referenceCode: 'FND-20260225-ARCHIVE1',
        dateReported: '2026-02-25T15:00:00.000Z',
        archivedAt: '2026-03-30T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-archived');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(
    response.body.error.message,
    'This item has been archived and is no longer in active listings.',
  );
});

test('GET /api/v1/items/:id/status returns public availability for a claimed item', async () => {
  const app = buildTestApp({
    items: {
      'item-status-1': {
        title: 'Phone',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-STAT0001',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-1/status');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: 'item-status-1',
    status: 'CLAIMED',
    availability: 'CLAIMED',
    claimStatus: 'APPROVED',
  });
});

test('GET /api/v1/items/:id/status returns public availability for a validated item', async () => {
  const app = buildTestApp({
    items: {
      'item-status-validated': {
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-STAT0002',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-validated/status');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: 'item-status-validated',
    status: 'VALIDATED',
    availability: 'AVAILABLE',
  });
});

test('GET /api/v1/items/:id/status returns 403 when item is still under review', async () => {
  const app = buildTestApp({
    items: {
      'item-status-review': {
        title: 'Headphones',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-REVIEW02',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-review/status');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('GET /api/v1/items/:id/status returns 404 when no matching item exists', async () => {
  const app = buildTestApp();

  const response = await request(app).get('/api/v1/items/unknown-status-id/status');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
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

test('GET /api/v1/items skips reports with unparseable dateReported values', async () => {
  const app = buildTestApp({
    reports: {
      'invalid-date-item': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BADDATE1',
        dateReported: 'not-a-real-date',
      },
      'valid-date-item': {
        kind: 'FOUND',
        title: 'Bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-VALID001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'valid-date-item');
});

test('GET /api/v1/items/:id returns 422 when dateReported is not parseable', async () => {
  const app = buildTestApp({
    items: {
      'item-invalid-date': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-INVALID1',
        dateReported: 'not-a-real-date',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-invalid-date');

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ITEM_DATA');
});

test('GET /api/v1/admin/items/:id/history returns persisted and legacy events in reverse chronological order', async () => {
  const app = buildTestApp({
    items: {
      'item-1': {
        reportId: 'report-1',
        title: 'Blue backpack',
        status: 'CLAIMED',
        referenceCode: 'FND-20260317-HIST0001',
      },
    },
    reports: {
      'report-1': {
        kind: 'FOUND',
        title: 'Blue backpack',
        status: 'CLAIMED',
        referenceCode: 'FND-20260317-HIST0001',
        dateReported: '2026-03-17T10:00:00.000Z',
        contactEmail: 'finder@example.com',
      },
    },
    claims: {
      'claim-1': {
        itemId: 'report-1',
        referenceCode: 'FND-20260317-HIST0001',
        claimantUid: 'student-1',
        claimantEmail: 'student@example.com',
        claimantName: 'Jane Student',
        itemName: 'Blue backpack',
        claimReason: 'Has my books',
        proofDetails: 'Contains student ID',
        status: 'APPROVED',
        createdAt: '2026-03-18T09:00:00.000Z',
        reviewedAt: '2026-03-18T11:00:00.000Z',
      },
    },
    itemHistory: {
      'history-1': {
        itemId: 'report-1',
        entityType: 'REPORT',
        entityId: 'report-1',
        actionType: 'REPORT_UPDATED',
        timestamp: '2026-03-17T12:00:00.000Z',
        summary: 'Report details updated.',
        changes: [{
          field: 'location',
          previousValue: 'Library',
          newValue: 'Student Center',
        }],
      },
    },
  });

  const response = await request(app).get('/api/v1/admin/items/item-1/history');

  assert.equal(response.status, 200);
  assert.equal(response.body.itemId, 'report-1');
  assert.equal(response.body.resolvedFrom, 'item-1');
  assert.equal(response.body.referenceCode, 'FND-20260317-HIST0001');
  assert.equal(response.body.currentStatus, 'CLAIMED');
  assert.equal(response.body.total, 4);
  assert.deepEqual(
    response.body.events.map((event) => event.actionType),
    ['CLAIM_APPROVED', 'CLAIM_CREATED', 'REPORT_UPDATED', 'REPORT_CREATED'],
  );
  assert.ok(response.body.events.every((event) => event.itemId === 'report-1'));
  assert.equal(response.body.events[0].entityId, 'claim-1');
  assert.equal(response.body.events[3].entityId, 'report-1');
});

test('GET /api/v1/admin/items/:id/history returns 404 when no item can be resolved', async () => {
  const app = buildTestApp();

  const response = await request(app).get('/api/v1/admin/items/missing-item/history');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/admin/items/:id/status updates a validated item to returned and writes audit metadata', async () => {
  const itemStatusHistory = {};
  const app = buildTestApp({
    items: {
      'item-admin-1': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ADMIN01',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-1/status')
    .send({ status: 'RETURNED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-admin-1');
  assert.equal(response.body.previousStatus, 'VALIDATED');
  assert.equal(response.body.status, 'RETURNED');
  assert.equal(response.body.updatedByUid, 'security-1');
  assert.equal(response.body.updatedByEmail, 'security@example.com');
  assert.equal(response.body.updatedByRole, 'SECURITY');
  assert.match(response.body.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const historyEntries = Object.values(itemStatusHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'item-admin-1');
  assert.equal(historyEntries[0].previousStatus, 'VALIDATED');
  assert.equal(historyEntries[0].nextStatus, 'RETURNED');
  assert.equal(historyEntries[0].changedByUid, 'security-1');
});

test('PATCH /api/v1/admin/items/:id/status updates a legacy report document and records history', async () => {
  const itemStatusHistory = {};
  const app = buildTestApp({
    reports: {
      'report-admin-1': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'CLAIMED',
        referenceCode: 'FND-20260225-ADMIN02',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/report-admin-1/status')
    .send({ status: 'RETURNED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'report-admin-1');
  assert.equal(response.body.previousStatus, 'CLAIMED');
  assert.equal(response.body.status, 'RETURNED');

  const historyEntries = Object.values(itemStatusHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-admin-1');
  assert.equal(historyEntries[0].previousStatus, 'CLAIMED');
  assert.equal(historyEntries[0].nextStatus, 'RETURNED');
  assert.equal(historyEntries[0].changedByUid, 'security-1');
});

test('PATCH /api/v1/admin/items/:id/status returns 409 for an invalid status transition', async () => {
  const app = buildTestApp({
    items: {
      'item-admin-conflict': {
        title: 'Phone',
        status: 'RETURNED',
        referenceCode: 'FND-20260225-ADMIN03',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-conflict/status')
    .send({ status: 'CLAIMED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_CONFLICT');
});

test('PATCH /api/v1/admin/items/:id/status returns 409 when the status is unchanged', async () => {
  const app = buildTestApp({
    items: {
      'item-admin-same': {
        title: 'Bottle',
        status: 'ARCHIVED',
        referenceCode: 'FND-20260225-ADMIN04',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-same/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_CONFLICT');
});

test('PATCH /api/v1/admin/items/:id/status returns 404 when item does not exist', async () => {
  const app = buildTestApp();

  const response = await request(app)
    .patch('/api/v1/admin/items/missing-item/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/admin/items/:id/status returns 400 for unsupported target status', async () => {
  const app = buildTestApp({
    items: {
      'item-admin-invalid': {
        title: 'Laptop',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ADMIN05',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-invalid/status')
    .send({ status: 'PENDING_VALIDATION' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('PATCH /api/v1/admin/items/:id/status archives linked item/report records and logs item history', async () => {
  const itemStatusHistory = {};
  const itemHistory = {};
  const app = buildTestApp({
    items: {
      'item-linked-1': {
        reportId: 'report-linked-1',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LINK0001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    reports: {
      'report-linked-1': {
        kind: 'FOUND',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LINK0001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemHistory,
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-linked-1/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-linked-1');
  assert.equal(response.body.status, 'ARCHIVED');

  const statusEntries = Object.values(itemStatusHistory);
  assert.equal(statusEntries.length, 1);
  assert.equal(statusEntries[0].nextStatus, 'ARCHIVED');
  assert.equal(statusEntries[0].itemId, 'item-linked-1');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-linked-1');
  assert.equal(historyEntries[0].entityId, 'item-linked-1');
  assert.equal(historyEntries[0].actionType, 'ITEM_ARCHIVED');
  assert.equal(historyEntries[0].summary, 'Item archived by staff.');
});

test('PATCH /api/v1/admin/items/:id/status keeps linked item/report updates when ids collide across collections', async () => {
  const items = {
    'shared-id': {
      reportId: 'shared-id',
      title: 'Umbrella',
      status: 'VALIDATED',
      referenceCode: 'FND-20260225-SHARED01',
      dateReported: '2026-02-25T12:00:00.000Z',
    },
  };
  const reports = {
    'shared-id': {
      kind: 'FOUND',
      title: 'Umbrella',
      status: 'VALIDATED',
      referenceCode: 'FND-20260225-SHARED01',
      dateReported: '2026-02-25T12:00:00.000Z',
    },
  };
  const itemHistory = {};
  const app = buildTestApp({
    items,
    reports,
    itemHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/shared-id/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ARCHIVED');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'shared-id');
  assert.equal(historyEntries[0].entityId, 'shared-id');
  assert.equal(items['shared-id'].status, 'ARCHIVED');
  assert.equal(reports['shared-id'].status, 'ARCHIVED');
  assert.match(items['shared-id'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(reports['shared-id'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('POST /api/v1/admin/items/:id/restore-status restores an item to a previous status from history', async () => {
  const itemStatusHistory = {
    'history-1': {
      itemId: 'item-restore-1',
      previousStatus: 'VALIDATED',
      nextStatus: 'CLAIMED',
      changedAt: '2026-03-20T10:00:00.000Z',
      changedByUid: 'security-1',
      changedByRole: 'SECURITY',
    },
    'history-2': {
      itemId: 'item-restore-1',
      previousStatus: 'CLAIMED',
      nextStatus: 'RETURNED',
      changedAt: '2026-03-21T10:00:00.000Z',
      changedByUid: 'security-1',
      changedByRole: 'SECURITY',
    },
  };
  const itemHistory = {};
  const app = buildTestApp({
    items: {
      'item-restore-1': {
        reportId: 'report-restore-1',
        title: 'Wallet',
        status: 'RETURNED',
        referenceCode: 'FND-20260320-RESTORE1',
        dateReported: '2026-03-20T09:00:00.000Z',
      },
    },
    reports: {
      'report-restore-1': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'RETURNED',
        referenceCode: 'FND-20260320-RESTORE1',
        dateReported: '2026-03-20T09:00:00.000Z',
      },
    },
    itemStatusHistory,
    itemHistory,
  });

  const response = await request(app)
    .post('/api/v1/admin/items/item-restore-1/restore-status')
    .send({ status: 'VALIDATED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-restore-1');
  assert.equal(response.body.previousStatus, 'RETURNED');
  assert.equal(response.body.status, 'VALIDATED');

  const statusEntries = Object.values(itemStatusHistory);
  assert.equal(statusEntries.length, 3);
  assert.equal(statusEntries[2].previousStatus, 'RETURNED');
  assert.equal(statusEntries[2].nextStatus, 'VALIDATED');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-restore-1');
  assert.equal(historyEntries[0].actionType, 'ITEM_STATUS_RESTORED');
});

test('POST /api/v1/admin/items/:id/restore-status returns 409 when the selected status is not in history', async () => {
  const app = buildTestApp({
    items: {
      'item-restore-invalid': {
        title: 'Phone',
        status: 'RETURNED',
        referenceCode: 'FND-20260320-RESTORE2',
        dateReported: '2026-03-20T09:00:00.000Z',
      },
    },
    itemStatusHistory: {
      'history-1': {
        itemId: 'item-restore-invalid',
        previousStatus: 'VALIDATED',
        nextStatus: 'CLAIMED',
        changedAt: '2026-03-20T10:00:00.000Z',
        changedByUid: 'security-1',
        changedByRole: 'SECURITY',
      },
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/items/item-restore-invalid/restore-status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_RESTORE_NOT_ALLOWED');
});
