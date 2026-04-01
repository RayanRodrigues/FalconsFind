import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import type { ErrorResponse } from '../../../models';
import { ReportService } from '../../../core/services/report.service';
import type { EditableReportResponse } from '../../../core/services/report.service';

@Component({
  selector: 'app-edit-report-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './edit-report-page.component.html',
})
export class EditReportPageComponent {
  private readonly fb = new FormBuilder();

  readonly lookupForm = this.fb.group({
    referenceCode: ['', [Validators.required]],
  });

  readonly editForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    location: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    date: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  loading = false;
  saving = false;
  lookupAttempted = false;
  reportFound = false;
  saveSuccess = false;
  errorMessage = '';

  private currentReferenceCode = '';
  private currentDateReported = '';
  reportType: 'lost' | 'found' = 'lost';
  reportReferenceCode = '';

  constructor(private readonly reportService: ReportService) {}

  getFieldError(form: 'lookup' | 'edit', field: string): string | null {
    const group = form === 'lookup' ? this.lookupForm : this.editForm;
    const ctrl = group.get(field);
    if (!ctrl?.touched || !ctrl.errors) return null;
    if (ctrl.hasError('required')) return 'This field is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    if (ctrl.hasError('minlength')) return 'Please provide more detail.';
    if (ctrl.hasError('maxlength')) return 'This field exceeds the maximum allowed length.';
    return null;
  }

  isFieldInvalid(form: 'lookup' | 'edit', field: string): boolean {
    const group = form === 'lookup' ? this.lookupForm : this.editForm;
    const ctrl = group.get(field);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  findReport(): void {
    this.lookupForm.markAllAsTouched();
    if (this.lookupForm.invalid) return;

    const trimmedCode = (this.lookupForm.value.referenceCode ?? '').trim().toUpperCase();
    this.lookupAttempted = true;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';

    this.loading = true;
    this.reportService.getEditableReport(trimmedCode)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: (report) => {
          this.currentReferenceCode = report.referenceCode;
          this.currentDateReported = report.dateReported;
          this.reportType = report.kind === 'FOUND' ? 'found' : 'lost';
          this.reportReferenceCode = report.referenceCode;
          this.editForm.patchValue({
            title: report.title,
            location: report.location ?? '',
            date: report.dateReported.slice(0, 10),
            description: report.description ?? '',
            contactEmail: report.contactEmail ?? '',
          });
          this.editForm.markAsUntouched();
          this.reportFound = true;
        },
        error: (error: ErrorResponse) => {
          this.errorMessage = this.mapLookupError(error);
        },
      });
  }

  saveChanges(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;

    this.saveSuccess = false;
    this.errorMessage = '';

    const v = this.editForm.value;
    this.saving = true;
    this.reportService.updateEditableReport(this.currentReferenceCode, {
      title: (v.title ?? '').trim(),
      location: (v.location ?? '').trim(),
      dateReported: this.mergeDateWithExistingTimestamp(v.date ?? '', this.currentDateReported),
      description: (v.description ?? '').trim(),
      contactEmail: (v.contactEmail ?? '').trim(),
    })
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (report) => {
          this.currentDateReported = report.dateReported;
          this.editForm.patchValue({
            title: report.title,
            location: report.location ?? '',
            date: report.dateReported.slice(0, 10),
            description: report.description ?? '',
            contactEmail: report.contactEmail ?? '',
          });
          this.saveSuccess = true;
        },
        error: (error: ErrorResponse) => {
          this.errorMessage = this.mapSaveError(error);
        },
      });
  }

  resetSearch(): void {
    this.lookupForm.reset();
    this.editForm.reset();
    this.loading = false;
    this.saving = false;
    this.lookupAttempted = false;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';
    this.currentReferenceCode = '';
    this.currentDateReported = '';
    this.reportType = 'lost';
    this.reportReferenceCode = '';
  }

  private mergeDateWithExistingTimestamp(date: string, currentDateReported: string): string {
    const existingTime = currentDateReported.includes('T') ? currentDateReported.split('T')[1] : '12:00:00.000Z';
    return `${date}T${existingTime}`;
  }

  private mapLookupError(error: ErrorResponse): string {
    if (error?.error?.code === 'NOT_FOUND') {
      return 'We could not find a report with that reference code. Please check the code and try again.';
    }

    return 'We could not load that report right now. Please try again.';
  }

  private mapSaveError(error: ErrorResponse): string {
    if (error?.error?.code === 'REPORT_EDIT_CONFLICT') {
      return 'This report can no longer be edited because it is no longer under review.';
    }

    return 'We could not save your changes right now. Please try again.';
  }
}
