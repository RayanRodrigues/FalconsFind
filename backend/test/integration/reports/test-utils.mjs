import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createReportsRouter } from '../../../dist/src/routes/reports.routes.js';
import { errorHandler, notFoundHandler } from '../../../dist/src/middleware/error-handler.js';

export { test, assert };

export const createFakeDb = (initialData = {}) => {
  const usesStructuredInput = (
    Object.prototype.hasOwnProperty.call(initialData, 'reports')
    || Object.prototype.hasOwnProperty.call(initialData, 'items')
    || Object.prototype.hasOwnProperty.call(initialData, 'itemHistory')
    || Object.prototype.hasOwnProperty.call(initialData, 'itemStatusHistory')
  );
  const savedReports = [];
  const reports = usesStructuredInput ? { ...(initialData.reports ?? {}) } : { ...initialData };
  const items = usesStructuredInput ? { ...(initialData.items ?? {}) } : {};
  const itemHistory = usesStructuredInput ? { ...(initialData.itemHistory ?? {}) } : {};
  const itemStatusHistory = usesStructuredInput ? { ...(initialData.itemStatusHistory ?? {}) } : {};
  let counter = 0;

  const createReportDoc = (id, data) => ({
    id,
    ref: {
      id,
      collectionName: 'reports',
      path: `reports/${id}`,
      update: async (patch) => {
        reports[id] = { ...reports[id], ...patch };
      },
    },
    data: () => data,
  });

  return {
    db: {
      collection: (collectionName) => {
        if (collectionName === 'itemHistory') {
          return {
            doc: () => {
              counter += 1;
              const generatedId = `history-${counter}`;
              return {
                id: generatedId,
                set: async (data) => {
                  itemHistory[generatedId] = data;
                },
              };
            },
          };
        }

        if (collectionName === 'itemStatusHistory') {
          return {
            doc: (id) => ({
              id,
              collectionName,
              set: async (data) => {
                itemStatusHistory[id] = data;
              },
            }),
          };
        }

        if (collectionName === 'items') {
          return {
            doc: (id) => ({
              id,
              collectionName,
              path: `${collectionName}/${id}`,
              update: async (patch) => {
                items[id] = { ...items[id], ...patch };
              },
              get: async () => ({
                id,
                exists: items[id] !== undefined,
                data: () => items[id],
              }),
            }),
            where: (field, operator, value) => {
              assert.equal(field, 'reportId');
              assert.equal(operator, '==');

              const matches = Object.entries(items)
                .filter(([, item]) => item[field] === value)
                .map(([id, data]) => ({
                  id,
                  ref: {
                    id,
                    collectionName,
                    path: `${collectionName}/${id}`,
                    update: async (patch) => {
                      items[id] = { ...items[id], ...patch };
                    },
                  },
                  data: () => data,
                }));

              return {
                limit: (limitValue) => {
                  assert.equal(limitValue, 1);
                  return {
                    get: async () => ({
                      empty: matches.length === 0,
                      docs: matches.slice(0, limitValue),
                    }),
                  };
                },
              };
            },
          };
        }

        assert.equal(collectionName, 'reports');

        const buildQuery = (filters = []) => ({
          where: (field, operator, value) => {
            assert.equal(operator, '==');
            return buildQuery([...filters, { field, value }]);
          },
          limit: (limitValue) => {
            assert.equal(limitValue, 1);
            const matches = Object.entries(reports)
              .filter(([, data]) => filters.every(({ field, value }) => data[field] === value))
              .map(([id, data]) => createReportDoc(id, data));

            return {
              get: async () => ({
                empty: matches.length === 0,
                docs: matches.slice(0, limitValue),
              }),
            };
          },
          get: async () => ({
            docs: Object.entries(reports)
              .filter(([, data]) => filters.every(({ field, value }) => data[field] === value))
              .map(([id, data]) => createReportDoc(id, data)),
          }),
        });

        return {
          get: buildQuery().get,
          where: buildQuery().where,
          doc: (id) => {
            if (id) {
              return {
                id,
                collectionName,
                path: `${collectionName}/${id}`,
                get: async () => ({
                  id,
                  exists: reports[id] !== undefined,
                  data: () => reports[id],
                }),
                update: async (patch) => {
                  reports[id] = { ...reports[id], ...patch };
                },
              };
            }

            counter += 1;
            const generatedId = `doc-${counter}`;
            return {
              id: generatedId,
              set: async (data) => {
                reports[generatedId] = data;
                savedReports.push({ id: generatedId, data });
              },
            };
          },
        };
      },
      runTransaction: async (handler) => {
        const transaction = {
          get: async (target) => target.get(),
          update: (target, patch) => target.update(patch),
          set: (target, data) => {
            if (target.collectionName === 'itemStatusHistory') {
              itemStatusHistory[target.id] = data;
              return;
            }
            target.set(data);
          },
        };

        return handler(transaction);
      },
    },
    savedReports,
    itemHistory,
    itemStatusHistory,
    items,
    reports,
  };
};

const createFakeBucket = () => {
  const uploads = [];

  return {
    bucket: {
      name: 'test-bucket',
      storage: {
        bucket: (bucketName) => ({
          file: (fileName) => ({
            getSignedUrl: async () => [`https://signed.example/${bucketName}/${fileName}`],
          }),
        }),
      },
      file: (fileName) => ({
        save: async (buffer, options) => {
          uploads.push({ fileName, size: buffer.length, options });
        },
        getSignedUrl: async () => [`https://signed.example/test-bucket/${fileName}`],
      }),
    },
    uploads,
  };
};

export const buildReportsTestApp = (initialData = {}) => {
  const { db, savedReports, itemHistory, itemStatusHistory, items, reports } = createFakeDb(initialData);
  const { bucket, uploads } = createFakeBucket();

  const app = express();
  app.use(express.json());
  app.use(createReportsRouter(db, bucket, null, {
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

  return { app, savedReports, uploads, itemHistory, itemStatusHistory, items, reports };
};
