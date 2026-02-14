import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses">
      @if (cardTitle) {
        <div class="px-6 py-4 border-b border-border bg-bg-secondary">
          <h2 class="text-lg font-semibold text-text-primary">{{ cardTitle }}</h2>
          @if (subtitle) {
            <p class="mt-1 text-sm text-text-secondary">{{ subtitle }}</p>
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
    return 'bg-white rounded-xl shadow-sm overflow-hidden border border-border/50';
  }
}
