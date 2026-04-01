import { invalidateAdminClaimsCache, invalidateUserClaimsCache } from '../../services/claims/claim-query-cache.service.js';
import { invalidatePublicItemsCache } from '../../services/items/item-query-cache.service.js';
import { API_PREFIX, HttpError } from '../route-utils.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import type { ClaimsRouterDeps } from './claims-router-modules.js';
import { getSingleRouteParam } from './claims-router-modules.js';

export const registerAdminClaimsRoutes = ({
  router,
  db,
  bucket,
  redis,
  requireStaffUser,
  schemaModule,
  claimsServiceModule,
}: ClaimsRouterDeps): void => {
  router.get(`${API_PREFIX}/admin/claims`, requireStaffUser, async (_req, res) => {
    res.status(200).json(await claimsServiceModule.listAdminClaims(db, bucket, redis));
  });

  router.patch(`${API_PREFIX}/claims/:id/status`, requireStaffUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const payload = parseBodyOrThrow(schemaModule.updateClaimStatusSchema, req.body);
    try {
      const result = await claimsServiceModule.updateClaimStatus(db, claimId, payload.status);
      await invalidateAdminClaimsCache(redis);
      await invalidateUserClaimsCache(redis);
      await invalidatePublicItemsCache(redis, result.itemId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      throw error;
    }
  });

  router.patch(`${API_PREFIX}/claims/:id/proof-request`, requireStaffUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const payload = parseBodyOrThrow(schemaModule.requestAdditionalProofSchema, req.body);
    try {
      const result = await claimsServiceModule.requestAdditionalProof(db, claimId, payload);
      await invalidateAdminClaimsCache(redis);
      await invalidateUserClaimsCache(redis);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      throw error;
    }
  });
};
