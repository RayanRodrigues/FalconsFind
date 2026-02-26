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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormFieldComponent,
    InputComponent,
    TextareaComponent
  ],
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
  @Input({ required: true }) getFieldError!: (fieldName: string) => string | null;
  @Input({ required: true }) isFieldInvalid!: (fieldName: string) => boolean;
}
