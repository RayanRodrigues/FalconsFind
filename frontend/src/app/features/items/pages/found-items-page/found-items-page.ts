import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import type { ItemPublicResponse } from '../../../../models';
import { ItemsApiService, type ItemsListResponse } from '../../../../core/services/items-api.service';

@Component({
  selector: 'app-found-items-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './found-items-page.html',
  styleUrl: './found-items-page.css',
})
export class FoundItemsPageComponent implements OnInit {
  loading = true;
  error = false;

  items: ItemPublicResponse[] = [];

  page = 1;
  limit = 10;
  totalPages = 1;
  hasNextPage = false;
  hasPrevPage = false;

  constructor(private itemsApi: ItemsApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems() {
    this.loading = true;
    this.error = false;
    this.cdr.detectChanges();

    this.itemsApi
      .getFoundItems(this.page, this.limit)
      .pipe(
        timeout(3000),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: ItemsListResponse) => {
          this.items = response.items;
          this.page = response.page;
          this.limit = response.limit;
          this.totalPages = response.totalPages;
          this.hasNextPage = response.hasNextPage;
          this.hasPrevPage = response.hasPrevPage;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.log('[FoundItems] request failed:', err);
          this.error = true;
          this.cdr.detectChanges();
        },
      });
  }

  retry() {
    this.loadItems();
  }

  prev() {
    if (!this.hasPrevPage) return;
    this.page -= 1;
    this.loadItems();
  }

  next() {
    if (!this.hasNextPage) return;
    this.page += 1;
    this.loadItems();
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
