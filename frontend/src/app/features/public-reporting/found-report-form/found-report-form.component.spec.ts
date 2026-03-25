import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ErrorService } from '../../../core/services/error.service';
import { FormValidationService } from '../../../core/services/form-validation.service';
import { ReportService } from '../../../core/services/report.service';
import { FoundReportFormComponent } from './found-report-form.component';

describe('FoundReportFormComponent', () => {
  let component: FoundReportFormComponent;
  let reportService: Pick<ReportService, 'createFoundReport'>;

  beforeEach(async () => {
    reportService = {
      createFoundReport: vi.fn().mockReturnValue(
        of({ id: 'report-1', referenceCode: 'FND-20260225-ABC12345' }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [FoundReportFormComponent],
      providers: [
        FormValidationService,
        ErrorService,
        { provide: ReportService, useValue: reportService },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FoundReportFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submits found report with multipart payload using dropdown location', () => {
    const photo = new File(['photo-bytes'], 'wallet.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    });

    component.foundForm.patchValue({
      title: 'Found wallet',
      categoryOption: 'Wallets & Purses',
      description: 'Brown leather wallet with documents',
      foundLocationOption: 'Library',
      foundDate: '2026-02-20',
      foundTime: '10:30',
      contactEmail: 'finder@example.com',
      photos: [photo],
    });

    component.onSubmit();

    const createFoundReportMock = reportService.createFoundReport as ReturnType<typeof vi.fn>;
    expect(createFoundReportMock).toHaveBeenCalledTimes(1);
    const payload = createFoundReportMock.mock.calls[0][0] as FormData;

    expect(payload.get('title')).toBe('Found wallet');
    expect(payload.get('category')).toBe('Wallets & Purses');
    expect(payload.get('foundLocation')).toBe('Library');
    expect(payload.get('description')).toBe('Brown leather wallet with documents');
    expect(payload.get('contactEmail')).toBe('finder@example.com');
    expect(payload.get('photo')).toBe(photo);
    expect(component.submitSuccess).toBe(true);
    expect(component.referenceCode).toBe('FND-20260225-ABC12345');
  });

  it('submits found report with multipart payload using manual location', () => {
    const photo = new File(['photo-bytes'], 'wallet.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    });

    component.foundForm.patchValue({
      title: 'Found wallet',
      categoryOption: 'Wallets & Purses',
      description: 'Brown leather wallet with documents',
      foundLocationOption: 'Other',
      foundLocationCustom: 'Building B, Room 204',
      foundDate: '2026-02-20',
      foundTime: '10:30',
      contactEmail: 'finder@example.com',
      photos: [photo],
    });

    component.onSubmit();

    const createFoundReportMock = reportService.createFoundReport as ReturnType<typeof vi.fn>;
    expect(createFoundReportMock).toHaveBeenCalledTimes(1);
    const payload = createFoundReportMock.mock.calls[0][0] as FormData;

    expect(payload.get('foundLocation')).toBe('Building B, Room 204');
    expect(component.submitSuccess).toBe(true);
    expect(component.referenceCode).toBe('FND-20260225-ABC12345');
  });
});