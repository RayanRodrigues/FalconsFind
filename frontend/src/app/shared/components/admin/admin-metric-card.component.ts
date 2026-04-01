import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-metric-card',
  standalone: true,
  template: `
    <div class="admin-metric-card" [class]="toneClass">
      <p class="admin-metric-card__label">{{ label }}</p>
      <p class="admin-metric-card__value" [class]="valueClass">{{ value }}</p>
      <p class="admin-metric-card__hint">{{ hint }}</p>
    </div>
  `,
  styles: [`
    .admin-metric-card {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border-radius: 1rem;
      border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      background: color-mix(in srgb, var(--color-surface) 92%, transparent);
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    .admin-metric-card::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      border-radius: 999px;
      background: var(--metric-accent, var(--color-primary));
      z-index: 1;
    }

    .admin-metric-card::after {
      content: '';
      position: absolute;
      right: -0.9rem;
      bottom: -1.2rem;
      width: 6.5rem;
      height: 6.5rem;
      background-image: url('/PNG/Icon-Red-Secondary.png');
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }

    .admin-metric-card > * {
      position: relative;
      z-index: 1;
    }

    .admin-metric-card__label {
      margin: 0 0 0.5rem;
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .admin-metric-card__value {
      margin: 0 0 0.25rem;
      color: var(--color-text-primary);
      font-size: 1.875rem;
      font-weight: 700;
      line-height: 1.1;
    }

    .admin-metric-card__hint {
      margin: 0;
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .admin-metric-card--default {
      --metric-accent: var(--color-primary);
    }

    .admin-metric-card--warning {
      --metric-accent: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 20%, var(--color-border));
    }

    .admin-metric-card--success {
      --metric-accent: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 20%, var(--color-border));
    }

    .admin-metric-card--primary {
      --metric-accent: var(--color-primary);
      border-color: color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
    }

    .admin-metric-card--info {
      --metric-accent: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 20%, var(--color-border));
    }

    .admin-metric-card--error {
      --metric-accent: var(--color-error);
      border-color: color-mix(in srgb, var(--color-error) 20%, var(--color-border));
    }

    .admin-metric-card--slate {
      --metric-accent: color-mix(in srgb, var(--color-text-secondary) 55%, transparent);
      border-color: color-mix(in srgb, var(--color-text-secondary) 20%, var(--color-border));
    }

    :host-context(.dark-theme) .admin-metric-card {
      background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    }

    :host-context(.dark-theme) .admin-metric-card::after {
      background-image: url('/PNG/Icon-White.png');
      opacity: 0.07;
    }
  `],
})
export class AdminMetricCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() hint = '';
  @Input() tone: 'default' | 'warning' | 'success' | 'primary' | 'info' | 'error' | 'slate' = 'default';
  @Input() valueClass = '';

  get toneClass(): string {
    return `admin-metric-card--${this.tone}`;
  }
}
