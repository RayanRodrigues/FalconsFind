import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-statistics-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-2xl border border-border/60 bg-[var(--color-surface)] p-5 shadow-sm">
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Analytics Filters</p>
            <p class="mb-0 text-sm text-text-secondary">
              Narrow the dataset to inspect operational volume, recovery progress, and concentration by category or location.
            </p>
          </div>

          <div class="rounded-full border border-border/60 bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-text-secondary">
            @if (latestReportedAt) {
              Latest report in view: {{ latestReportedAt | date: 'mediumDate' }}
            } @else {
              No report dates available in the current view
            }
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Date From</label>
            <input
              type="date"
              [ngModel]="dateFrom"
              (ngModelChange)="dateFromChange.emit($event)"
              class="w-full rounded-xl border border-border bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Category</label>
            <select
              [ngModel]="categoryFilter"
              (ngModelChange)="categoryFilterChange.emit($event)"
              class="w-full rounded-xl border border-border bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="all">All categories</option>
              @for (category of uniqueCategories; track category) {
                <option [value]="category.toLowerCase()">{{ category }}</option>
              }
            </select>
          </div>

          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Location</label>
            <input
              type="text"
              [ngModel]="locationFilter"
              (ngModelChange)="locationFilterChange.emit($event)"
              placeholder="Search location"
              class="w-full rounded-xl border border-border bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] transition placeholder:text-[var(--color-text-secondary)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div class="flex items-end">
            <button
              type="button"
              (click)="clear.emit()"
              class="w-full rounded-xl border border-border bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:border-primary/30 hover:text-primary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminStatisticsFiltersComponent {
  @Input() latestReportedAt: Date | null = null;
  @Input() dateFrom = '';
  @Input() categoryFilter = 'all';
  @Input() locationFilter = '';
  @Input() uniqueCategories: string[] = [];

  @Output() readonly dateFromChange = new EventEmitter<string>();
  @Output() readonly categoryFilterChange = new EventEmitter<string>();
  @Output() readonly locationFilterChange = new EventEmitter<string>();
  @Output() readonly clear = new EventEmitter<void>();
}
