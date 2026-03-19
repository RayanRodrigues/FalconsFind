import { Component } from '@angular/core';

@Component({
  selector: 'app-home-how-it-works',
  standalone: true,
  template: `
    <section class="bg-white border-t border-border/60">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">

        <p class="section-eyebrow text-center">Step by step</p>
        <h2 class="section-title text-center" style="margin-bottom: 3.5rem;">How it works</h2>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-12 text-center">

          <div class="flex flex-col items-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-5">1</div>
            <h3 class="font-semibold text-text-primary text-sm mb-2">Found something?</h3>
            <p class="text-xs text-text-secondary leading-relaxed">Submit a quick report with a photo and description. Campus Security reviews and posts it.</p>
          </div>

          <div class="flex flex-col items-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-5">2</div>
            <h3 class="font-semibold text-text-primary text-sm mb-2">Browse validated items</h3>
            <p class="text-xs text-text-secondary leading-relaxed">Search by category, location, or date to find your item in our verified lost &amp; found list.</p>
          </div>

          <div class="flex flex-col items-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-5">3</div>
            <h3 class="font-semibold text-text-primary text-sm mb-2">Claim it back</h3>
            <p class="text-xs text-text-secondary leading-relaxed">Submit a claim and, once approved by Campus Security, arrange to collect your belongings.</p>
          </div>

        </div>
      </div>
    </section>
  `,
})
export class HomeHowItWorksComponent {}
