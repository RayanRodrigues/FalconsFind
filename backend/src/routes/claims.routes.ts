import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CreateClaimRequest } from '../contracts/index.js';
import { API_PREFIX, HttpError } from './route-utils.js';

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
};

const claimsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  ClaimItemNotFoundError: new () => Error;
  ClaimItemNotEligibleError: new () => Error;
  createClaim: (
    db: Firestore,
    payload: CreateClaimRequest,
  ) => Promise<{
    id: string;
    claim: {
      status: string;
      createdAt: string;
    };
  }>;
};

export const createClaimsRouter = (db: Firestore): Router => {
  const router = Router();

  router.post(`${API_PREFIX}/claims`, async (req, res) => {
    const parsed = schemaModule.createClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
      throw new HttpError(400, 'BAD_REQUEST', message);
    }

    try {
      const result = await claimsServiceModule.createClaim(db, parsed.data);
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

  return router;
};
