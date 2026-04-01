import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { AdminReport } from '../../../features/admin/reports/admin-reports.types';

@Component({
  selector: 'app-admin-report-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-neutral-base/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Select</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Report Overview</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items; track item.id) {
              <tr [class]="rowClass(item)">
                <td class="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    [checked]="selectedIds.has(item.id)"
                    (change)="toggleSelect.emit(item.id)"
                    class="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    aria-label="Select report"
                  />
                </td>

                <td class="px-4 py-4 min-w-[420px]">
                  <div class="space-y-3">
                    <div class="flex flex-wrap items-start gap-2">
                      <p class="text-lg font-semibold text-text-primary mb-0 leading-6">{{ item.title || 'Untitled' }}</p>

                      @if (isFlagged(item)) {
                        <span
                          class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                          [class]="suspiciousBadgeClass(item)"
                        >
                          Suspicious
                        </span>
                      }
                    </div>

                    <p class="text-sm text-text-secondary mb-0 line-clamp-2 leading-6">
                      {{ item.description || 'No additional description was provided for this report.' }}
                    </p>

                    <div class="flex flex-wrap gap-2">
                      <span class="inline-flex items-center rounded-full border border-border/70 bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                        {{ item.referenceCode }}
                      </span>

                      @if (item.location) {
                        <span class="inline-flex items-center rounded-full border border-border/70 bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                          {{ item.location }}
                        </span>
                      }
                    </div>

                    @if (isFlagged(item) && item.flagReason) {
                      <p class="text-[12px] text-primary mb-0">
                        <span class="font-semibold">Flag reason:</span> {{ item.flagReason }}
                      </p>
                    }

                    <p class="text-[12px] text-text-secondary mb-0">
                      Submitted {{ item.dateReported | date: 'mediumDate' }}
                    </p>
                  </div>
                </td>

                <td class="px-4 py-4 align-top min-w-[200px]">
                  <div class="flex flex-col items-start gap-2">
                    <span
                      class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      [class]="statusClass(item.status)"
                    >
                      {{ statusLabel(item.status) }}
                    </span>

                    @if (isFlagged(item)) {
                      <span
                        class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                        [class]="suspiciousBadgeClass(item)"
                      >
                        Flagged
                      </span>
                    }
                  </div>
                </td>

                <td class="px-4 py-4 align-top min-w-[220px]">
                  <div class="flex flex-col items-start gap-3">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="details.emit(item)"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-sm hover:bg-primary/15 transition-colors"
                        [attr.aria-label]="'View details for ' + (item.title || 'report')"
                        title="View Details"
                      >
                        <svg style="width:16px;height:16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      <div class="relative">
                        <button
                          type="button"
                          (click)="toggleMenu(item.id)"
                          class="inline-flex items-center gap-1 rounded-full border border-border/80 bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-semibold text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
                          [attr.aria-expanded]="openMenuId === item.id"
                          [attr.aria-label]="'More actions for ' + (item.title || 'report')"
                        >
                          More
                          <svg style="width:14px;height:14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        @if (openMenuId === item.id) {
                          <div class="absolute left-0 top-full z-10 mt-2 min-w-[150px] rounded-xl border border-border/70 bg-[var(--color-surface)] p-1.5 shadow-lg">
                            <button
                              type="button"
                              (click)="handleCopyReference(item.referenceCode)"
                              class="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-neutral-base/70 transition-colors"
                            >
                              Copy Ref
                            </button>

                            @if (item.contactEmail) {
                              <button
                                type="button"
                                (click)="handleCopyEmail(item.contactEmail)"
                                class="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-neutral-base/70 transition-colors"
                              >
                                Copy Email
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="flag.emit(item)"
                      [disabled]="!canFlag(item)"
                      class="inline-flex items-center px-1 py-0 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
                      [class]="canFlag(item)
                        ? 'text-primary/80 hover:text-primary'
                        : 'text-text-secondary/70 cursor-not-allowed'"
                    >
                      {{ canFlag(item) ? 'Flag Suspicious' : 'Flagged or unavailable' }}
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminReportTableComponent {
  openMenuId: string | null = null;

  @Input() items: AdminReport[] = [];
  @Input() selectedIds: Set<string> = new Set();
  @Input() rowClass: (item: AdminReport) => string = () => '';
  @Input() statusClass: (status?: string) => string = () => '';
  @Input() statusLabel: (status?: string) => string = () => '';
  @Input() suspiciousBadgeClass: (item: AdminReport) => string = () => '';
  @Input() isFlagged: (item: AdminReport) => boolean = () => false;
  @Input() isArchived: (item: AdminReport) => boolean = () => false;
  @Input() canFlag: (item: AdminReport) => boolean = () => false;

  @Output() toggleSelect = new EventEmitter<string>();
  @Output() copyReference = new EventEmitter<string>();
  @Output() copyEmail = new EventEmitter<string>();
  @Output() flag = new EventEmitter<AdminReport>();
  @Output() details = new EventEmitter<AdminReport>();

  toggleMenu(itemId: string): void {
    this.openMenuId = this.openMenuId === itemId ? null : itemId;
  }

  handleCopyReference(referenceCode: string): void {
    this.copyReference.emit(referenceCode);
    this.openMenuId = null;
  }

  handleCopyEmail(email?: string): void {
    if (!email) return;
    this.copyEmail.emit(email);
    this.openMenuId = null;
  }
}
