import type { AdminReport, ItemHistoryEvent, ItemHistoryResponse } from './admin-reports.types';

export function normalizeStatus(status?: string): string {
  return (status || '').trim().toLowerCase();
}

export function normalizeHistoryActionType(actionType?: string): string {
  return (actionType || '').trim().toLowerCase();
}

export function statusClass(status?: string): string {
  const normalized = normalizeStatus(status);

  const map: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border-warning/30',
    pending_validation: 'bg-warning/15 text-warning border-warning/30',
    approved: 'bg-success/10 text-success border-success/30',
    validated: 'bg-success/10 text-success border-success/30',
    rejected: 'bg-error/10 text-error border-error/30',
    claimed: 'bg-info/10 text-info border-info/30',
    returned: 'bg-info/10 text-info border-info/30',
    archived: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
    reported: 'bg-warning/15 text-warning border-warning/30',
  };

  return map[normalized] ?? 'bg-[var(--color-border)]/20 text-[var(--color-text-secondary)] border-[var(--color-border)]';
}

export function statusLabel(status?: string): string {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case 'pending_validation': return 'Pending';
    case 'validated':
    case 'approved': return 'Validated';
    case 'claimed': return 'Claimed';
    case 'returned': return 'Returned';
    case 'rejected': return 'Rejected';
    case 'archived': return 'Archived';
    case 'reported': return 'Reported';
    default: return normalized
      ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      : 'Unknown';
  }
}

export function isArchived(item: AdminReport): boolean {
  return normalizeStatus(item.status) === 'archived';
}

export function isFlagged(item: AdminReport): boolean {
  return Boolean(item.isSuspicious);
}

export function suspiciousBadgeClass(item: AdminReport): string {
  return isFlagged(item)
    ? 'bg-primary/10 text-primary border-primary/30'
    : 'bg-[var(--color-border)]/20 text-[var(--color-text-secondary)] border-[var(--color-border)]';
}

export function rowClass(item: AdminReport): string {
  if (isArchived(item)) {
    return 'border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/80 hover:bg-[var(--color-surface-2)] transition-colors';
  }

  if (isFlagged(item)) {
    return 'border-b border-[var(--color-border)] bg-primary/5 hover:bg-primary/10 transition-colors';
  }

  return 'border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/70 transition-colors';
}

export function canValidate(item: AdminReport): boolean {
  const status = normalizeStatus(item.status);
  return status === 'pending_validation' || status === 'pending' || status === 'reported';
}

export function canFlag(item: AdminReport): boolean {
  return !isArchived(item) && !isFlagged(item);
}

export function getPhotoUrls(item: AdminReport): string[] {
  return [
    ...(Array.isArray(item.photoUrls) ? item.photoUrls : []),
    ...(item.photoUrl ? [item.photoUrl] : []),
  ].filter(
    (value, index, all) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      all.indexOf(value) === index,
  );
}

export function extractSuspiciousValue(item: Partial<AdminReport>): boolean {
  return Boolean(item.isSuspicious);
}

export function getStatusTimeline(history: ItemHistoryResponse | null): ItemHistoryEvent[] {
  if (!history) return [];

  return history.events.filter((event) =>
    (event.changes ?? []).some((change) => change.field === 'status') ||
    typeof event.metadata?.itemStatus === 'string',
  );
}

export function getFullHistoryEvents(history: ItemHistoryResponse | null): ItemHistoryEvent[] {
  if (!history) return [];

  return [...history.events].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function getHistoryBadgeClass(event: ItemHistoryEvent): string {
  const type = normalizeHistoryActionType(event.actionType);

  if (type.includes('flag') || type.includes('suspicious')) {
    return 'bg-primary/10 text-primary border-primary/30';
  }

  if (type.includes('restore') || type.includes('status') || type.includes('validate') || type.includes('approved') || type.includes('update')) {
    return 'bg-info/10 text-info border-info/30';
  }

  if (type.includes('claim')) {
    return 'bg-success/10 text-success border-success/30';
  }

  if (type.includes('archive')) {
    return 'bg-slate-100 text-slate-700 border-slate-300';
  }

  return 'bg-[var(--color-border)]/20 text-[var(--color-text-secondary)] border-[var(--color-border)]';
}

export function getHistoryActorLabel(event: ItemHistoryEvent): string {
  if (event.actor?.email?.trim()) return event.actor.email.trim();
  if (event.actor?.type?.trim()) return event.actor.type.trim();
  return 'System';
}

export function getHistoryActionLabel(event: ItemHistoryEvent): string {
  const actionType = normalizeHistoryActionType(event.actionType);

  if (actionType.includes('flag') || actionType.includes('suspicious')) return 'Flagged';
  if (actionType.includes('restore')) return 'Restored';
  if (actionType.includes('validate') || actionType.includes('approved')) return 'Validated';
  if (actionType.includes('archive')) return 'Archived';
  if (actionType.includes('claim')) return 'Claim Activity';
  if (actionType.includes('report') || actionType.includes('create')) return 'Report Activity';
  if (actionType.includes('status') || actionType.includes('update')) return 'Status Update';

  return event.actionType
    ? event.actionType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'History Event';
}

export function hasHistoryMetadata(event: ItemHistoryEvent): boolean {
  return Boolean(
    event.actor?.email ||
    event.actor?.type ||
    event.entityType ||
    event.metadata?.referenceCode ||
    event.metadata?.claimStatus ||
    event.metadata?.reportKind ||
    event.metadata?.flagReason,
  );
}

export function getHistoryEventLabel(event: ItemHistoryEvent): string {
  return event.summary || event.actionType.replace(/_/g, ' ');
}

export function getHistoryStatusChange(event: ItemHistoryEvent): { previous?: string; next?: string } | null {
  const statusChange = (event.changes ?? []).find((change) => change.field === 'status');

  if (statusChange) {
    return {
      previous: typeof statusChange.previousValue === 'string' ? statusChange.previousValue : undefined,
      next: typeof statusChange.newValue === 'string' ? statusChange.newValue : undefined,
    };
  }

  if (typeof event.metadata?.itemStatus === 'string') {
    return { next: event.metadata.itemStatus };
  }

  return null;
}
