import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg)]">

      <!-- Background blobs -->
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute left-1/2 top-16 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
        <div class="absolute -left-10 bottom-10 h-48 w-48 rounded-full bg-primary/5 blur-3xl"></div>
        <div class="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-primary/8 blur-3xl"></div>
      </div>

      <div class="relative mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 sm:py-28">

        <img
          src="/PNG/LogoPrincipalTwo.png"
          alt="FalconFind"
          class="mx-auto mb-10 h-auto w-[140px]"
        />

        <h1 class="mb-5 text-4xl font-bold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
          Your Campus Lost &amp; Found, Now Digital
        </h1>
        <p class="mx-auto mb-10 text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
          Report lost items, browse what's been turned in, and claim what's yours — all in one place.
        </p>

        <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            routerLink="/found-items"
            class="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-secondary sm:w-auto"
          >Browse Found Items</a>
          <a
            routerLink="/report/lost"
            class="inline-flex w-full items-center justify-center rounded-full border border-[var(--color-border)] bg-transparent px-8 py-3.5 text-base font-semibold text-[var(--color-text-primary)] transition-colors hover:border-primary hover:text-primary sm:w-auto"
          >Report a Lost Item</a>
        </div>

      </div>
    </section>
  `,
})
export class HomeHeroComponent {}
