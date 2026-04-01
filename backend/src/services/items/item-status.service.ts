import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { ItemStatus } from '../../contracts/index.js';
import type {
  RestoreItemStatusRequest,
  UpdateItemStatusRequest,
  UpdateItemStatusResponse,
} from '../../contracts/index.js';
import { recordItemHistoryEvent } from '../item-history.service.js';
import { ItemStatusConflictError, ItemStatusRestoreNotAllowedError, InvalidItemDataError } from './item-errors.js';
import {
  allowedStatusTransitions,
  createStatusPatch,
  getStatusHistoryEntries,
  getStatusSyncTargets,
} from './item-shared.js';
import type { ItemStatusHistoryRecord, ItemStatusUpdateActor } from './item-types.js';

export const recordArchivedHistory = async (
  db: Firestore,
  canonicalItemId: string,
  entityId: string,
  previousStatus: ItemStatus,
  archivedAt: string,
  actor: ItemStatusUpdateActor,
  referenceCode?: string,
  options: { transaction?: Transaction; summary?: string; automatic?: boolean } = {},
): Promise<void> => {
  await recordItemHistoryEvent(db, {
    itemId: canonicalItemId,
    entityType: 'ITEM',
    entityId,
    actionType: 'ITEM_ARCHIVED',
    timestamp: archivedAt,
    summary: options.summary ?? 'Item archived.',
    actor: { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role },
    metadata: { referenceCode, itemStatus: ItemStatus.ARCHIVED, automatic: options.automatic === true },
    changes: [{ field: 'status', previousValue: previousStatus, newValue: ItemStatus.ARCHIVED }],
  }, options);
};

export const recordStatusRestoredHistory = async (
  db: Firestore,
  canonicalItemId: string,
  entityId: string,
  previousStatus: ItemStatus,
  restoredStatus: ItemStatus,
  restoredAt: string,
  actor: ItemStatusUpdateActor,
  referenceCode?: string,
  options: { transaction?: Transaction } = {},
): Promise<void> => {
  await recordItemHistoryEvent(db, {
    itemId: canonicalItemId,
    entityType: 'ITEM',
    entityId,
    actionType: 'ITEM_STATUS_RESTORED',
    timestamp: restoredAt,
    summary: `Item status restored from ${previousStatus} to ${restoredStatus}.`,
    actor: { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role },
    metadata: {
      referenceCode,
      itemStatus: restoredStatus,
      restoredFromStatus: previousStatus,
      restoredToStatus: restoredStatus,
    },
    changes: [{ field: 'status', previousValue: previousStatus, newValue: restoredStatus }],
  }, options);
};

const writeStatusHistoryRecord = (
  db: Firestore,
  transaction: Transaction,
  itemId: string,
  previousStatus: ItemStatus,
  nextStatus: ItemStatus,
  actor: ItemStatusUpdateActor,
  changedAt: string,
) => {
  const historyRef = db.collection('itemStatusHistory').doc(randomUUID());
  transaction.set(historyRef, {
    itemId,
    previousStatus,
    nextStatus,
    changedAt,
    changedByUid: actor.uid,
    changedByEmail: actor.email ?? null,
    changedByRole: actor.role,
  } satisfies ItemStatusHistoryRecord);
};

export const updateItemStatus = async (
  db: Firestore,
  itemId: string,
  payload: UpdateItemStatusRequest,
  actor: ItemStatusUpdateActor,
): Promise<UpdateItemStatusResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const { primaryRef, primaryData, targetRefs, canonicalItemId, referenceCode } = await getStatusSyncTargets(transaction, db, itemId);
    const currentStatus = primaryData.status;
    if (!currentStatus || !Object.values(ItemStatus).includes(currentStatus)) throw new InvalidItemDataError();
    if (currentStatus === payload.status) throw new ItemStatusConflictError(`Item is already in status ${payload.status}.`);
    if (!allowedStatusTransitions[currentStatus].includes(payload.status)) {
      throw new ItemStatusConflictError(`Cannot change item status from ${currentStatus} to ${payload.status}.`);
    }

    const updatedAt = new Date().toISOString();
    const patch = createStatusPatch(payload.status, updatedAt, actor);
    for (const targetRef of targetRefs) transaction.update(targetRef, patch);
    writeStatusHistoryRecord(db, transaction, primaryRef.id, currentStatus, payload.status, actor, updatedAt);

    if (payload.status === ItemStatus.ARCHIVED) {
      await recordArchivedHistory(db, canonicalItemId, primaryRef.id, currentStatus, updatedAt, actor, referenceCode, {
        transaction,
        summary: 'Item archived by staff.',
      });
    }

    return {
      id: primaryRef.id,
      previousStatus: currentStatus,
      status: payload.status,
      updatedAt,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? null,
      updatedByRole: actor.role,
    };
  });
};

export const restoreItemStatus = async (
  db: Firestore,
  itemId: string,
  payload: RestoreItemStatusRequest,
  actor: ItemStatusUpdateActor,
): Promise<UpdateItemStatusResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const { primaryRef, primaryData, targetRefs, canonicalItemId, referenceCode } = await getStatusSyncTargets(transaction, db, itemId);
    const currentStatus = primaryData.status;
    if (!currentStatus || !Object.values(ItemStatus).includes(currentStatus)) throw new InvalidItemDataError();
    if (currentStatus === payload.status) throw new ItemStatusConflictError(`Item is already in status ${payload.status}.`);

    const historyEntries = await getStatusHistoryEntries(transaction, db, primaryRef.id);
    const availablePreviousStatuses = new Set<ItemStatus>();
    for (const entry of historyEntries) {
      availablePreviousStatuses.add(entry.previousStatus);
      if (entry.nextStatus !== currentStatus) availablePreviousStatuses.add(entry.nextStatus);
    }
    availablePreviousStatuses.delete(currentStatus);

    if (!availablePreviousStatuses.has(payload.status)) {
      throw new ItemStatusRestoreNotAllowedError(
        `Cannot restore item to ${payload.status} because that status is not available in this item's history.`,
      );
    }

    const updatedAt = new Date().toISOString();
    const patch = createStatusPatch(payload.status, updatedAt, actor);
    for (const targetRef of targetRefs) transaction.update(targetRef, patch);
    writeStatusHistoryRecord(db, transaction, primaryRef.id, currentStatus, payload.status, actor, updatedAt);
    await recordStatusRestoredHistory(db, canonicalItemId, primaryRef.id, currentStatus, payload.status, updatedAt, actor, referenceCode, { transaction });

    return {
      id: primaryRef.id,
      previousStatus: currentStatus,
      status: payload.status,
      updatedAt,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? null,
      updatedByRole: actor.role,
    };
  });
};
