import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">

      <!-- Main footer body -->
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          <!-- Brand column -->
          <div class="lg:col-span-2">
            <img
              [src]="isDarkMode() ? '/PNG/LogoBranco.png' : '/PNG/LogoPrincipal.png'"
              alt="FalconFind"
              class="mb-3 h-8 w-auto"
            />
            <p class="max-w-xs text-sm leading-relaxed text-[var(--color-text-secondary)]">
              FalconsFind is Fanshawe College's digital lost &amp; found platform — helping students and staff reconnect with their belongings quickly and securely.
            </p>
            <p class="mt-4 text-xs text-[var(--color-text-secondary)]">
              Operated by <span class="font-medium text-[var(--color-text-primary)]">Campus Security</span>
            </p>
          </div>

          <!-- Quick links -->
          <div>
            <h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Browse</h3>
            <ul class="space-y-2.5">
              <li>
                <a routerLink="/found-items" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  Found Items
                </a>
              </li>
              <li>
                <a routerLink="/report/lost" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  Report a Lost Item
                </a>
              </li>
              <li>
                <a routerLink="/report/found" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  Report a Found Item
                </a>
              </li>
            </ul>
          </div>

          <!-- Help & account -->
          <div>
            <h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Help</h3>
            <ul class="space-y-2.5">
              <li>
                <a routerLink="/" fragment="how-it-works" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  How it Works
                </a>
              </li>
              <li>
                <a routerLink="/" fragment="faq" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  FAQ
                </a>
              </li>
              <li>
                <a routerLink="/login" class="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-primary">
                  Student Login
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-[var(--color-border)]">
        <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
          <p class="text-xs text-[var(--color-text-secondary)]">
            © {{ year }} FalconsFind · Fanshawe College. All rights reserved.
          </p>
          <div class="flex items-center gap-4">
            <a routerLink="/privacy" class="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-primary">
              Privacy Policy
            </a>
            <span class="text-[var(--color-border)]">·</span>
            <a routerLink="/terms" class="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-primary">
              Terms of Use
            </a>
          </div>
        </div>
      </div>

    </footer>
  `
})
export class FooterComponent {
  readonly year = new Date().getFullYear();

  constructor(private theme: ThemeService) {}

  isDarkMode(): boolean {
    return this.theme.isDarkMode();
  }
}
