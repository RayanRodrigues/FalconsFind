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
        <div class="absolute left-1/2 top-20 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"></div>
        <div class="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-soft-accent/30 blur-3xl"></div>
      </div>

      <div class="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div class="flex w-full flex-col items-center text-center">
          <div class="mx-auto flex w-fit items-end justify-center gap-1 sm:gap-3">
            <span class="text-[88px] font-bold leading-none tracking-[-0.08em] text-primary sm:text-[160px]">4</span>
            <span class="flex h-20 w-20 items-center justify-center sm:h-32 sm:w-32">
              <img
                src="/SVG/Icon1.svg"
                alt="FalconFind icon"
                class="h-16 w-auto sm:h-24"
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
            <p class="mt-3 text-2xl font-medium text-primary sm:text-4xl">
              But that's okay.
            </p>

            <p class="mt-8 max-w-xl text-base leading-8 text-text-secondary sm:text-xl">
              Even good detectives take a wrong turn sometimes. This page is missing, but your way back is not.
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
})
export class NotFoundPageComponent {}
