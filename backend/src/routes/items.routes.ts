import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import { UserRole } from '../contracts/index.js';
import type { RequestHandler } from 'express';
import type { ItemDetailsResponse, ItemHistoryResponse, ItemStatusResponse } from '../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, HttpError } from './route-utils.js';
import {
  assertValidDateRange,
  parseDateFilter,
  parseOptionalString,
  parsePositiveInt,
} from './request-parsers.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceTsPath = path.resolve(__dirname, '../services/items.service.ts');
const serviceJsPath = path.resolve(__dirname, '../services/items.service.js');
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;
const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

const itemsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  InvalidItemDataError: new () => Error;
  ItemHistoryNotFoundError: new () => Error;
  getItemById: (db: Firestore, bucket: Bucket, redis: RedisClient | null, itemId: string) => Promise<ItemDetailsResponse | null>;
  getItemHistory: (db: Firestore, itemId: string) => Promise<ItemHistoryResponse>;
  isItemPubliclyVisible: (item: ItemDetailsResponse) => boolean;
  getPublicItemStatus: (item: ItemDetailsResponse) => ItemStatusResponse;
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
      sort?: 'most_recent' | 'oldest';
    },
  ) => Promise<{
    items: unknown[];
    total: number;
  }>;
};

type ItemsRouterOptions = {
  requireStaffUser?: RequestHandler;
};

export const createItemsRouter = (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  options: ItemsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser
    ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);

  router.get(`${API_PREFIX}/items`, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limitRaw = parsePositiveInt(req.query.limit, 10);
    const limit = Math.min(limitRaw, 50);
    const keyword = parseOptionalString(req.query.keyword);
    const category = parseOptionalString(req.query.category);
    const location = parseOptionalString(req.query.location);
    const dateFrom = parseDateFilter(req.query.dateFrom, 'dateFrom');
    const dateTo = parseDateFilter(req.query.dateTo, 'dateTo');
    const sortRaw = parseOptionalString(req.query.sort);
    const sort = sortRaw === 'most_recent' || sortRaw === 'oldest' ? sortRaw : undefined;

    if (sortRaw && !sort) {
      throw new HttpError(400, 'BAD_REQUEST', 'sort must be one of: most_recent, oldest');
    }

    assertValidDateRange(dateFrom, dateTo);

    const result = await itemsServiceModule.listValidatedItems(db, bucket, redis, {
      page,
      limit,
      keyword,
      category,
      location,
      dateFrom,
      dateTo,
      sort,
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
        sort: sort ?? 'most_recent',
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

  router.get(`${API_PREFIX}/items/:id/status`, async (req, res) => {
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

    res.json(itemsServiceModule.getPublicItemStatus(item));
  });

  router.get(`${API_PREFIX}/admin/items/:id/history`, requireStaffUser, async (req, res) => {
    const itemId = getSingleRouteParam(req.params.id);
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    try {
      const history = await itemsServiceModule.getItemHistory(db, itemId);
      res.status(200).json(history);
    } catch (error) {
      if (error instanceof itemsServiceModule.ItemHistoryNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      throw error;
    }
  });

  return router;
};
