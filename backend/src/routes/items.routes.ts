import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, HttpError } from './route-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceTsPath = path.resolve(__dirname, '../services/items.service.ts');
const serviceJsPath = path.resolve(__dirname, '../services/items.service.js');

const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

// We expect your service layer to handle Firestore querying + "VALIDATED only"
const itemsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  listValidatedItems: (
    db: Firestore,
    params: { page: number; limit: number },
  ) => Promise<{
    items: unknown[];
    total: number;
  }>;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export const createItemsRouter = (db: Firestore): Router => {
  const router = Router();

  // GET /api/v1/items?page=1&limit=10
  router.get(`${API_PREFIX}/items`, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limitRaw = parsePositiveInt(req.query.limit, 10);

    // Safety clamp so someone can't request 10,000 records
    const limit = Math.min(limitRaw, 50);

    if (limit < 1) {
      throw new HttpError(400, 'BAD_REQUEST', 'limit must be >= 1');
    }

    const result = await itemsServiceModule.listValidatedItems(db, { page, limit });

    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    res.status(200).json({
      page,
      limit,
      total: result.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      items: result.items,
    });
  });

  return router;
};