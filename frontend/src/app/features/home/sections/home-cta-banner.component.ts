import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-cta-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section style="background-color: #1e2433;">
      <div class="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">

        <p class="mb-2 text-center text-xs font-semibold uppercase tracking-widest" style="color: rgba(255,255,255,0.6);">Need help?</p>
        <h2 class="mb-10 text-center text-2xl font-bold leading-tight" style="color: #ffffff;">Not sure where to start?</h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <a routerLink="/report/lost" class="cta-card group flex items-center gap-4 rounded-2xl p-5 transition-colors" style="background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style="background: rgba(255,255,255,0.15); color: #ffffff;">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="mb-1 text-[0.9375rem] font-semibold" style="color: #ffffff;">I lost something</p>
              <p class="text-[0.8125rem] leading-relaxed" style="color: rgba(255,255,255,0.6);">File a report so Campus Security can match it if someone turns it in.</p>
            </div>
            <svg class="cta-arrow h-5 w-5 shrink-0 transition-transform duration-150" style="color: rgba(255,255,255,0.5);" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <a routerLink="/report/found" class="cta-card group flex items-center gap-4 rounded-2xl p-5 transition-colors" style="background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style="background: rgba(255,255,255,0.15); color: #ffffff;">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="mb-1 text-[0.9375rem] font-semibold" style="color: #ffffff;">I found something</p>
              <p class="text-[0.8125rem] leading-relaxed" style="color: rgba(255,255,255,0.6);">Submit a report with a photo and help reunite someone with their belongings.</p>
            </div>
            <svg class="cta-arrow h-5 w-5 shrink-0 transition-transform duration-150" style="color: rgba(255,255,255,0.5);" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>

        </div>
      </div>
    </section>
  `,
  styles: [`
    .cta-card:hover {
      background: rgba(255,255,255,0.18) !important;
      border-color: rgba(255,255,255,0.30) !important;
    }
    .cta-card:hover .cta-arrow {
      transform: translateX(3px);
      color: #ffffff !important;
    }
  `],
})
export class HomeCtaBannerComponent {}
