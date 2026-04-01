import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('PATCH /api/v1/reports/found/:id/validate validates a pending found-item report', async () => {
  const { app, reports, itemHistory } = buildReportsTestApp({
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

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'REPORT_VALIDATED');
  assert.equal(historyEvent.actor.uid, 'security-1');
  assert.equal(historyEvent.actor.email, 'security@example.com');
  assert.equal(historyEvent.actor.role, 'SECURITY');
});

test('PATCH /api/v1/reports/found/:id/validate returns 404 when report does not exist', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app)
    .patch('/api/v1/reports/found/missing-report/validate')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/reports/found/:id/validate returns 409 for non-found reports', async () => {
  const { app } = buildReportsTestApp({
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
  const { app } = buildReportsTestApp({
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
