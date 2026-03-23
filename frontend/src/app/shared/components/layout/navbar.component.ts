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
    <header
      class="fixed top-0 left-0 right-0 z-50 border-b shadow-sm"
      style="background-color: var(--app-surface); border-color: var(--app-border); color: var(--app-text);"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-[72px] items-center justify-between gap-4">

          <!-- Brand -->
          <a routerLink="/" class="shrink-0" aria-label="FalconFind – Home">
            <img src="/PNG/LogoPrincipal.png" alt="FalconFind" style="height: 30px;" />
          </a>

          <!-- Desktop nav -->
          <nav class="hidden sm:flex items-center gap-2">
            <a routerLink="/found-items" class="px-3 py-1.5 text-sm" style="color: var(--app-text);">Browse</a>
            <a routerLink="/report/lost" class="px-3 py-1.5 text-sm" style="color: var(--app-text);">Lost</a>
            <a routerLink="/report/found" class="px-3 py-1.5 text-sm" style="color: var(--app-text);">Found</a>
          </nav>

          <!-- RIGHT SIDE -->
          <div class="hidden sm:flex items-center gap-2">

            <!-- 🌙 THEME BUTTON -->
            <button
              type="button"
              (click)="toggleTheme()"
              style="
                padding: 6px 10px;
                border-radius: 8px;
                border: 1px solid var(--app-border);
                background: var(--app-surface);
                color: var(--app-text);
              "
            >
              {{ isDarkMode() ? 'Light Mode' : 'Dark Mode' }}
            </button>

            <!-- AUTH -->
            @if (studentSession()) {
              <span style="color: var(--app-text);">{{ displayName() }}</span>
              <button (click)="logout()">Logout</button>
            } @else {
              <a routerLink="/login">Login</a>
            }

          </div>

          <!-- MOBILE BUTTON -->
          <button (click)="toggleMenu()" class="sm:hidden">☰</button>

        </div>

        <!-- MOBILE MENU -->
        @if (menuOpen()) {
          <div class="sm:hidden flex flex-col gap-2 p-3"
               style="border-top: 1px solid var(--app-border); background: var(--app-surface);">

            <button (click)="toggleTheme()">
              {{ isDarkMode() ? 'Light Mode' : 'Dark Mode' }}
            </button>

          </div>
        }

      </div>
    </header>
  `,
  styles: [``]
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  menuOpen = signal(false);

  readonly authSession = computed(() => this.authService.session());

  readonly studentSession = computed(() => {
    const s = this.authSession();
    return s?.user.role === UserRole.STUDENT ? s : null;
  });

  readonly displayName = computed(() => {
    const s = this.studentSession();
    return s?.user.displayName || '';
  });

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
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