import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { ErrorService } from '../../../core/services/error.service';
import { FormValidationService } from '../../../core/services/form-validation.service';
import { ReportService } from '../../../core/services/report.service';
import type { CreateReportResponse } from '../../../models/responses/create-report.response.dto';
import type { ErrorResponse } from '../../../models/responses/error-response.model';
import { ButtonComponent } from '../../../shared/components/buttons/button.component';
import { AlertComponent } from '../../../shared/components/feedback/alert.component';
import { FormFieldComponent } from '../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../shared/components/forms/input.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';
import { CardComponent } from '../../../shared/components/layout/card.component';

@Component({
  selector: 'app-found-report-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    FormFieldComponent,
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    AlertComponent
  ],
  templateUrl: './found-report-form.component.html'
})
export class FoundReportFormComponent implements OnInit, OnDestroy {
  foundForm!: FormGroup;
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;
  referenceCode: string | null = null;
  photoPreviewUrl: string | null = null;
  currentStep = 1;
  readonly totalSteps = 3;
  readonly todayDate = this.formatLocalDate(new Date());

  private destroy$ = new Subject<void>();
  private readonly stepFields: Record<number, string[]> = {
    1: ['title', 'description'],
    2: ['foundLocation', 'foundDate', 'foundTime', 'photo'],
    3: ['contactEmail']
  };

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private errorService: ErrorService,
    private validationService: FormValidationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.foundForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      foundLocation: ['', [Validators.required, Validators.maxLength(120)]],
      foundDate: [this.todayDate, [Validators.required, this.validationService.pastDateValidator()]],
      foundTime: ['', Validators.required],
      contactEmail: ['', [Validators.email]],
      photo: [null as File | null, [Validators.required]]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFieldError(fieldName: string): string | null {
    const control = this.foundForm.get(fieldName);
    if (!control || !control.errors || !control.touched) return null;
    return this.validationService.getErrorMessage(fieldName, control.errors);
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.foundForm.get(fieldName);
    return !!control && control.touched && control.invalid;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      this.submitError = 'Please select a valid image file (JPEG, PNG)';
      input.value = '';
      this.photoPreviewUrl = null;
      this.foundForm.patchValue({ photo: null });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.submitError = 'File size must be less than 5MB';
      input.value = '';
      this.photoPreviewUrl = null;
      this.foundForm.patchValue({ photo: null });
      return;
    }

    this.foundForm.patchValue({ photo: file });
    this.photoPreviewUrl = URL.createObjectURL(file);
    this.submitError = null;
  }

  onSubmit(): void {
    void this.submitFoundReport();
  }

  nextStep(): void {
    const stepControlNames = this.stepFields[this.currentStep] ?? [];
    const stepControls = stepControlNames
      .map((name) => this.foundForm.get(name))
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

  private submitFoundReport(): void {
    this.submitError = null;
    this.foundForm.markAllAsTouched();
    if (this.foundForm.invalid) {
      const invalidElement = document.querySelector('[aria-invalid="true"]');
      invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const value = this.foundForm.value;
    if (!(value.photo instanceof File)) {
      this.submitError = 'Photo is required';
      return;
    }

    const formData = new FormData();
    formData.append('title', value.title ?? '');
    formData.append('foundLocation', value.foundLocation ?? '');
    formData.append('photo', value.photo);

    if (value.description?.trim()) {
      formData.append('description', value.description.trim());
    }
    if (value.contactEmail?.trim()) {
      formData.append('contactEmail', value.contactEmail.trim());
    }
    if (value.foundDate) {
      const dateTime = value.foundTime ? `${value.foundDate}T${value.foundTime}` : `${value.foundDate}T00:00`;
      formData.append('foundAt', new Date(dateTime).toISOString());
    }

    this.isSubmitting = true;
    this.reportService.createFoundReport(formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting = false)
      )
      .subscribe({
        next: (response: CreateReportResponse) => {
          this.submitSuccess = true;
          this.referenceCode = response.referenceCode;
          this.foundForm.disable();
        },
        error: (error: ErrorResponse) => {
          this.submitError = this.errorService.getUserFriendlyMessage(error);
        }
      });
  }

  resetForm(): void {
    this.foundForm.enable();
    this.foundForm.reset();
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
