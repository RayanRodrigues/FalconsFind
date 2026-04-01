import type { Firestore } from 'firebase-admin/firestore';
import type { RedisClient } from '../../bootstrap/redis.js';
import { ItemStatus } from '../../contracts/index.js';
import { invalidateAdminReportsCache } from '../reports/report-admin-query-cache.service.js';
import { ItemNotFoundError } from './item-errors.js';
import { invalidatePublicItemsCache } from './item-query-cache.service.js';
import { recordArchivedHistory } from './item-status.service.js';
import { createStatusPatch, getStatusSyncTargets, writeStatusHistoryRecord } from './item-shared.js';
import type { ItemAutomationActor, StoredItem } from './item-types.js';

const AUTO_ARCHIVE_AFTER_MONTHS = 6;
const AUTO_ARCHIVE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const SYSTEM_AUTO_ARCHIVE_ACTOR: ItemAutomationActor = {
  type: 'SYSTEM',
  uid: 'system-auto-archive',
  email: null,
  role: 'SYSTEM',
};

const getRetentionCutoff = (now: Date = new Date()): Date => {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - AUTO_ARCHIVE_AFTER_MONTHS);
  return cutoff;
};

const parseReportedAtMs = (dateReported: unknown): number | null => {
  if (typeof dateReported !== 'string') return null;
  const reportedAtMs = Date.parse(dateReported);
  return Number.isNaN(reportedAtMs) ? null : reportedAtMs;
};

export const isItemEligibleForAutoArchive = (
  item: Pick<StoredItem, 'archivedAt' | 'dateReported' | 'kind' | 'status'>,
  now: Date = new Date(),
): boolean => {
  if (item.kind !== 'FOUND' || item.status !== ItemStatus.VALIDATED || item.archivedAt) {
    return false;
  }

  const reportedAtMs = parseReportedAtMs(item.dateReported);
  if (reportedAtMs === null) {
    return false;
  }

  return reportedAtMs <= getRetentionCutoff(now).getTime();
};

export const archiveItemIfEligible = async (
  db: Firestore,
  itemId: string,
  now: Date = new Date(),
): Promise<boolean> => {
  try {
    return await db.runTransaction(async (transaction) => {
      const { primaryRef, primaryData, targetRefs, canonicalItemId, referenceCode, kind } = await getStatusSyncTargets(transaction, db, itemId);
      if (!isItemEligibleForAutoArchive({ ...primaryData, kind }, now)) {
        return false;
      }

      const archivedAt = now.toISOString();
      const patch = createStatusPatch(ItemStatus.ARCHIVED, archivedAt, SYSTEM_AUTO_ARCHIVE_ACTOR);
      for (const targetRef of targetRefs) transaction.update(targetRef, patch);
      writeStatusHistoryRecord(
        db,
        transaction,
        primaryRef.id,
        ItemStatus.VALIDATED,
        ItemStatus.ARCHIVED,
        SYSTEM_AUTO_ARCHIVE_ACTOR,
        archivedAt,
      );
      await recordArchivedHistory(
        db,
        canonicalItemId,
        primaryRef.id,
        ItemStatus.VALIDATED,
        archivedAt,
        SYSTEM_AUTO_ARCHIVE_ACTOR,
        referenceCode,
        {
          transaction,
          automatic: true,
          summary: 'Item archived automatically after 6 months without a claim.',
        },
      );

      return true;
    });
  } catch (error) {
    if (error instanceof ItemNotFoundError) {
      return false;
    }

    throw error;
  }
};

export const archiveExpiredUnclaimedItems = async (
  db: Firestore,
  now: Date = new Date(),
): Promise<number> => {
  const reportsSnap = await db.collection('reports')
    .where('kind', '==', 'FOUND')
    .where('status', '==', ItemStatus.VALIDATED)
    .get();

  let archivedCount = 0;
  for (const doc of reportsSnap.docs) {
    if (await archiveItemIfEligible(db, doc.id, now)) {
      archivedCount += 1;
    }
  }

  return archivedCount;
};

export const invalidateCachesAfterAutoArchive = async (
  redis: RedisClient | null,
  archivedCount: number,
): Promise<void> => {
  if (archivedCount <= 0) {
    return;
  }

  await Promise.all([
    invalidatePublicItemsCache(redis),
    invalidateAdminReportsCache(redis),
  ]);
};

export const runAutoArchiveSweep = async (
  db: Firestore,
  redis: RedisClient | null,
  now: Date = new Date(),
): Promise<number> => {
  const archivedCount = await archiveExpiredUnclaimedItems(db, now);
  await invalidateCachesAfterAutoArchive(redis, archivedCount);
  return archivedCount;
};

export const startAutoArchiveSweep = (
  db: Firestore,
  redis: RedisClient | null,
): void => {
  void runAutoArchiveSweep(db, redis);

  const interval = setInterval(() => {
    void runAutoArchiveSweep(db, redis);
  }, AUTO_ARCHIVE_SWEEP_INTERVAL_MS);

  interval.unref();
};
