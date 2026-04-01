import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, Renderer2, RendererFactory2, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../buttons/button.component';
import type { AdminReport, ItemHistoryEvent } from '../../../features/admin/sections/admin-reports.types';

@Component({
  selector: 'app-admin-report-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-md" (click)="close.emit()"></div>

      <div class="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          #dialogPanel
          class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border/60 bg-[var(--color-surface)] shadow-2xl outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-report-details-title"
          tabindex="-1"
          (keydown.escape)="close.emit()"
        >
          <div class="relative px-5 py-5 sm:px-7 sm:py-6 border-b border-border/50">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary mb-2">Found Item Details</p>
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <h3 id="admin-report-details-title" class="text-xl sm:text-2xl font-bold text-text-primary mb-0">{{ item.title }}</h3>

                  @if (isFlagged(item)) {
                    <span
                      class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      [class]="suspiciousBadgeClass(item)"
                    >
                      Suspicious
                    </span>
                  }
                </div>

                <div class="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <span>{{ item.referenceCode }}</span>
                  <span class="text-border">•</span>
                  <span>{{ item.dateReported | date: 'medium' }}</span>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <span
                  class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  [class]="statusClass(item.status)"
                >
                  {{ statusLabel(item.status) }}
                </span>

                <button
                  type="button"
                  (click)="close.emit()"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-[var(--color-surface)] text-text-secondary hover:text-text-primary hover:border-primary/30 transition"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div class="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <div class="space-y-5">
                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface-2)]/65 p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Quick Snapshot</p>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface)] px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Reference Code</p>
                      <p class="text-sm font-semibold text-text-primary mb-0 break-all">{{ item.referenceCode }}</p>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface)] px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Current Status</p>
                      <p class="text-sm font-semibold text-text-primary mb-0">{{ statusLabel(item.status) }}</p>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface)] px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Location</p>
                      <p class="text-sm font-semibold text-text-primary mb-0">{{ item.location || 'Not provided' }}</p>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface)] px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Category</p>
                      <p class="text-sm font-semibold text-text-primary mb-0">{{ item.category || 'Not provided' }}</p>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface)] px-3.5 py-3 sm:col-span-2">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Reported On</p>
                      <p class="text-sm font-semibold text-text-primary mb-0">{{ item.dateReported | date: 'fullDate' }}</p>
                      <p class="text-xs text-text-secondary mb-0 mt-1">{{ item.dateReported | date: 'shortTime' }}</p>
                    </div>
                  </div>
                </div>

                @if (canOpenPhoto(item)) {
                  <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Photos</p>

                    @if (getSelectedPhoto(item); as mainPhoto) {
                      <div class="overflow-hidden rounded-2xl border border-border/60 bg-[var(--color-surface-2)]/70 mb-3">
                        <img [src]="mainPhoto" [alt]="item.title" class="h-72 w-full object-cover" />
                      </div>
                    }

                    @if (getPhotoUrls(item).length > 1) {
                      <div class="grid grid-cols-4 gap-2">
                        @for (photoUrl of getPhotoUrls(item); track photoUrl; let photoIndex = $index) {
                          <button
                            type="button"
                            (click)="selectPhoto.emit(photoIndex)"
                            class="overflow-hidden rounded-xl border transition"
                            [class]="selectedPhotoIndex === photoIndex
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border/60 hover:border-primary/40'"
                          >
                            <img
                              [src]="photoUrl"
                              [alt]="item.title + ' preview ' + (photoIndex + 1)"
                              class="h-16 w-full object-cover"
                            />
                          </button>
                        }
                      </div>
                    }
                  </div>
                }

                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Description</p>
                  <p class="text-sm leading-6 text-text-primary mb-0">{{ item.description || 'No description was provided for this found item.' }}</p>
                </div>

                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Contact & Reporting</p>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface-2)]/55 px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Contact Email</p>
                      <p class="text-sm font-semibold text-text-primary mb-0 break-all">{{ item.contactEmail || 'Not provided' }}</p>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-[var(--color-surface-2)]/55 px-3.5 py-3">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary mb-1">Visibility</p>
                      <p class="text-sm font-semibold text-text-primary mb-0">{{ isArchived(item) ? 'Archived from active queue' : 'Visible in active operations' }}</p>
                    </div>
                  </div>
                </div>

                @if (isFlagged(item)) {
                  <div class="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Suspicious Report Status</p>

                    <div class="space-y-3 text-sm">
                      <div>
                        <p class="text-xs text-text-secondary mb-1">Flag Status</p>
                        <p class="font-semibold text-primary mb-0">Flagged as suspicious</p>
                      </div>

                      <div>
                        <p class="text-xs text-text-secondary mb-1">Reason</p>
                        <p class="font-semibold text-text-primary mb-0">{{ item.flagReason || 'No reason was provided.' }}</p>
                      </div>

                      @if (item.flaggedAt) {
                        <div>
                          <p class="text-xs text-text-secondary mb-1">Flagged On</p>
                          <p class="font-semibold text-text-primary mb-0">{{ item.flaggedAt | date: 'fullDate' }}</p>
                          <p class="text-xs text-text-secondary mb-0">{{ item.flaggedAt | date: 'shortTime' }}</p>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="space-y-5">
                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4 lg:sticky lg:top-0">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Quick Actions</p>

                  <div class="flex flex-wrap gap-2">
                    @if (canValidate(item)) {
                      <button
                        type="button"
                        [disabled]="activeRowId === item.id"
                        (click)="approve.emit(item.id)"
                        class="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg style="width:14px;height:14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m5 13 4 4L19 7" />
                        </svg>
                        {{ activeRowId === item.id ? 'Validating…' : 'Validate' }}
                      </button>
                    }

                    @if (canFlag(item)) {
                      <button
                        type="button"
                        (click)="flag.emit(item)"
                        class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                      >
                        <svg style="width:14px;height:14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v3m0 3h.01M10.29 3.86l-7.5 13A1 1 0 0 0 3.65 18h16.7a1 1 0 0 0 .86-1.5l-7.5-13a1 1 0 0 0-1.72 0z" />
                        </svg>
                        Flag
                      </button>
                    }

                    <button
                      type="button"
                      (click)="copyReference.emit(item.referenceCode)"
                      class="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[var(--color-surface-2)] px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      <svg style="width:14px;height:14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 16h8M8 12h8m-6-8h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l3-5z" />
                      </svg>
                      Copy Ref
                    </button>

                    @if (item.contactEmail) {
                      <button
                        type="button"
                        (click)="copyEmail.emit(item.contactEmail)"
                        class="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[var(--color-surface-2)] px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        <svg style="width:14px;height:14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16v12H4z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m4 7 8 6 8-6" />
                        </svg>
                        Copy Email
                      </button>
                    }
                  </div>
                </div>

                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Restore Previous Status</p>

                  @if (historyLoading) {
                    <p class="text-sm text-text-secondary mb-0">Loading status history…</p>
                  }

                  @if (historyError) {
                    <p class="text-sm text-error mb-0">{{ historyError }}</p>
                  }

                  @if (!historyLoading && !historyError) {
                    <div class="space-y-3">
                      <select
                        [ngModel]="selectedRestoreStatus"
                        (ngModelChange)="selectedRestoreStatusChange.emit($event)"
                        [disabled]="!canRestore"
                        class="w-full rounded-xl border border-border bg-[var(--color-surface)] px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition disabled:bg-[var(--color-surface-2)] disabled:text-text-secondary"
                      >
                        <option value="">Select previous status</option>
                        @for (status of restoreOptions; track status) {
                          <option [value]="status">{{ statusLabel(status) }}</option>
                        }
                      </select>

                      @if (!canRestore) {
                        <p class="text-xs text-text-secondary mb-0">No restorable previous statuses are available for this item.</p>
                      }

                      <app-button
                        type="button"
                        variant="secondary"
                        size="md"
                        [disabled]="!selectedRestoreStatus"
                        (buttonClick)="openRestoreModal.emit()"
                      >
                        Restore Status
                      </app-button>
                    </div>
                  }
                </div>

                <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-3">Full Item History</p>

                  @if (historyLoading) {
                    <p class="text-sm text-text-secondary mb-0">Loading timeline…</p>
                  }

                  @if (historyError) {
                    <p class="text-sm text-error mb-0">{{ historyError }}</p>
                  }

                  @if (!historyLoading && !historyError && historyEvents.length === 0) {
                    <p class="text-sm text-text-secondary mb-0">No history available yet.</p>
                  }

                  @if (!historyLoading && !historyError && historyEvents.length > 0) {
                    <div class="max-h-[28rem] overflow-y-auto pr-1">
                      @for (event of historyEvents; track event.id) {
                        <div class="relative pl-7 pb-5 last:pb-0">
                          <div class="absolute left-2.5 top-2.5 bottom-0 w-px bg-border last:hidden"></div>
                          <div class="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                            <div class="h-2 w-2 rounded-full bg-current"></div>
                          </div>

                          <div class="pl-2">
                            <div class="flex flex-wrap items-start justify-between gap-2">
                              <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2 mb-1">
                                  <p class="text-sm font-semibold text-text-primary mb-0">
                                    {{ getHistoryActionLabel(event) }}
                                  </p>
                                  <span class="text-[11px] text-text-secondary">
                                    {{ event.entityType }}
                                  </span>
                                </div>

                                <p class="text-sm text-text-primary mb-1">
                                  {{ getHistoryEventLabel(event) }}
                                </p>

                                <p class="text-xs text-text-secondary mb-0">
                                  {{ getHistoryActorLabel(event) }} · {{ event.timestamp | date: 'medium' }}
                                </p>
                              </div>
                            </div>

                            @if (getHistoryStatusChange(event); as statusChange) {
                              <p class="mt-2 text-xs text-text-secondary mb-0">
                                Status:
                                @if (statusChange.previous) {
                                  <span class="text-text-primary">{{ statusLabel(statusChange.previous) }}</span>
                                  <span class="mx-1">→</span>
                                }
                                @if (statusChange.next) {
                                  <span class="text-text-primary">{{ statusLabel(statusChange.next) }}</span>
                                }
                              </p>
                            }

                            @if (event.metadata?.flagReason) {
                              <p class="mt-2 text-xs text-text-secondary mb-0">
                                Flag reason: <span class="text-text-primary">{{ event.metadata?.flagReason }}</span>
                              </p>
                            }

                            @if (event.metadata?.referenceCode) {
                              <p class="mt-1 text-xs text-text-secondary mb-0">
                                Ref: <span class="text-text-primary">{{ event.metadata?.referenceCode }}</span>
                              </p>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      @if (restoreModalOpen) {
        <div class="absolute inset-0 z-[90] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-950/40" (click)="closeRestoreModal.emit()"></div>

          <div class="relative w-full max-w-md rounded-2xl border border-border/60 bg-[var(--color-surface)] p-6 shadow-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary mb-2">Confirm Restore</p>
            <h4 class="text-lg font-bold text-text-primary mb-2">Restore previous status?</h4>
            <p class="text-sm text-text-secondary mb-5">
              This will change the current item status to
              <span class="font-semibold text-text-primary">{{ statusLabel(selectedRestoreStatus) }}</span>.
            </p>

            <div class="flex items-center justify-end gap-3">
              <app-button
                type="button"
                variant="secondary"
                size="md"
                [disabled]="restoring"
                (buttonClick)="closeRestoreModal.emit()"
              >
                Cancel
              </app-button>

              <app-button
                type="button"
                variant="primary"
                size="md"
                [loading]="restoring"
                [disabled]="restoring"
                (buttonClick)="restoreStatus.emit()"
              >
                {{ restoring ? 'Restoring…' : 'Confirm Restore' }}
              </app-button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminReportDetailsModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);
  private previousBodyOverflow = '';

  @ViewChild('dialogPanel') private readonly dialogPanel?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) item!: AdminReport;
  @Input() activeRowId: string | null = null;
  @Input() selectedPhotoIndex = 0;
  @Input() selectedRestoreStatus = '';
  @Input() restoreOptions: string[] = [];
  @Input() canRestore = false;
  @Input() restoring = false;
  @Input() restoreModalOpen = false;
  @Input() historyLoading = false;
  @Input() historyError = '';
  @Input() historyEvents: ItemHistoryEvent[] = [];

  @Input() statusClass: (status?: string) => string = () => '';
  @Input() statusLabel: (status?: string) => string = () => '';
  @Input() suspiciousBadgeClass: (item: AdminReport) => string = () => '';
  @Input() isFlagged: (item: AdminReport) => boolean = () => false;
  @Input() isArchived: (item: AdminReport) => boolean = () => false;
  @Input() canValidate: (item: AdminReport) => boolean = () => false;
  @Input() canFlag: (item: AdminReport) => boolean = () => false;
  @Input() canOpenPhoto: (item: AdminReport) => boolean = () => false;
  @Input() getPhotoUrls: (item: AdminReport) => string[] = () => [];
  @Input() getSelectedPhoto: (item: AdminReport) => string | null = () => null;
  @Input() getHistoryEventLabel: (event: ItemHistoryEvent) => string = () => '';
  @Input() getHistoryBadgeClass: (event: ItemHistoryEvent) => string = () => '';
  @Input() getHistoryActionLabel: (event: ItemHistoryEvent) => string = () => '';
  @Input() getHistoryStatusChange: (event: ItemHistoryEvent) => { previous?: string; next?: string } | null = () => null;
  @Input() hasHistoryMetadata: (event: ItemHistoryEvent) => boolean = () => false;
  @Input() getHistoryActorLabel: (event: ItemHistoryEvent) => string = () => '';

  @Output() close = new EventEmitter<void>();
  @Output() approve = new EventEmitter<string>();
  @Output() flag = new EventEmitter<AdminReport>();
  @Output() viewPhoto = new EventEmitter<string | undefined>();
  @Output() copyReference = new EventEmitter<string>();
  @Output() copyEmail = new EventEmitter<string | undefined>();
  @Output() selectPhoto = new EventEmitter<number>();
  @Output() selectedRestoreStatusChange = new EventEmitter<string>();
  @Output() openRestoreModal = new EventEmitter<void>();
  @Output() closeRestoreModal = new EventEmitter<void>();
  @Output() restoreStatus = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.lockBodyScroll();
    queueMicrotask(() => this.dialogPanel?.nativeElement.focus());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && !changes['item'].firstChange) {
      queueMicrotask(() => this.dialogPanel?.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    const body = this.document?.body;
    if (!body) return;

    this.previousBodyOverflow = body.style.overflow;
    this.renderer.setStyle(body, 'overflow', 'hidden');
  }

  private unlockBodyScroll(): void {
    const body = this.document?.body;
    if (!body) return;

    if (this.previousBodyOverflow) {
      this.renderer.setStyle(body, 'overflow', this.previousBodyOverflow);
    } else {
      this.renderer.removeStyle(body, 'overflow');
    }
  }
}
