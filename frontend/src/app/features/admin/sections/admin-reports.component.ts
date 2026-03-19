import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type FoundReport = {
  id: string;
  kind: 'FOUND' | 'LOST';
  title: string;
  description?: string;
  category?: string;
  location?: string;
  dateReported: string;
  status: string;
  referenceCode: string;
};

type AdminReportsResponse = {
  reports: FoundReport[];
  total: number;
};

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  allItems: FoundReport[] = [];
  filteredItems: FoundReport[] = [];
  searchTerm = '';
  statusFilter = 'all';

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  get stats() {
    return {
      total: this.allItems.length,
      pending: this.allItems.filter((item) => item.status === 'PENDING_VALIDATION').length,
      validated: this.allItems.filter((item) => item.status === 'VALIDATED').length,
      rejected: this.allItems.filter((item) => item.status === 'REJECTED').length,
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
    this.http.get<AdminReportsResponse>('/admin/reports?kind=FOUND&page=1&limit=100').subscribe({
      next: (res) => {
        this.allItems = res.reports ?? [];
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load reports.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    const kw = this.searchTerm.trim().toLowerCase();
    this.filteredItems = this.allItems.filter((item) => {
      const name = item.title.toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const status = item.status.toLowerCase();
      const referenceCode = item.referenceCode.toLowerCase();
      const kwMatch = !kw || name.includes(kw) || loc.includes(kw) || status.includes(kw) || referenceCode.includes(kw);
      const statusMatch = this.statusFilter === 'all' || status === this.statusFilter;
      return kwMatch && statusMatch;
    });
  }

  approve(id: string): void {
    this.http.patch(`/reports/found/${id}/validate`, {}).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to validate found report.'),
    });
  }

  statusClass(status?: string): string {
    const map: Record<string, string> = {
      PENDING_VALIDATION: 'bg-warning/15 text-warning border-warning/30',
      VALIDATED: 'bg-success/10 text-success border-success/30',
      REJECTED: 'bg-error/10 text-error border-error/30',
      CLAIMED: 'bg-info/10 text-info border-info/30',
    };
    return map[status ?? ''] ?? 'bg-border/20 text-text-secondary border-border';
  }

  trackById(_: number, item: FoundReport): string {
    return item.id;
  }
}
