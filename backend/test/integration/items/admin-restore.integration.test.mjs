import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('POST /api/v1/admin/items/:id/restore-status restores an item to a previous status from history', async () => {
  const items = {
    'item-restore-1': {
      reportId: 'report-restore-1',
      title: 'Wallet',
      status: 'RETURNED',
      referenceCode: 'FND-20260320-RESTORE1',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const reports = {
    'report-restore-1': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'RETURNED',
      referenceCode: 'FND-20260320-RESTORE1',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const itemStatusHistory = {
    'history-1': {
      itemId: 'item-restore-1',
      previousStatus: 'VALIDATED',
      nextStatus: 'CLAIMED',
      changedAt: '2026-03-20T10:00:00.000Z',
      changedByUid: 'security-1',
      changedByRole: 'SECURITY',
    },
    'history-2': {
      itemId: 'item-restore-1',
      previousStatus: 'CLAIMED',
      nextStatus: 'RETURNED',
      changedAt: '2026-03-21T10:00:00.000Z',
      changedByUid: 'security-1',
      changedByRole: 'SECURITY',
    },
  };
  const itemHistory = {};
  const app = buildItemsTestApp({ items, reports, itemStatusHistory, itemHistory });

  const response = await request(app)
    .post('/api/v1/admin/items/item-restore-1/restore-status')
    .send({ status: 'VALIDATED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-restore-1');
  assert.equal(response.body.previousStatus, 'RETURNED');
  assert.equal(response.body.status, 'VALIDATED');

  const statusEntries = Object.values(itemStatusHistory);
  assert.equal(statusEntries.length, 3);
  assert.equal(statusEntries[2].previousStatus, 'RETURNED');
  assert.equal(statusEntries[2].nextStatus, 'VALIDATED');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-restore-1');
  assert.equal(historyEntries[0].entityId, 'item-restore-1');
  assert.equal(historyEntries[0].actionType, 'ITEM_STATUS_RESTORED');
  assert.equal(items['item-restore-1'].status, 'VALIDATED');
  assert.equal(reports['report-restore-1'].status, 'VALIDATED');
  assert.equal(items['item-restore-1'].archivedAt, null);
  assert.equal(reports['report-restore-1'].archivedAt, null);
});

test('POST /api/v1/admin/items/:id/restore-status clears archivedAt when restoring an archived item', async () => {
  const items = {
    'item-restore-archived': {
      reportId: 'report-restore-archived',
      title: 'Wallet',
      status: 'ARCHIVED',
      archivedAt: '2026-03-22T10:00:00.000Z',
      referenceCode: 'FND-20260320-RESTORE3',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const reports = {
    'report-restore-archived': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'ARCHIVED',
      archivedAt: '2026-03-22T10:00:00.000Z',
      referenceCode: 'FND-20260320-RESTORE3',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const app = buildItemsTestApp({
    items,
    reports,
    itemStatusHistory: {
      'history-1': {
        itemId: 'item-restore-archived',
        previousStatus: 'VALIDATED',
        nextStatus: 'ARCHIVED',
        changedAt: '2026-03-22T10:00:00.000Z',
        changedByUid: 'security-1',
        changedByRole: 'SECURITY',
      },
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/items/item-restore-archived/restore-status')
    .send({ status: 'VALIDATED' });

  assert.equal(response.status, 200);
  assert.equal(items['item-restore-archived'].status, 'VALIDATED');
  assert.equal(reports['report-restore-archived'].status, 'VALIDATED');
  assert.equal(items['item-restore-archived'].archivedAt, null);
  assert.equal(reports['report-restore-archived'].archivedAt, null);
});

test('POST /api/v1/admin/items/:id/restore-status returns 409 when the selected status is not in history', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-restore-invalid': {
        title: 'Phone',
        status: 'RETURNED',
        referenceCode: 'FND-20260320-RESTORE2',
        dateReported: '2026-03-20T09:00:00.000Z',
      },
    },
    itemStatusHistory: {
      'history-1': {
        itemId: 'item-restore-invalid',
        previousStatus: 'VALIDATED',
        nextStatus: 'CLAIMED',
        changedAt: '2026-03-20T10:00:00.000Z',
        changedByUid: 'security-1',
        changedByRole: 'SECURITY',
      },
    },
  });

  const response = await request(app)
    .post('/api/v1/admin/items/item-restore-invalid/restore-status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_RESTORE_NOT_ALLOWED');
});

test('POST /api/v1/admin/items/:id/restore-status accepts statuses present in persisted item history when status-history records are missing', async () => {
  const items = {
    'item-restore-history': {
      reportId: 'report-restore-history',
      title: 'Wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260320-RESTORE4',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const reports = {
    'report-restore-history': {
      kind: 'FOUND',
      title: 'Wallet',
      status: 'VALIDATED',
      referenceCode: 'FND-20260320-RESTORE4',
      dateReported: '2026-03-20T09:00:00.000Z',
    },
  };
  const itemHistory = {
    'history-event-1': {
      itemId: 'report-restore-history',
      entityType: 'REPORT',
      entityId: 'report-restore-history',
      actionType: 'REPORT_VALIDATED',
      timestamp: '2026-03-20T10:00:00.000Z',
      summary: 'Found-item report validated by staff.',
      actor: { type: 'SECURITY' },
      metadata: { referenceCode: 'FND-20260320-RESTORE4', itemStatus: 'VALIDATED' },
      changes: [{ field: 'status', previousValue: 'PENDING_VALIDATION', newValue: 'VALIDATED' }],
    },
  };
  const app = buildItemsTestApp({ items, reports, itemHistory });

  const response = await request(app)
    .post('/api/v1/admin/items/report-restore-history/restore-status')
    .send({ status: 'PENDING_VALIDATION' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'PENDING_VALIDATION');
  assert.equal(items['item-restore-history'].status, 'PENDING_VALIDATION');
  assert.equal(reports['report-restore-history'].status, 'PENDING_VALIDATION');
});
