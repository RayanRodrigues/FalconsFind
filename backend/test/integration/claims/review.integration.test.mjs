import test from 'node:test';
import assert from 'node:assert/strict';
import request from '../request-helper.mjs';
import { buildClaimsTestApp, createFakeDb } from './test-utils.mjs';

test('PATCH /api/v1/claims/:id/status approves a pending claim and marks the item as claimed', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-1': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-1': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-1/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-1');
  assert.equal(response.body.status, 'APPROVED');
  assert.equal(response.body.itemStatus, 'CLAIMED');
  assert.equal(claims['claim-1'].status, 'APPROVED');
  assert.match(claims['claim-1'].reviewedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(items['item-1'].status, 'CLAIMED');
  assert.equal(items['item-1'].claimStatus, 'APPROVED');
  assert.match(items['item-1'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/status approves a claim after additional proof was requested', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-proof': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-proof': {
        itemId: 'item-proof',
        status: 'NEEDS_PROOF',
        additionalProofRequest: 'Please send a photo of the serial number.',
        proofRequestedAt: '2026-03-17T12:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-proof/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'APPROVED');
  assert.equal(items['item-proof'].status, 'CLAIMED');
  assert.equal(items['item-proof'].claimStatus, 'APPROVED');
  assert.equal(claims['claim-proof'].status, 'APPROVED');
});

test('PATCH /api/v1/claims/:id/status rejects a pending claim and keeps the item validated', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-2': {
        reportId: 'report-2',
        status: 'CLAIMED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-2': {
        itemId: 'report-2',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-2/status')
    .send({ status: 'REJECTED' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'REJECTED');
  assert.equal(response.body.itemId, 'report-2');
  assert.equal(response.body.itemStatus, 'VALIDATED');
  assert.equal(claims['claim-2'].status, 'REJECTED');
  assert.equal(items['item-2'].status, 'VALIDATED');
  assert.equal(items['item-2'].claimStatus, 'REJECTED');
});

test('PATCH /api/v1/claims/:id/status updates legacy report docs when no item doc exists', async () => {
  const { db, reports } = createFakeDb({
    reports: {
      'report-legacy': {
        status: 'VALIDATED',
      },
    },
    claims: {
      'claim-legacy': {
        itemId: 'report-legacy',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-legacy/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 200);
  assert.equal(reports['report-legacy'].status, 'CLAIMED');
  assert.equal(reports['report-legacy'].claimStatus, 'APPROVED');
});

test('PATCH /api/v1/claims/:id/status returns 409 when the claim is already reviewed', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-closed': {
        itemId: 'item-closed',
        status: 'APPROVED',
      },
    },
    items: {
      'item-closed': {
        status: 'CLAIMED',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-closed/status')
    .send({ status: 'REJECTED' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/status returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-orphan': {
        itemId: 'missing-item',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-orphan/status')
    .send({ status: 'APPROVED' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/status returns 400 for unsupported review status', async () => {
  const { db } = createFakeDb();

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-1/status')
    .send({ status: 'CANCELLED' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('GET /api/v1/admin/claims lists structured claims for the admin dashboard', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-1': {
        itemId: 'item-1',
        referenceCode: 'FF-2024-00001',
        claimantUid: 'student-1',
        itemName: 'Black backpack',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I left it after class and returned shortly after.',
        proofDetails: 'It has my initials on the inner label.',
        createdAt: '2026-03-18T10:00:00.000Z',
      },
      'claim-2': {
        itemId: 'item-2',
        referenceCode: 'FF-2024-00002',
        claimantUid: 'student-2',
        itemName: 'Silver bottle',
        status: 'NEEDS_PROOF',
        claimantName: 'John Smith',
        claimantEmail: 'john@example.com',
        claimReason: 'I lost it in the library on Tuesday afternoon.',
        proofDetails: 'It has a dent near the base and a sticker from residence.',
        additionalProofRequest: 'Please describe the sticker.',
        proofRequestedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app).get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.summary.totalClaims, 2);
  assert.equal(response.body.summary.pendingClaims, 1);
  assert.equal(response.body.summary.needsProofClaims, 1);
  assert.equal(response.body.claims[0].id, 'claim-1');
  assert.equal(response.body.claims[1].id, 'claim-2');
  assert.equal(response.body.claims[1].additionalProofRequest, 'Please describe the sticker.');
});

test('GET /api/v1/admin/claims includes student proof responses after proof is submitted', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-proof-admin-1': {
        itemId: 'item-proof-admin-1',
        referenceCode: 'FND-2024-00999',
        claimantUid: 'student-1',
        itemName: 'Black water bottle',
        status: 'PENDING',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this bottle after class and can describe the stickers on it.',
        proofDetails: 'There is a silver cap and a blue Falcons sticker near the base.',
        additionalProofRequest: 'Please share a photo of the sticker near the base.',
        proofRequestedAt: '2026-03-18T10:00:00.000Z',
        proofResponseMessage: 'Here is the bottle with the blue sticker and silver cap you asked for.',
        proofResponsePhotoUrls: ['gs://test-bucket/claims/proof-photo-1.jpg'],
        proofRespondedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app).get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.claims[0].proofResponseMessage, 'Here is the bottle with the blue sticker and silver cap you asked for.');
  assert.match(response.body.claims[0].proofResponsePhotoUrls[0], /^https:\/\/signed\.local\/claims\//);
  assert.equal(response.body.claims[0].proofRespondedAt, '2026-03-18T11:00:00.000Z');
});

test('GET /api/v1/admin/claims lists legacy claims stored with message-only fields', async () => {
  const { db } = createFakeDb({
    reports: {
      'report-legacy': {
        kind: 'FOUND',
        title: 'Black Backpack',
        referenceCode: 'FF-LEGACY-001',
        status: 'VALIDATED',
      },
    },
    claims: {
      'claim-legacy': {
        itemId: 'report-legacy',
        claimantName: 'Rayan Teste',
        claimantEmail: 'rayan@email.com',
        message: 'I can describe the item and where I lost it.',
        status: 'PENDING',
        createdAt: '2026-03-16T04:40:13.963Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app).get('/api/v1/admin/claims');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.claims[0].id, 'claim-legacy');
  assert.equal(response.body.claims[0].referenceCode, 'FF-LEGACY-001');
  assert.equal(response.body.claims[0].itemName, 'Black Backpack');
  assert.equal(response.body.claims[0].claimReason, 'I can describe the item and where I lost it.');
  assert.equal(response.body.claims[0].proofDetails, 'No proof details provided.');
});
