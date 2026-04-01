import { Component } from '@angular/core';

@Component({
  selector: 'app-home-how-it-works',
  standalone: true,
  template: `
    <section class="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">

        <p class="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-primary">Step by step</p>
        <h2 class="mb-14 text-center text-2xl font-bold text-[var(--color-text-primary)]">How it works</h2>

        <div class="grid grid-cols-1 gap-6 text-center sm:grid-cols-3 sm:gap-12">

          <div class="flex flex-col items-center">
            <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">1</div>
            <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Found something?</h3>
            <p class="text-xs leading-relaxed text-[var(--color-text-secondary)]">Submit a quick report with a photo and description. Campus Security reviews and posts it.</p>
          </div>

          <div class="flex flex-col items-center">
            <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">2</div>
            <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Browse validated items</h3>
            <p class="text-xs leading-relaxed text-[var(--color-text-secondary)]">Search by category, location, or date to find your item in our verified lost &amp; found list.</p>
          </div>

          <div class="flex flex-col items-center">
            <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">3</div>
            <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Claim it back</h3>
            <p class="text-xs leading-relaxed text-[var(--color-text-secondary)]">Submit a claim and, once approved by Campus Security, arrange to collect your belongings.</p>
          </div>

        </div>
      </div>
    </section>
  `,
})
export class HomeHowItWorksComponent {}
