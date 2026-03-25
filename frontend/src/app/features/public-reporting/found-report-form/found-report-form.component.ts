import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { PhotoUploadFieldComponent } from '../../../shared/components/forms/photo-upload-field.component';
import { SelectComponent } from '../../../shared/components/forms/select.component';
import { TextareaComponent } from '../../../shared/components/forms/textarea.component';
import { CardComponent } from '../../../shared/components/layout/card.component';
import { ReportStepsComponent } from '../../../shared/components/navigation/report-steps.component';
import { mergeSelectedPhotos } from '../../../shared/utils/photo-upload.util';

@Component({
  selector: 'app-found-report-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    FormFieldComponent,
    InputComponent,
    PhotoUploadFieldComponent,
    SelectComponent,
    TextareaComponent,
    ReportStepsComponent,
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
  photoPreviewUrls: string[] = [];
  currentStep = 1;
  readonly totalSteps = 3;
  readonly todayDate = this.formatLocalDate(new Date());

  readonly categories = [
    'Electronics', 'Wallets & Purses', 'Keys', 'ID Cards', 'Clothing',
    'Backpacks & Bags', 'Books', 'Jewelry', 'Eyewear', 'Personal Items', 'Other'
  ];

  readonly locationOptions = [
    'Library',
    'Student Centre',
    'Cafeteria',
    'Gym',
    'Parking Lot',
    'Hallway',
    'Classroom',
    'Lecture Hall',
    'Residence',
    'Campus Security Office',
    'Other'
  ];

  readonly manualLocationOption = 'Other';
  readonly manualCategoryOption = 'Other';

  private readonly platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();
  private readonly stepFields: Record<number, string[]> = {
    1: ['title', 'categoryOption', 'categoryCustom', 'description'],
    2: ['foundLocationOption', 'foundLocationCustom', 'foundDate', 'foundTime', 'photos'],
    3: ['contactEmail']
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
    this.foundForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],

      // final submitted category value
      category: ['', Validators.required],
      // UI fields
      categoryOption: ['', Validators.required],
      categoryCustom: ['', [Validators.maxLength(100)]],

      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],

      // final submitted found location value
      foundLocation: ['', [Validators.required, Validators.maxLength(120)]],
      // UI fields
      foundLocationOption: ['', Validators.required],
      foundLocationCustom: ['', [Validators.maxLength(120)]],

      foundDate: [this.todayDate, [Validators.required, this.validationService.pastDateValidator()]],
      foundTime: ['', Validators.required],
      contactEmail: ['', [Validators.email]],
      photos: [[] as File[], [Validators.required]]
    });

    this.foundForm.get('categoryOption')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const customCategoryControl = this.foundForm.get('categoryCustom');

        if (value === this.manualCategoryOption) {
          customCategoryControl?.setValidators([Validators.required, Validators.maxLength(100)]);
          this.foundForm.patchValue({ category: '' }, { emitEvent: false });
        } else {
          customCategoryControl?.clearValidators();
          customCategoryControl?.setValue('', { emitEvent: false });
          this.foundForm.patchValue({ category: value ?? '' }, { emitEvent: false });
        }

        customCategoryControl?.updateValueAndValidity({ emitEvent: false });
        this.foundForm.get('category')?.updateValueAndValidity({ emitEvent: false });
      });

    this.foundForm.get('categoryCustom')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.isManualCategorySelected()) {
          this.foundForm.patchValue({ category: value ?? '' }, { emitEvent: false });
          this.foundForm.get('category')?.updateValueAndValidity({ emitEvent: false });
        }
      });

    this.foundForm.get('foundLocationOption')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const customLocationControl = this.foundForm.get('foundLocationCustom');

        if (value === this.manualLocationOption) {
          customLocationControl?.setValidators([Validators.required, Validators.maxLength(120)]);
          this.foundForm.patchValue({ foundLocation: '' }, { emitEvent: false });
        } else {
          customLocationControl?.clearValidators();
          customLocationControl?.setValue('', { emitEvent: false });
          this.foundForm.patchValue({ foundLocation: value ?? '' }, { emitEvent: false });
        }

        customLocationControl?.updateValueAndValidity({ emitEvent: false });
        this.foundForm.get('foundLocation')?.updateValueAndValidity({ emitEvent: false });
      });

    this.foundForm.get('foundLocationCustom')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.isManualLocationSelected()) {
          this.foundForm.patchValue({ foundLocation: value ?? '' }, { emitEvent: false });
          this.foundForm.get('foundLocation')?.updateValueAndValidity({ emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.revokePreviewUrls();
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

  isManualCategorySelected(): boolean {
    return this.foundForm.get('categoryOption')?.value === this.manualCategoryOption;
  }

  getCategoryError(): string | null {
    const categoryOptionControl = this.foundForm.get('categoryOption');
    const categoryCustomControl = this.foundForm.get('categoryCustom');

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
    const categoryOptionControl = this.foundForm.get('categoryOption');
    const categoryCustomControl = this.foundForm.get('categoryCustom');

    if (categoryOptionControl?.touched && categoryOptionControl.invalid) {
      return true;
    }

    if (this.isManualCategorySelected() && categoryCustomControl?.touched && categoryCustomControl.invalid) {
      return true;
    }

    return false;
  }

  isManualLocationSelected(): boolean {
    return this.foundForm.get('foundLocationOption')?.value === this.manualLocationOption;
  }

  getLocationError(): string | null {
    const locationOptionControl = this.foundForm.get('foundLocationOption');
    const locationCustomControl = this.foundForm.get('foundLocationCustom');

    if (locationOptionControl?.touched && locationOptionControl.errors?.['required']) {
      return 'Please select a found location';
    }

    if (this.isManualLocationSelected()) {
      if (locationCustomControl?.touched && locationCustomControl.errors?.['required']) {
        return 'Please enter the found location';
      }

      if (locationCustomControl?.touched && locationCustomControl.errors?.['maxlength']) {
        return 'Found location must be 120 characters or less';
      }
    }

    return null;
  }

  isLocationInvalid(): boolean {
    const locationOptionControl = this.foundForm.get('foundLocationOption');
    const locationCustomControl = this.foundForm.get('foundLocationCustom');

    if (locationOptionControl?.touched && locationOptionControl.invalid) {
      return true;
    }

    if (this.isManualLocationSelected() && locationCustomControl?.touched && locationCustomControl.invalid) {
      return true;
    }

    return false;
  }

  onPhotosSelected(files: File[]): void {
    this.handlePhotoFiles(files);
  }

  private handlePhotoFiles(files: File[]): void {
    if (files.length === 0) return;
    const currentPhotos: File[] = (this.foundForm.get('photos')?.value as File[]) ?? [];
    const { photos: nextPhotos, error: nextError } = mergeSelectedPhotos(currentPhotos, files);

    this.foundForm.patchValue({ photos: nextPhotos });
    this.rebuildPreviewUrls(nextPhotos);
    this.submitError = nextError;
  }

  removePhoto(index: number): void {
    const currentPhotos: File[] = (this.foundForm.get('photos')?.value as File[]) ?? [];
    const nextPhotos = currentPhotos.filter((_, currentIndex) => currentIndex !== index);
    this.foundForm.patchValue({ photos: nextPhotos });
    this.rebuildPreviewUrls(nextPhotos);
  }

  onSubmit(): void {
    void this.submitFoundReport();
  }

  nextStep(): void {
    this.syncCategoryValue();
    this.syncFoundLocationValue();

    const stepControlNames = this.stepFields[this.currentStep] ?? [];
    const stepControls = stepControlNames
      .map((name) => this.foundForm.get(name))
      .filter((control): control is NonNullable<typeof control> => !!control);

    stepControls.forEach((control) => control.markAsTouched());
    this.foundForm.get('category')?.markAsTouched();
    this.foundForm.get('foundLocation')?.markAsTouched();

    if (this.currentStep === 1) {
      const titleInvalid = this.foundForm.get('title')?.invalid;
      const categoryOptionInvalid = this.foundForm.get('categoryOption')?.invalid;
      const categoryCustomInvalid =
        this.isManualCategorySelected() && this.foundForm.get('categoryCustom')?.invalid;
      const descriptionInvalid = this.foundForm.get('description')?.invalid;

      if (titleInvalid || categoryOptionInvalid || categoryCustomInvalid || descriptionInvalid || this.foundForm.get('category')?.invalid) {
        const invalidElement = document.querySelector('[aria-invalid="true"]');
        invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    } else if (this.currentStep === 2) {
      const locationOptionInvalid = this.foundForm.get('foundLocationOption')?.invalid;
      const locationCustomInvalid =
        this.isManualLocationSelected() && this.foundForm.get('foundLocationCustom')?.invalid;
      const dateInvalid = this.foundForm.get('foundDate')?.invalid;
      const timeInvalid = this.foundForm.get('foundTime')?.invalid;
      const photosInvalid = this.foundForm.get('photos')?.invalid;

      if (locationOptionInvalid || locationCustomInvalid || dateInvalid || timeInvalid || photosInvalid || this.foundForm.get('foundLocation')?.invalid) {
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

  private submitFoundReport(): void {
    this.submitError = null;
    this.syncCategoryValue();
    this.syncFoundLocationValue();
    this.foundForm.markAllAsTouched();

    if (this.foundForm.invalid) {
      const invalidElement = document.querySelector('[aria-invalid="true"]');
      invalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const value = this.foundForm.value;
    const photos: File[] = Array.isArray(value.photos) ? value.photos : [];
    if (photos.length === 0 || !(photos[0] instanceof File)) {
      this.submitError = 'At least one photo is required';
      return;
    }

    const formData = new FormData();
    formData.append('title', value.title ?? '');
    formData.append('category', value.category ?? '');
    formData.append('foundLocation', value.foundLocation ?? '');
    formData.append('photo', photos[0]);

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
    this.foundForm.reset({
      foundDate: this.todayDate,
      photos: []
    });
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
    const selectedCategory = this.foundForm.get('categoryOption')?.value;
    const customCategory = this.foundForm.get('categoryCustom')?.value;

    const finalCategory = selectedCategory === this.manualCategoryOption
      ? (customCategory ?? '').trim()
      : (selectedCategory ?? '').trim();

    this.foundForm.patchValue({ category: finalCategory }, { emitEvent: false });
    this.foundForm.get('category')?.updateValueAndValidity({ emitEvent: false });
  }

  private syncFoundLocationValue(): void {
    const selectedLocation = this.foundForm.get('foundLocationOption')?.value;
    const customLocation = this.foundForm.get('foundLocationCustom')?.value;

    const finalLocation = selectedLocation === this.manualLocationOption
      ? (customLocation ?? '').trim()
      : (selectedLocation ?? '').trim();

    this.foundForm.patchValue({ foundLocation: finalLocation }, { emitEvent: false });
    this.foundForm.get('foundLocation')?.updateValueAndValidity({ emitEvent: false });
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
}