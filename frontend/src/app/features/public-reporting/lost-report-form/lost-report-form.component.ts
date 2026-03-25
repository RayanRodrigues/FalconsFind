import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ReportService } from '../../../core/services/report.service';
import { ErrorService } from '../../../core/services/error.service';
import { FormValidationService } from '../../../core/services/form-validation.service';
import type { CreateReportResponse } from '../../../models/responses/create-report.response.dto';
import type { ErrorResponse } from '../../../models/responses/error-response.model';

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

  readonly manualLocationOption = 'Other';
  readonly manualCategoryOption = 'Other';

  private readonly platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();
  private readonly stepFields: Record<number, string[]> = {
    1: ['title', 'categoryOption', 'categoryCustom', 'description'],
    2: ['locationOption', 'locationCustom', 'date', 'time', 'photos'],
    3: ['contactName', 'contactEmail', 'contactPhone', 'additionalInfo']
  };

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private errorService: ErrorService,
    private validationService: FormValidationService,
    private router: Router,
    private cdr: ChangeDetectorRef
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

      // final submitted category
      category: ['', Validators.required],
      // UI controls
      categoryOption: ['', Validators.required],
      categoryCustom: ['', [Validators.maxLength(100)]],

      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],

      // final submitted location
      location: ['', Validators.required],
      // UI controls
      locationOption: ['', Validators.required],
      locationCustom: ['', [Validators.maxLength(120)]],

      date: [this.todayDate, [Validators.required, this.validationService.pastDateValidator()]],
      time: ['', Validators.required],
      contactName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.pattern('^[0-9+\\-\\s()]{10,15}$')]],
      photos: [[] as File[]],
      additionalInfo: ['', Validators.maxLength(200)]
    });

    this.reportForm.get('categoryOption')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const customCategoryControl = this.reportForm.get('categoryCustom');

        if (value === this.manualCategoryOption) {
          customCategoryControl?.setValidators([Validators.required, Validators.maxLength(100)]);
          this.reportForm.patchValue({ category: '' }, { emitEvent: false });
        } else {
          customCategoryControl?.clearValidators();
          customCategoryControl?.setValue('', { emitEvent: false });
          this.reportForm.patchValue({ category: value ?? '' }, { emitEvent: false });
        }

        customCategoryControl?.updateValueAndValidity({ emitEvent: false });
        this.reportForm.get('category')?.updateValueAndValidity({ emitEvent: false });
      });

    this.reportForm.get('categoryCustom')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.isManualCategorySelected()) {
          this.reportForm.patchValue({ category: value ?? '' }, { emitEvent: false });
          this.reportForm.get('category')?.updateValueAndValidity({ emitEvent: false });
        }
      });

    this.reportForm.get('locationOption')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const customLocationControl = this.reportForm.get('locationCustom');

        if (value === this.manualLocationOption) {
          customLocationControl?.setValidators([Validators.required, Validators.maxLength(120)]);
          this.reportForm.patchValue({ location: '' }, { emitEvent: false });
        } else {
          customLocationControl?.clearValidators();
          customLocationControl?.setValue('', { emitEvent: false });
          this.reportForm.patchValue({ location: value ?? '' }, { emitEvent: false });
        }

        customLocationControl?.updateValueAndValidity({ emitEvent: false });
        this.reportForm.get('location')?.updateValueAndValidity({ emitEvent: false });
      });

    this.reportForm.get('locationCustom')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.isManualLocationSelected()) {
          this.reportForm.patchValue({ location: value ?? '' }, { emitEvent: false });
          this.reportForm.get('location')?.updateValueAndValidity({ emitEvent: false });
        }
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

  isManualCategorySelected(): boolean {
    return this.reportForm.get('categoryOption')?.value === this.manualCategoryOption;
  }

  getCategoryError(): string | null {
    const categoryOptionControl = this.reportForm.get('categoryOption');
    const categoryCustomControl = this.reportForm.get('categoryCustom');

    if (categoryOptionControl?.touched && categoryOptionControl.errors?.['required']) {
      return 'Please select a category';
    }

    if (this.isManualCategorySelected()) {
      if (categoryCustomControl?.touched && categoryCustomControl.errors?.['required']) {
        return 'Please enter the category';
      }

      if (categoryCustomControl?.touched && categoryCustomControl.errors?.['maxlength']) {
        return 'Category must be 100 characters or less';
      }
    }

    return null;
  }

  isCategoryInvalid(): boolean {
    const categoryOptionControl = this.reportForm.get('categoryOption');
    const categoryCustomControl = this.reportForm.get('categoryCustom');

    if (categoryOptionControl?.touched && categoryOptionControl.invalid) {
      return true;
    }

    if (this.isManualCategorySelected() && categoryCustomControl?.touched && categoryCustomControl.invalid) {
      return true;
    }

    return false;
  }

  isManualLocationSelected(): boolean {
    return this.reportForm.get('locationOption')?.value === this.manualLocationOption;
  }

  getLocationError(): string | null {
    const locationOptionControl = this.reportForm.get('locationOption');
    const locationCustomControl = this.reportForm.get('locationCustom');

    if (locationOptionControl?.touched && locationOptionControl.errors?.['required']) {
      return 'Please select a location';
    }

    if (this.isManualLocationSelected()) {
      if (locationCustomControl?.touched && locationCustomControl.errors?.['required']) {
        return 'Please enter the location';
      }

      if (locationCustomControl?.touched && locationCustomControl.errors?.['maxlength']) {
        return 'Location must be 120 characters or less';
      }
    }

    return null;
  }

  isLocationInvalid(): boolean {
    const locationOptionControl = this.reportForm.get('locationOption');
    const locationCustomControl = this.reportForm.get('locationCustom');

    if (locationOptionControl?.touched && locationOptionControl.invalid) {
      return true;
    }

    if (this.isManualLocationSelected() && locationCustomControl?.touched && locationCustomControl.invalid) {
      return true;
    }

    return false;
  }

  private revokePreviewUrls(): void {
    this.photoPreviewUrls = [];
  }

  private rebuildPreviewUrls(files: File[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.photoPreviewUrls = [];
      return;
    }

    Promise.all(
      files.map(file => new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string) ?? '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      }))
    ).then(urls => {
      this.photoPreviewUrls = urls.filter(Boolean);
      this.cdr.markForCheck();
    });
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
    this.syncCategoryValue();
    this.syncLocationValue();

    const stepControlNames = this.stepFields[this.currentStep] ?? [];
    const stepControls = stepControlNames
      .map((name) => this.reportForm.get(name))
      .filter((control): control is NonNullable<typeof control> => !!control);

    stepControls.forEach((control) => control.markAsTouched());
    this.reportForm.get('category')?.markAsTouched();
    this.reportForm.get('location')?.markAsTouched();

    if (this.currentStep === 1) {
      const titleInvalid = this.reportForm.get('title')?.invalid;
      const categoryOptionInvalid = this.reportForm.get('categoryOption')?.invalid;
      const categoryCustomInvalid =
        this.isManualCategorySelected() && this.reportForm.get('categoryCustom')?.invalid;
      const descriptionInvalid = this.reportForm.get('description')?.invalid;

      if (titleInvalid || categoryOptionInvalid || categoryCustomInvalid || descriptionInvalid || this.reportForm.get('category')?.invalid) {
        const invalidElement = document.querySelector('[aria-invalid="true"]');
        invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    } else if (this.currentStep === 2) {
      const locationOptionInvalid = this.reportForm.get('locationOption')?.invalid;
      const locationCustomInvalid =
        this.isManualLocationSelected() && this.reportForm.get('locationCustom')?.invalid;
      const dateInvalid = this.reportForm.get('date')?.invalid;
      const timeInvalid = this.reportForm.get('time')?.invalid;

      if (locationOptionInvalid || locationCustomInvalid || dateInvalid || timeInvalid || this.reportForm.get('location')?.invalid) {
        const invalidElement = document.querySelector('[aria-invalid="true"]');
        invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    this.currentStep = Math.min(this.currentStep + 1, this.totalSteps);
  }

  previousStep(): void {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  private async submitLostReport(): Promise<void> {
    this.submitError = null;
    this.syncCategoryValue();
    this.syncLocationValue();
    this.reportForm.markAllAsTouched();

    if (this.reportForm.invalid) {
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.isSubmitting = true;

    const formValue = this.reportForm.value;
    const dateTime = new Date(`${formValue.date}T${formValue.time}`);

    const formData = new FormData();
    formData.append('title', formValue.title ?? '');
    formData.append('category', formValue.category ?? '');
    formData.append('description', formValue.description ?? '');
    formData.append('additionalInfo', formValue.additionalInfo ?? '');
    formData.append('lastSeenLocation', formValue.location ?? '');
    formData.append('lastSeenAt', dateTime.toISOString());
    formData.append('contactEmail', formValue.contactEmail ?? '');

    const photos: File[] = Array.isArray(formValue.photos) ? formValue.photos : [];
    if (photos.length > 0) {
      formData.append('photo', photos[0]);
    }

    this.reportService.createLostReport(formData)
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

  private syncCategoryValue(): void {
    const selectedCategory = this.reportForm.get('categoryOption')?.value;
    const customCategory = this.reportForm.get('categoryCustom')?.value;

    const finalCategory = selectedCategory === this.manualCategoryOption
      ? (customCategory ?? '').trim()
      : (selectedCategory ?? '').trim();

    this.reportForm.patchValue({ category: finalCategory }, { emitEvent: false });
    this.reportForm.get('category')?.updateValueAndValidity({ emitEvent: false });
  }

  private syncLocationValue(): void {
    const selectedLocation = this.reportForm.get('locationOption')?.value;
    const customLocation = this.reportForm.get('locationCustom')?.value;

    const finalLocation = selectedLocation === this.manualLocationOption
      ? (customLocation ?? '').trim()
      : (selectedLocation ?? '').trim();

    this.reportForm.patchValue({ location: finalLocation }, { emitEvent: false });
    this.reportForm.get('location')?.updateValueAndValidity({ emitEvent: false });
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}