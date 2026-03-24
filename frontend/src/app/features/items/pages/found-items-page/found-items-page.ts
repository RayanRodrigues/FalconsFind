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
          this.items = this.sortItems(response.items);
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

  safeDetectChanges(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cdr.detectChanges();
    }
  }

  isClaimed(status: string | null | undefined): boolean {
    return (status ?? '').toUpperCase() === 'CLAIMED';
  }

  getAvailabilityLabel(status: string | null | undefined): string {
    return this.isClaimed(status) ? 'Claimed' : 'Available';
  }

  getAvailabilityClass(status: string | null | undefined): string {
    return this.isClaimed(status)
      ? 'bg-red-100 text-red-700 border-red-200'
      : 'bg-green-100 text-green-700 border-green-200';
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
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.sortStorageKey, this.sortOption);
  }

  private restoreSortPreference(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const saved = localStorage.getItem(this.sortStorageKey);
    if (saved === 'most-recent' || saved === 'oldest') {
      this.sortOption = saved;
    }
  }
}