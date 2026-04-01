import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type AdminToolbarViewOption = {
  label: string;
  value: string;
  tone?: 'primary' | 'slate' | 'info';
};

export type AdminToolbarStatusOption = {
  label: string;
  value: string;
};

@Component({
  selector: 'app-admin-list-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-2">
          @for (option of viewOptions; track option.value) {
            <button
              type="button"
              (click)="viewChange.emit(option.value)"
              class="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
              [class]="getViewButtonClasses(option)"
            >
              {{ option.label }}
            </button>
          }

          @if (actionLabel) {
            <button
              type="button"
              (click)="actionClick.emit()"
              [disabled]="actionDisabled"
              class="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
              [class]="actionDisabled
                ? 'border-border bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] cursor-not-allowed'
                : 'border-primary bg-primary text-white hover:opacity-90'"
            >
              {{ actionLabel }}
            </button>
          }
        </div>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="relative flex-1">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              style="width:16px;height:16px;flex-shrink:0;"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              [ngModel]="searchValue"
              (ngModelChange)="searchValueChange.emit($event)"
              [placeholder]="searchPlaceholder"
              class="w-full rounded-lg border border-border bg-[var(--color-surface)] pl-9 pr-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
            />
          </div>

          <select
            [ngModel]="statusValue"
            (ngModelChange)="statusValueChange.emit($event)"
            class="rounded-lg border border-border px-3 py-2 text-sm bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
          >
            @for (option of statusOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>

          <span class="text-xs text-[var(--color-text-secondary)] lg:ml-auto">
            {{ resultsCount }} result{{ resultsCount === 1 ? '' : 's' }}
            @if (selectedCount > 0) {
              <span> • {{ selectedCount }} selected</span>
            }
          </span>
        </div>
      </div>
    </div>
  `,
})
export class AdminListToolbarComponent {
  @Input() viewOptions: AdminToolbarViewOption[] = [];
  @Input() activeView = '';
  @Input() actionLabel = '';
  @Input() actionDisabled = false;
  @Input() searchValue = '';
  @Input() searchPlaceholder = 'Search...';
  @Input() statusValue = '';
  @Input() statusOptions: AdminToolbarStatusOption[] = [];
  @Input() resultsCount = 0;
  @Input() selectedCount = 0;

  @Output() viewChange = new EventEmitter<string>();
  @Output() actionClick = new EventEmitter<void>();
  @Output() searchValueChange = new EventEmitter<string>();
  @Output() statusValueChange = new EventEmitter<string>();

  getViewButtonClasses(option: AdminToolbarViewOption): string {
    const tone = option.tone ?? 'primary';
    const active = this.activeView === option.value;

    if (active) {
      if (tone === 'slate') return 'border-slate-400 bg-slate-700 text-white';
      if (tone === 'info') return 'border-info bg-info text-white';
      return 'border-primary bg-primary text-white';
    }

    if (tone === 'slate') {
      return 'border-border bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-slate-400 hover:text-slate-700';
    }

    if (tone === 'info') {
      return 'border-border bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-info hover:text-info';
    }

    return 'border-border bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-primary hover:text-primary';
  }
}
