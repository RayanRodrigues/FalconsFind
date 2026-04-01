import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/items/:id returns 200 for validated item id', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-1': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-ABC12345',
        dateReported: '2026-02-25T12:00:00.000Z',
        location: 'Library',
        photoUrl: 'gs://test-bucket/reports/found/item-1.jpg',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-1');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-1');
  assert.equal(response.body.status, 'VALIDATED');
  assert.equal(response.body.availability, 'AVAILABLE');
  assert.equal(response.body.referenceCode, 'FND-20260225-ABC12345');
  assert.equal(typeof response.body.listedDurationMs, 'number');
  assert.ok(Number.isFinite(response.body.listedDurationMs));
  assert.ok(response.body.listedDurationMs >= 0);
  assert.ok(Array.isArray(response.body.imageUrls));
  assert.match(response.body.imageUrls[0], /^https:\/\/signed\.local\//);
});

test('GET /api/v1/items/:id returns 200 for claimed item id', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-claimed': {
        title: 'Black backpack',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-CLAIM0001',
        dateReported: '2026-02-25T12:00:00.000Z',
        location: 'Library',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-claimed');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-claimed');
  assert.equal(response.body.status, 'CLAIMED');
  assert.equal(response.body.availability, 'CLAIMED');
  assert.equal(response.body.claimStatus, 'APPROVED');
});

test('GET /api/v1/items/:id resolves item by reportId relation', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-2': {
        reportId: 'report-2',
        title: 'Blue water bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-REL00002',
        dateReported: '2026-02-25T13:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/report-2');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'item-2');
  assert.equal(response.body.referenceCode, 'FND-20260225-REL00002');
});

test('GET /api/v1/items/:id resolves backward-compatible reports document', async () => {
  const app = buildItemsTestApp({
    reports: {
      'legacy-report-id': {
        title: 'Lost charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-LEGACY01',
        dateReported: '2026-02-25T14:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/legacy-report-id');

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'legacy-report-id');
  assert.equal(response.body.status, 'VALIDATED');
});

test('GET /api/v1/items/:id returns 403 when item exists but is not public', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-review': {
        title: 'Headphones',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-REVIEW01',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-review');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(response.body.error.message, 'This item is currently under review by Campus Security.');
});

test('GET /api/v1/items/:id returns an archived message when the item is archived', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-archived': {
        title: 'Headphones',
        status: 'ARCHIVED',
        referenceCode: 'FND-20260225-ARCHIVE1',
        dateReported: '2026-02-25T15:00:00.000Z',
        archivedAt: '2026-03-30T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-archived');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(response.body.error.message, 'This item has been archived and is no longer in active listings.');
});

test('GET /api/v1/items/:id/status returns public availability for a claimed item', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-status-1': {
        title: 'Phone',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-STAT0001',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-1/status');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: 'item-status-1',
    status: 'CLAIMED',
    availability: 'CLAIMED',
    claimStatus: 'APPROVED',
  });
});

test('GET /api/v1/items/:id/status returns public availability for a validated item', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-status-validated': {
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-STAT0002',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-validated/status');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: 'item-status-validated',
    status: 'VALIDATED',
    availability: 'AVAILABLE',
  });
});

test('GET /api/v1/items/:id/status returns 403 when item is still under review', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-status-review': {
        title: 'Headphones',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-REVIEW02',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-status-review/status');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('GET /api/v1/items/:id/status returns 404 when no matching item exists', async () => {
  const response = await request(buildItemsTestApp()).get('/api/v1/items/unknown-status-id/status');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('GET /api/v1/items/:id returns 404 when no matching item exists', async () => {
  const response = await request(buildItemsTestApp()).get('/api/v1/items/unknown-id');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('GET /api/v1/items/:id returns 422 for malformed item payload', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-bad-data': {
        title: 'Unstructured item',
        status: 'VALIDATED',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-bad-data');

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ITEM_DATA');
  assert.match(response.body.error.message, /incorrectly reported|contact Campus Security/i);
});

test('GET /api/v1/items skips reports with unparseable dateReported values', async () => {
  const app = buildItemsTestApp({
    reports: {
      'invalid-date-item': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BADDATE1',
        dateReported: 'not-a-real-date',
      },
      'valid-date-item': {
        kind: 'FOUND',
        title: 'Bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-VALID001',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'valid-date-item');
});

test('GET /api/v1/items/:id returns 422 when dateReported is not parseable', async () => {
  const app = buildItemsTestApp({
    items: {
      'item-invalid-date': {
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-INVALID1',
        dateReported: 'not-a-real-date',
      },
    },
  });

  const response = await request(app).get('/api/v1/items/item-invalid-date');

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ITEM_DATA');
});
