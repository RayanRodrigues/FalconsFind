import request from '../request-helper.mjs';
import { assert, buildReportsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/admin/reports auto-archives stale validated found items before listing the queue', async () => {
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
  assert.equal(response.body.total, 1);
  assert.equal(response.body.reports[0].id, 'report-stale-admin-1');
  assert.equal(response.body.reports[0].status, 'ARCHIVED');
  assert.equal(items['item-stale-admin-1'].status, 'ARCHIVED');
  assert.equal(reports['report-stale-admin-1'].status, 'ARCHIVED');

  const [statusEntry] = Object.values(itemStatusHistory);
  assert.ok(statusEntry);
  assert.equal(statusEntry.itemId, 'item-stale-admin-1');
  assert.equal(statusEntry.nextStatus, 'ARCHIVED');
  assert.equal(statusEntry.changedByRole, 'SYSTEM');

  const [historyEntry] = Object.values(itemHistory);
  assert.ok(historyEntry);
  assert.equal(historyEntry.actionType, 'ITEM_ARCHIVED');
  assert.equal(historyEntry.actor.type, 'SYSTEM');
  assert.equal(historyEntry.metadata.automatic, true);
});
