import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, takeUntil, timeout } from 'rxjs';
import { ItemService } from '../../../core/services/item.service';
import type { ItemDetailsResponse, ItemStatus, ErrorResponse } from '../../../models';
import { ButtonComponent } from '../../../shared/components/buttons/button.component';
import { AlertComponent } from '../../../shared/components/feedback/alert.component';

@Component({
  selector: 'app-item-details',
  standalone: true,
  imports: [CommonModule, ButtonComponent, AlertComponent],
  templateUrl: './item-details.component.html'
})
export class ItemDetailsComponent implements OnInit, OnDestroy {
  item: ItemDetailsResponse | null = null;
  isLoading = true;
  loadError: string | null = null;
  isNotFound = false;
  isUnderReview = false;
  private currentItemId: string | null = null;
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private itemService: ItemService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentItemId = this.route.snapshot.paramMap.get('id')?.trim() ?? null;
    if (!this.currentItemId) {
      this.isLoading = false;
      this.isNotFound = true;
      this.loadError = 'Item not found.';
      return;
    }

    this.fetchItemDetails();
  }

  private fetchItemDetails(): void {
    if (!this.currentItemId) {
      return;
    }

    this.isLoading = true;
    this.isNotFound = false;
    this.isUnderReview = false;
    this.loadError = null;
    this.item = null;
    this.startLoadingGuard();

    this.itemService
      .getItemDetails(this.currentItemId)
      .pipe(
        timeout(10000),
        takeUntil(this.destroy$),
        finalize(() => {
          this.stopLoadingGuard();
          this.isLoading = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (item) => {
          this.item = item;
          this.isNotFound = false;
          this.loadError = null;
          this.refreshView();
        },
        error: (error: unknown) => {
          const apiError = this.asApiError(error);
          const code = apiError?.error?.code ?? this.getNonApiErrorCode(error);
          if (code === 'NOT_FOUND') {
            this.isNotFound = true;
            this.loadError = 'Item not found.';
            this.refreshView();
            return;
          }

          if (code === 'FORBIDDEN') {
            this.isUnderReview = true;
            this.loadError = 'This item is currently under review by Campus Security.';
            this.refreshView();
            return;
          }

          if (code === 'BAD_REQUEST') {
            this.loadError = 'Invalid item link. Please check the URL and try again.';
            this.refreshView();
            return;
          }

          if (code === 'INVALID_ITEM_DATA') {
            this.loadError =
              apiError?.error?.message ??
              'This item was incorrectly reported. Please submit it again or contact Campus Security.';
            this.refreshView();
            return;
          }

          if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
            this.loadError = 'Could not load item details. Check your connection and try again.';
            this.refreshView();
            return;
          }

          this.loadError = apiError?.error?.message ?? 'Could not load item details right now.';
          this.refreshView();
        }
      });
  }

  ngOnDestroy(): void {
    this.stopLoadingGuard();
    this.destroy$.next();
    this.destroy$.complete();
  }

  back(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigate(['/']);
  }

  retry(): void {
    this.fetchItemDetails();
  }

  private startLoadingGuard(): void {
    this.stopLoadingGuard();
    this.loadingGuard = setTimeout(() => {
      if (!this.isLoading) {
        return;
      }

      this.isLoading = false;
      this.loadError = 'Could not load item details. Check your connection and try again.';
      this.refreshView();
    }, 12000);
  }

  private stopLoadingGuard(): void {
    if (!this.loadingGuard) {
      return;
    }

    clearTimeout(this.loadingGuard);
    this.loadingGuard = null;
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignore if view is already destroyed.
    }
  }

  private asApiError(error: unknown): ErrorResponse | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const candidate = error as Partial<ErrorResponse>;
    if (!candidate.error?.code || !candidate.error?.message) {
      return null;
    }

    return candidate as ErrorResponse;
  }

  private getNonApiErrorCode(error: unknown): string {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'TIMEOUT';
    }

    return 'UNKNOWN_ERROR';
  }

  get statusLabel(): string {
    return this.item?.status?.replace(/_/g, ' ') ?? '';
  }

  get statusClass(): string {
    const status = this.item?.status;
    const statusClasses: Record<ItemStatus, string> = {
      REPORTED: 'bg-info/10 text-info border-info/20',
      PENDING_VALIDATION: 'bg-warning/20 text-text-primary border-warning/30',
      VALIDATED: 'bg-success/10 text-success border-success/30',
      CLAIMED: 'bg-primary/10 text-primary border-primary/30',
      RETURNED: 'bg-secondary/10 text-secondary border-secondary/30',
      ARCHIVED: 'bg-border/30 text-text-secondary border-border'
    };

    return status ? statusClasses[status] : 'bg-border/30 text-text-secondary border-border';
  }

  get imageUrls(): string[] {
    return this.item?.imageUrls?.filter((url) => !!url.trim()) ?? [];
  }
}
