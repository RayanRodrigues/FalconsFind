import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import type { ErrorResponse } from '../../../models';
import { ReportService } from '../../../core/services/report.service';
import type { EditableReportResponse } from '../../../core/services/report.service';

type EditableReport = {
  id: string;
  referenceCode: string;
  reportType: 'lost' | 'found';
  title: string;
  location: string;
  date: string;
  dateReported: string;
  description: string;
  contactEmail: string;
};

@Component({
  selector: 'app-edit-report-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-report-page.component.html',
})
export class EditReportPageComponent {
  referenceCode = '';
  loading = false;
  saving = false;
  lookupAttempted = false;
  reportFound = false;
  saveSuccess = false;
  errorMessage = '';
  report: EditableReport = this.createEmptyReport();

  constructor(private readonly reportService: ReportService) {}

  findReport(): void {
    const trimmedCode = this.referenceCode.trim().toUpperCase();
    this.lookupAttempted = true;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';

    if (!trimmedCode) {
      this.errorMessage = 'Enter a reference code before searching.';
      return;
    }

    this.loading = true;
    this.reportService.getEditableReport(trimmedCode)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: (report) => {
          this.report = this.mapEditableReport(report);
          this.reportFound = true;
        },
        error: (error: ErrorResponse) => {
          this.errorMessage = this.mapLookupError(error);
        },
      });
  }

  saveChanges(): void {
    this.saveSuccess = false;
    this.errorMessage = '';

    if (
      !this.report.title.trim()
      || !this.report.location.trim()
      || !this.report.date.trim()
      || !this.report.description.trim()
      || !this.report.contactEmail.trim()
    ) {
      this.errorMessage = 'Please complete all fields before saving your changes.';
      return;
    }

    this.saving = true;
    this.reportService.updateEditableReport(this.report.referenceCode, {
      title: this.report.title.trim(),
      location: this.report.location.trim(),
      dateReported: this.mergeDateWithExistingTimestamp(this.report.date, this.report.dateReported),
      description: this.report.description.trim(),
      contactEmail: this.report.contactEmail.trim(),
    })
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (report) => {
          this.report = this.mapEditableReport(report);
          this.saveSuccess = true;
        },
        error: (error: ErrorResponse) => {
          this.errorMessage = this.mapSaveError(error);
        },
      });
  }

  resetSearch(): void {
    this.referenceCode = '';
    this.loading = false;
    this.saving = false;
    this.lookupAttempted = false;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';
    this.report = this.createEmptyReport();
  }

  private createEmptyReport(): EditableReport {
    return {
      id: '',
      referenceCode: '',
      reportType: 'lost',
      title: '',
      location: '',
      date: '',
      dateReported: '',
      description: '',
      contactEmail: '',
    };
  }

  private mapEditableReport(report: EditableReportResponse): EditableReport {
    return {
      id: report.id,
      referenceCode: report.referenceCode,
      reportType: report.kind === 'FOUND' ? 'found' : 'lost',
      title: report.title,
      location: report.location ?? '',
      date: report.dateReported.slice(0, 10),
      dateReported: report.dateReported,
      description: report.description ?? '',
      contactEmail: report.contactEmail ?? '',
    };
  }

  private mergeDateWithExistingTimestamp(date: string, currentDateReported: string): string {
    const existingTime = currentDateReported.includes('T') ? currentDateReported.split('T')[1] : '12:00:00.000Z';
    return `${date}T${existingTime}`;
  }

  private mapLookupError(error: ErrorResponse): string {
    if (error?.error?.code === 'NOT_FOUND') {
      return 'We could not find a report with that reference code. Please check the code and try again.';
    }

    return error?.error?.message || 'We could not load that report right now. Please try again.';
  }

  private mapSaveError(error: ErrorResponse): string {
    if (error?.error?.code === 'REPORT_EDIT_CONFLICT') {
      return 'This report can no longer be edited because it is no longer under review.';
    }

    return error?.error?.message || 'We could not save your changes right now. Please try again.';
  }
}
