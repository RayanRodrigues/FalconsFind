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
  <div class="border-2 border-dashed border-border rounded-lg bg-bg-secondary hover:border-primary hover:bg-primary/5 transition-all duration-200 p-4">

    <!-- Hidden input with UNIQUE id -->
    <input
      #photosInput
      type="file"
      id="photosInput"
      multiple
      accept="image/jpeg,image/png,image/jpg"
      (change)="onFileSelected($event)"
      class="hidden"
    />

    <!-- Always-clickable upload trigger -->
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm text-text-secondary">
        JPEG, PNG up to 5MB each (max 5)
      </div>

      <button
        type="button"
        (click)="photosInput.click()"
        class="px-3 py-2 rounded-md border border-border text-sm font-medium hover:border-primary hover:text-primary transition"
      >
        Add photos
      </button>
    </div>

    @if (((form.get('photos')?.value?.length || 0) > 0) && (photoPreviewUrls.length > 0)) {
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        @for (url of photoPreviewUrls; track $index) {
          <div class="relative">
            <img
              [src]="url"
              alt="Selected photo preview"
              class="w-full aspect-square rounded-md object-cover border border-border"
            />

            <button
              type="button"
              (click)="onRemovePhoto($index)"
              aria-label="Remove photo"
              class="absolute top-2 right-2 z-30 rounded-md bg-white text-black border border-black p-2 shadow-md hover:bg-gray-100 transition"
            >
            
            <svg viewBox="0 0 24 24" class="w-4 h-4 text-black" fill="none" stroke="currentColor" stroke-width="1.8">                
            <path stroke-linecap="round" stroke-linejoin="round" 
            d="M6 7h12M9 7V5h6v2m-7 3v10m8-10v10M10 21h4a2 2 0 0 0 2-2V7H8v12a2 2 0 0 0 2 2Z"/>
            </svg>
            </button>
          </div>
        }
      </div>
    } @else {
      <div class="text-center py-8">
        <span class="font-medium text-text-primary block">No photos selected</span>
        <span class="text-xs text-text-secondary block mt-1">Click “Add photos” to upload</span>
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
