import { API_PREFIX, HttpError } from '../route-utils.js';
import { createJsonRateLimiter } from '../rate-limit.js';
import {
  assertValidDateRange,
  parseDateFilter,
  parseOptionalString,
  parsePositiveInt,
} from '../request-parsers.js';
import { itemsServiceModule, getSingleRouteParam } from './items-router-modules.js';
import type { ItemsRouterDeps } from './items-router-modules.js';

const getItemVisibilityMessage = (item: import('../../contracts/index.js').ItemDetailsResponse): string => (
  item.status === 'ARCHIVED'
    ? 'This item has been archived and is no longer in active listings.'
    : 'This item is currently under review by Campus Security.'
);

export const registerPublicItemRoutes = ({
  router,
  db,
  bucket,
  redis,
}: ItemsRouterDeps): void => {
  const listItemsLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    message: 'Too many item list requests. Please try again later.',
  });
  const itemDetailLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    message: 'Too many item detail requests. Please try again later.',
  });

  router.get(`${API_PREFIX}/items`, listItemsLimiter, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);
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

  router.get(`${API_PREFIX}/items/:id`, itemDetailLimiter, async (req, res) => {
    const itemId = getSingleRouteParam(req.params.id);
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    let item = null;
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
      throw new HttpError(403, 'FORBIDDEN', getItemVisibilityMessage(item));
    }

    res.json(item);
  });

  router.get(`${API_PREFIX}/items/:id/status`, itemDetailLimiter, async (req, res) => {
    const itemId = getSingleRouteParam(req.params.id);
    if (!itemId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    let item = null;
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
      throw new HttpError(403, 'FORBIDDEN', getItemVisibilityMessage(item));
    }

    res.json(itemsServiceModule.getPublicItemStatus(item));
  });
};
