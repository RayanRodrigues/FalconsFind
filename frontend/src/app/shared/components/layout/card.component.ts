import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses">
      @if (cardTitle) {
        <div class="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-4">
          <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">{{ cardTitle }}</h2>
          @if (subtitle) {
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ subtitle }}</p>
          }
        </div>
      }
      <div class="p-6">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class CardComponent {
  @Input() cardTitle?: string;
  @Input() subtitle?: string;
  @Input() padding = true;

  get cardClasses(): string {
    return 'bg-[var(--color-surface)] rounded-xl shadow-sm overflow-hidden border border-[var(--color-border)]';
  }
}
