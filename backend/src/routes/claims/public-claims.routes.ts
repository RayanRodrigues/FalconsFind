import { API_PREFIX, HttpError } from '../route-utils.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import { createPhotoArrayUpload, getValidatedUploadedPhotos } from '../report-photo-upload.js';
import type { UserRole } from '../../contracts/index.js';
import type { ClaimsRouterDeps } from './claims-router-modules.js';
import { getSingleRouteParam } from './claims-router-modules.js';

export const registerPublicClaimsRoutes = ({
  router,
  db,
  bucket,
  requireAuthenticatedUser,
  requireClaimAccessUser,
  schemaModule,
  claimsServiceModule,
}: ClaimsRouterDeps): void => {
  router.post(`${API_PREFIX}/claims`, requireAuthenticatedUser, async (req, res) => {
    const authUser = res.locals.authUser as { uid?: string; email?: string | null } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    const payload = parseBodyOrThrow(schemaModule.createClaimSchema, req.body);
    const claimantEmail = authUser?.email?.trim() || payload.claimantEmail;

    try {
      const result = await claimsServiceModule.createClaim(db, { ...payload, claimantEmail }, { uid });
      res.status(201).json({ id: result.id, status: result.claim.status, createdAt: result.claim.createdAt });
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotEligibleError) {
        throw new HttpError(409, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM', error.message);
      }
      throw error;
    }
  });

  router.get(`${API_PREFIX}/claims/me`, requireAuthenticatedUser, async (_req, res) => {
    const authUser = res.locals.authUser as { uid?: string } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    res.status(200).json(await claimsServiceModule.listClaimsForUser(db, bucket, uid));
  });

  router.patch(`${API_PREFIX}/claims/:id`, requireClaimAccessUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const authUser = res.locals.authUser as { uid?: string } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    const payload = parseBodyOrThrow(schemaModule.updateClaimSchema, req.body);
    try {
      res.status(200).json(await claimsServiceModule.updateClaim(db, claimId, payload, { uid }));
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
      throw error;
    }
  });

  router.patch(
    `${API_PREFIX}/claims/:id/proof-response`,
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
        res.status(200).json(await claimsServiceModule.submitClaimProof(db, bucket, claimId, payload, photos, { uid }));
      } catch (error) {
        if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
        if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
        if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
        if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
        throw error;
      }
    },
  );

  router.patch(`${API_PREFIX}/claims/:id/cancel`, requireClaimAccessUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) throw new HttpError(400, 'BAD_REQUEST', 'id is required');

    const authUser = res.locals.authUser as { uid?: string; role?: UserRole } | undefined;
    const uid = authUser?.uid?.trim();
    const role = authUser?.role;
    if (!uid || !role) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    try {
      res.status(200).json(await claimsServiceModule.cancelClaim(db, claimId, { uid, role }));
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) throw new HttpError(404, 'NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      if (error instanceof claimsServiceModule.ClaimConflictError) throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      if (error instanceof claimsServiceModule.ClaimForbiddenError) throw new HttpError(403, 'FORBIDDEN', error.message);
      throw error;
    }
  });
};
