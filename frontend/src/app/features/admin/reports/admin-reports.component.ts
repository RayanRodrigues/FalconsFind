import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertComponent } from '../../../shared/components/feedback/alert.component';
import { ButtonComponent } from '../../../shared/components/buttons/button.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';
import { AdminListToolbarComponent, type AdminToolbarStatusOption, type AdminToolbarViewOption } from '../../../shared/components/admin/admin-list-toolbar.component';
import { AdminMetricCardComponent } from '../../../shared/components/admin/admin-metric-card.component';
import { AdminReportTableComponent } from '../../../shared/components/admin/admin-report-table.component';
import { AdminModalShellComponent } from '../../../shared/components/admin/admin-modal-shell.component';
import { AdminReportDetailsModalComponent } from '../../../shared/components/admin/admin-report-details-modal.component';
import { ErrorService } from '../../../core/services/error.service';
import type { ErrorResponse } from '../../../models';
import type { AdminReport, ItemHistoryEvent, ItemHistoryResponse, ViewFilter } from './admin-reports.types';
import { AdminReportsApiService } from './admin-reports-api.service';
import {
  normalizeStatus, extractSuspiciousValue, statusClass, statusLabel,
  isArchived, isFlagged, suspiciousBadgeClass, rowClass,
  canValidate, canFlag, getPhotoUrls,
  getStatusTimeline, getFullHistoryEvents,
  getHistoryBadgeClass, getHistoryActorLabel, getHistoryActionLabel,
  hasHistoryMetadata, getHistoryEventLabel, getHistoryStatusChange,
} from './admin-reports.helpers';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AlertComponent,
    ButtonComponent,
    TextareaComponent,
    AdminListToolbarComponent,
    AdminMetricCardComponent,
    AdminReportTableComponent,
    AdminModalShellComponent,
    AdminReportDetailsModalComponent,
  ],
  templateUrl: './admin-reports.component.html',
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  private actionMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
  readonly viewOptions: AdminToolbarViewOption[] = [
    { label: 'Active', value: 'active', tone: 'primary' },
    { label: 'Archived', value: 'archived', tone: 'slate' },
    { label: 'All', value: 'all', tone: 'info' },
  ];
  readonly statusOptions: AdminToolbarStatusOption[] = [
    { label: 'All statuses', value: 'all' },
    { label: 'Pending', value: 'pending_validation' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Validated', value: 'validated' },
    { label: 'Claimed', value: 'claimed' },
    { label: 'Archived', value: 'archived' },
  ];

  constructor(
    private readonly adminReportsApi: AdminReportsApiService,
    private readonly errorService: ErrorService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnDestroy(): void {
    this.clearActionMessageTimeout();
  }

  get stats() {
    const visibleItems = this.getViewFilteredItems();

    const countByStatus = (statuses: string[]) =>
      visibleItems.filter((item) => statuses.includes(normalizeStatus(item.status))).length;

    return {
      total: visibleItems.length,
      pending: countByStatus(['pending_validation', 'pending']),
      validated: countByStatus(['validated', 'approved']),
      rejected: countByStatus(['rejected']),
      archived: visibleItems.filter((item) => isArchived(item)).length,
      suspicious: visibleItems.filter((item) => isFlagged(item)).length,
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
    this.setActionMessage('');

    this.adminReportsApi.listReports({ page: 1, limit: 100, kind: 'FOUND' }).subscribe({
      next: (res) => {
        this.allItems = (res.reports ?? []).map((item) => ({
          ...item,
          status: normalizeStatus(item.status || 'pending_validation'),
          isSuspicious: extractSuspiciousValue(item),
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
      const status = normalizeStatus(item.status);
      const ref = (item.referenceCode || '').toLowerCase();
      const flagReason = (item.flagReason || '').toLowerCase();
      const suspiciousText = isFlagged(item) ? 'suspicious flagged' : '';

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
    this.setActionMessage('');
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
    this.setActionMessage('');

    const duplicateIds = selected
      .filter((item) => item.id !== primaryId)
      .map((item) => item.id);

    this.adminReportsApi.mergeReports(primaryId, duplicateIds).subscribe({
      next: (response) => {
        if (this.selectedItem() && duplicateIds.includes(this.selectedItem()!.id)) {
          this.closeDetails();
        }

        this.selectedItems.set(new Set());
        this.selectedPrimaryMergeId.set('');
        this.mergeModalOpen.set(false);
        this.merging.set(false);
        this.setActionMessage(
          `Merged ${response.mergedReportIds.length + 1} reports. Kept "${response.primaryReport.title || primary.title || 'Untitled'}" as the primary report.`
        );
        this.load();
      },
      error: (err) => {
        this.merging.set(false);
        this.error.set(this.getFriendlyErrorMessage(err, 'Failed to merge the selected reports.'));
      },
    });
  }

  approve(id: string): void {
    if (this.activeRowId() || this.flagging()) return;

    this.activeRowId.set(id);
    this.setActionMessage('');
    this.error.set('');

    this.adminReportsApi.validateFoundReport(id).subscribe({
      next: () => {
        this.activeRowId.set(null);
        this.closeDetails();
        this.setActionMessage('Found item validated successfully.');
        this.load();
      },
      error: (err) => {
        this.activeRowId.set(null);
        this.error.set(this.getFriendlyErrorMessage(err, 'Failed to validate the found item.'));
      },
    });
  }

  openFlagModal(item: AdminReport): void {
    if (isFlagged(item) || this.flagging()) return;

    this.flagTargetItem.set(item);
    this.suspiciousReason = item.flagReason ?? '';
    this.flagModalOpen.set(true);
    this.error.set('');
    this.setActionMessage('');
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
    this.setActionMessage('');

    const reason = this.suspiciousReason.trim();

    if (!reason) {
      this.error.set('Please enter a reason before flagging this report.');
      return;
    }

    this.flagging.set(true);

    this.adminReportsApi.flagReport(item.id, reason).subscribe({
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
        this.setActionMessage('Report flagged as suspicious.');
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
      this.setActionMessage(`Reference code: ${referenceCode}`);
      return;
    }

    navigator.clipboard
      .writeText(referenceCode)
      .then(() => this.setActionMessage(`Copied ${referenceCode}.`, 2500))
      .catch(() => this.setActionMessage(`Reference code: ${referenceCode}`, 2500));
  }

  copyContactEmail(email?: string): void {
    if (!email) return;

    if (!isPlatformBrowser(this.platformId) || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.setActionMessage(`Contact email: ${email}`);
      return;
    }

    navigator.clipboard
      .writeText(email)
      .then(() => this.setActionMessage(`Copied ${email}.`, 2500))
      .catch(() => this.setActionMessage(`Contact email: ${email}`, 2500));
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

    this.adminReportsApi.getItemHistory(itemId).subscribe({
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

  getFullHistoryEvents(): ItemHistoryEvent[] {
    return getFullHistoryEvents(this.itemHistory());
  }

  readonly getHistoryBadgeClass = getHistoryBadgeClass;
  readonly getHistoryActorLabel = getHistoryActorLabel;
  readonly getHistoryActionLabel = getHistoryActionLabel;
  readonly hasHistoryMetadata = hasHistoryMetadata;
  readonly getHistoryEventLabel = getHistoryEventLabel;
  readonly getHistoryStatusChange = getHistoryStatusChange;

  private getAllowedRestoreTargetsForCurrentStatus(): Set<string> {
    const currentStatus = normalizeStatus(this.selectedItem()?.status);

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
    const currentStatus = normalizeStatus(selected?.status);
    const timeline = getStatusTimeline(this.itemHistory());
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
          .map((value) => normalizeStatus(value))
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
    this.setActionMessage('');

    this.adminReportsApi.restoreItemStatus(item.id, status).subscribe({
      next: () => {
        this.restoring.set(false);
        this.restoreModalOpen.set(false);
        this.setActionMessage(`Item restored to ${statusLabel(status)}.`);
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

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;
  readonly suspiciousBadgeClass = suspiciousBadgeClass;
  readonly isArchived = isArchived;
  readonly isFlagged = isFlagged;
  readonly rowClass = rowClass;
  readonly canValidate = canValidate;
  readonly canFlag = canFlag;
  readonly getPhotoUrls = getPhotoUrls;

  canOpenPhoto(item: AdminReport): boolean {
    return getPhotoUrls(item).length > 0;
  }

  getSelectedPhoto(item: AdminReport): string | null {
    const urls = getPhotoUrls(item);
    return urls.length === 0 ? null : (urls[this.selectedPhotoIndex()] ?? urls[0]);
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex.set(index);
  }

  trackById(_index: number, item: AdminReport): string {
    return item.id;
  }

  private getViewFilteredItems(): AdminReport[] {
    if (this.viewFilter === 'archived') {
      return this.allItems.filter((item) => isArchived(item));
    }

    if (this.viewFilter === 'all') {
      return [...this.allItems];
    }

    return this.allItems.filter((item) => !isArchived(item));
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

  private getFriendlyErrorMessage(err: unknown, fallback: string): string {
    const friendly = this.errorService.getUserFriendlyMessage(err as ErrorResponse);
    return friendly && friendly !== 'An error occurred. Please try again.' ? friendly : fallback;
  }

  private setActionMessage(message: string, autoClearMs?: number): void {
    this.actionMessage.set(message);
    this.clearActionMessageTimeout();

    if (message && autoClearMs && isPlatformBrowser(this.platformId)) {
      this.actionMessageTimeoutId = setTimeout(() => {
        this.actionMessage.set('');
        this.actionMessageTimeoutId = null;
      }, autoClearMs);
    }
  }

  private clearActionMessageTimeout(): void {
    if (this.actionMessageTimeoutId) {
      clearTimeout(this.actionMessageTimeoutId);
      this.actionMessageTimeoutId = null;
    }
  }
}
