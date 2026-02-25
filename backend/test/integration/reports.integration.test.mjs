import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createReportsRouter } from '../../dist/src/routes/reports.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const createFakeDb = () => {
  const savedReports = [];
  let counter = 0;

  return {
    db: {
      collection: (collectionName) => {
        assert.equal(collectionName, 'reports');
        return {
          doc: () => {
            counter += 1;
            const id = `doc-${counter}`;
            return {
              id,
              set: async (data) => {
                savedReports.push({ id, data });
              },
            };
          },
        };
      },
    },
    savedReports,
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

const buildTestApp = () => {
  const { db, savedReports } = createFakeDb();
  const { bucket, uploads } = createFakeBucket();

  const app = express();
  app.use(express.json());
  app.use(createReportsRouter(db, bucket));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, savedReports, uploads };
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
  assert.equal(uploads.length, 1);
});
