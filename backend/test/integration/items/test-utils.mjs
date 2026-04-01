import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createItemsRouter } from '../../../dist/src/routes/items.routes.js';
import { errorHandler, notFoundHandler } from '../../../dist/src/middleware/error-handler.js';

export { test, assert };

export const createFakeDb = ({ items = {}, reports = {}, claims = {}, itemHistory = {}, itemStatusHistory = {} } = {}) => {
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
    if (typeof value === 'string') return value;
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    return new Date(0).toISOString();
  };

  const buildEqualsQuery = (entries, field) => ({
    where: (queryField, operator, value) => {
      assert.equal(queryField, field);
      assert.equal(operator, '==');
      const docs = entries
        .filter(([, source]) => source[field] === value)
        .map(([id, source]) => normalizeDoc(id, source));

      return { get: async () => ({ docs }) };
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
              if (!source) return { exists: false, id, data: () => undefined };
              return normalizeDoc(id, source);
            },
          }),
          where: (field, operator, value) => {
            assert.equal(field, 'reportId');
            assert.equal(operator, '==');
            const matches = Object.entries(items)
              .filter(([, item]) => item.reportId === value)
              .map(([id, item]) => ({ ...normalizeDoc(id, item), ref: buildRef('items', id) }));

            return {
              limit: (limitValue) => {
                assert.equal(limitValue, 1);
                return {
                  get: async () => {
                    const docs = matches.slice(0, limitValue);
                    return { empty: docs.length === 0, docs };
                  },
                };
              },
            };
          },
        };
      }

      if (collectionName === 'reports') {
        const buildReportsQuery = (entries) => ({
          where: (field, operator, value) => {
            const filtered = entries.filter(([, report]) => {
              const fieldValue = report[field];
              const normalizedFieldValue = normalizeDate(fieldValue);
              const normalizedFilterValue = typeof value === 'string' ? value : normalizeDate(value);
              if (operator === '==') return fieldValue === value;
              if (operator === 'in') return Array.isArray(value) && value.includes(fieldValue);
              if (operator === '>=') return normalizedFieldValue >= normalizedFilterValue;
              if (operator === '<=') return normalizedFieldValue <= normalizedFilterValue;
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
              return direction === 'asc' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
            });

            return {
              get: async () => ({ docs: sorted.map(([id, data]) => normalizeDoc(id, data)) }),
              offset: (offsetValue) => ({
                limit: (limitValue) => ({
                  get: async () => ({
                    docs: sorted
                      .slice(offsetValue, offsetValue + limitValue)
                      .map(([id, data]) => normalizeDoc(id, data)),
                  }),
                }),
              }),
              limit: (limitValue) => ({
                get: async () => ({
                  docs: sorted.slice(0, limitValue).map(([id, data]) => normalizeDoc(id, data)),
                }),
              }),
            };
          },
        });

        return {
          where: (field, operator, value) => buildReportsQuery(Object.entries(reports)).where(field, operator, value),
          doc: (id) => ({
            ...buildRef(collectionName, id),
            get: async () => {
              const source = reports[id];
              if (!source) return { exists: false, id, data: () => undefined };
              return normalizeDoc(id, source);
            },
          }),
        };
      }

      if (collectionName === 'claims') return buildEqualsQuery(Object.entries(claims), 'itemId');
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

          if (!store?.[ref.id]) throw new Error(`Cannot update missing doc ${ref.collectionName}/${ref.id}`);
          store[ref.id] = { ...store[ref.id], ...patch };
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

export const buildItemsTestApp = ({ items = {}, reports = {}, claims = {}, itemHistory = {}, itemStatusHistory = {} } = {}) => {
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
