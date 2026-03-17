import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type PendingItemsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: any[];
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  pendingItems: any[] = [];
  loading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPendingItems();
  }

  loadPendingItems(): void {
    this.loading = true;
    this.error = '';

    this.http.get<PendingItemsResponse>('/items?status=pending&page=1&limit=50').subscribe({
      next: (response) => {
        console.log('Pending items response:', response);
        this.pendingItems = response.items ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load pending items:', err);
        this.error = 'Failed to load pending found items.';
        this.loading = false;
      }
    });
  }

  approveItem(itemId: string): void {
    this.http.patch(`/items/${itemId}/validate`, {
      status: 'approved'
    }).subscribe({
      next: () => {
        this.loadPendingItems();
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
        this.loadPendingItems();
      },
      error: (err) => {
        console.error('Failed to reject item:', err);
        this.error = 'Failed to reject item.';
      }
    });
  }
}