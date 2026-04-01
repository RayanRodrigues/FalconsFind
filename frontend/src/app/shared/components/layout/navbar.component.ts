import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserRole } from '../../../models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header [class]="headerClass">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-[72px] items-center justify-between gap-4">

          <!-- Logo: white version in dark mode -->
          <a routerLink="/" class="shrink-0" aria-label="FalconFind – Home">
            <img
              [src]="isDarkMode() ? '/PNG/LogoBranco.png' : '/PNG/LogoPrincipal.png'"
              alt="FalconFind"
              class="h-[30px] w-auto"
            />
          </a>

          <!-- Desktop nav links -->
          <nav class="hidden items-center gap-0.5 sm:flex" aria-label="Main navigation">
            <a routerLink="/found-items" routerLinkActive="font-semibold !bg-primary !text-white" [class]="navLinkClass">Browse Found Items</a>
            <a routerLink="/report/lost"  routerLinkActive="font-semibold !bg-primary !text-white" [class]="navLinkClass">Report Lost</a>
            <a routerLink="/report/found" routerLinkActive="font-semibold !bg-primary !text-white" [class]="navLinkClass">Report Found</a>
            <a routerLink="/claim-request" routerLinkActive="font-semibold !bg-primary !text-white" [class]="navLinkClass">Claim Request</a>
          </nav>

          <!-- Desktop right side -->
          <div class="hidden items-center gap-2 sm:flex">

            <!-- Admin/Security session -->
            @if (isAdmin()) {
              <a routerLink="/admin/dashboard" [class]="actionBtnClass">Dashboard</a>
              <button
                type="button"
                (click)="logout()"
                aria-label="Logout"
                class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-primary hover:text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </button>

            <!-- Student session -->
            } @else if (isStudent()) {
              <a routerLink="/my-claims" routerLinkActive="font-semibold !bg-primary !text-white" [class]="navLinkClass">My Claims</a>
              <button
                type="button"
                (click)="logout()"
                aria-label="Logout"
                class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-primary hover:text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </button>

            <!-- Not authenticated -->
            } @else {
              <a routerLink="/login" [class]="actionBtnClass">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Login
              </a>
            }

            <!-- Theme toggle icon -->
            <button
              type="button"
              (click)="toggleTheme()"
              class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-primary hover:text-primary"
              [attr.aria-label]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              @if (isDarkMode()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              }
            </button>
          </div>

          <!-- Mobile hamburger -->
          <button
            type="button"
            (click)="toggleMenu()"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-primary hover:text-primary sm:hidden"
            [attr.aria-label]="menuOpen() ? 'Close menu' : 'Open menu'"
            [attr.aria-expanded]="menuOpen()"
          >
            @if (menuOpen()) {
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            }
          </button>
        </div>

        <!-- Mobile menu -->
        @if (menuOpen()) {
          <nav class="flex flex-col gap-0.5 border-t border-[var(--color-border)] py-3 sm:hidden" aria-label="Mobile navigation">
            <a routerLink="/found-items"  (click)="closeMenu()" routerLinkActive="font-semibold !bg-primary !text-white" [class]="mobileNavLinkClass">Browse Found Items</a>
            <a routerLink="/report/lost"  (click)="closeMenu()" routerLinkActive="font-semibold !bg-primary !text-white" [class]="mobileNavLinkClass">Report Lost</a>
            <a routerLink="/report/found" (click)="closeMenu()" routerLinkActive="font-semibold !bg-primary !text-white" [class]="mobileNavLinkClass">Report Found</a>
            <a routerLink="/claim-request" (click)="closeMenu()" routerLinkActive="font-semibold !bg-primary !text-white" [class]="mobileNavLinkClass">Claim Request</a>

            <div class="my-1.5 border-t border-[var(--color-border)]"></div>

            @if (isAdmin()) {
              <a routerLink="/admin/dashboard" (click)="closeMenu()" [class]="mobileActionBtnClass">Dashboard</a>
              <button type="button" (click)="logout()" [class]="mobileItemClass">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
                Logout
              </button>
            } @else if (isStudent()) {
              <a routerLink="/my-claims" (click)="closeMenu()" routerLinkActive="font-semibold !bg-primary !text-white" [class]="mobileNavLinkClass">My Claims</a>
              <button type="button" (click)="logout()" [class]="mobileItemClass">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
                Logout
              </button>
            } @else {
              <a routerLink="/login" (click)="closeMenu()" [class]="mobileActionBtnClass">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Login
              </a>
            }

            <div class="my-1.5 border-t border-[var(--color-border)]"></div>

            <button type="button" (click)="toggleTheme()" [class]="mobileItemClass">
              @if (isDarkMode()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
                Light Mode
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
                Dark Mode
              }
            </button>
          </nav>
        }
      </div>
    </header>
  `,
  styles: [``],
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly menuOpen = signal(false);

  readonly authSession = computed(() => this.authService.session());

  readonly isStudent = computed(() =>
    this.authSession()?.user.role === UserRole.STUDENT
  );

  readonly isAdmin = computed(() => {
    const role = this.authSession()?.user.role;
    return role === UserRole.ADMIN || role === UserRole.SECURITY;
  });

  get headerClass(): string {
    const bg = this.isDarkMode() ? 'bg-[#1E293B]' : 'bg-[var(--color-surface-2)]';
    return `fixed left-0 right-0 top-0 z-[100] border-b border-[var(--color-border)] shadow-sm ${bg}`;
  }

  // Nav link text adapts: brand crimson in light, near-white in dark (no red on hover in dark)
  get navLinkClass(): string {
    return 'rounded-full px-3.5 py-1.5 text-sm text-[var(--color-nav-link)] transition-colors hover:bg-primary/12';
  }

  get mobileNavLinkClass(): string {
    return 'rounded-lg px-3 py-2.5 text-sm text-[var(--color-nav-link)] transition-colors hover:bg-primary/12';
  }

  get actionBtnClass(): string {
    return 'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-nav-action-border)] px-5 py-1.5 text-sm font-semibold text-[var(--color-nav-action-text)] transition-colors hover:border-primary hover:bg-primary hover:text-white';
  }

  get mobileActionBtnClass(): string {
    return 'inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-nav-action-border)] px-5 py-2 text-sm font-semibold text-[var(--color-nav-action-text)] transition-colors hover:border-primary hover:bg-primary hover:text-white';
  }

  // Mobile list-row items (logout, theme toggle)
  get mobileItemClass(): string {
    const hoverColor = this.isDarkMode() ? '' : 'hover:text-primary';
    return `flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/12 text-[var(--color-text-secondary)] ${hoverColor}`;
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  logout(): void {
    this.authService.logoutStudent();
    this.menuOpen.set(false);
    void this.router.navigate(['/login']);
  }
}
