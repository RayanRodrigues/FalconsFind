import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home-hero.component.css',
  template: `
    <section class="bg-white border-b border-border/60">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">

        <img
          src="/PNG/LogoPrincipalTwo.png"
          alt="FalconFind"
          style="width: 140px; height: auto; margin: 0 auto 2.5rem;"
        />

        <h1 class="text-4xl sm:text-5xl font-bold text-text-primary mb-5 leading-tight">
          Your Campus Lost &amp; Found, Now Digital
        </h1>
        <p class="text-base sm:text-lg text-text-secondary mx-auto mb-10 leading-relaxed">
          Report lost items, browse what's been turned in, and claim what's yours — all in one place.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a routerLink="/found-items" class="btn-primary w-full sm:w-auto">Browse Found Items</a>
          <a routerLink="/report/lost" class="btn-outline w-full sm:w-auto">Report a Lost Item</a>
        </div>

      </div>
    </section>
  `,
})
export class HomeHeroComponent {}
