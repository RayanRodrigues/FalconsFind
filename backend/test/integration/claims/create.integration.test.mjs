import test from 'node:test';
import assert from 'node:assert/strict';
import request from '../request-helper.mjs';
import { buildClaimsTestApp, createFakeDb } from './test-utils.mjs';

test('POST /api/v1/claims creates a pending claim for a validated item found by referenceCode', async () => {
  const { db, itemHistory, savedClaims } = createFakeDb({
    reports: {
      'report-1': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00001',
      },
    },
  });

  const { app } = buildClaimsTestApp(db);
  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00001',
      itemName: 'Black backpack',
      claimReason: 'I left this backpack after class and returned shortly after to find it missing.',
      proofDetails: 'It has a Falcon sticker and my initials on the inside pocket.',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
      phone: '519-555-0100',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.id, 'claim-1');
  assert.equal(response.body.status, 'PENDING');
  assert.match(response.body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(savedClaims.length, 1);
  assert.equal(savedClaims[0].data.itemId, 'report-1');
  assert.equal(savedClaims[0].data.referenceCode, 'FF-2024-00001');
  assert.equal(savedClaims[0].data.claimantUid, 'student-1');
  assert.equal(savedClaims[0].data.itemName, 'Black backpack');
  assert.equal(savedClaims[0].data.status, 'PENDING');
  assert.equal(savedClaims[0].data.claimantName, 'Jane Doe');
  assert.equal(savedClaims[0].data.claimReason, 'I left this backpack after class and returned shortly after to find it missing.');
  assert.equal(savedClaims[0].data.proofDetails, 'It has a Falcon sticker and my initials on the inside pocket.');
  assert.equal(savedClaims[0].data.phone, '519-555-0100');

  const [historyEvent] = Object.values(itemHistory);
  assert.ok(historyEvent);
  assert.equal(historyEvent.actionType, 'CLAIM_CREATED');
  assert.equal(historyEvent.entityId, 'claim-1');
  assert.equal(historyEvent.itemId, 'report-1');
  assert.equal(historyEvent.metadata.referenceCode, 'FF-2024-00001');
  assert.equal(historyEvent.metadata.claimStatus, 'PENDING');
  assert.match(historyEvent.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('POST /api/v1/claims creates a pending claim when item is in the items collection', async () => {
  const { db, savedClaims } = createFakeDb({
    items: {
      'item-ref': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00099',
      },
    },
  });

  const { app } = buildClaimsTestApp(db);
  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00099',
      itemName: 'Campus card holder',
      claimReason: 'I dropped this in the hallway while heading to class and noticed it was gone.',
      proofDetails: 'It contains my student card and a blue transit pass.',
      claimantName: 'John Smith',
      claimantEmail: 'john@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(savedClaims[0].data.itemId, 'item-ref');
  assert.equal(savedClaims[0].data.status, 'PENDING');
  assert.equal(savedClaims[0].data.claimantUid, 'student-1');
  assert.equal(savedClaims[0].data.claimantEmail, 'jane@example.com');
});

test('POST /api/v1/claims also allows authenticated admin users to create a claim', async () => {
  const { db, savedClaims } = createFakeDb({
    reports: {
      'report-4': {
        kind: 'FOUND',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00100',
      },
    },
  });

  const { app } = buildClaimsTestApp(db, {
    authenticatedUser: {
      uid: 'admin-1',
      email: 'admin@fanshawe.ca',
      role: 'ADMIN',
    },
    claimAccessUser: {
      uid: 'admin-1',
      email: 'admin@fanshawe.ca',
      role: 'ADMIN',
    },
  });

  const response = await request(app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00100',
      itemName: 'Black jacket',
      claimReason: 'I can identify where I left this and the personal items inside the pocket.',
      proofDetails: 'There is a silver keychain on the zipper and my work badge in the sleeve.',
      claimantName: 'Admin User',
      claimantEmail: 'someone-else@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(savedClaims[0].data.claimantUid, 'admin-1');
  assert.equal(savedClaims[0].data.claimantEmail, 'admin@fanshawe.ca');
});

test('POST /api/v1/claims returns 404 when no item has that referenceCode', async () => {
  const { db } = createFakeDb();

  const response = await request(buildClaimsTestApp(db).app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-MISSING',
      itemName: 'Bag',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('POST /api/v1/claims returns 409 when the target item is not validated', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-2': {
        kind: 'FOUND',
        status: 'CLAIMED',
        referenceCode: 'FF-2024-00002',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00002',
      itemName: 'Wallet',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM');
});

test('POST /api/v1/claims returns 409 when the target item is not a found item', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-3': {
        kind: 'LOST',
        status: 'VALIDATED',
        referenceCode: 'FF-2024-00003',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .post('/api/v1/claims')
    .send({
      referenceCode: 'FF-2024-00003',
      itemName: 'Keys',
      claimReason: 'This is long enough to satisfy validation on the form and backend.',
      proofDetails: 'This is also long enough to satisfy the backend validation rules.',
      claimantName: 'Jane Doe',
      claimantEmail: 'jane@example.com',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM');
});

test('POST /api/v1/claims returns 400 for invalid request payload', async () => {
  const { db } = createFakeDb();

  const response = await request(buildClaimsTestApp(db).app)
    .post('/api/v1/claims')
    .send({
      referenceCode: '',
      itemName: '',
      claimReason: 'short',
      proofDetails: 'short',
      claimantName: '',
      claimantEmail: 'not-an-email',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/claims/me lists only the authenticated user claims', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-1': {
        itemId: 'report-1',
        referenceCode: 'FND-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Black backpack',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'This item belongs to me and I can identify what is inside.',
        proofDetails: 'It has my initials and class notes inside.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
      'claim-2': {
        itemId: 'report-2',
        referenceCode: 'FND-2024-00002',
        claimantUid: 'student-1',
        itemName: 'Laptop sleeve',
        status: 'NEEDS_PROOF',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this sleeve after class.',
        proofDetails: 'It contains my name card.',
        additionalProofRequest: 'Please provide a photo of the sticker on the inside.',
        proofRequestedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
      'claim-3': {
        itemId: 'report-3',
        referenceCode: 'FND-2024-00003',
        claimantUid: 'student-2',
        itemName: 'Keys',
        status: 'PENDING',
        claimantName: 'Other User',
        claimantEmail: 'other@example.com',
        claimReason: 'Other claim reason',
        proofDetails: 'Other proof details',
        createdAt: '2026-03-18T08:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app).get('/api/v1/claims/me');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.summary.totalClaims, 2);
  assert.equal(response.body.summary.pendingClaims, 1);
  assert.equal(response.body.summary.needsProofClaims, 1);
  assert.equal(response.body.claims.length, 2);
  assert.equal(response.body.claims[0].id, 'claim-1');
  assert.equal(response.body.claims[1].id, 'claim-2');
  assert.equal(response.body.claims[1].additionalProofRequest, 'Please provide a photo of the sticker on the inside.');
});

test('PATCH /api/v1/claims/:id lets the owner edit a pending claim', async () => {
  const { db, claims } = createFakeDb({
    claims: {
      'claim-edit-1': {
        itemId: 'report-1',
        referenceCode: 'FND-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Old backpack label',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'Old reason text that is long enough for validation.',
        proofDetails: 'Old proof details that are also long enough for validation.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-edit-1')
    .send({
      itemName: 'Updated backpack label',
      claimReason: 'Updated reason that clearly explains how the item belongs to me.',
      proofDetails: 'Updated proof details describing stickers, notebooks, and initials inside.',
      phone: '519-555-0101',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'PENDING');
  assert.equal(claims['claim-edit-1'].itemName, 'Updated backpack label');
  assert.equal(claims['claim-edit-1'].phone, '519-555-0101');
});
