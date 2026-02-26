import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dev-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div>

      <!-- Hero -->
      <section class="bg-white border-b border-border/60">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold mx-auto mb-5 shadow-sm select-none">
            FF
          </span>
          <h1 class="text-4xl sm:text-5xl font-bold text-text-primary mb-3">FalconFind</h1>
          <p class="text-lg text-text-secondary max-w-2xl w-full mx-auto mb-5 text-center leading-relaxed" style="text-align: center;">
            The Fanshawe College lost &amp; found — digitized, organized, and only slightly over-engineered.
          </p>
          <div class="inline-flex items-center gap-2 rounded-full bg-warning/15 border border-warning/30 px-4 py-1.5 text-sm text-text-primary">
            <span aria-hidden="true">🚧</span>
            <span>Still in development — aka "it works on my machine"</span>
          </div>
        </div>
      </section>

      <!-- Action cards -->
      <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-5">What do you need?</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <a
            routerLink="/found-items"
            class="group flex flex-col rounded-xl border border-border/60 bg-white p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div class="rounded-lg bg-info/10 p-2.5 w-fit mb-3">
              <svg class="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Browse Found Items</h3>
            <p class="text-xs text-text-secondary flex-1 mb-0">See what's been turned in — your stuff might already be waiting for you.</p>
          </a>

          <a
            routerLink="/report/lost"
            class="group flex flex-col rounded-xl border border-border/60 bg-white p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div class="rounded-lg bg-error/10 p-2.5 w-fit mb-3">
              <svg class="h-5 w-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Report a Lost Item</h3>
            <p class="text-xs text-text-secondary flex-1 mb-0">Lost something? File a report and we'll help reunite you with your belongings.</p>
          </a>

          <a
            routerLink="/report/found"
            class="group flex flex-col rounded-xl border border-border/60 bg-white p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div class="rounded-lg bg-success/10 p-2.5 w-fit mb-3">
              <svg class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Report a Found Item</h3>
            <p class="text-xs text-text-secondary flex-1 mb-0">Found something? Be the hero someone needs. Turn it in here.</p>
          </a>

        </div>
      </section>

      <!-- Dev tool -->
      <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div class="rounded-xl border border-dashed border-border bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">Dev Tool — Open Item by ID</p>
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary/60"
              placeholder="Paste item ID"
              [value]="itemId"
              (input)="onItemIdInput($event)"
            />
            <button
              type="button"
              [disabled]="!itemId.trim()"
              (click)="openItemDetails()"
              class="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Open
            </button>
          </div>
        </div>
      </section>

    </div>
  `
})
export class DevHomeComponent {
  itemId = '';

  constructor(private router: Router) {}

  onItemIdInput(event: Event): void {
    this.itemId = (event.target as HTMLInputElement).value;
  }

  openItemDetails(): void {
    const value = this.itemId.trim();
    if (!value) return;
    void this.router.navigate(['/items', value]);
  }
}
