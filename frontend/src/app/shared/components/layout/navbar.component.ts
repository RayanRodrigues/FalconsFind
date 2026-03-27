import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserRole } from '../../../models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header
      class="fixed top-0 left-0 right-0 z-[100] border-b shadow-sm"
      style="background-color: var(--color-bg); border-color: var(--color-border); color: var(--color-text-primary);"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-[72px] items-center justify-between gap-4">

          <a routerLink="/" class="shrink-0" aria-label="FalconFind – Home">
            <img src="/PNG/LogoPrincipal.png" alt="FalconFind" style="height: 30px;" />
          </a>

          <nav class="hidden sm:flex items-center gap-2">
            <a routerLink="/found-items" class="px-3 py-1.5 text-sm" style="color: var(--color-text-primary);">Browse</a>
            <a routerLink="/report/lost" class="px-3 py-1.5 text-sm" style="color: var(--color-text-primary);">Lost</a>
            <a routerLink="/report/found" class="px-3 py-1.5 text-sm" style="color: var(--color-text-primary);">Found</a>
          </nav>

          <div class="hidden sm:flex items-center gap-2">
            <button
              type="button"
              (click)="toggleTheme()"
              style="
                padding: 6px 10px;
                border-radius: 8px;
                border: 1px solid var(--color-border);
                background: var(--color-bg);
                color: var(--color-text-primary);
              "
            >
              {{ isDarkMode() ? 'Light Mode' : 'Dark Mode' }}
            </button>

            @if (studentSession()) {
              <span style="color: var(--color-text-primary);">{{ displayName() }}</span>
              <button type="button" (click)="logout()" style="color: var(--color-text-primary);">Logout</button>
            } @else {
              <a routerLink="/login" style="color: var(--color-text-primary);">Login</a>
            }
          </div>

          <button
            type="button"
            (click)="toggleMenu()"
            class="sm:hidden"
            style="color: var(--color-text-primary);"
          >
            ☰
          </button>
        </div>

        @if (menuOpen()) {
          <div
            class="sm:hidden flex flex-col gap-2 p-3"
            style="border-top: 1px solid var(--color-border); background: var(--color-bg);"
          >
            <a routerLink="/found-items" (click)="closeMenu()" style="color: var(--color-text-primary);">Browse</a>
            <a routerLink="/report/lost" (click)="closeMenu()" style="color: var(--color-text-primary);">Lost</a>
            <a routerLink="/report/found" (click)="closeMenu()" style="color: var(--color-text-primary);">Found</a>

            <button type="button" (click)="toggleTheme()" style="text-align:left; color: var(--color-text-primary);">
              {{ isDarkMode() ? 'Light Mode' : 'Dark Mode' }}
            </button>

            @if (studentSession()) {
              <span style="color: var(--color-text-primary);">{{ displayName() }}</span>
              <button type="button" (click)="logout()" style="text-align:left; color: var(--color-text-primary);">
                Logout
              </button>
            } @else {
              <a routerLink="/login" (click)="closeMenu()" style="color: var(--color-text-primary);">Login</a>
            }
          </div>
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

  menuOpen = signal(false);

  readonly authSession = computed(() => this.authService.session());

  readonly studentSession = computed(() => {
    const session = this.authSession();
    return session?.user.role === UserRole.STUDENT ? session : null;
  });

  readonly displayName = computed(() => {
    const session = this.studentSession();
    return session?.user.displayName || '';
  });

  toggleMenu(): void {
    this.menuOpen.update(value => !value);
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