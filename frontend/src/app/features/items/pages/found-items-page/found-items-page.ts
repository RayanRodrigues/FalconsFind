import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

type ItemsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: any[];
};

@Component({
  selector: 'app-found-items-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './found-items-page.html',
  styleUrl: './found-items-page.css',
})
export class FoundItemsPageComponent implements OnInit {
  loading = true;
  error = false;

  items: any[] = [];

  page = 1;
  limit = 10;
  totalPages = 1;
  hasNextPage = false;
  hasPrevPage = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems() {
    this.loading = true;
    this.error = false;
    this.cdr.detectChanges(); // force UI update immediately

    this.http
      .get<ItemsResponse>(`/items?page=${this.page}&limit=${this.limit}`)
      .pipe(
        timeout(3000),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges(); // force UI update when request finishes
        })
      )
      .subscribe({
        next: (response) => {
          this.items = response.items;
          this.page = response.page;
          this.limit = response.limit;
          this.totalPages = response.totalPages;
          this.hasNextPage = response.hasNextPage;
          this.hasPrevPage = response.hasPrevPage;
          this.cdr.detectChanges(); // force UI update with results
        },
        error: (err) => {
          console.log('[FoundItems] request failed:', err);
          this.error = true;
          this.cdr.detectChanges(); // force UI update to error state
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
}