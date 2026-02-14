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

@Component({
  selector: 'app-lost-report-step-when-where',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormFieldComponent,
    InputComponent,
    SelectComponent
  ],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-text-primary">When and Where</h3>

      <app-form-field id="location" label="Location" [required]="true" [error]="getFieldError('location')">
        <app-select
          id="location"
          formControlName="location"
          placeholder="Select a location"
          [invalid]="isFieldInvalid('location')"
        >
          @for (location of locations; track location) {
            <option [value]="location">{{ location }}</option>
          }
        </app-select>
      </app-form-field>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <app-form-field id="date" label="Date Lost" [required]="true" [error]="getFieldError('date')">
          <app-input
            id="date"
            type="date"
            formControlName="date"
            [max]="todayDate"
            [invalid]="isFieldInvalid('date')"
          />
        </app-form-field>

        <app-form-field id="time" label="Approximate Time" [required]="true" [error]="getFieldError('time')">
          <app-input id="time" type="time" formControlName="time" [invalid]="isFieldInvalid('time')" />
        </app-form-field>
      </div>
    </div>
  `
})
export class LostReportStepWhenWhereComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) locations!: string[];
  @Input({ required: true }) todayDate!: string;
  @Input({ required: true }) getFieldError!: (fieldName: string) => string | null;
  @Input({ required: true }) isFieldInvalid!: (fieldName: string) => boolean;
}
