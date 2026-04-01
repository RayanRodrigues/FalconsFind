import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/admin/items/:id/history returns persisted and legacy events in reverse chronological order', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-1': {
        reportId: 'report-1',
        title: 'Blue backpack',
        status: 'CLAIMED',
        referenceCode: 'FND-20260317-HIST0001',
      },
    },
    reports: {
      'report-1': {
        kind: 'FOUND',
        title: 'Blue backpack',
        status: 'CLAIMED',
        referenceCode: 'FND-20260317-HIST0001',
        dateReported: '2026-03-17T10:00:00.000Z',
        contactEmail: 'finder@example.com',
      },
    },
    claims: {
      'claim-1': {
        itemId: 'report-1',
        referenceCode: 'FND-20260317-HIST0001',
        claimantUid: 'student-1',
        claimantEmail: 'student@example.com',
        claimantName: 'Jane Student',
        itemName: 'Blue backpack',
        claimReason: 'Has my books',
        proofDetails: 'Contains student ID',
        status: 'APPROVED',
        createdAt: '2026-03-18T09:00:00.000Z',
        reviewedAt: '2026-03-18T11:00:00.000Z',
      },
    },
    itemHistory: {
      'history-1': {
        itemId: 'report-1',
        entityType: 'REPORT',
        entityId: 'report-1',
        actionType: 'REPORT_UPDATED',
        timestamp: '2026-03-17T12:00:00.000Z',
        summary: 'Report details updated.',
        changes: [{
          field: 'location',
          previousValue: 'Library',
          newValue: 'Student Center',
        }],
      },
    },
  });

  const response = await request(app).get('/api/v1/admin/items/item-1/history');

  assert.equal(response.status, 200);
  assert.equal(response.body.itemId, 'report-1');
  assert.equal(response.body.resolvedFrom, 'item-1');
  assert.equal(response.body.referenceCode, 'FND-20260317-HIST0001');
  assert.equal(response.body.currentStatus, 'CLAIMED');
  assert.equal(response.body.total, 4);
  assert.deepEqual(response.body.events.map((event) => event.actionType), [
    'CLAIM_APPROVED',
    'CLAIM_CREATED',
    'REPORT_UPDATED',
    'REPORT_CREATED',
  ]);
  assert.ok(response.body.events.every((event) => event.itemId === 'report-1'));
  assert.equal(response.body.events[0].entityId, 'claim-1');
  assert.equal(response.body.events[3].entityId, 'report-1');
});

test('GET /api/v1/admin/items/:id/history includes item status history entries that are not persisted in itemHistory', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-history-2': {
        reportId: 'report-history-2',
        title: 'Grey hoodie',
        status: 'RETURNED',
        referenceCode: 'FND-20260317-HIST0002',
      },
    },
    reports: {
      'report-history-2': {
        kind: 'FOUND',
        title: 'Grey hoodie',
        status: 'RETURNED',
        referenceCode: 'FND-20260317-HIST0002',
        dateReported: '2026-03-17T10:00:00.000Z',
      },
    },
    itemStatusHistory: {
      'status-history-1': {
        itemId: 'item-history-2',
        previousStatus: 'CLAIMED',
        nextStatus: 'RETURNED',
        changedAt: '2026-03-18T15:00:00.000Z',
        changedByUid: 'security-1',
        changedByEmail: 'security@example.com',
        changedByRole: 'SECURITY',
      },
    },
  });

  const response = await request(app).get('/api/v1/admin/items/item-history-2/history');

  assert.equal(response.status, 200);
  assert.equal(response.body.itemId, 'report-history-2');
  assert.equal(response.body.total, 2);
  assert.deepEqual(response.body.events.map((event) => event.actionType), ['ITEM_STATUS_UPDATED', 'REPORT_CREATED']);
  assert.equal(response.body.events[0].actor.email, 'security@example.com');
  assert.equal(response.body.events[0].changes[0].previousValue, 'CLAIMED');
  assert.equal(response.body.events[0].changes[0].newValue, 'RETURNED');
});

test('GET /api/v1/admin/items/:id/history returns 404 when no item can be resolved', async () => {
  const response = await request(buildItemsTestApp()).get('/api/v1/admin/items/missing-item/history');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
