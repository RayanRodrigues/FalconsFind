import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type ReportStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'claimed'
  | 'returned'
  | string;

type FoundItem = {
  _id: string;
  itemName?: string;
  title?: string;
  description?: string;
  category?: string;
  locationFound?: string;
  location?: string;
  dateFound?: string;
  status?: ReportStatus;
  createdAt?: string;
  updatedAt?: string;
};

type ItemsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: FoundItem[];
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  allItems: FoundItem[] = [];
  filteredItems: FoundItem[] = [];

  loading = false;
  error = '';

  searchTerm = '';
  selectedStatus = 'all';

  totalReports = 0;
  pendingCount = 0;
  approvedCount = 0;
  rejectedCount = 0;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAllReports();
    } else {
      this.loading = false;
    }
  }

  loadAllReports(): void {
    this.loading = true;
    this.error = '';

    this.http.get<ItemsResponse>('/items?page=1&limit=100').subscribe({
      next: (response) => {
        this.allItems = (response.items ?? []).map((item) => ({
          ...item,
          status: (item.status || 'pending').toLowerCase()
        }));

        this.totalReports = this.allItems.length;
        this.pendingCount = this.allItems.filter(
          (item) => item.status === 'pending'
        ).length;
        this.approvedCount = this.allItems.filter(
          (item) => item.status === 'approved'
        ).length;
        this.rejectedCount = this.allItems.filter(
          (item) => item.status === 'rejected'
        ).length;

        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load reports:', err);
        this.error = 'Failed to load reports.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredItems = this.allItems.filter((item) => {
      const itemName = (item.itemName || item.title || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const location = (item.locationFound || item.location || '').toLowerCase();
      const status = (item.status || '').toLowerCase();

      const matchesSearch =
        !search ||
        itemName.includes(search) ||
        description.includes(search) ||
        category.includes(search) ||
        location.includes(search) ||
        status.includes(search);

      const matchesStatus =
        this.selectedStatus === 'all' || status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilters();
  }

  onStatusFilterChange(value: string): void {
    this.selectedStatus = value;
    this.applyFilters();
  }

  approveItem(itemId: string): void {
    this.http.patch(`/items/${itemId}/validate`, {
      status: 'approved'
    }).subscribe({
      next: () => {
        this.loadAllReports();
      },
      error: (err) => {
        console.error('Failed to approve item:', err);
        this.error = 'Failed to approve item.';
      }
    });
  }

  rejectItem(itemId: string): void {
    this.http.patch(`/items/${itemId}/validate`, {
      status: 'rejected'
    }).subscribe({
      next: () => {
        this.loadAllReports();
      },
      error: (err) => {
        console.error('Failed to reject item:', err);
        this.error = 'Failed to reject item.';
      }
    });
  }

  formatStatus(status?: string): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  trackByItemId(index: number, item: FoundItem): string {
    return item._id;
  }
}