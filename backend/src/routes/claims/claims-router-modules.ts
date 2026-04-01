import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { RequestHandler, Router } from 'express';
import type { RedisClient } from '../../bootstrap/redis.js';
import type {
  AdminClaimsListResponse,
  CreateClaimRequest,
  RequestAdditionalProofRequest,
  SubmitClaimProofRequest,
  UpdateClaimRequest,
  UpdateClaimStatusRequest,
  UserClaimsListResponse,
  UserRole,
} from '../../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, '../../schemas/claims.schema.ts');
const schemaJsPath = path.resolve(__dirname, '../../schemas/claims.schema.js');
const serviceTsPath = path.resolve(__dirname, '../../services/claims.service.ts');
const serviceJsPath = path.resolve(__dirname, '../../services/claims.service.js');

const schemaPath = fs.existsSync(schemaTsPath) ? schemaTsPath : schemaJsPath;
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

export type ClaimsSchemaModule = {
  createClaimSchema: { safeParse: (input: unknown) => { success: true; data: CreateClaimRequest } | { success: false; error: { issues: Array<{ message?: string }> } } };
  requestAdditionalProofSchema: { safeParse: (input: unknown) => { success: true; data: RequestAdditionalProofRequest } | { success: false; error: { issues: Array<{ message?: string }> } } };
  submitClaimProofSchema: { safeParse: (input: unknown) => { success: true; data: SubmitClaimProofRequest } | { success: false; error: { issues: Array<{ message?: string }> } } };
  updateClaimStatusSchema: { safeParse: (input: unknown) => { success: true; data: UpdateClaimStatusRequest } | { success: false; error: { issues: Array<{ message?: string }> } } };
  updateClaimSchema: { safeParse: (input: unknown) => { success: true; data: UpdateClaimRequest } | { success: false; error: { issues: Array<{ message?: string }> } } };
};

export type ClaimsServiceModule = {
  ClaimNotFoundError: new () => Error;
  ClaimConflictError: new (message: string) => Error;
  ClaimForbiddenError: new (message: string) => Error;
  ClaimItemNotFoundError: new () => Error;
  ClaimItemNotEligibleError: new () => Error;
  listAdminClaims: (db: Firestore, bucket: Bucket, redis: RedisClient | null) => Promise<AdminClaimsListResponse>;
  listClaimsForUser: (db: Firestore, bucket: Bucket, redis: RedisClient | null, uid: string) => Promise<UserClaimsListResponse>;
  createClaim: (db: Firestore, payload: CreateClaimRequest, actor: { uid: string }) => Promise<{ id: string; claim: { status: string; createdAt: string } }>;
  updateClaim: (db: Firestore, claimId: string, payload: UpdateClaimRequest, actor: { uid: string }) => Promise<{ id: string; status: string; itemName: string; claimReason: string; proofDetails: string; phone?: string }>;
  updateClaimStatus: (db: Firestore, claimId: string, targetStatus: UpdateClaimStatusRequest['status']) => Promise<{ id: string; status: UpdateClaimStatusRequest['status']; itemId: string; itemStatus: string }>;
  requestAdditionalProof: (db: Firestore, claimId: string, payload: RequestAdditionalProofRequest) => Promise<{ id: string; status: string; additionalProofRequest: string; proofRequestedAt: string }>;
  submitClaimProof: (
    db: Firestore,
    bucket: Bucket,
    claimId: string,
    payload: SubmitClaimProofRequest,
    photos: Array<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' }>,
    actor: { uid: string },
  ) => Promise<{ id: string; status: string; proofResponseMessage: string; proofResponsePhotoUrls?: string[]; proofRespondedAt: string }>;
  cancelClaim: (db: Firestore, claimId: string, actor: { uid: string; role: UserRole }) => Promise<{ id: string; status: string; itemId: string; itemStatus: string }>;
};

export type ClaimsRouterDeps = {
  router: Router;
  db: Firestore;
  bucket: Bucket;
  redis: RedisClient | null;
  requireStaffUser: RequestHandler;
  requireAuthenticatedUser: RequestHandler;
  requireClaimAccessUser: RequestHandler;
  schemaModule: ClaimsSchemaModule;
  claimsServiceModule: ClaimsServiceModule;
};

export const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const schemaModule = (await import(pathToFileURL(schemaPath).href)) as ClaimsSchemaModule;
export const claimsServiceModule = (await import(pathToFileURL(servicePath).href)) as ClaimsServiceModule;
