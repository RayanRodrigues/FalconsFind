import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { timeout } from 'rxjs/operators';
import { ItemsApiService } from '../../../core/services/items-api.service';
import type { ItemPublicResponse } from '../../../models';

@Component({
  selector: 'app-home-recent-items',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home-recent-items.component.css',
  templateUrl: './home-recent-items.component.html',
})
export class HomeRecentItemsComponent implements OnInit {
  private readonly itemsApi = inject(ItemsApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(true);
  readonly items = signal<ItemPublicResponse[]>([]);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }

    this.itemsApi.getFoundItems(1, 3)
      .pipe(timeout(5000))
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
