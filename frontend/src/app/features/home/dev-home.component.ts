import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dev-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="min-h-[70vh] grid place-items-center px-6">
      <div class="max-w-2xl w-full rounded-2xl border border-border bg-bg-secondary p-8 text-center shadow-sm">
        <p class="text-sm font-medium text-primary mb-2">FalconFind</p>
        <h1 class="text-3xl sm:text-4xl font-semibold text-text-primary mb-3">
          Site in Development
        </h1>
        <p class="text-text-secondary mb-6">
          Our developers are currently bribing bugs with coffee. Most pages are still under construction.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            routerLink="/report/lost"
            class="group inline-flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition hover:-translate-y-0.5 hover:bg-primary/20"
            aria-label="Go to Report Lost Item"
            title="Fly to Report Lost Item"
          >
            <svg
              class="h-7 w-7 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 2.25 10.5 13.5" />
              <path stroke-linecap="round" stroke-linejoin="round" d="m21.75 2.25-7.5 19.5-3.75-8.25-8.25-3.75 19.5-7.5Z" />
            </svg>
          </a>
          <a
            routerLink="/report/found"
            class="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            Report Found Item
          </a>
        </div>

        <div class="mt-8 border-t border-border pt-6 text-left">
          <p class="text-sm font-medium text-text-primary mb-2">Open Item Details (dev)</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
              placeholder="Paste item id"
              [value]="itemId"
              (input)="onItemIdInput($event)"
            />
            <button
              type="button"
              class="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="!itemId.trim()"
              (click)="openItemDetails()"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DevHomeComponent {
  itemId = '';

  constructor(private router: Router) {}

  onItemIdInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.itemId = input.value;
  }

  openItemDetails(): void {
    const value = this.itemId.trim();
    if (!value) {
      return;
    }

    void this.router.navigate(['/items', value]);
  }
}
