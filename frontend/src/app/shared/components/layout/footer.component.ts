import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-auto border-t border-white/10 bg-[#1E293B]">

      <!-- Main footer body -->
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          <!-- Brand column -->
          <div class="lg:col-span-2">
            <img
              src="/PNG/LogoBranco.png"
              alt="FalconFind"
              class="mb-3 h-8 w-auto"
            />
            <p class="max-w-xs text-sm leading-relaxed" style="color: rgba(255,255,255,0.55);">
              FalconsFind is Fanshawe College's digital lost &amp; found platform — helping students and staff reconnect with their belongings quickly and securely.
            </p>
            <p class="mt-4 text-xs" style="color: rgba(255,255,255,0.4);">
              Operated by <span class="font-medium" style="color: rgba(255,255,255,0.75);">Campus Security</span>
            </p>
          </div>

          <!-- Quick links -->
          <div>
            <h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Browse</h3>
            <ul class="space-y-2.5">
              <li>
                <a routerLink="/found-items" class="footer-link text-sm transition-colors">Found Items</a>
              </li>
              <li>
                <a routerLink="/report/lost" class="footer-link text-sm transition-colors">Report a Lost Item</a>
              </li>
              <li>
                <a routerLink="/report/found" class="footer-link text-sm transition-colors">Report a Found Item</a>
              </li>
            </ul>
          </div>

          <!-- Help & account -->
          <div>
            <h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Help</h3>
            <ul class="space-y-2.5">
              <li>
                <a routerLink="/" fragment="how-it-works" class="footer-link text-sm transition-colors">How it Works</a>
              </li>
              <li>
                <a routerLink="/" fragment="faq" class="footer-link text-sm transition-colors">FAQ</a>
              </li>
              <li>
                <a routerLink="/login" class="footer-link text-sm transition-colors">Student Login</a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-white/10">
        <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
          <p class="text-xs" style="color: rgba(255,255,255,0.4);">
            © {{ year }} FalconsFind · Fanshawe College. All rights reserved.
          </p>
          <div class="flex items-center gap-4">
            <a routerLink="/privacy" class="footer-link text-xs transition-colors">Privacy Policy</a>
            <span style="color: rgba(255,255,255,0.2);">·</span>
            <a routerLink="/terms" class="footer-link text-xs transition-colors">Terms of Use</a>
          </div>
        </div>
      </div>

    </footer>
  `,
  styles: [`
    .footer-link {
      color: rgba(255,255,255,0.55);
    }
    .footer-link:hover {
      color: #ffffff;
    }
  `]
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
