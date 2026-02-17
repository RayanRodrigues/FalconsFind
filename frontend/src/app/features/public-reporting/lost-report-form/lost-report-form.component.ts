import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ReportService } from '../../../core/services/report.service';
import { ErrorService } from '../../../core/services/error.service';
import { FormValidationService } from '../../../core/services/form-validation.service';
import type { CreateLostReportRequest } from '../../../models/dtos/create-lost-report.request.dto';
import type { CreateReportResponse } from '../../../models/responses/create-report.response.dto';
import type { ErrorResponse } from '../../../models/responses/error-response.model';

// Reusable Components
import { CardComponent } from '../../../shared/components/layout/card.component';
import { ButtonComponent } from '../../../shared/components/buttons/button.component';
import { AlertComponent } from '../../../shared/components/feedback/alert.component';
import { LostReportStepBasicComponent } from './lost-report-step-basic.component';
import { LostReportStepWhenWhereComponent } from './lost-report-step-when-where.component';
import { LostReportStepContactComponent } from './lost-report-step-contact.component';

@Component({
  selector: 'app-lost-report-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    LostReportStepBasicComponent,
    LostReportStepWhenWhereComponent,
    LostReportStepContactComponent
  ],
  templateUrl: './lost-report-form.component.html'
})
export class LostReportFormComponent implements OnInit, OnDestroy {
  reportForm!: FormGroup;
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;
  referenceCode: string | null = null;
  photoPreviewUrl: string | null = null;
  currentStep = 1;
  readonly totalSteps = 3;
  readonly todayDate = this.formatLocalDate(new Date());

  categories = [
    'Electronics', 'Wallets & Purses', 'Keys', 'ID Cards', 'Clothing',
    'Backpacks & Bags', 'Books', 'Jewelry', 'Eyewear', 'Personal Items', 'Other'
  ];

  locations = [
    'Library', 'Student Centre', 'Building T', 'Building B', 'Building D',
    'Building E', 'Building F', 'Building H', 'Gymnasium', 'Cafeteria',
    'Parking Lot', 'Other'
  ];

  private destroy$ = new Subject<void>();
  private readonly stepFields: Record<number, string[]> = {
    1: ['title', 'category', 'description'],
    2: ['location', 'date', 'time'],
    3: ['contactName', 'contactEmail', 'contactPhone', 'photo', 'additionalInfo']
  };

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private errorService: ErrorService,
    private validationService: FormValidationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.reportForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      location: ['', Validators.required],
      date: [this.todayDate, [Validators.required, this.validationService.pastDateValidator()]],
      time: ['', Validators.required],
      contactName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.pattern('^[0-9+\\-\\s()]{10,15}$')]],
      photo: [null],
      additionalInfo: ['', Validators.maxLength(200)]
    });
  }

  get f() {
    return this.reportForm.controls;
  }

  getFieldError(fieldName: string): string | null {
    const control = this.reportForm.get(fieldName);
    if (!control || !control.errors || !control.touched) return null;
    return this.validationService.getErrorMessage(fieldName, control.errors);
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.reportForm.get(fieldName);
    return control ? (control.invalid && control.touched) : false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        this.submitError = 'Please select a valid image file (JPEG, PNG)';
        input.value = '';
        this.photoPreviewUrl = null;
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.submitError = 'File size must be less than 5MB';
        input.value = '';
        this.photoPreviewUrl = null;
        return;
      }

      this.reportForm.patchValue({ photo: file });
      this.photoPreviewUrl = URL.createObjectURL(file);
      this.submitError = null;
    }
  }

  onSubmit(): void {
    void this.submitLostReport();
  }

  nextStep(): void {
    const stepControlNames = this.stepFields[this.currentStep] ?? [];
    const stepControls = stepControlNames
      .map((name) => this.reportForm.get(name))
      .filter((control): control is NonNullable<typeof control> => !!control);

    stepControls.forEach((control) => control.markAsTouched());
    const firstInvalid = stepControls.find((control) => control.invalid);
    if (firstInvalid) {
      const invalidElement = document.querySelector('[aria-invalid="true"]');
      invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.currentStep = Math.min(this.currentStep + 1, this.totalSteps);
  }

  previousStep(): void {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  private async submitLostReport(): Promise<void> {
    this.submitError = null;
    this.reportForm.markAllAsTouched();

    if (this.reportForm.invalid) {
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.isSubmitting = true;

    const formValue = this.reportForm.value;
    const dateTime = new Date(`${formValue.date}T${formValue.time}`);

    const request: CreateLostReportRequest = {
      title: formValue.title,
      description: [
        formValue.description,
        formValue.category ? `Category: ${formValue.category}` : null,
        formValue.additionalInfo ? `Additional info: ${formValue.additionalInfo}` : null
      ]
        .filter(Boolean)
        .join('\n'),
      lastSeenLocation: formValue.location,
      lastSeenAt: dateTime.toISOString(),
      contactEmail: formValue.contactEmail
    };

    if (formValue.photo instanceof File) {
      request.photoDataUrl = await this.fileToDataUrl(formValue.photo);
    }

    this.reportService.createLostReport(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting = false)
      )
      .subscribe({
        next: (response: CreateReportResponse) => {
          this.submitSuccess = true;
          this.referenceCode = response.referenceCode;
          this.reportForm.disable();
        },
        error: (error: ErrorResponse) => {
          this.submitError = this.errorService.getUserFriendlyMessage(error);
        }
      });
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Could not read image file'));
      };
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
  }

  resetForm(): void {
    this.reportForm.enable();
    this.reportForm.reset();
    this.initializeForm();
    this.submitSuccess = false;
    this.referenceCode = null;
    this.submitError = null;
    this.photoPreviewUrl = null;
    this.currentStep = 1;
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
