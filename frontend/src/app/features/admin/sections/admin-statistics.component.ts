import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ItemsApiService } from '../../../core/services/items-api.service';
import type { ItemPublicResponse } from '../../../models';

type DashboardItem = ItemPublicResponse & {
  category?: string;
};

type StatusBar = {
  label: string;
  value: number;
  percent: number;
  toneClass: string;
  barClass: string;
};

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-statistics.component.html',
})
export class AdminStatisticsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');

  readonly allItems = signal<DashboardItem[]>([]);

  readonly dateFrom = signal('');
  readonly categoryFilter = signal('all');
  readonly locationFilter = signal('');

  constructor(
    private readonly itemsApi: ItemsApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStatistics();
      return;
    }

    this.loading.set(false);
  }

  loadStatistics(): void {
    this.loading.set(true);
    this.error.set('');

    this.itemsApi.getFoundItems(1, 200, { includeArchived: true }).subscribe({
      next: (response) => {
        this.allItems.set((response.items ?? []) as DashboardItem[]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load dashboard statistics.');
        this.loading.set(false);
      },
    });
  }

  readonly filteredItems = computed(() => {
    const items = this.allItems();
    const selectedCategory = this.categoryFilter().trim().toLowerCase();
    const selectedLocation = this.locationFilter().trim().toLowerCase();
    const selectedDateFrom = this.dateFrom();

    return items.filter((item) => {
      const itemCategory = String(item.category ?? '').trim().toLowerCase();
      const itemLocation = String(item.location ?? '').trim().toLowerCase();
      const itemDate = item.dateReported ? new Date(item.dateReported) : null;

      const categoryMatch =
        selectedCategory === 'all' || itemCategory === selectedCategory;

      const locationMatch =
        !selectedLocation || itemLocation.includes(selectedLocation);

      const dateMatch =
        !selectedDateFrom ||
        (itemDate !== null && !Number.isNaN(itemDate.getTime()) && itemDate >= new Date(selectedDateFrom));

      return categoryMatch && locationMatch && dateMatch;
    });
  });

  readonly totalReported = computed(() => this.filteredItems().length);

  readonly validatedCount = computed(() =>
    this.filteredItems().filter((item) => {
      const status = this.normalizeStatus(item.status);
      return status === 'validated' || status === 'approved';
    }).length,
  );

  readonly claimedCount = computed(() =>
    this.filteredItems().filter((item) => this.normalizeStatus(item.status) === 'claimed').length,
  );

  readonly returnedCount = computed(() =>
    this.filteredItems().filter((item) => this.normalizeStatus(item.status) === 'returned').length,
  );

  readonly uniqueCategories = computed(() => {
    const categories = this.allItems()
      .map((item) => String(item.category ?? '').trim())
      .filter((value) => value.length > 0);

    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  });

  readonly statusBars = computed<StatusBar[]>(() => {
    const total = this.totalReported();

    const makePercent = (value: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    };

    return [
      {
        label: 'Validated',
        value: this.validatedCount(),
        percent: makePercent(this.validatedCount()),
        toneClass: 'text-success',
        barClass: 'bg-success',
      },
      {
        label: 'Claimed',
        value: this.claimedCount(),
        percent: makePercent(this.claimedCount()),
        toneClass: 'text-info',
        barClass: 'bg-info',
      },
      {
        label: 'Returned',
        value: this.returnedCount(),
        percent: makePercent(this.returnedCount()),
        toneClass: 'text-primary',
        barClass: 'bg-primary',
      },
    ];
  });

  readonly topLocations = computed(() => {
    const counts = new Map<string, number>();

    for (const item of this.filteredItems()) {
      const rawLocation = String(item.location ?? '').trim();
      const normalizedLocation = this.formatLocationLabel(rawLocation || 'Unknown');

      counts.set(normalizedLocation, (counts.get(normalizedLocation) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
  }

  setCategory(value: string): void {
    this.categoryFilter.set(value);
  }

  setLocation(value: string): void {
    this.locationFilter.set(value);
  }

  clearFilters(): void {
    this.dateFrom.set('');
    this.categoryFilter.set('all');
    this.locationFilter.set('');
  }

  trackByLabel(_index: number, item: StatusBar): string {
    return item.label;
  }

  trackByLocation(_index: number, item: { location: string; count: number }): string {
    return item.location;
  }

  private formatLocationLabel(location: string): string {
    return location
      .replace(/\bflor\b/gi, 'Floor')
      .replace(/\bfloor\b/gi, 'Floor')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeStatus(status?: string): string {
    return String(status ?? '').trim().toLowerCase();
  }
}