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
import { SelectComponent } from '../../../shared/components/forms/select.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';

@Component({
  selector: 'app-lost-report-step-basic',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent
  ],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-text-primary">Basic Information</h3>

      <app-form-field id="title" label="Item Title" [required]="true" [error]="getFieldError('title')">
        <app-input
          id="title"
          formControlName="title"
          placeholder="e.g., Black Laptop in Sleeve"
          [invalid]="isFieldInvalid('title')"
        />
        <span hint class="text-xs text-text-secondary">Be specific but concise (5-100 characters)</span>
      </app-form-field>

      <app-form-field id="category" label="Category" [required]="true" [error]="getFieldError('category')">
        <app-select
          id="category"
          formControlName="category"
          placeholder="Select a category"
          [invalid]="isFieldInvalid('category')"
        >
          @for (category of categories; track category) {
            <option [value]="category">{{ category }}</option>
          }
        </app-select>
      </app-form-field>

      <app-form-field id="description" label="Description" [required]="true" [error]="getFieldError('description')">
        <app-textarea
          id="description"
          formControlName="description"
          [rows]="4"
          placeholder="Describe your item in detail (color, brand, distinguishing features, etc.)"
          [invalid]="isFieldInvalid('description')"
        />
        <span hint class="text-xs text-text-secondary">
          {{ form.get('description')?.value?.length || 0 }}/500 characters
        </span>
      </app-form-field>
    </div>
  `
})
export class LostReportStepBasicComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) categories!: string[];
  @Input({ required: true }) getFieldError!: (fieldName: string) => string | null;
  @Input({ required: true }) isFieldInvalid!: (fieldName: string) => boolean;
}
