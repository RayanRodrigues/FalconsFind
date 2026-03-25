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
import { PhotoUploadFieldComponent } from '../../../shared/components/forms/photo-upload-field.component';
import { SelectComponent } from '../../../shared/components/forms/select.component';

@Component({
  selector: 'app-lost-report-step-when-where',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormFieldComponent,
    InputComponent,
    PhotoUploadFieldComponent,
    SelectComponent
  ],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-text-primary">When and Where</h3>

      <app-form-field
        id="locationOption"
        label="Location"
        [required]="true"
        [error]="getLocationError()"
      >
        <app-select
          id="locationOption"
          formControlName="locationOption"
          placeholder="Select a location"
          [invalid]="isLocationInvalid()"
        >
          @for (location of locations; track location) {
            <option [value]="location">{{ location }}</option>
          }
        </app-select>
      </app-form-field>

      <div *ngIf="form.get('locationOption')?.value === 'Other'">
        <app-form-field
          id="locationCustom"
          label="Enter Location"
          [required]="true"
          [error]="getLocationError()"
        >
          <app-input
            id="locationCustom"
            formControlName="locationCustom"
            placeholder="e.g., Building B, Room 204"
            [invalid]="isLocationInvalid()"
          />
        </app-form-field>
      </div>

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

      <app-photo-upload-field
        id="photos"
        inputId="photosInputLost"
        label="Photos"
        [photosCount]="form.get('photos')?.value?.length || 0"
        [photoPreviewUrls]="photoPreviewUrls"
        (filesSelected)="onPhotosSelected($event)"
        (removePhoto)="onRemovePhoto($event)"
      />
    </div>
  `
})
export class LostReportStepWhenWhereComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) locations!: string[];
  @Input({ required: true }) todayDate!: string;
  @Input({ required: true }) photoPreviewUrls: string[] = [];
  @Input({ required: true }) getFieldError!: (fieldName: string) => string | null;
  @Input({ required: true }) isFieldInvalid!: (fieldName: string) => boolean;
  @Input({ required: true }) getLocationError!: () => string | null;
  @Input({ required: true }) isLocationInvalid!: () => boolean;
  @Input({ required: true }) onPhotosSelected!: (files: File[]) => void;
  @Input({ required: true }) onRemovePhoto!: (index: number) => void;
}