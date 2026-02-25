import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ErrorService } from '../../../core/services/error.service';
import { FormValidationService } from '../../../core/services/form-validation.service';
import { ReportService } from '../../../core/services/report.service';
import { LostReportFormComponent } from './lost-report-form.component';

describe('LostReportFormComponent', () => {
  let component: LostReportFormComponent;
  let reportService: Pick<ReportService, 'createLostReport'>;

  beforeEach(async () => {
    reportService = {
      createLostReport: vi.fn().mockReturnValue(
      of({ id: 'report-2', referenceCode: 'LST-20260225-XYZ98765' }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LostReportFormComponent],
      providers: [
        FormValidationService,
        ErrorService,
        { provide: ReportService, useValue: reportService },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LostReportFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submits lost report request including optional photoDataUrl', async () => {
    const photo = new File(['image-bytes'], 'bag.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    });
    (component as unknown as { fileToDataUrl: () => Promise<string> }).fileToDataUrl = vi
      .fn()
      .mockResolvedValue('data:image/jpeg;base64,ZmFrZQ==');

    component.reportForm.patchValue({
      title: 'Lost backpack',
      category: 'Backpacks & Bags',
      description: 'Black backpack with laptop',
      location: 'Building D',
      date: '2026-02-20',
      time: '09:00',
      contactName: 'John Doe',
      contactEmail: 'john@example.com',
      contactPhone: '+1 555 111 2222',
      additionalInfo: 'Has course stickers',
      photos: [photo],
    });

    component.onSubmit();
    await Promise.resolve();

    const createLostReportMock = reportService.createLostReport as ReturnType<typeof vi.fn>;
    expect(createLostReportMock).toHaveBeenCalledTimes(1);
    const request = createLostReportMock.mock.calls[0][0];

    expect(request.title).toBe('Lost backpack');
    expect(request.lastSeenLocation).toBe('Building D');
    expect(request.contactEmail).toBe('john@example.com');
    expect(request.photoDataUrl).toBe('data:image/jpeg;base64,ZmFrZQ==');
    expect(request.description).toContain('Category: Backpacks & Bags');
    expect(component.submitSuccess).toBe(true);
    expect(component.referenceCode).toBe('LST-20260225-XYZ98765');
  });
});
