import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
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
  getItemById: (db: Firestore, bucket: Bucket, itemId: string) => Promise<ItemDetailsResponse | null>;
  isItemPubliclyVisible: (item: ItemDetailsResponse) => boolean;
};

export const createItemsRouter = (db: Firestore, bucket: Bucket): Router => {
  const router = Router();

  router.get(`${API_PREFIX}/items/:id`, async (req, res) => {
    const itemId = req.params.id?.trim();
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    let item: ItemDetailsResponse | null = null;
    try {
      item = await itemsServiceModule.getItemById(db, bucket, itemId);
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
