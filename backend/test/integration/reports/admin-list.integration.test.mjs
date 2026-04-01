import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/admin/reports lists all reports with aggregated summary', async () => {
  const { app } = buildReportsTestApp({
    'report-1': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'REPORTED',
      referenceCode: 'FND-20260317-FOUND001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
      contactEmail: 'finder@example.com',
      photoUrl: 'gs://test-bucket/reports/wallet.jpg',
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
  assert.equal(response.body.filters.flagged, null);
  assert.equal(response.body.reports[0].photoUrl, 'https://signed.example/test-bucket/reports/wallet.jpg');
  assert.deepEqual(response.body.reports[0].photoUrls, ['https://signed.example/test-bucket/reports/wallet.jpg']);
  assert.equal(response.body.reports[0].isSuspicious, false);
});

test('GET /api/v1/admin/reports filters by kind, status, and search', async () => {
  const { app } = buildReportsTestApp({
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
  assert.equal(response.body.filters.flagged, null);
  assert.equal(response.body.reports.length, 1);
  assert.equal(response.body.reports[0].id, 'report-2');
});

test('GET /api/v1/admin/reports filters by suspicious flag status', async () => {
  const { app } = buildReportsTestApp({
    'report-flagged': {
      kind: 'FOUND',
      title: 'Found wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260317-FLAG1001',
      location: 'Gym',
      dateReported: '2026-03-17T10:00:00.000Z',
      isSuspicious: true,
      suspiciousReason: 'Duplicate report',
      suspiciousFlaggedByUid: 'security-1',
      suspiciousFlaggedByEmail: 'security@example.com',
      suspiciousFlaggedByRole: 'SECURITY',
      suspiciousFlaggedAt: '2026-03-17T12:00:00.000Z',
    },
    'report-clean': {
      kind: 'LOST',
      title: 'Lost notebook',
      status: 'REPORTED',
      referenceCode: 'LST-20260317-FLAG1002',
      location: 'Lab',
      dateReported: '2026-03-17T09:00:00.000Z',
    },
  });

  const response = await request(app).get('/api/v1/admin/reports?flagged=true');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.filters.flagged, true);
  assert.equal(response.body.reports.length, 1);
  assert.equal(response.body.reports[0].id, 'report-flagged');
  assert.equal(response.body.reports[0].isSuspicious, true);
  assert.equal(response.body.reports[0].flagReason, 'Duplicate report');
  assert.equal(response.body.reports[0].flaggedAt, '2026-03-17T12:00:00.000Z');
  assert.equal(response.body.reports[0].suspiciousReason, 'Duplicate report');
});

test('GET /api/v1/admin/reports returns 400 for invalid flagged filter', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app).get('/api/v1/admin/reports?flagged=maybe');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/admin/reports returns 400 for invalid kind filter', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app).get('/api/v1/admin/reports?kind=INVALID');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/admin/reports returns 400 for invalid status filter', async () => {
  const { app } = buildReportsTestApp();

  const response = await request(app).get('/api/v1/admin/reports?status=INVALID');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
