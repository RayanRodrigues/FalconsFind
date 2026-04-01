import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('POST /api/v1/reports/lost creates a report', async () => {
  const { app, itemHistory, savedReports } = buildReportsTestApp();

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

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'REPORT_CREATED');
  assert.equal(historyEvent.entityId, response.body.id);
  assert.equal(historyEvent.itemId, response.body.id);
  assert.equal(historyEvent.metadata.referenceCode, response.body.referenceCode);
  assert.match(historyEvent.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('POST /api/v1/reports/found returns 400 when photo is missing', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app)
    .post('/api/v1/reports/found')
    .field('title', 'Found keys')
    .field('foundLocation', 'Cafeteria');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
  assert.equal(response.body.error.message, 'photo is required');
});

test('POST /api/v1/reports/found creates a report with photo upload', async () => {
  const { app, itemHistory, savedReports, uploads } = buildReportsTestApp();
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);

  const response = await request(app)
    .post('/api/v1/reports/found')
    .field('title', 'Found wallet')
    .field('category', 'Wallets & Purses')
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
  assert.equal(savedReports[0].data.category, 'Wallets & Purses');
  assert.equal(savedReports[0].data.status, 'PENDING_VALIDATION');
  assert.equal(uploads.length, 1);

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'REPORT_CREATED');
  assert.equal(historyEvent.entityId, response.body.id);
  assert.equal(historyEvent.itemId, response.body.id);
  assert.equal(historyEvent.metadata.referenceCode, response.body.referenceCode);
  assert.equal(historyEvent.metadata.itemStatus, 'PENDING_VALIDATION');
});

test('GET /api/v1/reports/reference/:referenceCode returns a report by reference code', async () => {
  const { app } = buildReportsTestApp({
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
  const { app } = buildReportsTestApp();

  const response = await request(app).get('/api/v1/reports/reference/FND-20260317-MISSING01');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/reports/reference/:referenceCode updates an editable report', async () => {
  const { app, reports } = buildReportsTestApp({
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
  const { app } = buildReportsTestApp({
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
    .send({ title: 'Updated title' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_EDIT_CONFLICT');
});

test('PATCH /api/v1/reports/reference/:referenceCode returns 400 for invalid payload', async () => {
  const { app } = buildReportsTestApp({
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
