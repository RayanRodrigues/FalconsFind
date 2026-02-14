import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="onClick($event)"
    >
      @if (loading) {
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      }
      <ng-content></ng-content>
    </button>
  `
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() loading = false;

  get buttonClasses(): string {
    const baseClasses = 'inline-flex items-center justify-center text-center whitespace-normal break-words leading-tight font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 shadow-sm';
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs min-h-8',
      md: 'px-6 py-2 text-sm min-h-10',
      lg: 'px-8 py-3 text-base min-h-12'
    }[this.size];

    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-secondary focus:ring-primary/50 disabled:opacity-50',
      secondary: 'bg-transparent text-primary border border-primary hover:bg-soft-accent focus:ring-primary/30 disabled:opacity-50',
      danger: 'bg-error text-white hover:bg-error/90 focus:ring-error/50 disabled:opacity-50'
    }[this.variant];

    const stateClasses = this.disabled || this.loading ? 'cursor-not-allowed' : 'cursor-pointer';

    return `${baseClasses} ${sizeClasses} ${variantClasses} ${stateClasses}`;
  }

  onClick(event: MouseEvent): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
