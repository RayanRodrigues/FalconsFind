import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-statistics-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
      <div class="space-y-6">
        <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-5 shadow-sm">
          <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Performance Snapshot</p>
          <h2 class="mb-3 text-lg font-bold text-text-primary">Return and closure signals</h2>

          <div class="grid gap-3">
            <div class="rounded-xl border border-border/50 bg-[var(--color-surface-2)]/45 px-4 py-4">
              <p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Returned Items</p>
              <p class="mb-1 text-2xl font-bold text-primary">{{ returnedCount }}</p>
              <p class="mb-0 text-sm text-text-secondary">Items that completed the recovery cycle.</p>
            </div>

            <div class="rounded-xl border border-border/50 bg-[var(--color-surface-2)]/45 px-4 py-4">
              <p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Archived Items</p>
              <p class="mb-1 text-2xl font-bold text-text-primary">{{ archivedCount }}</p>
              <p class="mb-0 text-sm text-text-secondary">Items closed out of the active operational workflow.</p>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-5 shadow-sm">
          <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Top Locations</p>
          <h2 class="mb-4 text-lg font-bold text-text-primary">Where items are most often reported</h2>

          <div class="space-y-3">
            @for (entry of topLocations; track entry.location; let rank = $index) {
              <div class="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-[var(--color-surface-2)]/45 px-4 py-3">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {{ rank + 1 }}
                  </div>
                  <span class="truncate text-sm font-medium text-text-primary">{{ entry.location }}</span>
                </div>
                <span class="text-sm font-bold text-primary">{{ entry.count }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-5 shadow-sm">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Category Breakdown</p>
            <h2 class="mb-0 text-lg font-bold text-text-primary">Most common report categories</h2>
          </div>
          <p class="mb-0 text-sm text-text-secondary">Highlights which item groups generate the most operational activity.</p>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
          @for (entry of topCategories; track entry.category) {
            <div class="rounded-xl border border-border/50 bg-[var(--color-surface-2)]/45 px-4 py-4">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Category</p>
                  <p class="mb-0 truncate text-sm font-semibold text-text-primary">{{ entry.category }}</p>
                </div>
                <p class="mb-0 text-2xl font-bold text-primary">{{ entry.count }}</p>
              </div>

              <div class="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-300"
                  [style.width.%]="totalReported > 0 ? (entry.count / totalReported) * 100 : 0"
                ></div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminStatisticsSummaryComponent {
  @Input() returnedCount = 0;
  @Input() archivedCount = 0;
  @Input() totalReported = 0;
  @Input() topLocations: Array<{ location: string; count: number }> = [];
  @Input() topCategories: Array<{ category: string; count: number }> = [];
}
