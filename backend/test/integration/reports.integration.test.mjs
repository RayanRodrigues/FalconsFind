import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createReportsRouter } from '../../dist/src/routes/reports.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = (initialReports = {}) => {
  const savedReports = [];
  let counter = 0;
  const reports = { ...initialReports };

  return {
    db: {
      collection: (collectionName) => {
        assert.equal(collectionName, 'reports');
        return {
          doc: (id) => {
            if (id) {
              return {
                id,
                get: async () => ({
                  id,
                  exists: reports[id] !== undefined,
                  data: () => reports[id],
                }),
                update: async (patch) => {
                  reports[id] = {
                    ...reports[id],
                    ...patch,
                  };
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
        };

        return handler(transaction);
      },
    },
    savedReports,
    reports,
  };
};

const createFakeBucket = () => {
  const uploads = [];

  return {
    bucket: {
      name: 'test-bucket',
      file: (fileName) => ({
        save: async (buffer, options) => {
          uploads.push({ fileName, size: buffer.length, options });
        },
      }),
    },
    uploads,
  };
};

const buildTestApp = (initialReports = {}) => {
  const { db, savedReports, reports } = createFakeDb(initialReports);
  const { bucket, uploads } = createFakeBucket();

  const app = express();
  app.use(express.json());
  app.use(createReportsRouter(db, bucket));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, savedReports, uploads, reports };
};

test('POST /api/v1/reports/lost creates a report', async () => {
  const { app, savedReports } = buildTestApp();

  const response = await request(app)
    .post('/api/v1/reports/lost')
    .send({
      title: 'Lost backpack',
      description: 'Black backpack',
      lastSeenLocation: 'Library',
      contactEmail: 'student@example.com',
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.id);
  assert.match(response.body.referenceCode, /^LST-\d{8}-[A-Z0-9]+$/);
  assert.equal(savedReports.length, 1);
  assert.equal(savedReports[0].data.kind, 'LOST');
  assert.equal(savedReports[0].data.title, 'Lost backpack');
});

test('POST /api/v1/reports/found returns 400 when photo is missing', async () => {
  const { app } = buildTestApp();

  const response = await request(app)
    .post('/api/v1/reports/found')
    .field('title', 'Found keys')
    .field('foundLocation', 'Cafeteria');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
  assert.equal(response.body.error.message, 'photo is required');
});

test('POST /api/v1/reports/found creates a report with photo upload', async () => {
  const { app, savedReports, uploads } = buildTestApp();

  const response = await request(app)
    .post('/api/v1/reports/found')
    .field('title', 'Found wallet')
    .field('foundLocation', 'Gym')
    .field('contactEmail', 'finder@example.com')
    .attach('photo', Buffer.from('fake-image-bytes'), {
      filename: 'wallet.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.id);
  assert.match(response.body.referenceCode, /^FND-\d{8}-[A-Z0-9]+$/);
  assert.equal(savedReports.length, 1);
  assert.equal(savedReports[0].data.kind, 'FOUND');
  assert.equal(savedReports[0].data.title, 'Found wallet');
  assert.equal(savedReports[0].data.status, 'PENDING_VALIDATION');
  assert.equal(uploads.length, 1);
});

test('PATCH /api/v1/reports/found/:id/validate validates a pending found-item report', async () => {
  const { app, reports } = buildTestApp({
    'found-1': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260317-FOUND001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/found/found-1/validate')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'found-1');
  assert.equal(response.body.referenceCode, 'FND-20260317-FOUND001');
  assert.equal(response.body.status, 'VALIDATED');
  assert.equal(reports['found-1'].status, 'VALIDATED');
});

test('PATCH /api/v1/reports/found/:id/validate returns 404 when report does not exist', async () => {
  const { app } = buildTestApp();

  const response = await request(app)
    .patch('/api/v1/reports/found/missing-report/validate')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/reports/found/:id/validate returns 409 for non-found reports', async () => {
  const { app } = buildTestApp({
    'lost-1': {
      kind: 'LOST',
      title: 'Lost backpack',
      status: 'REPORTED',
      referenceCode: 'LST-20260317-LOST0001',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/found/lost-1/validate')
    .send();

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_VALIDATION_CONFLICT');
});

test('PATCH /api/v1/reports/found/:id/validate returns 409 when report is not pending validation', async () => {
  const { app } = buildTestApp({
    'found-validated': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260317-FOUND002',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/found/found-validated/validate')
    .send();

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_VALIDATION_CONFLICT');
});
