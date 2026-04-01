import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('PATCH /api/v1/admin/reports/:id/flag flags a report as suspicious with actor metadata', async () => {
  const { app, reports, itemHistory } = buildReportsTestApp({
    'report-flag-1': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260317-FLAG0001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/reports/report-flag-1/flag')
    .send({
      flagged: true,
      reason: 'Suspicious duplicate report',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'report-flag-1');
  assert.equal(response.body.isSuspicious, true);
  assert.equal(response.body.flagReason, 'Suspicious duplicate report');
  assert.match(response.body.flaggedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(response.body.suspiciousReason, 'Suspicious duplicate report');
  assert.equal(response.body.suspiciousFlaggedByUid, 'security-1');
  assert.equal(response.body.suspiciousFlaggedByEmail, 'security@example.com');
  assert.equal(response.body.suspiciousFlaggedByRole, 'SECURITY');
  assert.match(response.body.suspiciousFlaggedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(reports['report-flag-1'].isSuspicious, true);
  assert.equal(reports['report-flag-1'].suspiciousReason, 'Suspicious duplicate report');

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'REPORT_FLAGGED');
  assert.equal(historyEvent.actor.uid, 'security-1');
  assert.equal(historyEvent.actor.email, 'security@example.com');
  assert.equal(historyEvent.metadata.isSuspicious, true);
});

test('PATCH /api/v1/admin/reports/:id/flag accepts suspiciousReason-only payload from the admin UI', async () => {
  const { app, reports } = buildReportsTestApp({
    'report-flag-ui': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260326-FLAGUI01',
      location: 'Gym',
      dateReported: '2026-03-26T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/reports/report-flag-ui/flag')
    .send({
      suspiciousReason: 'Submitted with inconsistent finder details',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.isSuspicious, true);
  assert.equal(response.body.flagReason, 'Submitted with inconsistent finder details');
  assert.equal(response.body.suspiciousReason, 'Submitted with inconsistent finder details');
  assert.equal(reports['report-flag-ui'].isSuspicious, true);
  assert.equal(reports['report-flag-ui'].suspiciousReason, 'Submitted with inconsistent finder details');
});

test('PATCH /api/v1/admin/reports/:id/flag clears suspicious metadata when unflagging', async () => {
  const { app, reports, itemHistory } = buildReportsTestApp({
    'report-flag-2': {
      kind: 'FOUND',
      title: 'Found keys',
      status: 'VALIDATED',
      referenceCode: 'FND-20260317-FLAG0002',
      location: 'Hallway',
      dateReported: '2026-03-17T10:00:00.000Z',
      isSuspicious: true,
      suspiciousReason: 'Looks fabricated',
      suspiciousFlaggedByUid: 'security-old',
      suspiciousFlaggedByEmail: 'old@example.com',
      suspiciousFlaggedByRole: 'SECURITY',
      suspiciousFlaggedAt: '2026-03-17T11:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/reports/report-flag-2/flag')
    .send({ flagged: false });

  assert.equal(response.status, 200);
  assert.equal(response.body.isSuspicious, false);
  assert.equal(response.body.suspiciousReason, null);
  assert.equal(response.body.suspiciousFlaggedAt, null);
  assert.equal(response.body.suspiciousFlaggedByUid, null);
  assert.equal(response.body.suspiciousFlaggedByEmail, null);
  assert.equal(response.body.suspiciousFlaggedByRole, null);
  assert.equal(reports['report-flag-2'].isSuspicious, false);
  assert.equal(reports['report-flag-2'].suspiciousReason, null);
  assert.equal(reports['report-flag-2'].suspiciousFlaggedByUid, null);

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'REPORT_UNFLAGGED');
  assert.equal(historyEvent.metadata.isSuspicious, false);
});

test('PATCH /api/v1/admin/reports/:id/flag returns 404 when report does not exist', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app)
    .patch('/api/v1/admin/reports/missing-report/flag')
    .send({ flagged: true });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/admin/reports/:id/flag returns 400 when reason is sent while unflagging', async () => {
  const { app } = buildReportsTestApp({
    'report-flag-3': {
      kind: 'LOST',
      title: 'Lost ID card',
      status: 'REPORTED',
      referenceCode: 'LST-20260317-FLAG0003',
      location: 'Library',
      dateReported: '2026-03-17T10:00:00.000Z',
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/reports/report-flag-3/flag')
    .send({
      flagged: false,
      reason: 'should fail',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
