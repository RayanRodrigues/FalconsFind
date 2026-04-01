import { invalidatePublicItemsCache } from '../../services/items/item-query-cache.service.js';
import { API_PREFIX, HttpError } from '../route-utils.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import { getSingleRouteParam, itemsServiceModule, schemaModule } from './items-router-modules.js';
import type { ItemsRouterDeps } from './items-router-modules.js';

export const registerAdminItemRoutes = ({
  router,
  db,
  redis,
  requireStaffUser,
}: ItemsRouterDeps): void => {
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

  router.patch(`${API_PREFIX}/admin/items/:id/status`, requireStaffUser, async (req, res) => {
    const itemId = getSingleRouteParam(req.params.id);
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const payload = parseBodyOrThrow(schemaModule.updateItemStatusSchema, req.body);
    const actor = res.locals.authUser as { uid?: string; email?: string | null; role?: 'ADMIN' | 'SECURITY' } | undefined;
    if (!actor?.uid || (actor.role !== 'ADMIN' && actor.role !== 'SECURITY')) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    try {
      const result = await itemsServiceModule.updateItemStatus(db, itemId, payload, {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
      });
      await invalidatePublicItemsCache(redis, itemId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof itemsServiceModule.ItemNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }
      if (error instanceof itemsServiceModule.InvalidItemDataError) {
        throw new HttpError(422, 'INVALID_ITEM_DATA', error.message);
      }
      if (error instanceof itemsServiceModule.ItemStatusConflictError) {
        throw new HttpError(409, 'ITEM_STATUS_CONFLICT', error.message);
      }
      throw error;
    }
  });

  router.post(`${API_PREFIX}/admin/items/:id/restore-status`, requireStaffUser, async (req, res) => {
    const itemId = getSingleRouteParam(req.params.id);
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const payload = parseBodyOrThrow(schemaModule.restoreItemStatusSchema, req.body);
    const actor = res.locals.authUser as { uid?: string; email?: string | null; role?: 'ADMIN' | 'SECURITY' } | undefined;
    if (!actor?.uid || (actor.role !== 'ADMIN' && actor.role !== 'SECURITY')) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    try {
      const result = await itemsServiceModule.restoreItemStatus(db, itemId, payload, {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
      });
      await invalidatePublicItemsCache(redis, itemId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof itemsServiceModule.ItemNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }
      if (error instanceof itemsServiceModule.InvalidItemDataError) {
        throw new HttpError(422, 'INVALID_ITEM_DATA', error.message);
      }
      if (error instanceof itemsServiceModule.ItemStatusConflictError) {
        throw new HttpError(409, 'ITEM_STATUS_CONFLICT', error.message);
      }
      if (error instanceof itemsServiceModule.ItemStatusRestoreNotAllowedError) {
        throw new HttpError(409, 'ITEM_STATUS_RESTORE_NOT_ALLOWED', error.message);
      }
      throw error;
    }
  });
};
