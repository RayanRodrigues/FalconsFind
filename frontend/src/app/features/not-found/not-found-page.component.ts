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

      <div class="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div class="flex w-full flex-col items-center text-center">
          <div class="mx-auto flex w-fit items-end justify-center gap-1 sm:gap-3">
            <span class="text-[88px] font-bold leading-none tracking-[-0.08em] text-primary sm:text-[160px]">4</span>
            <span class="flex h-20 w-20 items-center justify-center sm:h-32 sm:w-32">
              <img
                src="/SVG/Icon1.svg"
                alt="FalconFind"
                class="not-found-search__icon relative h-12 w-auto sm:h-16"
              />
            </span>
            <span class="text-[88px] font-bold leading-none tracking-[-0.08em] text-primary sm:text-[160px]">4</span>
            <span class="mb-2 ml-2 text-2xl font-semibold uppercase tracking-tight text-text-primary sm:mb-4 sm:ml-4 sm:text-5xl">
              Error
            </span>
          </div>

          <div class="mx-auto mt-10 flex w-full max-w-2xl flex-col items-center text-center">
            <h1 class="text-5xl font-bold uppercase leading-none tracking-[-0.05em] text-text-primary sm:text-8xl">
              OH NO!
            </h1>
            <p class="mt-4 text-lg font-medium text-primary sm:text-2xl">
              Good news: the rest of FalconFind is still on the case.
            </p>

            <p class="mt-8 max-w-2xl text-base leading-8 text-text-secondary sm:text-xl">
              We checked the usual hiding spots and this route is still missing. Head back home, browse found items, or file a report before the trail goes cold.
            </p>

            <a
              routerLink="/"
              class="mt-12 inline-flex items-center justify-center rounded-xl bg-primary px-10 py-4 text-lg font-semibold !text-white shadow-sm transition-colors hover:bg-secondary sm:px-16"
            >
              Back to home
            </a>
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
