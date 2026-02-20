import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-report-steps',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-3 gap-2">
      <button
        type="button"
        class="min-h-9 px-2 py-1 rounded-md border text-xs sm:text-sm leading-tight text-center whitespace-normal break-words font-medium transition-all"
        [ngClass]="currentStep === 1 ? 'border-primary text-primary bg-primary/5' : 'border-border text-text-secondary'"
      >
        <span class="inline-flex w-full items-center justify-center gap-1.5">
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 8.25h7.5M8.25 11.25h7.5M8.25 14.25h4.5" />
          </svg>
          <span>Basic Info</span>
        </span>
      </button>
      <button
        type="button"
        class="min-h-9 px-2 py-1 rounded-md border text-xs sm:text-sm leading-tight text-center whitespace-normal break-words font-medium transition-all"
        [ngClass]="currentStep === 2 ? 'border-primary text-primary bg-primary/5' : 'border-border text-text-secondary'"
      >
        <span class="inline-flex w-full items-center justify-center gap-1.5">
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75v3M17.25 3.75v3M3.75 9.75h16.5" />
            <rect x="3.75" y="5.25" width="16.5" height="15" rx="2.25" ry="2.25"></rect>
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 13.5h3.75" />
          </svg>
          <span>Time & Place</span>
        </span>
      </button>
      <button
        type="button"
        class="min-h-9 px-2 py-1 rounded-md border text-xs sm:text-sm leading-tight text-center whitespace-normal break-words font-medium transition-all"
        [ngClass]="currentStep === 3 ? 'border-primary text-primary bg-primary/5' : 'border-border text-text-secondary'"
      >
        <span class="inline-flex w-full items-center justify-center gap-1.5">
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 19.5a7.5 7.5 0 0 1 15 0" />
          </svg>
          <span>Contact</span>
        </span>
      </button>
    </div>
  `
})
export class ReportStepsComponent {
  @Input({ required: true }) currentStep = 1;
}
