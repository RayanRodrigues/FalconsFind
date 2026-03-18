import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from './request-helper.mjs';
import { createReportsRouter } from '../../dist/src/routes/reports.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = (initialReports = {}) => {
  const savedReports = [];
  let counter = 0;
  const reports = { ...initialReports };

  const createReportDoc = (id, data) => ({
    id,
    ref: {
      id,
      update: async (patch) => {
        reports[id] = {
          ...reports[id],
          ...patch,
        };
      },
    },
    data: () => data,
  });

  return {
    db: {
      collection: (collectionName) => {
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
  app.use(createReportsRouter(db, bucket, {
    requireStaffUser: (_req, _res, next) => next(),
  }));
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
      category: 'Backpacks & Bags',
      description: 'Black backpack',
      additionalInfo: 'Has course stickers',
      lastSeenLocation: 'Library',
      contactEmail: 'student@example.com',
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.id);
  assert.match(response.body.referenceCode, /^LST-\d{8}-[A-Z0-9]+$/);
  assert.equal(savedReports.length, 1);
  assert.equal(savedReports[0].data.kind, 'LOST');
  assert.equal(savedReports[0].data.title, 'Lost backpack');
  assert.equal(savedReports[0].data.category, 'Backpacks & Bags');
  assert.equal(savedReports[0].data.description, 'Black backpack');
  assert.equal(savedReports[0].data.additionalInfo, 'Has course stickers');
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
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);

  const response = await request(app)
    .post('/api/v1/reports/found')
    .field('title', 'Found wallet')
    .field('foundLocation', 'Gym')
    .field('contactEmail', 'finder@example.com')
    .attach('photo', jpegBuffer, {
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

test('GET /api/v1/reports/reference/:referenceCode returns a report by reference code', async () => {
  const { app } = buildTestApp({
    'report-edit-1': {
      kind: 'FOUND',
      title: 'Black wallet',
      status: 'REPORTED',
      referenceCode: 'FND-20260317-EDIT0001',
      location: 'Library',
      description: 'Black leather wallet',
      dateReported: '2026-03-17T10:00:00.000Z',
      contactEmail: 'user@example.com',
    },
  });

  const response = await request(app).get('/api/v1/reports/reference/FND-20260317-EDIT0001');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'report-edit-1');
  assert.equal(response.body.referenceCode, 'FND-20260317-EDIT0001');
  assert.equal(response.body.kind, 'FOUND');
  assert.equal(response.body.title, 'Black wallet');
});

test('GET /api/v1/reports/reference/:referenceCode returns 404 when report is missing', async () => {
  const { app } = buildTestApp();

  const response = await request(app).get('/api/v1/reports/reference/FND-20260317-MISSING01');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/reports/reference/:referenceCode updates an editable report', async () => {
  const { app, reports } = buildTestApp({
    'report-edit-2': {
      kind: 'LOST',
      title: 'Blue backpack',
      status: 'REPORTED',
      referenceCode: 'LST-20260317-EDIT0002',
      location: 'Student Centre',
      description: 'Blue backpack with notebooks',
      dateReported: '2026-03-17T09:00:00.000Z',
      contactEmail: 'owner@example.com',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/reference/LST-20260317-EDIT0002')
    .send({
      title: 'Blue backpack with charger',
      location: 'Student Center',
      dateReported: '2026-03-17T12:30:00.000Z',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.title, 'Blue backpack with charger');
  assert.equal(response.body.location, 'Student Center');
  assert.equal(response.body.dateReported, '2026-03-17T12:30:00.000Z');
  assert.equal(reports['report-edit-2'].title, 'Blue backpack with charger');
  assert.equal(reports['report-edit-2'].location, 'Student Center');
  assert.equal(reports['report-edit-2'].dateReported, '2026-03-17T12:30:00.000Z');
});

test('PATCH /api/v1/reports/reference/:referenceCode returns 409 when report is no longer editable', async () => {
  const { app } = buildTestApp({
    'report-edit-3': {
      kind: 'FOUND',
      title: 'Black wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260317-EDIT0003',
      location: 'Library',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/reference/FND-20260317-EDIT0003')
    .send({
      title: 'Updated title',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_EDIT_CONFLICT');
});

test('PATCH /api/v1/reports/reference/:referenceCode returns 400 for invalid payload', async () => {
  const { app } = buildTestApp({
    'report-edit-4': {
      kind: 'FOUND',
      title: 'Keys',
      status: 'REPORTED',
      referenceCode: 'FND-20260317-EDIT0004',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/reports/reference/FND-20260317-EDIT0004')
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
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

test('GET /api/v1/admin/reports lists all reports with aggregated summary', async () => {
  const { app } = buildTestApp({
    'report-1': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'REPORTED',
      referenceCode: 'FND-20260317-FOUND001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
      contactEmail: 'finder@example.com',
    },
    'report-2': {
      kind: 'LOST',
      title: 'Lost backpack',
      status: 'VALIDATED',
      referenceCode: 'LST-20260316-LOST0002',
      location: 'Library',
      dateReported: '2026-03-16T11:00:00.000Z',
    },
    'report-3': {
      kind: 'FOUND',
      title: 'Silver keys',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260315-FOUND003',
      location: 'Hallway',
      dateReported: '2026-03-15T09:00:00.000Z',
    },
  });

  const response = await request(app).get('/api/v1/admin/reports?page=1&limit=2');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 3);
  assert.equal(response.body.totalPages, 2);
  assert.equal(response.body.hasNextPage, true);
  assert.equal(response.body.hasPrevPage, false);
  assert.equal(response.body.summary.totalReports, 3);
  assert.equal(response.body.summary.lostReports, 1);
  assert.equal(response.body.summary.foundReports, 2);
  assert.equal(response.body.summary.byStatus.REPORTED, 1);
  assert.equal(response.body.summary.byStatus.VALIDATED, 1);
  assert.equal(response.body.summary.byStatus.PENDING_VALIDATION, 1);
  assert.equal(response.body.reports.length, 2);
  assert.equal(response.body.reports[0].id, 'report-1');
  assert.equal(response.body.reports[1].id, 'report-2');
});

test('GET /api/v1/admin/reports filters by kind, status, and search', async () => {
  const { app } = buildTestApp({
    'report-1': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'REPORTED',
      referenceCode: 'FND-20260317-FOUND001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
    'report-2': {
      kind: 'FOUND',
      title: 'Found backpack',
      status: 'VALIDATED',
      referenceCode: 'FND-20260316-FOUND002',
      location: 'Library',
      dateReported: '2026-03-16T11:00:00.000Z',
    },
    'report-3': {
      kind: 'LOST',
      title: 'Lost keys',
      status: 'VALIDATED',
      referenceCode: 'LST-20260315-LOST003',
      location: 'Hallway',
      dateReported: '2026-03-15T09:00:00.000Z',
    },
  });

  const response = await request(app)
    .get('/api/v1/admin/reports?kind=FOUND&status=VALIDATED&search=backpack');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.summary.totalReports, 1);
  assert.equal(response.body.summary.foundReports, 1);
  assert.equal(response.body.summary.lostReports, 0);
  assert.equal(response.body.filters.kind, 'FOUND');
  assert.equal(response.body.filters.status, 'VALIDATED');
  assert.equal(response.body.filters.search, 'backpack');
  assert.equal(response.body.reports.length, 1);
  assert.equal(response.body.reports[0].id, 'report-2');
});

test('GET /api/v1/admin/reports returns 400 for invalid kind filter', async () => {
  const { app } = buildTestApp();

  const response = await request(app).get('/api/v1/admin/reports?kind=INVALID');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/admin/reports returns 400 for invalid status filter', async () => {
  const { app } = buildTestApp();

  const response = await request(app).get('/api/v1/admin/reports?status=INVALID');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
