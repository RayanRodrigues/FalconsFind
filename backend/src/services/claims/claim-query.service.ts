import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { RedisClient } from '../../bootstrap/redis.js';
import { ClaimStatus } from '../../contracts/index.js';
import type { AdminClaimResponse, AdminClaimsListResponse, Claim, UserClaimsListResponse } from '../../contracts/index.js';
import {
  buildAdminClaimsCacheKey,
  buildUserClaimsCacheKey,
  getCachedClaimsQuery,
  setCachedClaimsQuery,
} from './claim-query-cache.service.js';
import { toClaimPhotoUrls } from './claim-media.service.js';
import { extractLegacyClaimFields, getRelatedItemMetadata } from './claim-shared.js';
import type { StoredClaim } from './claim-types.js';

const mapStoredClaimToAdminClaim = async (
  db: Firestore,
  bucket: Bucket,
  id: string,
  data: StoredClaim,
): Promise<AdminClaimResponse | null> => {
  const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
  const claimantName = typeof data.claimantName === 'string' ? data.claimantName.trim() : '';
  const claimantEmail = typeof data.claimantEmail === 'string' ? data.claimantEmail.trim() : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt.trim() : '';
  const status = data.status;
  if (!itemId || !claimantName || !claimantEmail || !createdAt || !status) return null;

  const relatedItem = await getRelatedItemMetadata(db, itemId);
  const legacyFields = extractLegacyClaimFields(data.message);
  const referenceCode = typeof data.referenceCode === 'string' && data.referenceCode.trim()
    ? data.referenceCode.trim()
    : (relatedItem.referenceCode?.trim() || itemId);
  const itemName = typeof data.itemName === 'string' && data.itemName.trim()
    ? data.itemName.trim()
    : (relatedItem.itemName?.trim() || 'Unknown item');
  const claimReason = typeof data.claimReason === 'string' && data.claimReason.trim()
    ? data.claimReason.trim()
    : (legacyFields.claimReason || 'No claim reason provided.');
  const proofDetails = typeof data.proofDetails === 'string' && data.proofDetails.trim()
    ? data.proofDetails.trim()
    : (legacyFields.proofDetails || 'No proof details provided.');
  const phone = typeof data.phone === 'string' && data.phone.trim() ? data.phone.trim() : legacyFields.phone;
  const proofResponsePhotoUrls = await toClaimPhotoUrls(bucket, Array.isArray(data.proofResponsePhotoUrls)
    ? data.proofResponsePhotoUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined);

  return {
    id,
    itemId,
    referenceCode,
    itemName,
    claimantName,
    claimantEmail,
    claimReason,
    proofDetails,
    phone,
    status,
    additionalProofRequest: typeof data.additionalProofRequest === 'string' && data.additionalProofRequest.trim() ? data.additionalProofRequest.trim() : undefined,
    proofRequestedAt: typeof data.proofRequestedAt === 'string' && data.proofRequestedAt.trim() ? data.proofRequestedAt.trim() : undefined,
    proofResponseMessage: typeof data.proofResponseMessage === 'string' && data.proofResponseMessage.trim() ? data.proofResponseMessage.trim() : undefined,
    proofResponsePhotoUrls,
    proofRespondedAt: typeof data.proofRespondedAt === 'string' && data.proofRespondedAt.trim() ? data.proofRespondedAt.trim() : undefined,
    createdAt,
  };
};

