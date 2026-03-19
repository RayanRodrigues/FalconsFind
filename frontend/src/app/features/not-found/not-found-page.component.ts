import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="relative overflow-hidden bg-white">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute left-1/2 top-16 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
        <div class="absolute -left-10 bottom-10 h-48 w-48 rounded-full bg-soft-accent/35 blur-3xl"></div>
        <div class="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-info/10 blur-3xl"></div>
      </div>

      <div class="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div class="w-full text-center">
          <div class="mx-auto flex w-fit items-center justify-center gap-2 sm:gap-5">
            <span class="text-[92px] font-black leading-none tracking-[-0.09em] text-primary sm:text-[180px]">4</span>
            <div class="not-found-search relative flex h-24 w-24 items-center justify-center sm:h-36 sm:w-36">
              <img
                src="/SVG/Icon1.svg"
                alt="FalconFind"
                class="not-found-search__icon relative h-12 w-auto sm:h-16"
              />
            </div>
            <span class="text-[92px] font-black leading-none tracking-[-0.09em] text-primary sm:text-[180px]">4</span>
          </div>

          <div class="mx-auto mt-8 flex max-w-3xl flex-col items-center text-center">
            <p class="rounded-full border border-primary/15 bg-primary/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary sm:text-xs">
              Lost Page Report
            </p>

            <h1 class="mt-5 text-4xl font-black leading-none tracking-[-0.05em] text-text-primary sm:text-7xl">
              This page pulled a disappearing act
            </h1>
            <p class="mt-4 text-lg font-medium text-primary sm:text-2xl">
              Good news: the rest of FalconFind is still on the case.
            </p>

            <p class="mt-8 max-w-2xl text-base leading-8 text-text-secondary sm:text-xl">
              We checked the usual hiding spots and this route is still missing. Head back home, browse found items, or file a report before the trail goes cold.
            </p>

            <div class="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                routerLink="/"
                class="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 text-base font-semibold !text-white shadow-[0_18px_40px_rgba(30,64,175,0.22)] transition-colors hover:bg-secondary sm:px-10"
              >
                Back Home
              </a>
              <a
                routerLink="/found-items"
                class="inline-flex items-center justify-center rounded-full border border-border bg-white px-8 py-3.5 text-base font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary sm:px-10"
              >
                Browse Found Items
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .not-found-search {
      animation: not-found-search-sweep 3.6s ease-in-out infinite;
      transform-origin: center center;
    }

    .not-found-search__icon {
      filter: drop-shadow(0 16px 24px rgba(15, 23, 42, 0.12));
    }

    @keyframes not-found-search-sweep {
      0%, 100% {
        transform: translateX(-8px) translateY(0) rotate(-10deg);
      }

      25% {
        transform: translateX(8px) translateY(-3px) rotate(8deg);
      }

      50% {
        transform: translateX(18px) translateY(2px) rotate(14deg);
      }

      75% {
        transform: translateX(2px) translateY(-2px) rotate(-2deg);
      }
    }
  `],
})
export class NotFoundPageComponent {}
