import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, timeout, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import type { ItemPublicResponse } from '../../../../models';
import {
  ItemsApiService,
  type ItemsListResponse,
} from '../../../../core/services/items-api.service';

@Component({
  selector: 'app-found-items-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './found-items-page.html',
  styleUrl: './found-items-page.css',
})
export class FoundItemsPageComponent implements OnInit, OnDestroy {
  loading = true;
  error = false;

  items: ItemPublicResponse[] = [];
  total = 0;

  searchTerm = '';
  categoryFilter = '';
  locationFilter = '';
  dateFilter = '';

  page = 1;
  limit = 10;
  totalPages = 1;
  hasNextPage = false;
  hasPrevPage = false;

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private itemsApi: ItemsApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }

    // Debounce search input — short delay so fast typers don't flood the API
    this.searchSubject.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.page = 1;
      this.loadItems();
    });

    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadItems(): void {
    this.loading = true;
    this.error = false;
    this.safeDetectChanges();

    this.itemsApi
      .getFoundItems(this.page, this.limit, {
        keyword:  this.searchTerm,
        category: this.categoryFilter,
        location: this.locationFilter,
        dateFrom: this.dateFilter,
      })
      .pipe(
        timeout(8000),
        finalize(() => {
          this.loading = false;
          this.safeDetectChanges();
        }),
      )
      .subscribe({
        next: (response: ItemsListResponse) => {
          this.items = response.items;
          this.total = response.total;
          this.page = response.page;
          this.limit = response.limit;
          this.totalPages = response.totalPages;
          this.hasNextPage = response.hasNextPage;
          this.hasPrevPage = response.hasPrevPage;
          this.safeDetectChanges();
        },
        error: () => {
          this.error = true;
          this.safeDetectChanges();
        },
      });
  }

  // Called on every keystroke — bypasses debounce when field is empty so clearing
  // the search bar immediately restores the full list
  onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.page = 1;
      this.loadItems();
      return;
    }
    this.searchSubject.next(this.searchTerm);
  }

  // Called immediately when a dropdown or date filter changes
  onFilterChange(): void {
    this.page = 1;
    this.loadItems();
  }

  retry(): void { this.loadItems(); }

  prev(): void {
    if (!this.hasPrevPage) return;
    this.page -= 1;
    this.loadItems();
  }

  next(): void {
    if (!this.hasNextPage) return;
    this.page += 1;
    this.loadItems();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.page = 1;
    this.loadItems();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.locationFilter = '';
    this.dateFilter = '';
    this.page = 1;
    this.loadItems();
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.categoryFilter || this.locationFilter || this.dateFilter);
  }

  safeDetectChanges(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cdr.detectChanges();
    }
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      REPORTED: 'bg-info/10 text-info border-info/20',
      PENDING_VALIDATION: 'bg-warning/20 text-text-primary border-warning/30',
      VALIDATED: 'bg-success/10 text-success border-success/30',
      CLAIMED: 'bg-primary/10 text-primary border-primary/30',
      RETURNED: 'bg-secondary/10 text-secondary border-secondary/30',
      ARCHIVED: 'bg-border/30 text-text-secondary border-border',
    };
    return statusClasses[status] ?? 'bg-border/30 text-text-secondary border-border';
  }
}
