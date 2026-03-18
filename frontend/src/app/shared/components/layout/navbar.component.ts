import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border/60 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-[72px] items-center justify-between gap-4">

          <!-- Brand -->
          <a routerLink="/" class="shrink-0" aria-label="FalconFind – Home">
            <img
              src="/PNG/LogoPrincipal.png"
              alt="FalconFind"
              style="height: 30px; width: auto;"
            />
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
            <a
              routerLink="/claim-request"
              routerLinkActive="bg-primary/10 !text-primary"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors"
            >
              Claim Request
            </a>
          </nav>

          <!-- Auth CTA (desktop) -->
          <div class="hidden sm:flex items-center gap-2 shrink-0">
            @if (studentSession()) {
              <!-- User pill -->
              <span class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">
                  {{ initials() }}
                </span>
                {{ displayName() }}
              </span>
              <!-- Logout -->
              <button
                type="button"
                (click)="logout()"
                class="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-text-primary hover:border-red-400 hover:text-red-500 transition-colors"
              >
                <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log out
              </button>
            } @else if (isAdminSession()) {
              <a
                routerLink="/admin/dashboard"
                class="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors"
              >
                <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
            } @else {
              <a
                routerLink="/login"
                [routerLinkActive]="'navbar-login--active'"
                [routerLinkActiveOptions]="{ exact: true }"
                class="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors"
              >
                <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Login
              </a>
            }
          </div>

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
            <a routerLink="/found-items" routerLinkActive="bg-primary/10 !text-primary" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors">
              Browse Found Items
            </a>
            <a routerLink="/report/lost" routerLinkActive="bg-primary/10 !text-primary" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors">
              Report Lost
            </a>
            <a routerLink="/report/found" routerLinkActive="bg-primary/10 !text-primary" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors">
              Report Found
            </a>
            <a routerLink="/claim-request" routerLinkActive="bg-primary/10 !text-primary" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-neutral-base hover:text-text-primary transition-colors">
              Claim Request
            </a>

            <div class="border-t border-border/60 mt-1 pt-2">
              @if (studentSession()) {
                <div class="px-3 py-2 flex items-center gap-2 text-sm text-text-secondary mb-1">
                  <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">{{ initials() }}</span>
                  {{ displayName() }}
                </div>
                <button type="button" (click)="logout()" class="w-full text-left rounded-lg px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                  <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log out
                </button>
              } @else if (isAdminSession()) {
                <a routerLink="/admin/dashboard" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-neutral-base transition-colors flex items-center gap-2">
                  <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </a>
              } @else {
                <a routerLink="/login" (click)="closeMenu()" class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-neutral-base transition-colors flex items-center gap-2">
                  <svg style="width:15px;height:15px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Login
                </a>
              }
            </div>
          </nav>
        }

      </div>
    </header>
  `,
  styles: [`.navbar-login--active { display: none !important; }`]
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  menuOpen = signal(false);

  readonly studentSession = computed(() => {
    const s = this.authService.session();
    return s?.user.role === UserRole.STUDENT ? s : null;
  });

  readonly isAdminSession = computed(() => {
    const role = this.authService.session()?.user.role;
    return role === UserRole.ADMIN || role === UserRole.SECURITY;
  });

  readonly displayName = computed(() => {
    const s = this.studentSession();
    if (!s) return '';
    return s.user.displayName || s.user.email.split('@')[0];
  });

  readonly initials = computed(() => {
    const name = this.displayName();
    const parts = name.split(/[\s._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });

  toggleMenu(): void { this.menuOpen.update(v => !v); }
  closeMenu(): void { this.menuOpen.set(false); }

  logout(): void {
    this.authService.logoutStudent();
    this.closeMenu();
    void this.router.navigate(['/login']);
  }
}
