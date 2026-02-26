import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="bg-white border-t border-border/60 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div class="max-w-6xl mx-auto">

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="font-semibold text-text-primary text-sm">FalconFind</p>
            <p class="text-text-secondary text-xs mt-0.5">
              Helping Fanshawe Falcons find their stuff — one item at a time.
            </p>
          </div>

          <nav class="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Footer navigation">
            <a routerLink="/found-items" class="text-text-secondary hover:text-primary transition-colors">
              Found Items
            </a>
            <a routerLink="/report/lost" class="text-text-secondary hover:text-primary transition-colors">
              Report Lost
            </a>
            <a routerLink="/report/found" class="text-text-secondary hover:text-primary transition-colors">
              Report Found
            </a>
          </nav>
        </div>

        <p class="mt-5 pt-4 border-t border-border/40 text-xs text-text-secondary">
          © {{ year }} FalconFind · Fanshawe College · Crafted with ☕ coffee, late nights, and a suspicious amount of Stack Overflow.
        </p>

      </div>
    </footer>
  `
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
