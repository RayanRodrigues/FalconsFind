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

type SortOption = 'most-recent' | 'oldest';

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
  hasLoadedOnce = false;

  items: ItemPublicResponse[] = [];
  total = 0;

  searchTerm = '';
  categoryFilter = '';
  locationFilter = '';
  dateFilter = '';
  sortOption: SortOption = 'most-recent';

  page = 1;
  limit = 10;
  totalPages = 1;
  hasNextPage = false;
  hasPrevPage = false;

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private readonly sortStorageKey = 'falconfind-found-items-sort';

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

    this.restoreSortPreference();

    this.searchSubject
      .pipe(
        debounceTime(150),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
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
        keyword: this.searchTerm,
        category: this.categoryFilter,
        location: this.locationFilter,
        dateFrom: this.dateFilter,
        includeArchived: false,
      })
      .pipe(
        timeout(8000),
        finalize(() => {
          this.loading = false;
          this.safeDetectChanges();
        })
      )
      .subscribe({
        next: (response: ItemsListResponse) => {
          const activeItems = (response.items ?? []).filter((item) => !this.isArchived(item));

          this.items = this.sortItems(activeItems);
          this.total = activeItems.length;
          this.page = response.page;
          this.limit = response.limit;
          this.totalPages = response.totalPages;
          this.hasNextPage = response.hasNextPage;
          this.hasPrevPage = response.hasPrevPage;
          this.hasLoadedOnce = true;
          this.safeDetectChanges();
        },
        error: () => {
          this.error = true;
          this.hasLoadedOnce = true;
          this.safeDetectChanges();
        },
      });
  }

  onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.page = 1;
      this.loadItems();
      return;
    }

    this.searchSubject.next(this.searchTerm);
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadItems();
  }

  onSortChange(): void {
    this.saveSortPreference();
    this.items = this.sortItems(this.items);
    this.safeDetectChanges();
  }

  retry(): void {
    this.loadItems();
  }

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
    this.sortOption = 'most-recent';
    this.saveSortPreference();
    this.page = 1;
    this.loadItems();
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.categoryFilter ||
      this.locationFilter ||
      this.dateFilter ||
      this.sortOption !== 'most-recent'
    );
  }

  get showLoadingState(): boolean {
    return this.loading;
  }

  get showErrorState(): boolean {
    return !this.loading && this.error;
  }

  get showEmptyState(): boolean {
    return !this.loading && !this.error && this.hasLoadedOnce && this.items.length === 0;
  }

  get showInitialEmptyState(): boolean {
    return this.showEmptyState && !this.hasActiveFilters;
  }

  get showFilteredEmptyState(): boolean {
    return this.showEmptyState && this.hasActiveFilters;
  }

  get showItemsGrid(): boolean {
    return !this.loading && !this.error && this.items.length > 0;
  }

  safeDetectChanges(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cdr.detectChanges();
    }
  }

  isClaimed(status: string | null | undefined): boolean {
    return (status ?? '').toUpperCase() === 'CLAIMED';
  }

  isArchived(item: ItemPublicResponse): boolean {
    return (item.status ?? '').toUpperCase() === 'ARCHIVED';
  }

  getAvailabilityLabel(status: string | null | undefined): string {
    return this.isClaimed(status) ? 'Claimed' : 'Available';
  }

  getAvailabilityClass(status: string | null | undefined): string {
    return this.isClaimed(status)
      ? 'bg-red-500/10 text-red-500 border-red-500/20'
      : 'bg-green-500/10 text-green-600 border-green-500/20';
  }

  getTimeSinceListed(date: string | null | undefined): string {
    if (!date) return 'Listing date unavailable';

    const listedTime = new Date(date).getTime();

    if (Number.isNaN(listedTime)) {
      return 'Listing date unavailable';
    }

    const now = Date.now();
    const diffMs = Math.max(0, now - listedTime);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;

    if (diffMs < minute) {
      return 'Just now';
    }

    if (diffMs < hour) {
      const minutes = Math.floor(diffMs / minute);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    if (diffMs < week) {
      const days = Math.floor(diffMs / day);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    if (diffMs < month) {
      const weeks = Math.floor(diffMs / week);
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }

    const months = Math.floor(diffMs / month);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  private sortItems(items: ItemPublicResponse[]): ItemPublicResponse[] {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.dateReported ?? 0).getTime();
      const dateB = new Date(b.dateReported ?? 0).getTime();

      if (this.sortOption === 'oldest') {
        return dateA - dateB;
      }

      return dateB - dateA;
    });
  }

  private saveSortPreference(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage?.setItem !== 'function') {
      return;
    }

    localStorage.setItem(this.sortStorageKey, this.sortOption);
  }

  private restoreSortPreference(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage?.getItem !== 'function') {
      return;
    }

    const saved = localStorage.getItem(this.sortStorageKey);
    if (saved === 'most-recent' || saved === 'oldest') {
      this.sortOption = saved;
    }
  }
}
