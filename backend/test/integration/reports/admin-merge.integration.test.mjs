import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('POST /api/v1/admin/reports/merge merges duplicate reports into a primary report', async () => {
  const { app, reports, itemHistory } = buildReportsTestApp({
    'report-primary-1': {
      kind: 'FOUND',
      title: 'Black backpack',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-PRIMARY1',
      dateReported: '2026-03-25T09:00:00.000Z',
    },
    'report-duplicate-1': {
      kind: 'FOUND',
      title: 'Black backpack duplicate',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-DUPL0001',
      location: 'Library',
      contactEmail: 'finder@example.com',
      dateReported: '2026-03-25T09:05:00.000Z',
    },
    'report-duplicate-2': {
      kind: 'FOUND',
      title: 'Black backpack duplicate 2',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-DUPL0002',
      description: 'Contains notebooks',
      dateReported: '2026-03-25T09:06:00.000Z',
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/reports/merge')
    .send({
      primaryReportId: 'report-primary-1',
      duplicateReportIds: ['report-duplicate-1', 'report-duplicate-2'],
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.primaryReportId, 'report-primary-1');
  assert.deepEqual(response.body.mergedReportIds, ['report-duplicate-1', 'report-duplicate-2']);
  assert.equal(response.body.primaryReport.referenceCode, 'FND-20260325-PRIMARY1');

  assert.equal(reports['report-primary-1'].location, 'Library');
  assert.equal(reports['report-primary-1'].contactEmail, 'finder@example.com');
  assert.equal(reports['report-primary-1'].description, 'Contains notebooks');

  assert.equal(reports['report-duplicate-1'].status, 'ARCHIVED');
  assert.equal(reports['report-duplicate-1'].mergedIntoReportId, 'report-primary-1');
  assert.equal(reports['report-duplicate-1'].mergedIntoReferenceCode, 'FND-20260325-PRIMARY1');
  assert.equal(reports['report-duplicate-1'].mergedByUid, 'security-1');
  assert.equal(reports['report-duplicate-1'].mergedByEmail, 'security@example.com');
  assert.equal(reports['report-duplicate-1'].mergedByRole, 'SECURITY');
  assert.match(reports['report-duplicate-1'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(reports['report-duplicate-2'].status, 'ARCHIVED');
  assert.equal(reports['report-duplicate-2'].mergedIntoReportId, 'report-primary-1');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 3);
  assert.equal(historyEntries[0].actionType, 'REPORT_MERGED');
  assert.equal(historyEntries[0].itemId, 'report-primary-1');
  assert.equal(historyEntries[1].itemId, 'report-duplicate-1');
  assert.equal(historyEntries[2].itemId, 'report-duplicate-2');
});

test('POST /api/v1/admin/reports/merge returns 409 when reports are from different kinds', async () => {
  const { app } = buildReportsTestApp({
    'report-primary-kind': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-KIND0001',
      dateReported: '2026-03-25T09:00:00.000Z',
    },
    'report-duplicate-kind': {
      kind: 'LOST',
      title: 'Wallet',
      status: 'REPORTED',
      referenceCode: 'LST-20260325-KIND0002',
      dateReported: '2026-03-25T09:10:00.000Z',
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/reports/merge')
    .send({
      primaryReportId: 'report-primary-kind',
      duplicateReportIds: ['report-duplicate-kind'],
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_MERGE_CONFLICT');
});

test('POST /api/v1/admin/reports/merge returns 409 when the primary report has already been merged', async () => {
  const { app } = buildReportsTestApp({
    'report-primary-merged': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-MERGED01',
      mergedIntoReportId: 'report-other-primary',
      dateReported: '2026-03-25T09:00:00.000Z',
    },
    'report-duplicate-free': {
      kind: 'FOUND',
      title: 'Wallet duplicate',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-MERGED02',
      dateReported: '2026-03-25T09:10:00.000Z',
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/reports/merge')
    .send({
      primaryReportId: 'report-primary-merged',
      duplicateReportIds: ['report-duplicate-free'],
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_MERGE_CONFLICT');
});

test('POST /api/v1/admin/reports/merge returns 409 when a duplicate report is archived', async () => {
  const { app } = buildReportsTestApp({
    'report-primary-active': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-ARCHIVE1',
      dateReported: '2026-03-25T09:00:00.000Z',
    },
    'report-duplicate-archived': {
      kind: 'FOUND',
      title: 'Wallet duplicate',
      status: 'ARCHIVED',
      referenceCode: 'FND-20260325-ARCHIVE2',
      archivedAt: '2026-03-25T10:00:00.000Z',
      dateReported: '2026-03-25T09:10:00.000Z',
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/reports/merge')
    .send({
      primaryReportId: 'report-primary-active',
      duplicateReportIds: ['report-duplicate-archived'],
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_MERGE_CONFLICT');
});

test('POST /api/v1/admin/reports/merge returns 409 when a duplicate report has already been merged', async () => {
  const { app } = buildReportsTestApp({
    'report-primary-clean': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-DUPCHK1',
      dateReported: '2026-03-25T09:00:00.000Z',
    },
    'report-duplicate-merged': {
      kind: 'FOUND',
      title: 'Wallet duplicate',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260325-DUPCHK2',
      mergedIntoReportId: 'report-somewhere-else',
      dateReported: '2026-03-25T09:10:00.000Z',
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/reports/merge')
    .send({
      primaryReportId: 'report-primary-clean',
      duplicateReportIds: ['report-duplicate-merged'],
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_MERGE_CONFLICT');
});
