import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="alertClasses" role="alert">
      <div class="flex gap-3">
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            [attr.d]="iconPath"
          />
        </svg>
        <div class="flex-1">
          <ng-content></ng-content>
        </div>
        @if (dismissible) {
          <button (click)="onDismiss()" class="flex-shrink-0 hover:opacity-75">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
      </div>
    </div>
  `
})
export class AlertComponent {
  @Input() type: 'success' | 'error' | 'warning' | 'info' = 'info';
  @Input() dismissible = false;

  get iconPath(): string {
    const paths: Record<'success' | 'error' | 'warning' | 'info', string> = {
      success: 'M9 12.75 11.25 15 15 9.75M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z',
      error:
        'M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z',
      warning:
        'M12 9v3.75m0 3.75h.008v.008H12v-.008Zm-8.71 2.21L10.94 3.58a1.25 1.25 0 0 1 2.12 0l7.65 11.63a1.25 1.25 0 0 1-1.06 1.94H4.35a1.25 1.25 0 0 1-1.06-1.94Z',
      info: 'M12 10.5v4.5m0-7.5h.008v.008H12V7.5ZM21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z'
    };
    return paths[this.type];
  }

  get alertClasses(): string {
    const baseClasses = 'p-4 rounded-lg border-l-4 mb-4';
    
    const typeClasses = {
      success: 'bg-success/10 border-success text-success',
      error: 'bg-error/10 border-error text-error',
      warning: 'bg-warning/15 border-warning text-text-primary',
      info: 'bg-info/10 border-info text-info'
    }[this.type];

    return `${baseClasses} ${typeClasses}`;
  }

  onDismiss(): void {
    // Emit event or handle dismissal
  }
}
