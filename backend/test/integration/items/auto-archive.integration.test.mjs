import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/items/:id auto-archives a stale unclaimed found item after 6 months', async () => {
  const reportedAt = new Date();
  reportedAt.setUTCMonth(reportedAt.getUTCMonth() - 7);

  const items = {
    'item-stale-1': {
      reportId: 'report-stale-1',
      title: 'Wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20240101-STALE01',
      dateReported: reportedAt.toISOString(),
    },
  };
  const reports = {
    'report-stale-1': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20240101-STALE01',
      dateReported: reportedAt.toISOString(),
    },
  };
  const itemHistory = {};
  const itemStatusHistory = {};
  const app = buildItemsTestApp({ items, reports, itemHistory, itemStatusHistory });

  const response = await request(app).get('/api/v1/items/item-stale-1');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(response.body.error.message, 'This item has been archived and is no longer in active listings.');
  assert.equal(items['item-stale-1'].status, 'ARCHIVED');
  assert.equal(reports['report-stale-1'].status, 'ARCHIVED');
  assert.match(items['item-stale-1'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(reports['report-stale-1'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);

  const [statusEntry] = Object.values(itemStatusHistory);
  assert.ok(statusEntry);
  assert.equal(statusEntry.itemId, 'item-stale-1');
  assert.equal(statusEntry.previousStatus, 'VALIDATED');
  assert.equal(statusEntry.nextStatus, 'ARCHIVED');
  assert.equal(statusEntry.changedByRole, 'SYSTEM');

  const [historyEntry] = Object.values(itemHistory);
  assert.ok(historyEntry);
  assert.equal(historyEntry.actionType, 'ITEM_ARCHIVED');
  assert.equal(historyEntry.actor.type, 'SYSTEM');
  assert.equal(historyEntry.metadata.automatic, true);
  assert.equal(historyEntry.summary, 'Item archived automatically after 6 months without a claim.');
});

test('PATCH /api/v1/admin/items/:id/status returns 409 when archiving an ineligible item', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-claimed-1': {
        reportId: 'report-claimed-1',
        title: 'Phone',
        status: 'CLAIMED',
        referenceCode: 'FND-20260320-CLAIM01',
        dateReported: new Date().toISOString(),
      },
    },
    reports: {
      'report-claimed-1': {
        kind: 'FOUND',
        title: 'Phone',
        status: 'CLAIMED',
        referenceCode: 'FND-20260320-CLAIM01',
        dateReported: new Date().toISOString(),
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-claimed-1/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_CONFLICT');
  assert.equal(response.body.error.message, 'Only eligible found items in validated or returned status can be archived.');
});
