import test from 'node:test';
import assert from 'node:assert/strict';
import request from '../request-helper.mjs';
import { buildClaimsTestApp, createFakeDb } from './test-utils.mjs';

test('PATCH /api/v1/claims/:id/cancel cancels a pending claim and keeps the item validated', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-cancel': {
        itemId: 'item-cancel',
        claimantUid: 'student-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-cancel/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-cancel');
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(response.body.itemId, 'item-cancel');
  assert.equal(response.body.itemStatus, 'VALIDATED');
  assert.equal(claims['claim-cancel'].status, 'CANCELLED');
  assert.equal(items['item-cancel'].status, 'VALIDATED');
  assert.equal(items['item-cancel'].claimStatus, 'CANCELLED');
  assert.match(items['item-cancel'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/cancel cancels a proof-requested claim', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel-proof': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-cancel-proof': {
        itemId: 'item-cancel-proof',
        claimantUid: 'student-1',
        status: 'NEEDS_PROOF',
        additionalProofRequest: 'Please provide the serial number.',
        proofRequestedAt: '2026-03-17T12:00:00.000Z',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-cancel-proof/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(claims['claim-cancel-proof'].status, 'CANCELLED');
  assert.equal(items['item-cancel-proof'].status, 'VALIDATED');
  assert.equal(items['item-cancel-proof'].claimStatus, 'CANCELLED');
});

test('PATCH /api/v1/claims/:id/cancel returns 404 when the claim does not exist', async () => {
  const { db } = createFakeDb();

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/missing-claim/cancel')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/cancel returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-cancel-missing-item': {
        itemId: 'missing-item',
        claimantUid: 'student-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-cancel-missing-item/cancel')
    .send();

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/cancel returns 409 when the claim is already finalized', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-cancel-final': {
        itemId: 'item-cancel-final',
        claimantUid: 'student-1',
        status: 'APPROVED',
      },
    },
    items: {
      'item-cancel-final': {
        status: 'CLAIMED',
        claimStatus: 'APPROVED',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-cancel-final/cancel')
    .send();

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/cancel preserves the current item status when it is already terminal', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-cancel-terminal': {
        status: 'ARCHIVED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
    claims: {
      'claim-cancel-terminal': {
        itemId: 'item-cancel-terminal',
        claimantUid: 'student-1',
        status: 'NEEDS_PROOF',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-cancel-terminal/cancel')
    .send();

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CANCELLED');
  assert.equal(response.body.itemStatus, 'ARCHIVED');
  assert.equal(claims['claim-cancel-terminal'].status, 'CANCELLED');
  assert.equal(items['item-cancel-terminal'].status, 'ARCHIVED');
  assert.equal(items['item-cancel-terminal'].claimStatus, 'CANCELLED');
});

test('PATCH /api/v1/claims/:id/cancel returns 403 when a student tries to cancel someone else’s claim', async () => {
  const { db } = createFakeDb({
    items: {
      'item-other-owner': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-other-owner': {
        itemId: 'item-other-owner',
        claimantUid: 'student-2',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-other-owner/cancel')
    .send();

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});