const mapStoredClaimToUserClaim = async (bucket: Bucket, id: string, data: StoredClaim): Promise<Claim | null> => {
  const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
  const claimantUid = typeof data.claimantUid === 'string' ? data.claimantUid.trim() : '';
  const claimantName = typeof data.claimantName === 'string' ? data.claimantName.trim() : '';
  const claimantEmail = typeof data.claimantEmail === 'string' ? data.claimantEmail.trim() : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt.trim() : '';
  const status = data.status;
  if (!itemId || !claimantUid || !claimantName || !claimantEmail || !createdAt || !status) return null;

  const legacyFields = extractLegacyClaimFields(data.message);
  const referenceCode = typeof data.referenceCode === 'string' && data.referenceCode.trim() ? data.referenceCode.trim() : itemId;
  const itemName = typeof data.itemName === 'string' && data.itemName.trim() ? data.itemName.trim() : 'Unknown item';
  const claimReason = typeof data.claimReason === 'string' && data.claimReason.trim()
    ? data.claimReason.trim()
    : (legacyFields.claimReason || 'No claim reason provided.');
  const proofDetails = typeof data.proofDetails === 'string' && data.proofDetails.trim()
    ? data.proofDetails.trim()
    : (legacyFields.proofDetails || 'No proof details provided.');
  const phone = typeof data.phone === 'string' && data.phone.trim() ? data.phone.trim() : legacyFields.phone;
  const proofResponsePhotoUrls = await toClaimPhotoUrls(bucket, Array.isArray(data.proofResponsePhotoUrls)
    ? data.proofResponsePhotoUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined);

  return {
    id,
    itemId,
    claimantUid,
    referenceCode,
    itemName,
    claimantName,
    claimantEmail,
    claimReason,
    proofDetails,
    phone,
    status,
    additionalProofRequest: typeof data.additionalProofRequest === 'string' && data.additionalProofRequest.trim() ? data.additionalProofRequest.trim() : undefined,
    proofRequestedAt: typeof data.proofRequestedAt === 'string' && data.proofRequestedAt.trim() ? data.proofRequestedAt.trim() : undefined,
    proofResponseMessage: typeof data.proofResponseMessage === 'string' && data.proofResponseMessage.trim() ? data.proofResponseMessage.trim() : undefined,
    proofResponsePhotoUrls,
    proofRespondedAt: typeof data.proofRespondedAt === 'string' && data.proofRespondedAt.trim() ? data.proofRespondedAt.trim() : undefined,
    createdAt,
  };
};

const buildClaimsSummary = (claims: Array<{ status: ClaimStatus }>) => ({
  totalClaims: claims.length,
  pendingClaims: claims.filter((claim) => claim.status === ClaimStatus.PENDING).length,
  needsProofClaims: claims.filter((claim) => claim.status === ClaimStatus.NEEDS_PROOF).length,
  approvedClaims: claims.filter((claim) => claim.status === ClaimStatus.APPROVED).length,
  rejectedClaims: claims.filter((claim) => claim.status === ClaimStatus.REJECTED).length,
  cancelledClaims: claims.filter((claim) => claim.status === ClaimStatus.CANCELLED).length,
});

export const listAdminClaims = async (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
): Promise<AdminClaimsListResponse> => {
  const cacheKey = buildAdminClaimsCacheKey();
  const cached = await getCachedClaimsQuery<AdminClaimsListResponse>(redis, cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot = await db.collection('claims').get();
  const claims = (await Promise.all(
    snapshot.docs.map((doc) => mapStoredClaimToAdminClaim(db, bucket, doc.id, (doc.data() as StoredClaim | undefined) ?? {})),
  ))
    .filter((claim): claim is AdminClaimResponse => claim !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const result = { claims, total: claims.length, summary: buildClaimsSummary(claims) };
  await setCachedClaimsQuery(redis, cacheKey, result);
  return result;
};

export const listClaimsForUser = async (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  uid: string,
): Promise<UserClaimsListResponse> => {
  const cacheKey = buildUserClaimsCacheKey(uid);
  const cached = await getCachedClaimsQuery<UserClaimsListResponse>(redis, cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot = await db.collection('claims').where('claimantUid', '==', uid).get();
  const claims = (await Promise.all(
    snapshot.docs.map((doc) => mapStoredClaimToUserClaim(bucket, doc.id, (doc.data() as StoredClaim | undefined) ?? {})),
  ))
    .filter((claim): claim is Claim => claim !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const result = { claims, total: claims.length, summary: buildClaimsSummary(claims) };
  await setCachedClaimsQuery(redis, cacheKey, result);
  return result;
};
