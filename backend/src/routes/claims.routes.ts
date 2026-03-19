import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  AdminClaimsListResponse,
  CreateClaimRequest,
  RequestAdditionalProofRequest,
  UpdateClaimStatusRequest,
} from '../contracts/index.js';
import { UserRole } from '../contracts/index.js';
import { API_PREFIX, HttpError } from './route-utils.js';
import { parseBodyOrThrow } from './schema-validation.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, '../schemas/claims.schema.ts');
const schemaJsPath = path.resolve(__dirname, '../schemas/claims.schema.js');
const serviceTsPath = path.resolve(__dirname, '../services/claims.service.ts');
const serviceJsPath = path.resolve(__dirname, '../services/claims.service.js');

const schemaPath = fs.existsSync(schemaTsPath) ? schemaTsPath : schemaJsPath;
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

const schemaModule = (await import(pathToFileURL(schemaPath).href)) as {
  createClaimSchema: {
    safeParse: (
      input: unknown,
    ) =>
      | { success: true; data: CreateClaimRequest }
      | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  requestAdditionalProofSchema: {
    safeParse: (
      input: unknown,
    ) =>
      | { success: true; data: RequestAdditionalProofRequest }
      | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  updateClaimStatusSchema: {
    safeParse: (
      input: unknown,
    ) =>
      | { success: true; data: UpdateClaimStatusRequest }
      | { success: false; error: { issues: Array<{ message?: string }> } };
  };
};

const claimsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  ClaimNotFoundError: new () => Error;
  ClaimConflictError: new (message: string) => Error;
  ClaimForbiddenError: new (message: string) => Error;
  ClaimItemNotFoundError: new () => Error;
  ClaimItemNotEligibleError: new () => Error;
  listAdminClaims: (db: Firestore) => Promise<AdminClaimsListResponse>;
  createClaim: (
    db: Firestore,
    payload: CreateClaimRequest,
    actor: { uid: string },
  ) => Promise<{
    id: string;
    claim: {
      status: string;
      createdAt: string;
    };
  }>;
  updateClaimStatus: (
    db: Firestore,
    claimId: string,
    targetStatus: UpdateClaimStatusRequest['status'],
  ) => Promise<{
    id: string;
    status: UpdateClaimStatusRequest['status'];
    itemId: string;
    itemStatus: string;
  }>;
  requestAdditionalProof: (
    db: Firestore,
    claimId: string,
    payload: RequestAdditionalProofRequest,
  ) => Promise<{
    id: string;
    status: string;
    additionalProofRequest: string;
    proofRequestedAt: string;
  }>;
  cancelClaim: (
    db: Firestore,
    claimId: string,
    actor: { uid: string; role: UserRole },
  ) => Promise<{
    id: string;
    status: string;
    itemId: string;
    itemStatus: string;
  }>;
};

const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

type ClaimsRouterOptions = {
  requireStaffUser?: RequestHandler;
  requireStudentUser?: RequestHandler;
  requireClaimAccessUser?: RequestHandler;
};

export const createClaimsRouter = (
  db: Firestore,
  options: ClaimsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);
  const requireStudentUser = options.requireStudentUser ?? createRequireStaffRoles(db, [UserRole.STUDENT]);
  const requireClaimAccessUser = options.requireClaimAccessUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY, UserRole.STUDENT]);

  router.post(`${API_PREFIX}/claims`, requireStudentUser, async (req, res) => {
    const authUser = res.locals.authUser as { uid?: string; email?: string | null } | undefined;
    const uid = authUser?.uid?.trim();
    if (!uid) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    const payload = parseBodyOrThrow(schemaModule.createClaimSchema, req.body);
    const claimantEmail = authUser?.email?.trim() || payload.claimantEmail;

    try {
      const result = await claimsServiceModule.createClaim(db, {
        ...payload,
        claimantEmail,
      }, { uid });
      res.status(201).json({
        id: result.id,
        status: result.claim.status,
        createdAt: result.claim.createdAt,
      });
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimItemNotEligibleError) {
        throw new HttpError(409, 'ITEM_NOT_ELIGIBLE_FOR_CLAIM', error.message);
      }

      throw error;
    }
  });

  router.get(`${API_PREFIX}/admin/claims`, requireStaffUser, async (_req, res) => {
    const result = await claimsServiceModule.listAdminClaims(db);
    res.status(200).json(result);
  });

  router.patch(`${API_PREFIX}/claims/:id/status`, requireStaffUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const payload = parseBodyOrThrow(schemaModule.updateClaimStatusSchema, req.body);

    try {
      const result = await claimsServiceModule.updateClaimStatus(db, claimId, payload.status);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) {
        throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimConflictError) {
        throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      }

      throw error;
    }
  });

  router.patch(`${API_PREFIX}/claims/:id/proof-request`, requireStaffUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const payload = parseBodyOrThrow(schemaModule.requestAdditionalProofSchema, req.body);

    try {
      const result = await claimsServiceModule.requestAdditionalProof(db, claimId, payload);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) {
        throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimConflictError) {
        throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      }

      throw error;
    }
  });

  router.patch(`${API_PREFIX}/claims/:id/cancel`, requireClaimAccessUser, async (req, res) => {
    const claimId = getSingleRouteParam(req.params.id);
    if (!claimId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const authUser = res.locals.authUser as { uid?: string; role?: UserRole } | undefined;
    const uid = authUser?.uid?.trim();
    const role = authUser?.role;
    if (!uid || !role) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    try {
      const result = await claimsServiceModule.cancelClaim(db, claimId, { uid, role });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof claimsServiceModule.ClaimNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimItemNotFoundError) {
        throw new HttpError(404, 'CLAIM_ITEM_NOT_FOUND', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimConflictError) {
        throw new HttpError(409, 'CLAIM_STATUS_CONFLICT', error.message);
      }

      if (error instanceof claimsServiceModule.ClaimForbiddenError) {
        throw new HttpError(403, 'FORBIDDEN', error.message);
      }

      throw error;
    }
  });

  return router;
};
