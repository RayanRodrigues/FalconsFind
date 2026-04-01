import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/admin/reports no longer auto-archives stale items during reads', async () => {
  const reportedAt = new Date();
  reportedAt.setUTCMonth(reportedAt.getUTCMonth() - 7);

  const { app, items, reports, itemHistory, itemStatusHistory } = buildReportsTestApp({
    reports: {
      'report-stale-admin-1': {
        kind: 'FOUND',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20240101-ADMARCH1',
        dateReported: reportedAt.toISOString(),
      },
    },
    items: {
      'item-stale-admin-1': {
        reportId: 'report-stale-admin-1',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20240101-ADMARCH1',
        dateReported: reportedAt.toISOString(),
      },
    },
  });

  const response = await request(app).get('/api/v1/admin/reports?status=ARCHIVED');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 0);
  assert.equal(items['item-stale-admin-1'].status, 'VALIDATED');
  assert.equal(reports['report-stale-admin-1'].status, 'VALIDATED');
  assert.equal(Object.keys(itemStatusHistory).length, 0);
  assert.equal(Object.keys(itemHistory).length, 0);
});
