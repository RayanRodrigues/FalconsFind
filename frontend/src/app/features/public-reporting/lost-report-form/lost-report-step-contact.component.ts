import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  ControlContainer,
  FormGroupDirective,
  ReactiveFormsModule,
  type FormGroup
} from '@angular/forms';
import { FormFieldComponent } from '../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../shared/components/forms/input.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';

@Component({
  selector: 'app-lost-report-step-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent, InputComponent, TextareaComponent],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-text-primary">Contact Information</h3>
      <p class="text-sm text-text-secondary">How can we reach you if your item is found?</p>

      <app-form-field id="contactName" label="Your Name" [required]="true" [error]="getFieldError('contactName')">
        <app-input
          id="contactName"
          formControlName="contactName"
          placeholder="Full name"
          [invalid]="isFieldInvalid('contactName')"
        />
      </app-form-field>

      <app-form-field
        id="contactEmail"
        label="Email Address"
        [required]="true"
        [error]="getFieldError('contactEmail')"
      >
        <app-input
          id="contactEmail"
          type="email"
          formControlName="contactEmail"
          placeholder="your.name@fanshaweonline.ca"
          [invalid]="isFieldInvalid('contactEmail')"
        />
      </app-form-field>

      <app-form-field id="contactPhone" label="Phone Number" [error]="getFieldError('contactPhone')">
        <app-input
          id="contactPhone"
          type="tel"
          formControlName="contactPhone"
          placeholder="(519) 555-0123"
          [invalid]="isFieldInvalid('contactPhone')"
        />
        <span hint class="text-xs text-text-secondary">Format: 5195550123 or (519) 555-0123</span>
      </app-form-field>
    </div>

    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-text-primary">Additional Information</h3>

      <app-form-field id="photos" label="Photos">
        <div
          class="relative border-2 border-dashed border-border rounded-lg bg-bg-secondary hover:border-primary hover:bg-primary/5 transition-all duration-200"
        >
          <input
            type="file"
            id="photos"
            multiple
            accept="image/jpeg,image/png,image/jpg"
            (change)="onFileSelected($event)"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          @if (((form.get('photos')?.value?.length || 0) > 0) && (photoPreviewUrls.length > 0)) {
  <div class="p-4">
    <div class="flex items-center justify-between gap-2 mb-3">
      <div class="flex items-center gap-2 text-success font-medium text-sm">
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z"
          />
        </svg>
        {{ form.get('photos')?.value?.length }} photo(s) selected
      </div>
      <span class="text-xs text-text-secondary">Click to add more</span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      @for (url of photoPreviewUrls; track $index) {
        <div class="relative group">
          <img
            [src]="url"
            alt="Selected photo preview"
            class="w-full h-24 rounded-md object-cover border border-border"
          />
          <button
            type="button"
            (click)="onRemovePhoto($index)"
            class="absolute top-2 right-2 rounded-md bg-bg-primary/90 border border-border px-2 py-1 text-xs text-text-primary opacity-0 group-hover:opacity-100 transition"
          >
            Remove
          </button>
        </div>
      }
    </div>

    <p class="text-xs text-text-secondary mt-3">JPEG, PNG up to 5MB each (max 5)</p>
  </div>
} @else {
  <div class="text-center py-8">
    <svg
      class="w-8 h-8 text-text-secondary mx-auto mb-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5V8.25a2.25 2.25 0 0 1 2.25-2.25h2.379a1.5 1.5 0 0 0 1.06-.44l.622-.62a1.5 1.5 0 0 1 1.06-.44h3.258a1.5 1.5 0 0 1 1.06.44l.622.62a1.5 1.5 0 0 0 1.06.44h2.379A2.25 2.25 0 0 1 21 8.25v8.25A2.25 2.25 0 0 1 18.75 18.75H5.25A2.25 2.25 0 0 1 3 16.5Z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
    <span class="font-medium text-text-primary">Click to upload or drag and drop</span>
    <span class="text-xs text-text-secondary block mt-1">JPEG, PNG up to 5MB each (max 5)</span>
  </div>
}

        </div>
      </app-form-field>

      <app-form-field id="additionalInfo" label="Additional Details">
        <app-textarea
          id="additionalInfo"
          formControlName="additionalInfo"
          [rows]="3"
          placeholder="Any other information that might help identify your item"
        />
        <span hint class="text-xs text-text-secondary">{{ form.get('additionalInfo')?.value?.length || 0 }}/200 characters</span>
      </app-form-field>
    </div>
  `
})
export class LostReportStepContactComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) photoPreviewUrls: string[] = [];
  @Input({ required: true }) getFieldError!: (fieldName: string) => string | null;
  @Input({ required: true }) isFieldInvalid!: (fieldName: string) => boolean;
  @Input({ required: true }) onFileSelected!: (event: Event) => void;
  @Input({ required: true }) onRemovePhoto!: (index: number) => void;
}
