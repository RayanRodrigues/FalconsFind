import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, computed, signal } from '@angular/core';
import { ItemsApiService } from '../../../core/services/items-api.service';
import { AdminMetricCardComponent } from '../../../shared/components/admin/admin-metric-card.component';
import { AdminStatisticsFiltersComponent } from '../../../shared/components/admin/admin-statistics-filters.component';
import { AdminStatisticsChartsComponent } from '../../../shared/components/admin/admin-statistics-charts.component';
import { AdminStatisticsSummaryComponent } from '../../../shared/components/admin/admin-statistics-summary.component';
import type { ActivityPoint, DashboardItem, PieSlice, StatusBar } from './admin-statistics.types';
import { normalizeStatus, formatLocationLabel, resolveChartColor, toDateKey, buildDateWindow } from './admin-statistics.helpers';

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [
    AdminMetricCardComponent,
    AdminStatisticsFiltersComponent,
    AdminStatisticsChartsComponent,
    AdminStatisticsSummaryComponent,
  ],
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
      const status = normalizeStatus(item.status);
      return status === 'validated' || status === 'approved';
    }).length,
  );

  readonly claimedCount = computed(() =>
    this.filteredItems().filter((item) => normalizeStatus(item.status) === 'claimed').length,
  );

  readonly returnedCount = computed(() =>
    this.filteredItems().filter((item) => normalizeStatus(item.status) === 'returned').length,
  );

  readonly archivedCount = computed(() =>
    this.filteredItems().filter((item) => normalizeStatus(item.status) === 'archived').length,
  );

  readonly activeCount = computed(() =>
    this.filteredItems().filter((item) => normalizeStatus(item.status) !== 'archived').length,
  );

  readonly recoveryRate = computed(() => {
    const total = this.totalReported();
    if (total === 0) return 0;
    return Math.round((this.returnedCount() / total) * 100);
  });

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
        description: 'Visible and ready for matching',
        toneClass: 'text-success',
        barClass: 'bg-success',
      },
      {
        label: 'Claimed',
        value: this.claimedCount(),
        percent: makePercent(this.claimedCount()),
        description: 'Currently under ownership review',
        toneClass: 'text-info',
        barClass: 'bg-info',
      },
      {
        label: 'Returned',
        value: this.returnedCount(),
        percent: makePercent(this.returnedCount()),
        description: 'Successfully resolved and returned',
        toneClass: 'text-primary',
        barClass: 'bg-primary',
      },
      {
        label: 'Archived',
        value: this.archivedCount(),
        percent: makePercent(this.archivedCount()),
        description: 'Closed and removed from active operations',
        toneClass: 'text-[var(--color-text-secondary)]',
        barClass: 'bg-[var(--color-text-secondary)]',
      },
    ];
  });

  readonly topLocations = computed(() => {
    const counts = new Map<string, number>();

    for (const item of this.filteredItems()) {
      const rawLocation = String(item.location ?? '').trim();
      const normalizedLocation = formatLocationLabel(rawLocation || 'Unknown');

      counts.set(normalizedLocation, (counts.get(normalizedLocation) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  readonly topCategories = computed(() => {
    const counts = new Map<string, number>();

    for (const item of this.filteredItems()) {
      const rawCategory = String(item.category ?? '').trim();
      const normalizedCategory = rawCategory.length > 0 ? rawCategory : 'Uncategorized';
      counts.set(normalizedCategory, (counts.get(normalizedCategory) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  readonly latestReportedAt = computed(() => {
    const timestamps = this.filteredItems()
      .map((item) => item.dateReported ? new Date(item.dateReported).getTime() : Number.NaN)
      .filter((value) => !Number.isNaN(value));

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  });

  readonly statusPieSlices = computed<PieSlice[]>(() => {
    const bars = this.statusBars().filter((bar) => bar.value > 0);
    const total = bars.reduce((sum, bar) => sum + bar.value, 0);
    const circumference = 2 * Math.PI * 42;
    let cumulative = 0;

    if (total === 0) {
      return [];
    }

    return bars.map((bar) => {
      const fraction = bar.value / total;
      const sliceLength = circumference * fraction;
      const slice: PieSlice = {
        label: bar.label,
        value: bar.value,
        percent: bar.percent,
        color: resolveChartColor(bar.label),
        toneClass: bar.toneClass,
        dashArray: `${sliceLength} ${circumference - sliceLength}`,
        dashOffset: -cumulative,
      };

      cumulative += sliceLength;
      return slice;
    });
  });

  readonly activityPoints = computed<ActivityPoint[]>(() => {
    const items = this.filteredItems();
    const dailyCounts = new Map<string, number>();

    for (const item of items) {
      const dateKey = toDateKey(item.dateReported);
      if (!dateKey) continue;
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
    }

    const latestDate = this.latestReportedAt() ?? new Date();
    const chartDates = buildDateWindow(latestDate, 7);
    const maxValue = Math.max(1, ...chartDates.map((date) => dailyCounts.get(date) ?? 0));

    return chartDates.map((dateKey, index) => {
      const value = dailyCounts.get(dateKey) ?? 0;
      const x = chartDates.length === 1 ? 160 : 16 + (index * 288) / (chartDates.length - 1);
      const y = 132 - (value / maxValue) * 96;
      const date = new Date(`${dateKey}T00:00:00`);

      return {
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        shortLabel: date.toLocaleDateString(undefined, { weekday: 'short' }),
        value,
        x,
        y,
      };
    });
  });

  readonly activityLinePath = computed(() =>
    this.activityPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  readonly activityAreaPath = computed(() => {
    const points = this.activityPoints();
    if (points.length === 0) return '';

    const first = points[0];
    const last = points[points.length - 1];
    const pointPath = points.map((point) => `L ${point.x} ${point.y}`).join(' ');

    return `M ${first.x} 132 ${pointPath} L ${last.x} 132 Z`;
  });

  readonly activityMaxValue = computed(() =>
    Math.max(1, ...this.activityPoints().map((point) => point.value)),
  );

  readonly activityYAxis = computed(() => {
    const max = this.activityMaxValue();
    return [max, Math.round(max / 2), 0];
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

}
