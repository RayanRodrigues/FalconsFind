import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

type FoundItem = {
  _id: string;
  title?: string;
  itemName?: string;
  description?: string;
  category?: string;
  location?: string;
  locationFound?: string;
  dateFound?: string;
  status?: string;
};

type ItemsResponse = { items: FoundItem[]; total: number };

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  allItems: FoundItem[] = [];
  filteredItems: FoundItem[] = [];
  searchTerm = '';
  statusFilter = 'all';

  get stats() {
    return {
      total: this.allItems.length,
      pending: this.allItems.filter(i => i.status === 'pending').length,
      validated: this.allItems.filter(i => i.status === 'approved' || i.status === 'validated').length,
      rejected: this.allItems.filter(i => i.status === 'rejected').length,
    };
  }

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) this.load();
    else this.loading.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<ItemsResponse>('/items?page=1&limit=100').subscribe({
      next: (res) => {
        this.allItems = (res.items ?? []).map(i => ({ ...i, status: (i.status || 'pending').toLowerCase() }));
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load reports.'); this.loading.set(false); }
    });
  }

  applyFilters(): void {
    const kw = this.searchTerm.trim().toLowerCase();
    this.filteredItems = this.allItems.filter(i => {
      const name = (i.title || i.itemName || '').toLowerCase();
      const loc = (i.location || i.locationFound || '').toLowerCase();
      const status = (i.status || '').toLowerCase();
      const kwMatch = !kw || name.includes(kw) || loc.includes(kw) || status.includes(kw);
      const statusMatch = this.statusFilter === 'all' || status === this.statusFilter;
      return kwMatch && statusMatch;
    });
  }

  approve(id: string): void {
    this.http.patch(`/items/${id}/validate`, { status: 'approved' }).subscribe({ next: () => this.load(), error: () => this.error.set('Failed to approve.') });
  }

  reject(id: string): void {
    this.http.patch(`/items/${id}/validate`, { status: 'rejected' }).subscribe({ next: () => this.load(), error: () => this.error.set('Failed to reject.') });
  }

  statusClass(status?: string): string {
    const map: Record<string, string> = {
      pending: 'bg-warning/15 text-warning border-warning/30',
      approved: 'bg-success/10 text-success border-success/30',
      validated: 'bg-success/10 text-success border-success/30',
      rejected: 'bg-error/10 text-error border-error/30',
      claimed: 'bg-info/10 text-info border-info/30',
    };
    return map[status ?? ''] ?? 'bg-border/20 text-text-secondary border-border';
  }

  trackById(_: number, item: FoundItem): string { return item._id; }
}
