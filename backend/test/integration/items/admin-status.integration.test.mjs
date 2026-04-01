import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('PATCH /api/v1/admin/items/:id/status updates a validated item to returned and writes audit metadata', async () => {
  const itemStatusHistory = {};
  const app = buildItemsTestApp({
    items: {
      'item-admin-1': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ADMIN01',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-1/status')
    .send({ status: 'RETURNED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-admin-1');
  assert.equal(response.body.previousStatus, 'VALIDATED');
  assert.equal(response.body.status, 'RETURNED');
  assert.equal(response.body.updatedByUid, 'security-1');
  assert.equal(response.body.updatedByEmail, 'security@example.com');
  assert.equal(response.body.updatedByRole, 'SECURITY');
  assert.match(response.body.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const historyEntries = Object.values(itemStatusHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'item-admin-1');
  assert.equal(historyEntries[0].previousStatus, 'VALIDATED');
  assert.equal(historyEntries[0].nextStatus, 'RETURNED');
  assert.equal(historyEntries[0].changedByUid, 'security-1');
});

test('PATCH /api/v1/admin/items/:id/status updates a legacy report document and records history', async () => {
  const itemStatusHistory = {};
  const app = buildItemsTestApp({
    reports: {
      'report-admin-1': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'CLAIMED',
        referenceCode: 'FND-20260225-ADMIN02',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/report-admin-1/status')
    .send({ status: 'RETURNED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'report-admin-1');
  assert.equal(response.body.previousStatus, 'CLAIMED');
  assert.equal(response.body.status, 'RETURNED');

  const historyEntries = Object.values(itemStatusHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-admin-1');
  assert.equal(historyEntries[0].previousStatus, 'CLAIMED');
  assert.equal(historyEntries[0].nextStatus, 'RETURNED');
  assert.equal(historyEntries[0].changedByUid, 'security-1');
});

test('PATCH /api/v1/admin/items/:id/status returns 409 for an invalid status transition', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-admin-conflict': {
        title: 'Phone',
        status: 'RETURNED',
        referenceCode: 'FND-20260225-ADMIN03',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-conflict/status')
    .send({ status: 'CLAIMED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_CONFLICT');
});

test('PATCH /api/v1/admin/items/:id/status returns 409 when the status is unchanged', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-admin-same': {
        title: 'Bottle',
        status: 'ARCHIVED',
        referenceCode: 'FND-20260225-ADMIN04',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-same/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_STATUS_CONFLICT');
});

test('PATCH /api/v1/admin/items/:id/status returns 404 when item does not exist', async () => {
  const response = await request(buildItemsTestApp())
    .patch('/api/v1/admin/items/missing-item/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/admin/items/:id/status returns 400 for unsupported target status', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-admin-invalid': {
        title: 'Laptop',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ADMIN05',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-admin-invalid/status')
    .send({ status: 'PENDING_VALIDATION' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('PATCH /api/v1/admin/items/:id/status archives linked item/report records and logs item history', async () => {
  const itemStatusHistory = {};
  const itemHistory = {};
  const app = buildItemsTestApp({
    items: {
      'item-linked-1': {
        reportId: 'report-linked-1',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LINK0001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    reports: {
      'report-linked-1': {
        kind: 'FOUND',
        title: 'Umbrella',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LINK0001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
    itemHistory,
    itemStatusHistory,
  });

  const response = await request(app)
    .patch('/api/v1/admin/items/item-linked-1/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-linked-1');
  assert.equal(response.body.status, 'ARCHIVED');

  const statusEntries = Object.values(itemStatusHistory);
  assert.equal(statusEntries.length, 1);
  assert.equal(statusEntries[0].nextStatus, 'ARCHIVED');
  assert.equal(statusEntries[0].itemId, 'item-linked-1');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'report-linked-1');
  assert.equal(historyEntries[0].entityId, 'item-linked-1');
  assert.equal(historyEntries[0].actionType, 'ITEM_ARCHIVED');
  assert.equal(historyEntries[0].summary, 'Item archived by staff.');
});

test('PATCH /api/v1/admin/items/:id/status keeps linked item/report updates when ids collide across collections', async () => {
  const items = {
    'shared-id': {
      reportId: 'shared-id',
      title: 'Umbrella',
      status: 'VALIDATED',
      referenceCode: 'FND-20260225-SHARED01',
      dateReported: '2026-02-25T12:00:00.000Z',
    },
  };
  const reports = {
    'shared-id': {
      kind: 'FOUND',
      title: 'Umbrella',
      status: 'VALIDATED',
      referenceCode: 'FND-20260225-SHARED01',
      dateReported: '2026-02-25T12:00:00.000Z',
    },
  };
  const itemHistory = {};
  const app = buildItemsTestApp({ items, reports, itemHistory });

  const response = await request(app)
    .patch('/api/v1/admin/items/shared-id/status')
    .send({ status: 'ARCHIVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ARCHIVED');

  const historyEntries = Object.values(itemHistory);
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].itemId, 'shared-id');
  assert.equal(historyEntries[0].entityId, 'shared-id');
  assert.equal(items['shared-id'].status, 'ARCHIVED');
  assert.equal(reports['shared-id'].status, 'ARCHIVED');
  assert.match(items['shared-id'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(reports['shared-id'].archivedAt, /^\d{4}-\d{2}-\d{2}T/);
});
