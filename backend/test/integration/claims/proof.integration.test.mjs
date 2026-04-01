import test from 'node:test';
import assert from 'node:assert/strict';
import request from '../request-helper.mjs';
import { buildClaimsTestApp, createFakeDb } from './test-utils.mjs';

test('PATCH /api/v1/claims/:id/proof-response submits additional proof, uploads photos, and returns the claim to pending review', async () => {
  const { db, claims, items } = createFakeDb({
    claims: {
      'claim-proof-1': {
        itemId: 'item-proof-1',
        referenceCode: 'FND-2024-00090',
        claimantUid: 'student-1',
        itemName: 'Laptop sleeve',
        status: 'NEEDS_PROOF',
        claimantName: 'Jane Doe',
        claimantEmail: 'jane@example.com',
        claimReason: 'I lost this after class.',
        proofDetails: 'It contains my name tag inside.',
        additionalProofRequest: 'Please send a clearer photo of the inside label.',
        proofRequestedAt: '2026-03-18T10:00:00.000Z',
        createdAt: '2026-03-18T09:00:00.000Z',
      },
    },
    items: {
      'item-proof-1': {
        status: 'VALIDATED',
        claimStatus: 'NEEDS_PROOF',
      },
    },
  });

  const { app, uploads } = buildClaimsTestApp(db);
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);

  const response = await request(app)
    .patch('/api/v1/claims/claim-proof-1/proof-response')
    .field('message', 'Here is a clearer photo of the inside label and stitching.')
    .attach('photos', jpegBuffer, {
      filename: 'label.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'PENDING');
  assert.equal(response.body.proofResponseMessage, 'Here is a clearer photo of the inside label and stitching.');
  assert.match(response.body.proofRespondedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(response.body.proofResponsePhotoUrls[0], /^https:\/\/signed\.local\/claims\//);
  assert.equal(uploads.length, 1);
  assert.equal(claims['claim-proof-1'].status, 'PENDING');
  assert.equal(items['item-proof-1'].claimStatus, 'PENDING');
  assert.equal(claims['claim-proof-1'].proofResponsePhotoUrls.length, 1);
});

test('PATCH /api/v1/claims/:id/proof-request stores the additional proof request and marks the claim as NEEDS_PROOF', async () => {
  const { db, claims, items } = createFakeDb({
    items: {
      'item-1': {
        status: 'VALIDATED',
        claimStatus: 'PENDING',
      },
    },
    claims: {
      'claim-proof-request': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-proof-request/proof-request')
    .send({
      message: 'Please provide a photo of the serial number or describe a unique item inside the bag.',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'claim-proof-request');
  assert.equal(response.body.status, 'NEEDS_PROOF');
  assert.match(response.body.proofRequestedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    response.body.additionalProofRequest,
    'Please provide a photo of the serial number or describe a unique item inside the bag.',
  );
  assert.equal(claims['claim-proof-request'].status, 'NEEDS_PROOF');
  assert.equal(
    claims['claim-proof-request'].additionalProofRequest,
    'Please provide a photo of the serial number or describe a unique item inside the bag.',
  );
  assert.match(claims['claim-proof-request'].proofRequestedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(items['item-1'].claimStatus, 'NEEDS_PROOF');
  assert.match(items['item-1'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('PATCH /api/v1/claims/:id/proof-request returns 404 when the claim does not exist', async () => {
  const { db } = createFakeDb();

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/missing-claim/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/proof-request returns 404 when the related item cannot be found', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-missing-item': {
        itemId: 'missing-item',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-missing-item/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'CLAIM_ITEM_NOT_FOUND');
});

test('PATCH /api/v1/claims/:id/proof-request returns 409 when the claim is already finalized', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-final': {
        itemId: 'item-1',
        status: 'APPROVED',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-final/proof-request')
    .send({
      message: 'Please provide another identifying detail.',
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_STATUS_CONFLICT');
});

test('PATCH /api/v1/claims/:id/proof-request returns 400 for invalid request payload', async () => {
  const { db } = createFakeDb({
    claims: {
      'claim-invalid-proof-request': {
        itemId: 'item-1',
        status: 'PENDING',
      },
    },
  });

  const response = await request(buildClaimsTestApp(db).app)
    .patch('/api/v1/claims/claim-invalid-proof-request/proof-request')
    .send({
      message: '',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
});
