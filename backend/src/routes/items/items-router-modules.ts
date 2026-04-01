import type { RequestHandler, Router } from 'express';
import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { RedisClient } from '../../bootstrap/redis.js';
import type {
  ItemDetailsResponse,
  ItemHistoryResponse,
  ItemStatusResponse,
  RestoreItemStatusRequest,
  UpdateItemStatusRequest,
  UpdateItemStatusResponse,
} from '../../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, '../../schemas/items.schema.ts');
const schemaJsPath = path.resolve(__dirname, '../../schemas/items.schema.js');
const serviceTsPath = path.resolve(__dirname, '../../services/items.service.ts');
const serviceJsPath = path.resolve(__dirname, '../../services/items.service.js');
const schemaPath = fs.existsSync(schemaTsPath) ? schemaTsPath : schemaJsPath;
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

export const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const schemaModule = (await import(pathToFileURL(schemaPath).href)) as {
  updateItemStatusSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: UpdateItemStatusRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  restoreItemStatusSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: RestoreItemStatusRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
};

export const itemsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  InvalidItemDataError: new () => Error;
  ItemNotFoundError: new () => Error;
  ItemStatusConflictError: new (message: string) => Error;
  ItemStatusRestoreNotAllowedError: new (message: string) => Error;
  ItemHistoryNotFoundError: new () => Error;
  getItemById: (db: Firestore, bucket: Bucket, redis: RedisClient | null, itemId: string) => Promise<ItemDetailsResponse | null>;
  getItemHistory: (db: Firestore, itemId: string) => Promise<ItemHistoryResponse>;
  isItemPubliclyVisible: (item: ItemDetailsResponse) => boolean;
  updateItemStatus: (
    db: Firestore,
    itemId: string,
    payload: UpdateItemStatusRequest,
    actor: { uid: string; email?: string | null; role: 'ADMIN' | 'SECURITY' },
  ) => Promise<UpdateItemStatusResponse>;
  restoreItemStatus: (
    db: Firestore,
    itemId: string,
    payload: RestoreItemStatusRequest,
    actor: { uid: string; email?: string | null; role: 'ADMIN' | 'SECURITY' },
  ) => Promise<UpdateItemStatusResponse>;
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
  ) => Promise<{ items: unknown[]; total: number }>;
};

export type ItemsRouterDeps = {
  router: Router;
  db: Firestore;
  bucket: Bucket;
  redis: RedisClient | null;
  requireStaffUser: RequestHandler;
};
