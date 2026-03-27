import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AlertComponent } from '../../../shared/components/feedback/alert.component';
import { ButtonComponent } from '../../../shared/components/buttons/button.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';
import { ErrorService } from '../../../core/services/error.service';
import type { ErrorResponse } from '../../../models';

type AdminReport = {
  id: string;
  kind: 'LOST' | 'FOUND';
  title: string;
  description?: string;
  category?: string;
  location?: string;
  dateReported: string;
  status: string;
  referenceCode: string;
  contactEmail?: string;
  photoUrl?: string;
  photoUrls?: string[];
  archivedAt?: string | null;
  isSuspicious?: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
};

type AdminReportsResponse = {
  reports: AdminReport[];
  total: number;
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Record<string, number>;
  };
};

type ViewFilter = 'active' | 'archived' | 'all';

type ItemHistoryChange = {
  field: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
};

type ItemHistoryEvent = {
  id: string;
  itemId: string;
  entityType: 'REPORT' | 'CLAIM' | 'ITEM';
  entityId: string;
  actionType: string;
  timestamp: string;
  summary: string;
  actor?: {
    type?: string;
    uid?: string;
    email?: string;
  };
  metadata?: {
    itemStatus?: string;
    referenceCode?: string;
    reportKind?: string;
    claimStatus?: string;
    isSuspicious?: boolean;
    flagReason?: string;
    flaggedAt?: string;
  };
  changes?: ItemHistoryChange[];
};

