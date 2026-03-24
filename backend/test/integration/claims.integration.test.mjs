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

const createFakeDb = ({ claims = {}, items = {}, reports = {}, itemHistory = {} } = {}) => {
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

          throw new Error(`Cannot set unexpected collection ${ref.collectionName}`);
        },
      };

      return handler(transaction);
    },
  };

  return { db, itemHistory, savedClaims, claims, items, reports };
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

const buildTestApp = (db) => {
  const { bucket, uploads } = createFakeBucket();
  const app = express();
  app.use(express.json());
  app.use(createClaimsRouter(db, bucket, {
    requireStaffUser: (_req, _res, next) => next(),
    requireAuthenticatedUser: (_req, res, next) => {
      res.locals.authUser = {
        uid: 'student-1',
        email: 'jane@example.com',
        role: 'STUDENT',
      };
      next();
    },
    requireClaimAccessUser: (_req, res, next) => {
      res.locals.authUser = {
        uid: 'student-1',
        email: 'jane@example.com',
        role: 'STUDENT',
      };
      next();
    },
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  app.uploads = uploads;
  return app;
};

test('POST /api/v1/claims creates a pending claim for a validated item found by referenceCode', async () => {
  const { db, itemHistory, savedClaims } = createFakeDb({
    reports: {
      'report-1': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00001',
      },
    },
  });

  const app = buildTestApp(db);
  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00001',
      itemName: 'Black backpack',
      claimReason: 'I left this backpack after class and returned shortly after to find it missing.',
      proofDetails: 'It has a Falcon sticker and my initials on the inside pocket.',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
      phone: '519-555-0100',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.id, 'claim-1');
  assert.equal(response.body.status, 'PENDING');
  assert.match(response.body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(savedClaims.length, 1);
  assert.equal(savedClaims[0].data.itemId, 'report-1');
  assert.equal(savedClaims[0].data.referenceCode, 'FF-2024-00001');
  assert.equal(savedClaims[0].data.claimantUid, 'student-1');
  assert.equal(savedClaims[0].data.itemName, 'Black backpack');
  assert.equal(savedClaims[0].data.status, 'PENDING');
  assert.equal(savedClaims[0].data.claimantName, 'Jane Doe');
  assert.equal(savedClaims[0].data.claimReason, 'I left this backpack after class and returned shortly after to find it missing.');
  assert.equal(savedClaims[0].data.proofDetails, 'It has a Falcon sticker and my initials on the inside pocket.');
  assert.equal(savedClaims[0].data.phone, '519-555-0100');
  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'CLAIM_CREATED');
  assert.equal(historyEvent.entityId, 'claim-1');
  assert.equal(historyEvent.itemId, 'report-1');
  assert.equal(historyEvent.metadata.referenceCode, 'FF-2024-00001');
  assert.equal(historyEvent.metadata.claimStatus, 'PENDING');
  assert.match(historyEvent.timestamp, /^\d{4}-\d{2}-\d{2}T/);
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

  const app = buildTestApp(db);
  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00099',
      itemName: 'Campus card holder',
      claimReason: 'I dropped this in the hallway while heading to class and noticed it was gone.',
      proofDetails: 'It contains my student card and a blue transit pass.',
      claimantName: 'John Smith',
      claimantEmail: 'john@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(savedClaims[0].data.itemId, 'item-ref');
  assert.equal(savedClaims[0].data.status, 'PENDING');
  assert.equal(savedClaims[0].data.claimantUid, 'student-1');
  assert.equal(savedClaims[0].data.claimantEmail, 'jane@example.com');
});

test('POST /api/v1/claims also allows authenticated admin users to create a claim', async () => {
  const { db, savedClaims } = createFakeDb({
    reports: {
      'report-4': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00100',
      },
    },
  });

  const app = express();
  app.use(express.json());
  const { bucket } = createFakeBucket();
  app.use(createClaimsRouter(db, bucket, {
    requireStaffUser: (_req, _res, next) => next(),
    requireAuthenticatedUser: (_req, res, next) => {
      res.locals.authUser = {
        uid: 'admin-1',
        email: 'admin@fanshawe.ca',
        role: 'ADMIN',
      };
      next();
    },
    requireClaimAccessUser: (_req, res, next) => {
      res.locals.authUser = {
        uid: 'admin-1',
        email: 'admin@fanshawe.ca',
        role: 'ADMIN',
      };
      next();
    },
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00100',
      itemName: 'Black jacket',
      claimReason: 'I can identify where I left this and the personal items inside the pocket.',
      proofDetails: 'There is a silver keychain on the zipper and my work badge in the sleeve.',
      claimantName: 'Admin User',
      claimantEmail: 'someone-else@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(savedClaims[0].data.claimantUid, 'admin-1');
  assert.equal(savedClaims[0].data.claimantEmail, 'admin@fanshawe.ca');
});

test('POST /api/v1/claims returns 404 when no item has that referenceCode', async () => {
  const { db } = createFakeDb();

  const response = await request(buildTestApp(db))
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-MISSING',
      itemName: 'Bag',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
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
      itemName: 'Wallet',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
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
      itemName: 'Keys',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
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
      itemName: '',
      claimReason: 'short',
      proofDetails: 'short',
      claimantName: '',
      claimantEmail: 'not-an-email',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/claims/me lists only the authenticated user claims', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-1': {
        itemId: 'report-1',
        referenceCode: 'FND-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Black backpack',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'This item belongs to me and I can identify what is inside.',
        proofDetails: 'It has my initials and class notes inside.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
      'claim-2': {
        itemId: 'report-2',
        referenceCode: 'FND-2024-00002',
        claimantUid: 'student-1',
        itemName: 'Laptop sleeve',
        status: 'NEEDS_PROOF',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this sleeve after class.',
        proofDetails: 'It contains my name card.',
        additionalProofRequest: 'Please provide a photo of the sticker on the inside.',
        proofRequestedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
      'claim-3': {
        itemId: 'report-3',
        referenceCode: 'FND-2024-00003',
        claimantUid: 'student-2',
        itemName: 'Keys',
        status: 'PENDING',
        claimantName: 'Other User',
        claimantEmail: 'other@example.com',
        claimReason: 'Other claim reason',
        proofDetails: 'Other proof details',
        createdAt: '2026-03-18T08:00:00.000Z',
      },
    },
  });

  const app = buildTestApp(db);
  const response = await request(app).get('/api/v1/claims/me');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.summary.totalClaims, 2);
  assert.equal(response.body.summary.pendingClaims, 1);
  assert.equal(response.body.summary.needsProofClaims, 1);
  assert.equal(response.body.claims.length, 2);
  assert.equal(response.body.claims[0].id, 'claim-1');
  assert.equal(response.body.claims[1].id, 'claim-2');
  assert.equal(response.body.claims[1].additionalProofRequest, 'Please provide a photo of the sticker on the inside.');
});

test('PATCH /api/v1/claims/:id lets the owner edit a pending claim', async () => {
  const { db, claims } = createFakeDb({
    claims: {
      'claim-edit-1': {
        itemId: 'report-1',
        referenceCode: 'FND-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Old backpack label',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'Old reason text that is long enough for validation.',
        proofDetails: 'Old proof details that are also long enough for validation.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-edit-1')
    .send({
      itemName: 'Updated backpack label',
      claimReason: 'Updated reason that clearly explains how the item belongs to me.',
      proofDetails: 'Updated proof details describing stickers, notebooks, and initials inside.',
      phone: '519-555-0101',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'PENDING');
  assert.equal(claims['claim-edit-1'].itemName, 'Updated backpack label');
  assert.equal(claims['claim-edit-1'].phone, '519-555-0101');
});

test('PATCH /api/v1/claims/:id/proof-response submits additional proof, uploads photos, and returns the claim to pending review', async () => {
  const { db, claims, items } = createFakeDb({
    claims: {
      'claim-proof-1': {
        itemId: 'item-proof-1',
        referenceCode: 'FND-2024-00090',
        claimantUid: 'student-1',
        itemName: 'Laptop sleeve',
        status: 'NEEDS_PROOF',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this after class.',
        proofDetails: 'It contains my name tag inside.',
        additionalProofRequest: 'Please send a clearer photo of the inside label.',
        proofRequestedAt: '2026-03-18T10:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
    items: {
      'item-proof-1': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
  });

  const app = buildTestApp(db);
  const uploads = app.uploads;
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);

  const response = await request(app)
    .patch('/api/v1/claims/claim-proof-1/proof-response')
    .field('message', 'Here is a clearer photo of the inside label and stitching.')
    .attach('photos', jpegBuffer, {
      filename: 'label.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'PENDING');
  assert.equal(response.body.proofResponseMessage, 'Here is a clearer photo of the inside label and stitching.');
  assert.match(response.body.proofRespondedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(response.body.proofResponsePhotoUrls[0], /^https:\/\/signed\.local\/claims\//);
  assert.equal(uploads.length, 1);
  assert.equal(claims['claim-proof-1'].status, 'PENDING');
  assert.equal(items['item-proof-1'].claimStatus, 'PENDING');
  assert.equal(claims['claim-proof-1'].proofResponsePhotoUrls.length, 1);
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

test('GET /api/v1/admin/claims lists structured claims for the admin dashboard', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-1': {
        itemId: 'item-1',
        referenceCode: 'FF-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Black backpack',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I left it after class and returned shortly after.',
        proofDetails: 'It has my initials on the inner label.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
      'claim-2': {
        itemId: 'item-2',
        referenceCode: 'FF-2024-00002',
        claimantUid: 'student-2',
        itemName: 'Silver bottle',
        status: 'NEEDS_PROOF',
        claimantName: 'John Smith',
        claimantEmail: 'john@example.com',
        claimReason: 'I lost it in the library on Tuesday afternoon.',
        proofDetails: 'It has a dent near the base and a sticker from residence.',
        additionalProofRequest: 'Please describe the sticker.',
        proofRequestedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.summary.totalClaims, 2);
  assert.equal(response.body.summary.pendingClaims, 1);
  assert.equal(response.body.summary.needsProofClaims, 1);
  assert.equal(response.body.claims[0].id, 'claim-1');
  assert.equal(response.body.claims[1].id, 'claim-2');
  assert.equal(response.body.claims[1].additionalProofRequest, 'Please describe the sticker.');
});

test('GET /api/v1/admin/claims includes student proof responses after proof is submitted', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-proof-admin-1': {
        itemId: 'item-proof-admin-1',
        referenceCode: 'FND-2024-00999',
        claimantUid: 'student-1',
        itemName: 'Black water bottle',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this bottle after class and can describe the stickers on it.',
        proofDetails: 'There is a silver cap and a blue Falcons sticker near the base.',
        additionalProofRequest: 'Please share a photo of the sticker near the base.',
        proofRequestedAt: '2026-03-18T10:00:00.000Z',
        proofResponseMessage: 'Here is the bottle with the blue sticker and silver cap you asked for.',
        proofResponsePhotoUrls: ['gs://test-bucket/claims/proof-photo-1.jpg'],
        proofRespondedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.claims[0].proofResponseMessage, 'Here is the bottle with the blue sticker and silver cap you asked for.');
  assert.match(response.body.claims[0].proofResponsePhotoUrls[0], /^https:\/\/signed\.local\/claims\//);
  assert.equal(response.body.claims[0].proofRespondedAt, '2026-03-18T11:00:00.000Z');
});

test('GET /api/v1/admin/claims lists legacy claims stored with message-only fields', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-legacy': {
        kind: 'FOUND',
        title: 'Black Backpack',
        referenceCode: 'FF-LEGACY-001',
        status: 'VALIDATED',
      },
    },
    claims: {
      'claim-legacy': {
        itemId: 'report-legacy',
        claimantName: 'Rayan Teste',
        claimantEmail: 'rayan@email.com',
        message: 'I can describe the item and where I lost it.',
        status: 'PENDING',
        createdAt: '2026-03-16T04:40:13.963Z',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.claims[0].id, 'claim-legacy');
  assert.equal(response.body.claims[0].referenceCode, 'FF-LEGACY-001');
  assert.equal(response.body.claims[0].itemName, 'Black Backpack');
  assert.equal(response.body.claims[0].claimReason, 'I can describe the item and where I lost it.');
  assert.equal(response.body.claims[0].proofDetails, 'No proof details provided.');
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
        claimantUid: 'student-1',
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
        claimantUid: 'student-1',
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
        claimantUid: 'student-1',
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
        claimantUid: 'student-1',
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
        claimantUid: 'student-1',
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

test('PATCH /api/v1/claims/:id/cancel returns 403 when a student tries to cancel someone else’s claim', async () => {
  const { db } = createFakeDb({
    items: {
      'item-other-owner': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-other-owner': {
        itemId: 'item-other-owner',
        claimantUid: 'student-2',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildTestApp(db))
    .patch('/api/v1/claims/claim-other-owner/cancel')
    .send();

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});
