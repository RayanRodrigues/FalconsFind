import request from '../request-helper.mjs';
import { assert, buildItemsTestApp, test } from './test-utils.mjs';

test('GET /api/v1/items returns paginated public found items with availability and thumbnailUrl', async () => {
  const app = buildItemsTestApp({
    reports: {
      'report-2': {
        kind: 'FOUND',
        title: 'Blue bottle',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BLUE0002',
        location: 'Gym',
        dateReported: '2026-02-25T14:00:00.000Z',
        photoUrl: 'gs://test-bucket/reports/found/report-2.jpg',
      },
      'report-0': {
        kind: 'FOUND',
        title: 'Claimed phone',
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
        referenceCode: 'FND-20260225-CLMD0000',
        location: 'Security Office',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
      'report-1': {
        kind: 'FOUND',
        title: 'Black backpack',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BACK0001',
        location: 'Library',
        dateReported: '2026-02-25T12:00:00.000Z',
        photoUrl: 'https://cdn.example.com/report-1.jpg',
      },
      'report-hidden': {
        kind: 'FOUND',
        title: 'Pending item',
        status: 'REPORTED',
        referenceCode: 'FND-20260225-HIDE0003',
        dateReported: '2026-02-25T15:00:00.000Z',
      },
      'report-lost': {
        kind: 'LOST',
        title: 'Lost laptop',
        status: 'VALIDATED',
        referenceCode: 'LST-20260225-LOST0004',
        dateReported: '2026-02-25T16:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?page=1&limit=2');

  assert.equal(response.status, 200);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 2);
  assert.equal(response.body.total, 3);
  assert.equal(response.body.totalPages, 2);
  assert.equal(response.body.hasNextPage, true);
  assert.equal(response.body.hasPrevPage, false);
  assert.equal(response.body.items.length, 2);
  assert.equal(response.body.items[0].id, 'report-0');
  assert.equal(response.body.items[0].availability, 'CLAIMED');
  assert.equal(typeof response.body.items[0].listedDurationMs, 'number');
  assert.equal(response.body.items[1].id, 'report-2');
  assert.equal(response.body.items[1].availability, 'AVAILABLE');
  assert.equal(typeof response.body.items[1].listedDurationMs, 'number');
  assert.match(response.body.items[1].thumbnailUrl, /^https:\/\/signed\.local\//);
  assert.ok(Number.isFinite(response.body.items[0].listedDurationMs));
  assert.ok(response.body.items[0].listedDurationMs >= 0);
  assert.ok(Number.isFinite(response.body.items[1].listedDurationMs));
  assert.ok(response.body.items[1].listedDurationMs >= 0);
  assert.deepEqual(response.body.filters, {
    keyword: null,
    category: null,
    location: null,
    dateFrom: null,
    dateTo: null,
    sort: 'most_recent',
  });
});

test('GET /api/v1/items filters validated found items by category, location, and date range', async () => {
  const app = buildItemsTestApp({
    reports: {
      'report-match': {
        kind: 'FOUND',
        title: 'Silver water bottle',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-MATCH001',
        location: 'Library',
        dateReported: '2026-02-25T10:00:00.000Z',
      },
      'report-wrong-category': {
        kind: 'FOUND',
        title: 'Blue bottle',
        category: 'Electronics',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-OTHER002',
        location: 'Library',
        dateReported: '2026-02-25T11:00:00.000Z',
      },
      'report-wrong-location': {
        kind: 'FOUND',
        title: 'Wallet',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-OTHER003',
        location: 'Gym',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
      'report-wrong-date': {
        kind: 'FOUND',
        title: 'Keys',
        category: 'Accessories',
        status: 'VALIDATED',
        referenceCode: 'FND-20260220-OTHER004',
        location: 'Library',
        dateReported: '2026-02-20T10:00:00.000Z',
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/items?category=Accessories&location=Library&dateFrom=2026-02-24&dateTo=2026-02-26');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'report-match');
  assert.equal(response.body.items[0].category, 'Accessories');
  assert.deepEqual(response.body.filters, {
    keyword: null,
    category: 'Accessories',
    location: 'Library',
    dateFrom: '2026-02-24T00:00:00.000Z',
    dateTo: '2026-02-26T23:59:59.999Z',
    sort: 'most_recent',
  });
});

test('GET /api/v1/items returns 400 for invalid date range filters', async () => {
  const response = await request(buildItemsTestApp()).get('/api/v1/items?dateFrom=2026-02-30');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items returns 400 when dateFrom is after dateTo', async () => {
  const response = await request(buildItemsTestApp())
    .get('/api/v1/items?dateFrom=2026-02-27&dateTo=2026-02-26');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items skips malformed items from list payload', async () => {
  const app = buildItemsTestApp({
    reports: {
      'valid-item': {
        kind: 'FOUND',
        title: 'Wallet',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-WALLET01',
        dateReported: '2026-02-25T12:00:00.000Z',
      },
      'invalid-item': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FND-20260225-BROKEN01',
        dateReported: '2026-02-25T13:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'valid-item');
});

test('GET /api/v1/items filters validated found items by keyword in title or description', async () => {
  const app = buildItemsTestApp({
    reports: {
      'report-title': {
        kind: 'FOUND',
        title: 'Black Macbook Air',
        description: 'Found in Building T',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0001',
        dateReported: '2026-02-19T07:10:00.000Z',
      },
      'report-description': {
        kind: 'FOUND',
        title: 'Laptop sleeve',
        description: 'Contains notes about a MacBook charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-SLV0002',
        dateReported: '2026-02-19T07:00:00.000Z',
      },
      'report-other': {
        kind: 'FOUND',
        title: 'Blue water bottle',
        description: 'Found near the gym entrance',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-BTL0003',
        dateReported: '2026-02-19T06:50:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?keyword=macbook');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items.length, 2);
  assert.deepEqual(response.body.items.map((item) => item.id), ['report-title', 'report-description']);
  assert.deepEqual(response.body.filters, {
    keyword: 'macbook',
    category: null,
    location: null,
    dateFrom: null,
    dateTo: null,
    sort: 'most_recent',
  });
});

test('GET /api/v1/items sorts validated found items by oldest first when requested', async () => {
  const app = buildItemsTestApp({
    reports: {
      'report-newest': {
        kind: 'FOUND',
        title: 'Newest item',
        status: 'VALIDATED',
        referenceCode: 'FND-20260320-NEWEST01',
        dateReported: '2026-03-20T10:00:00.000Z',
      },
      'report-oldest': {
        kind: 'FOUND',
        title: 'Oldest item',
        status: 'VALIDATED',
        referenceCode: 'FND-20260318-OLDEST01',
        dateReported: '2026-03-18T10:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?sort=oldest');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map((item) => item.id), ['report-oldest', 'report-newest']);
  assert.equal(response.body.filters.sort, 'oldest');
});

test('GET /api/v1/items returns 400 for invalid sort option', async () => {
  const response = await request(buildItemsTestApp()).get('/api/v1/items?sort=invalid');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/items paginates keyword search results after filtering', async () => {
  const app = buildItemsTestApp({
    reports: {
      'report-3': {
        kind: 'FOUND',
        title: 'Macbook charger',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0003',
        dateReported: '2026-02-19T08:00:00.000Z',
      },
      'report-2': {
        kind: 'FOUND',
        title: 'Macbook sleeve',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0002',
        dateReported: '2026-02-19T07:30:00.000Z',
      },
      'report-1': {
        kind: 'FOUND',
        title: 'Macbook Air',
        status: 'VALIDATED',
        referenceCode: 'FND-20260219-MAC0001',
        dateReported: '2026-02-19T07:00:00.000Z',
      },
    },
  });

  const response = await request(app).get('/api/v1/items?keyword=macbook&page=2&limit=1');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.totalPages, 2);
  assert.equal(response.body.hasNextPage, false);
  assert.equal(response.body.hasPrevPage, true);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 'report-2');
});
