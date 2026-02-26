import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="sticky top-0 z-50 bg-white border-b border-border/60 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between gap-4">

          <!-- Brand -->
          <a
            routerLink="/"
            class="flex items-center gap-2 font-semibold text-base text-text-primary hover:text-primary transition-colors shrink-0"
          >
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white text-xs font-bold select-none">
              FF
            </span>
            FalconFind
          </a>

          <!-- Desktop nav -->
          <nav class="hidden sm:flex items-center gap-1" aria-label="Main navigation">
            <a
              routerLink="/found-items"
              routerLinkActive="bg-primary/10 !text-primary"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Browse Found Items
            </a>
            <a
              routerLink="/report/lost"
              routerLinkActive="bg-primary/10 !text-primary"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Report Lost
            </a>
            <a
              routerLink="/report/found"
              routerLinkActive="bg-primary/10 !text-primary"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Report Found
            </a>
          </nav>

          <!-- Mobile menu button -->
          <button
            type="button"
            (click)="toggleMenu()"
            [attr.aria-expanded]="menuOpen()"
            aria-label="Toggle navigation"
            class="sm:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-border text-text-secondary hover:bg-neutral-base transition-colors"
          >
            @if (menuOpen()) {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            } @else {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            }
          </button>

        </div>

        <!-- Mobile menu -->
        @if (menuOpen()) {
          <nav class="sm:hidden border-t border-border/60 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
            <a
              routerLink="/found-items"
              routerLinkActive="bg-primary/10 !text-primary"
              (click)="closeMenu()"
              class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Browse Found Items
            </a>
            <a
              routerLink="/report/lost"
              routerLinkActive="bg-primary/10 !text-primary"
              (click)="closeMenu()"
              class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Report Lost
            </a>
            <a
              routerLink="/report/found"
              routerLinkActive="bg-primary/10 !text-primary"
              (click)="closeMenu()"
              class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Report Found
            </a>
          </nav>
        }

      </div>
    </header>
  `
})
export class NavbarComponent {
  menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
