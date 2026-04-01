import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, Renderer2, RendererFactory2, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../buttons/button.component';
import type { AdminReport, ItemHistoryEvent } from '../../../features/admin/reports/admin-reports.types';

@Component({
  selector: 'app-admin-report-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './admin-report-details-modal.component.html',
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
