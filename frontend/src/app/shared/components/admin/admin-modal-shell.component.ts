import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-modal-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 flex items-center justify-center p-4" [class]="zIndexClass">
      <div class="absolute inset-0 bg-slate-950/40" (click)="backdropClick.emit()"></div>
      <div class="relative w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl" [class]="widthClass">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class AdminModalShellComponent {
  @Input() widthClass = 'max-w-lg';
  @Input() zIndexClass = 'z-[95]';

  @Output() backdropClick = new EventEmitter<void>();
}
