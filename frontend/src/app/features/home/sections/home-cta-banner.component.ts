import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-cta-banner',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home-cta-banner.component.css',
  template: `
    <section class="cta-section">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <p class="cta-eyebrow">Need help?</p>
        <h2 class="cta-title">Not sure where to start?</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <a routerLink="/report/lost" class="cta-card">
            <div class="cta-card__icon">
              <svg style="width:24px;height:24px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="cta-card__body">
              <p class="cta-card__title">I lost something</p>
              <p class="cta-card__desc">File a report so Campus Security can match it if someone turns it in.</p>
            </div>
            <svg class="cta-card__arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <a routerLink="/report/found" class="cta-card">
            <div class="cta-card__icon">
              <svg style="width:24px;height:24px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="cta-card__body">
              <p class="cta-card__title">I found something</p>
              <p class="cta-card__desc">Submit a report with a photo and help reunite someone with their belongings.</p>
            </div>
            <svg class="cta-card__arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>

        </div>
      </div>
    </section>
  `,
})
export class HomeCtaBannerComponent {}
