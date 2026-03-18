import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import type { ItemDetailsResponse } from '../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, HttpError } from './route-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceTsPath = path.resolve(__dirname, '../services/items.service.ts');
const serviceJsPath = path.resolve(__dirname, '../services/items.service.js');
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

const itemsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  InvalidItemDataError: new () => Error;
  getItemById: (db: Firestore, bucket: Bucket, redis: RedisClient | null, itemId: string) => Promise<ItemDetailsResponse | null>;
  isItemPubliclyVisible: (item: ItemDetailsResponse) => boolean;
  listValidatedItems: (
    db: Firestore,
    bucket: Bucket,
    redis: RedisClient | null,
    params: {
      page: number;
      limit: number;
      keyword?: string;
      category?: string;
      location?: string;
      dateFrom?: string;
      dateTo?: string;
    },
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

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const createItemsRouter = (db: Firestore, bucket: Bucket, redis: RedisClient | null): Router => {
  const router = Router();

  router.get(`${API_PREFIX}/items`, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limitRaw = parsePositiveInt(req.query.limit, 10);
    const limit = Math.min(limitRaw, 50);
    const keyword = parseOptionalString(req.query.keyword);
    const category = parseOptionalString(req.query.category);
    const location = parseOptionalString(req.query.location);
    const dateFrom = parseOptionalString(req.query.dateFrom);
    const dateTo = parseOptionalString(req.query.dateTo);

    const result = await itemsServiceModule.listValidatedItems(db, bucket, redis, {
      page,
      limit,
      keyword,
      category,
      location,
      dateFrom,
      dateTo,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    res.status(200).json({
      page,
      limit,
      total: result.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: {
        keyword: keyword ?? null,
        category: category ?? null,
        location: location ?? null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
      items: result.items,
    });
  });

  router.get(`${API_PREFIX}/items/:id`, async (req, res) => {
    const itemId = req.params.id?.trim();
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    let item: ItemDetailsResponse | null = null;
    try {
      item = await itemsServiceModule.getItemById(db, bucket, redis, itemId);
    } catch (error) {
      if (error instanceof itemsServiceModule.InvalidItemDataError) {
        throw new HttpError(422, 'INVALID_ITEM_DATA', error.message);
      }

      throw error;
    }

    if (!item) {
      throw new HttpError(404, 'NOT_FOUND', 'Item not found');
    }

    if (!itemsServiceModule.isItemPubliclyVisible(item)) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'This item is currently under review by Campus Security.',
      );
    }

    res.json(item);
  });

  return router;
};