type ItemHistoryResponse = {
  itemId: string;
  resolvedFrom?: string;
  title?: string;
  referenceCode?: string;
  currentStatus?: string;
  total: number;
  events: ItemHistoryEvent[];
};

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AlertComponent,
    ButtonComponent,
    TextareaComponent,
  ],
  templateUrl: './admin-reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly activeRowId = signal<string | null>(null);
  readonly selectedItem = signal<AdminReport | null>(null);
  readonly selectedPhotoIndex = signal(0);

  readonly itemHistory = signal<ItemHistoryResponse | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly selectedRestoreStatus = signal('');
  readonly restoreModalOpen = signal(false);
  readonly restoring = signal(false);

  readonly flagModalOpen = signal(false);
  readonly flagging = signal(false);
  readonly flagTargetItem = signal<AdminReport | null>(null);

  readonly selectedItems = signal<Set<string>>(new Set());
  readonly mergeModalOpen = signal(false);
  readonly merging = signal(false);
  readonly selectedPrimaryMergeId = signal('');

  allItems: AdminReport[] = [];
  filteredItems: AdminReport[] = [];

  searchTerm = '';
  statusFilter = 'all';
  viewFilter: ViewFilter = 'active';
  suspiciousReason = '';

  constructor(
    private readonly http: HttpClient,
    private readonly errorService: ErrorService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  get stats() {
    const visibleItems = this.getViewFilteredItems();

    const countByStatus = (statuses: string[]) =>
      visibleItems.filter((item) => statuses.includes(this.normalizeStatus(item.status))).length;

    return {
      total: visibleItems.length,
      pending: countByStatus(['pending_validation', 'pending']),
      validated: countByStatus(['validated', 'approved']),
      rejected: countByStatus(['rejected']),
      archived: visibleItems.filter((item) => this.isArchived(item)).length,
      suspicious: visibleItems.filter((item) => this.isFlagged(item)).length,
    };
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
      return;
    }

    this.loading.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.actionMessage.set('');

    this.http.get<AdminReportsResponse>('/admin/reports?page=1&limit=100&kind=FOUND').subscribe({
      next: (res) => {
        this.allItems = (res.reports ?? []).map((item) => ({
          ...item,
          status: this.normalizeStatus(item.status || 'pending_validation'),
          isSuspicious: this.extractSuspiciousValue(item),
          flagReason: item.flagReason ?? null,
          flaggedAt: item.flaggedAt ?? null,
        }));
        this.applyFilters();
        this.pruneSelectedItems();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.getFriendlyErrorMessage(err, 'Failed to load reports.'));
        this.loading.set(false);
      },
    });
  }

  setViewFilter(filter: ViewFilter): void {
    this.viewFilter = filter;
    this.applyFilters();
  }

  applyFilters(): void {
    const kw = this.searchTerm.trim().toLowerCase();

    this.filteredItems = this.getViewFilteredItems().filter((item) => {
      const name = (item.title || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const status = this.normalizeStatus(item.status);
      const ref = (item.referenceCode || '').toLowerCase();
      const flagReason = (item.flagReason || '').toLowerCase();
      const suspiciousText = this.isFlagged(item) ? 'suspicious flagged' : '';

      const kwMatch =
        !kw ||
        name.includes(kw) ||
        loc.includes(kw) ||
        status.includes(kw) ||
        ref.includes(kw) ||
        flagReason.includes(kw) ||
        suspiciousText.includes(kw);

      const statusMatch = this.statusFilter === 'all' || status === this.statusFilter;

      return kwMatch && statusMatch;
    });

    this.pruneSelectedItems();
  }

  toggleSelect(id: string): void {
    const current = new Set(this.selectedItems());

    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }

    this.selectedItems.set(current);

    if (this.selectedPrimaryMergeId() && !this.selectedItems().has(this.selectedPrimaryMergeId())) {
      const firstRemaining = Array.from(this.selectedItems())[0] ?? '';
      this.selectedPrimaryMergeId.set(firstRemaining);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedItems().has(id);
  }

  canMergeSelected(): boolean {
    return this.selectedItems().size >= 2;
  }

  getSelectedMergeItems(): AdminReport[] {
    const selectedIds = this.selectedItems();
    return this.filteredItems.filter((item) => selectedIds.has(item.id));
  }

  openMergeModal(): void {
    if (!this.canMergeSelected()) return;

    const selected = this.getSelectedMergeItems();
    this.selectedPrimaryMergeId.set(selected[0]?.id ?? '');
    this.mergeModalOpen.set(true);
    this.error.set('');
    this.actionMessage.set('');
  }

  closeMergeModal(): void {
    if (this.merging()) return;

    this.mergeModalOpen.set(false);
    this.selectedPrimaryMergeId.set('');
  }

  setPrimaryMergeId(id: string): void {
    this.selectedPrimaryMergeId.set(id);
  }

  confirmMerge(): void {
    const selected = this.getSelectedMergeItems();
    const primaryId = this.selectedPrimaryMergeId();

    if (selected.length < 2) {
      this.error.set('Please select at least two reports to merge.');
      return;
    }

    if (!primaryId) {
      this.error.set('Please choose a primary report to keep.');
      return;
    }

    const primary = selected.find((item) => item.id === primaryId);
    if (!primary) {
      this.error.set('Selected primary report was not found.');
      return;
    }

    this.merging.set(true);
    this.error.set('');
    this.actionMessage.set('');

    const duplicateIds = selected
      .filter((item) => item.id !== primaryId)
      .map((item) => item.id);

    this.allItems = this.allItems.filter((item) => !duplicateIds.includes(item.id));
    this.applyFilters();

    if (this.selectedItem() && duplicateIds.includes(this.selectedItem()!.id)) {
      this.closeDetails();
    }

    this.selectedItems.set(new Set());
    this.selectedPrimaryMergeId.set('');
    this.mergeModalOpen.set(false);
    this.merging.set(false);

    this.actionMessage.set(
      `Merged ${duplicateIds.length + 1} reports. Kept "${primary.title || 'Untitled'}" as the primary report.`
    );
  }

  approve(id: string): void {
    if (this.activeRowId() || this.flagging()) return;

    this.activeRowId.set(id);
    this.actionMessage.set('');
    this.error.set('');

    this.http.patch(`/reports/found/${id}/validate`, {}).subscribe({
      next: () => {
        this.activeRowId.set(null);
        this.closeDetails();
        this.actionMessage.set('Found item validated successfully.');
        this.load();
      },
      error: (err) => {
        this.activeRowId.set(null);
        this.error.set(this.getFriendlyErrorMessage(err, 'Failed to validate the found item.'));
      },
    });
  }

  openFlagModal(item: AdminReport): void {
    if (this.isFlagged(item) || this.flagging()) return;

    this.flagTargetItem.set(item);
    this.suspiciousReason = item.flagReason ?? '';
    this.flagModalOpen.set(true);
    this.error.set('');
    this.actionMessage.set('');
  }

  closeFlagModal(): void {
    if (this.flagging()) return;

    this.flagModalOpen.set(false);
    this.flagTargetItem.set(null);
    this.suspiciousReason = '';
  }

  submitFlagReport(): void {
    const item = this.flagTargetItem();
    if (!item || this.flagging()) return;

    this.error.set('');
    this.actionMessage.set('');

    const reason = this.suspiciousReason.trim();

    if (!reason) {
      this.error.set('Please enter a reason before flagging this report.');
      return;
    }

    this.flagging.set(true);

    this.http.patch<{
      id: string;
      isSuspicious: boolean;
      suspiciousReason?: string | null;
      suspiciousFlaggedAt?: string | null;
    }>(`/admin/reports/${item.id}/flag`, {
      suspiciousReason: reason,
    }).subscribe({
      next: (response) => {
        const flaggedAt = response?.suspiciousFlaggedAt ?? new Date().toISOString();
        const savedReason = response?.suspiciousReason ?? reason;

        this.allItems = this.allItems.map((report) =>
          report.id === item.id
            ? {
                ...report,
                isSuspicious: true,
                flagReason: savedReason,
                flaggedAt,
              }
            : report,
        );

        this.filteredItems = this.filteredItems.map((report) =>
          report.id === item.id
            ? {
                ...report,
                isSuspicious: true,
                flagReason: savedReason,
                flaggedAt,
              }
            : report,
        );

        if (this.selectedItem()?.id === item.id) {
          this.selectedItem.set({
            ...this.selectedItem()!,
            isSuspicious: true,
            flagReason: savedReason,
            flaggedAt,
          });
        }

        this.flagging.set(false);
        this.flagModalOpen.set(false);
        this.flagTargetItem.set(null);
        this.suspiciousReason = '';
        this.error.set('');
        this.actionMessage.set('Report flagged as suspicious.');
      },
      error: (err) => {
        this.flagging.set(false);
        this.error.set(
          err?.error?.message ||
          err?.error?.error ||
          err?.error?.details ||
          'Failed to flag report as suspicious.'
        );
      },
    });
  }

  copyReferenceCode(referenceCode: string): void {
    if (!isPlatformBrowser(this.platformId) || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.actionMessage.set(`Reference code: ${referenceCode}`);
      return;
    }

    navigator.clipboard
      .writeText(referenceCode)
      .then(() => this.actionMessage.set(`Copied ${referenceCode}.`))
      .catch(() => this.actionMessage.set(`Reference code: ${referenceCode}`));
  }

  copyContactEmail(email?: string): void {
    if (!email) return;

    if (!isPlatformBrowser(this.platformId) || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.actionMessage.set(`Contact email: ${email}`);
      return;
    }

    navigator.clipboard
      .writeText(email)
      .then(() => this.actionMessage.set(`Copied ${email}.`))
      .catch(() => this.actionMessage.set(`Contact email: ${email}`));
  }

  openDetails(item: AdminReport): void {
    this.selectedItem.set(item);
    this.selectedPhotoIndex.set(0);
    this.selectedRestoreStatus.set('');
    this.restoreModalOpen.set(false);
    this.loadItemHistory(item.id);
  }

  closeDetails(): void {
    this.selectedItem.set(null);
    this.selectedPhotoIndex.set(0);
    this.itemHistory.set(null);
    this.historyError.set('');
    this.historyLoading.set(false);
    this.selectedRestoreStatus.set('');
    this.restoreModalOpen.set(false);
    this.restoring.set(false);
  }

  loadItemHistory(itemId: string): void {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.itemHistory.set(null);

    this.http.get<ItemHistoryResponse>(`/admin/items/${itemId}/history`).subscribe({
      next: (history) => {
        this.itemHistory.set(history);
        this.historyLoading.set(false);
      },
      error: (err) => {
        this.historyError.set(this.getFriendlyErrorMessage(err, 'Failed to load item history.'));
        this.historyLoading.set(false);
      },
    });
  }

  getStatusTimeline(): ItemHistoryEvent[] {
    const history = this.itemHistory();
    if (!history) return [];

    return history.events.filter((event) =>
      (event.changes ?? []).some((change) => change.field === 'status') ||
      typeof event.metadata?.itemStatus === 'string',
    );
  }

  getFullHistoryEvents(): ItemHistoryEvent[] {
    const history = this.itemHistory();
    if (!history) return [];

    return [...history.events].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    });
  }

  getHistoryBadgeClass(event: ItemHistoryEvent): string {
    const type = this.normalizeHistoryActionType(event.actionType);

    if (
      type.includes('flag') ||
      type.includes('suspicious')
    ) {
      return 'bg-primary/10 text-primary border-primary/30';
    }

    if (
      type.includes('restore') ||
      type.includes('status') ||
      type.includes('validate') ||
      type.includes('approved') ||
      type.includes('update')
    ) {
      return 'bg-info/10 text-info border-info/30';
    }

    if (
      type.includes('claim')
    ) {
      return 'bg-success/10 text-success border-success/30';
    }

    if (
      type.includes('archive')
    ) {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }

    return 'bg-border/20 text-text-secondary border-border';
  }

  getHistoryActorLabel(event: ItemHistoryEvent): string {
    if (event.actor?.email?.trim()) {
      return event.actor.email.trim();
    }

    if (event.actor?.type?.trim()) {
      return event.actor.type.trim();
    }

    return 'System';
  }

  getHistoryActionLabel(event: ItemHistoryEvent): string {
    const actionType = this.normalizeHistoryActionType(event.actionType);

    if (actionType.includes('flag') || actionType.includes('suspicious')) {
      return 'Flagged';
    }

    if (actionType.includes('restore')) {
      return 'Restored';
    }

    if (actionType.includes('validate') || actionType.includes('approved')) {
      return 'Validated';
    }

    if (actionType.includes('archive')) {
      return 'Archived';
    }

    if (actionType.includes('claim')) {
      return 'Claim Activity';
    }

    if (actionType.includes('report') || actionType.includes('create')) {
      return 'Report Activity';
    }

    if (actionType.includes('status') || actionType.includes('update')) {
      return 'Status Update';
    }

    return event.actionType
      ? event.actionType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      : 'History Event';
  }

  hasHistoryMetadata(event: ItemHistoryEvent): boolean {
    return Boolean(
      event.actor?.email ||
      event.actor?.type ||
      event.entityType ||
      event.metadata?.referenceCode ||
      event.metadata?.claimStatus ||
      event.metadata?.reportKind ||
      event.metadata?.flagReason
    );
  }

  private getAllowedRestoreTargetsForCurrentStatus(): Set<string> {
    const currentStatus = this.normalizeStatus(this.selectedItem()?.status);

    const allowedByCurrent: Record<string, string[]> = {
      pending_validation: ['validated'],
      pending: ['validated'],
      reported: ['validated'],
      validated: ['claimed', 'archived'],
      claimed: ['returned', 'archived'],
      returned: ['archived'],
      archived: [],
    };

    return new Set(allowedByCurrent[currentStatus] ?? []);
  }

  getRestoreOptions(): string[] {
    const selected = this.selectedItem();
    const currentStatus = this.normalizeStatus(selected?.status);
    const timeline = this.getStatusTimeline();
    const allowedTargets = this.getAllowedRestoreTargetsForCurrentStatus();

    const rawStatuses = timeline.flatMap((event) => {
      const fromChanges = (event.changes ?? [])
        .filter((change) => change.field === 'status')
        .flatMap((change) => [change.previousValue, change.newValue]);

      const fromMetadata = typeof event.metadata?.itemStatus === 'string'
        ? [event.metadata.itemStatus]
        : [];

      return [...fromChanges, ...fromMetadata];
    });

    return Array.from(
      new Set(
        rawStatuses
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => this.normalizeStatus(value))
          .filter((value) =>
            value.length > 0 &&
            value !== currentStatus &&
            allowedTargets.has(value),
          ),
      ),
    );
  }

  canRestore(): boolean {
    return this.getRestoreOptions().length > 0;
  }

  openRestoreModal(): void {
    if (!this.selectedRestoreStatus()) return;
    this.restoreModalOpen.set(true);
  }

  closeRestoreModal(): void {
    this.restoreModalOpen.set(false);
  }

  restoreStatus(): void {
    const item = this.selectedItem();
    const status = this.selectedRestoreStatus();

    if (!item || !status) return;

    this.restoring.set(true);
    this.error.set('');
    this.actionMessage.set('');

    this.http.patch(`/admin/items/${item.id}/status`, {
      status: status.toUpperCase(),
    }).subscribe({
      next: () => {
        this.restoring.set(false);
        this.restoreModalOpen.set(false);
        this.actionMessage.set(`Item restored to ${this.statusLabel(status)}.`);
        this.closeDetails();
        this.load();
      },
      error: (err) => {
        this.restoring.set(false);
        this.restoreModalOpen.set(false);
        this.error.set(this.getFriendlyErrorMessage(err, 'Restore failed. That status change is not allowed.'));
      },
    });
  }

  openPhoto(photoUrl?: string): void {
    if (!photoUrl || !isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;
    window.open(photoUrl, '_blank', 'noopener,noreferrer');
  }

  statusClass(status?: string): string {
    const normalized = this.normalizeStatus(status);

    const map: Record<string, string> = {
      pending: 'bg-warning/15 text-warning border-warning/30',
      pending_validation: 'bg-warning/15 text-warning border-warning/30',
      approved: 'bg-success/10 text-success border-success/30',
      validated: 'bg-success/10 text-success border-success/30',
      rejected: 'bg-error/10 text-error border-error/30',
      claimed: 'bg-info/10 text-info border-info/30',
      returned: 'bg-info/10 text-info border-info/30',
      archived: 'bg-slate-100 text-slate-700 border-slate-300',
      reported: 'bg-warning/15 text-warning border-warning/30',
    };

    return map[normalized] ?? 'bg-border/20 text-text-secondary border-border';
  }

  suspiciousBadgeClass(item: AdminReport): string {
    return this.isFlagged(item)
      ? 'bg-primary/10 text-primary border-primary/30'
      : 'bg-border/20 text-text-secondary border-border';
  }

  statusLabel(status?: string): string {
    const normalized = this.normalizeStatus(status);

    switch (normalized) {
      case 'pending_validation':
        return 'Pending';
      case 'validated':
      case 'approved':
        return 'Validated';
      case 'claimed':
        return 'Claimed';
      case 'returned':
        return 'Returned';
      case 'rejected':
        return 'Rejected';
      case 'archived':
        return 'Archived';
      case 'reported':
        return 'Reported';
      default:
        return normalized
          ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
          : 'Unknown';
    }
  }

  getHistoryEventLabel(event: ItemHistoryEvent): string {
    return event.summary || event.actionType.replace(/_/g, ' ');
  }

  getHistoryStatusChange(event: ItemHistoryEvent): { previous?: string; next?: string } | null {
    const statusChange = (event.changes ?? []).find((change) => change.field === 'status');

    if (statusChange) {
      return {
        previous: typeof statusChange.previousValue === 'string' ? statusChange.previousValue : undefined,
        next: typeof statusChange.newValue === 'string' ? statusChange.newValue : undefined,
      };
    }

    if (typeof event.metadata?.itemStatus === 'string') {
      return {
        next: event.metadata.itemStatus,
      };
    }

    return null;
  }

  isArchived(item: AdminReport): boolean {
    return this.normalizeStatus(item.status) === 'archived';
  }

  isFlagged(item: AdminReport): boolean {
    return Boolean(item.isSuspicious);
  }

  rowClass(item: AdminReport): string {
    if (this.isArchived(item)) {
      return 'border-b border-border/40 bg-slate-50/70 hover:bg-slate-100/70 transition-colors';
    }

    if (this.isFlagged(item)) {
      return 'border-b border-border/40 bg-primary/5 hover:bg-primary/10 transition-colors';
    }

    return 'border-b border-border/40 hover:bg-neutral-base/50 transition-colors';
  }

  canValidate(item: AdminReport): boolean {
    const status = this.normalizeStatus(item.status);
    return status === 'pending_validation' || status === 'pending' || status === 'reported';
  }

  canFlag(item: AdminReport): boolean {
    return !this.isArchived(item) && !this.isFlagged(item);
  }

  canOpenPhoto(item: AdminReport): boolean {
    return this.getPhotoUrls(item).length > 0;
  }

  getPhotoUrls(item: AdminReport): string[] {
    const urls = [
      ...(Array.isArray(item.photoUrls) ? item.photoUrls : []),
      ...(item.photoUrl ? [item.photoUrl] : []),
    ].filter(
      (value, index, all) =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        all.indexOf(value) === index,
    );

    return urls;
  }

  getSelectedPhoto(item: AdminReport): string | null {
    const urls = this.getPhotoUrls(item);
    if (urls.length === 0) {
      return null;
    }

    return urls[this.selectedPhotoIndex()] ?? urls[0];
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex.set(index);
  }

  trackById(_index: number, item: AdminReport): string {
    return item.id;
  }

  trackHistoryEvent(_index: number, event: ItemHistoryEvent): string {
    return event.id;
  }

  private getViewFilteredItems(): AdminReport[] {
    if (this.viewFilter === 'archived') {
      return this.allItems.filter((item) => this.isArchived(item));
    }

    if (this.viewFilter === 'all') {
      return [...this.allItems];
    }

    return this.allItems.filter((item) => !this.isArchived(item));
  }

  private pruneSelectedItems(): void {
    const visibleIds = new Set(this.filteredItems.map((item) => item.id));
    const next = new Set(
      Array.from(this.selectedItems()).filter((id) => visibleIds.has(id)),
    );

    this.selectedItems.set(next);

    if (this.selectedPrimaryMergeId() && !next.has(this.selectedPrimaryMergeId())) {
      this.selectedPrimaryMergeId.set(Array.from(next)[0] ?? '');
    }
  }

  private normalizeStatus(status?: string): string {
    return (status || '').trim().toLowerCase();
  }

  private normalizeHistoryActionType(actionType?: string): string {
    return (actionType || '').trim().toLowerCase();
  }

  private extractSuspiciousValue(item: Partial<AdminReport>): boolean {
    return Boolean(item.isSuspicious);
  }

  private getFriendlyErrorMessage(err: unknown, fallback: string): string {
    const friendly = this.errorService.getUserFriendlyMessage(err as ErrorResponse);
    return friendly && friendly !== 'An error occurred. Please try again.' ? friendly : fallback;
  }
}