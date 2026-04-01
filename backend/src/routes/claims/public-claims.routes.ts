import { API_PREFIX, HttpError } from '../route-utils.js';
import { createJsonRateLimiter } from '../rate-limit.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import { createPhotoArrayUpload, getValidatedUploadedPhotos } from '../report-photo-upload.js';
import type { UserRole } from '../../contracts/index.js';
import { invalidateAdminClaimsCache, invalidateUserClaimsCache } from '../../services/claims/claim-query-cache.service.js';
import { invalidatePublicItemsCache } from '../../services/items/item-query-cache.service.js';
import type { ClaimsRouterDeps } from './claims-router-modules.js';
import { getSingleRouteParam } from './claims-router-modules.js';

export const registerPublicClaimsRoutes = ({
  router,
  db,
  bucket,
  redis,
  requireAuthenticatedUser,
  requireClaimAccessUser,
  schemaModule,
  claimsServiceModule,
}: ClaimsRouterDeps): void => {
  const createClaimLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many claim submissions. Please try again later.',
  });
  const listOwnClaimsLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    message: 'Too many claim list requests. Please try again later.',
  });
  const updateOwnClaimLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: 'Too many claim update attempts. Please try again later.',
  });
  const submitProofLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many proof submission attempts. Please try again later.',
  });
  const cancelClaimLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many claim cancellation attempts. Please try again later.',
  });

  router.post(`${API_PREFIX}/claims`, createClaimLimiter, requireAuthenticatedUser, async (req, res) => {
    const authUser = res.locals.authUser as { uid?: string; email?: string | null } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    const payload = parseBodyOrThrow(schemaModule.createClaimSchema, req.body);
    const claimantEmail = authUser?.email?.trim() || payload.claimantEmail;

    try {
      const result = await claimsServiceModule.createClaim(db, { ...payload, claimantEmail }, { uid });
      await invalidateAdminClaimsCache(redis);
      await invalidateUserClaimsCache(redis, uid);
      res.status(201).json({ id: result.id, status: result.claim.status, createdAt: result.claim.createdAt });
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotEligibleError) {
        throw new HttpError(409, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM', error.message);
      }
      throw error;
    }
  });

  router.get(`${API_PREFIX}/claims/me`, listOwnClaimsLimiter, requireAuthenticatedUser, async (_req, res) => {
    const authUser = res.locals.authUser as { uid?: string } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    res.status(200).json(await claimsServiceModule.listClaimsForUser(db, bucket, redis, uid));
  });

  router.patch(`${API_PREFIX}/claims/:id`, updateOwnClaimLimiter, requireClaimAccessUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const authUser = res.locals.authUser as { uid?: string } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    const payload = parseBodyOrThrow(schemaModule.updateClaimSchema, req.body);
    try {
      const result = await claimsServiceModule.updateClaim(db, claimId, payload, { uid });
      await invalidateAdminClaimsCache(redis);
      await invalidateUserClaimsCache(redis, uid);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
      throw error;
    }
  });

  router.patch(
    `${API_PREFIX}/claims/:id/proof-response`,
    submitProofLimiter,
    requireClaimAccessUser,
    createPhotoArrayUpload('photos', 5),
    async (req, res) => {
      const claimId = getSingleRouteParam(req.params.id);
      if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

      const authUser = res.locals.authUser as { uid?: string } | undefined;
      const uid = authUser?.uid?.trim();
      if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

      const payload = parseBodyOrThrow(schemaModule.submitClaimProofSchema, req.body);
      const photos = getValidatedUploadedPhotos(req.files as Express.Multer.File[] | undefined, { required: false });

      try {
        const result = await claimsServiceModule.submitClaimProof(db, bucket, claimId, payload, photos, { uid });
        await invalidateAdminClaimsCache(redis);
        await invalidateUserClaimsCache(redis, uid);
        res.status(200).json(result);
      } catch (error) {
        if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
        if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
        if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
        if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
        throw error;
      }
    },
  );

  router.patch(`${API_PREFIX}/claims/:id/cancel`, cancelClaimLimiter, requireClaimAccessUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const authUser = res.locals.authUser as { uid?: string; role?: UserRole } | undefined;
    const uid = authUser?.uid?.trim();
    const role = authUser?.role;
    if (!uid || !role) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    try {
      const result = await claimsServiceModule.cancelClaim(db, claimId, { uid, role });
      await invalidateAdminClaimsCache(redis);
      await invalidateUserClaimsCache(redis, uid);
      await invalidatePublicItemsCache(redis, result.itemId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
      throw error;
    }
  });
};
