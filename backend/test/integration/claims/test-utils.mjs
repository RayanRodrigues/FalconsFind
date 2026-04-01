import assert from 'node:assert/strict';
import express from 'express';
import { createClaimsRouter } from '../../../dist/src/routes/claims.routes.js';
import { errorHandler, notFoundHandler } from '../../../dist/src/middleware/error-handler.js';

const createDocSnapshot = (ref, source) => ({
  ref,
  id: ref.id,
  exists: source !== undefined,
  data: () => source,
});

export const createFakeDb = ({ claims = {}, items = {}, reports = {}, itemHistory = {}, itemStatusHistory = {} } = {}) => {
  const savedClaims = [];
  let counter = 0;

  const db = {
    collection: (collectionName) => {
      if (collectionName === 'itemHistory') {
        return {
          where: (field, operator, value) => {
            assert.equal(field, 'itemId');
            assert.equal(operator, '==');

            return {
              get: async () => ({
                docs: Object.entries(itemHistory)
                  .filter(([, event]) => event[field] === value)
                  .map(([id, event]) => createDocSnapshot({ id, collectionName }, event)),
              }),
            };
          },
          doc: () => {
            counter += 1;
            const generatedId = `history-${counter}`;
            return {
              id: generatedId,
              collectionName,
              set: async (data) => {
                itemHistory[generatedId] = data;
              },
            };
          },
        };
      }

      if (collectionName === 'claims') {
        return {
          get: async () => ({
            docs: Object.entries(claims).map(([id, claim]) => createDocSnapshot({ id, collectionName }, claim)),
          }),
          where: (field, operator, value) => {
            assert.equal(operator, '==');

            return {
              get: async () => ({
                docs: Object.entries(claims)
                  .filter(([, claim]) => claim[field] === value)
                  .map(([id, claim]) => createDocSnapshot({ id, collectionName }, claim)),
              }),
            };
          },
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
        set: (ref, data) => {
          if (ref.collectionName === 'itemHistory') {
            itemHistory[ref.id] = data;
            return;
          }
          if (ref.collectionName === 'itemStatusHistory') {
            itemStatusHistory[ref.id] = data;
            return;
          }

          throw new Error(`Cannot set unexpected collection ${ref.collectionName}`);
        },
      };

      return handler(transaction);
    },
  };

  return { db, itemHistory, itemStatusHistory, savedClaims, claims, items, reports };
};

const createFakeBucket = () => {
  const uploads = [];
  const createFileHandle = (fileName) => ({
    save: async (buffer, options) => {
      uploads.push({ fileName, size: buffer.length, options });
    },
    getSignedUrl: async () => [`https://signed.local/${fileName}`],
  });
  const storage = {
    bucket: (bucketName) => ({
      name: bucketName,
      storage,
      file: (fileName) => createFileHandle(fileName),
    }),
  };

  return {
    bucket: {
      name: 'test-bucket',
      storage,
      file: (fileName) => createFileHandle(fileName),
    },
    uploads,
  };
};

export const buildClaimsTestApp = (db, options = {}) => {
  const { bucket, uploads } = createFakeBucket();
  const authenticatedUser = options.authenticatedUser ?? {
    uid: 'student-1',
    email: 'jane@example.com',
    role: 'STUDENT',
  };
  const claimAccessUser = options.claimAccessUser ?? authenticatedUser;

  const app = express();
  app.use(express.json());
  app.use(createClaimsRouter(db, bucket, {
    requireStaffUser: options.requireStaffUser ?? ((_req, _res, next) => next()),
    requireAuthenticatedUser: (_req, res, next) => {
      res.locals.authUser = authenticatedUser;
      next();
    },
    requireClaimAccessUser: (_req, res, next) => {
      res.locals.authUser = claimAccessUser;
      next();
    },
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, uploads };
};
