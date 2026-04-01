import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-report-steps',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center">
      @for (step of [1, 2, 3]; track step; let i = $index) {

        <!-- Step -->
        <div class="flex flex-col items-center gap-1.5">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
            [ngClass]="{
              'bg-primary text-white': currentStep === step,
              'bg-primary/15 text-primary': currentStep > step,
              'border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface)]': currentStep < step
            }"
          >
            @if (currentStep > step) {
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            } @else {
              {{ step }}
            }
          </div>
          <span
            class="hidden text-[10px] font-medium sm:block"
            [ngClass]="{
              'text-primary': currentStep === step,
              'text-primary/70': currentStep > step,
              'text-[var(--color-text-secondary)]': currentStep < step
            }"
          >{{ labels[i] }}</span>
        </div>

        <!-- Connector line (not after last step) -->
        @if (i < 2) {
          <div
            class="mx-2 mb-5 h-0.5 flex-1 transition-all sm:mx-3"
            [ngClass]="currentStep > step ? 'bg-primary/40' : 'bg-[var(--color-border)]'"
          ></div>
        }

      }
    </div>
  `
})
export class ReportStepsComponent {
  @Input({ required: true }) currentStep = 1;
  @Input() labels: [string, string, string] = ['Basic Info', 'Time & Place', 'Contact'];
}
