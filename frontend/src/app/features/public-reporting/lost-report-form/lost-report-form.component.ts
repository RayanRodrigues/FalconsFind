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
import { ReportStepsComponent } from '../../../shared/components/navigation/report-steps.component';
import { mergeSelectedPhotos } from '../../../shared/utils/photo-upload.util';

@Component({
  selector: 'app-lost-report-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    ReportStepsComponent,
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
  photoPreviewUrls: string[] = [];
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
    2: ['location', 'date', 'time', 'photos'],
    3: ['contactName', 'contactEmail', 'contactPhone', 'additionalInfo']
  };

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private errorService: ErrorService,
    private validationService: FormValidationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.revokePreviewUrls();
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
      photos: [[] as File[]],
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

  private revokePreviewUrls(urls: string[] = this.photoPreviewUrls): void {
    for (const url of urls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }

  private rebuildPreviewUrls(files: File[]): void {
    this.revokePreviewUrls();
    this.photoPreviewUrls = files.map((file) => URL.createObjectURL(file));
  }

  onPhotosSelected(files: File[]): void {
    this.handlePhotoFiles(files);
  }

  private handlePhotoFiles(files: File[]): void {
    if (files.length === 0) return;
    const currentPhotos: File[] = (this.reportForm.get('photos')?.value as File[]) ?? [];
    const { photos: nextPhotos, error: nextError } = mergeSelectedPhotos(currentPhotos, files);

    this.reportForm.patchValue({ photos: nextPhotos });
    this.rebuildPreviewUrls(nextPhotos);
    this.submitError = nextError;
  }

  removePhoto(index: number): void {
    const currentPhotos: File[] = (this.reportForm.get('photos')?.value as File[]) ?? [];
    const nextPhotos = currentPhotos.filter((_, currentIndex) => currentIndex !== index);
    this.reportForm.patchValue({ photos: nextPhotos });
    this.rebuildPreviewUrls(nextPhotos);
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

    const photos: File[] = Array.isArray(formValue.photos) ? formValue.photos : [];
    if (photos.length > 0) {
      // For now: send the first photo only (backend expects one)
      request.photoDataUrl = await this.fileToDataUrl(photos[0]);
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
    this.revokePreviewUrls();
    this.photoPreviewUrls = [];
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
