import { of } from 'rxjs';
import { vi } from 'vitest';
import { AdminReportsComponent } from './admin-reports.component';
import type { AdminReport, AdminReportsResponse } from './admin-reports.types';

const baseResponse: AdminReportsResponse = {
  reports: [],
  total: 0,
  summary: {
    totalReports: 0,
    lostReports: 0,
    foundReports: 0,
    byStatus: {},
  },
};

function buildReport(overrides: Partial<AdminReport>): AdminReport {
  return {
    id: 'report-1',
    kind: 'FOUND',
    title: 'Wallet',
    description: 'Brown wallet',
    location: 'Library',
    dateReported: '2026-03-26T10:00:00.000Z',
    status: 'VALIDATED',
    referenceCode: 'FND-20260326-WALLET1',
    ...overrides,
  };
}

function createComponent(response: AdminReportsResponse = baseResponse): {
  component: AdminReportsComponent;
  api: {
    listReports: ReturnType<typeof vi.fn>;
    validateFoundReport: ReturnType<typeof vi.fn>;
    flagReport: ReturnType<typeof vi.fn>;
    unflagReport: ReturnType<typeof vi.fn>;
    mergeReports: ReturnType<typeof vi.fn>;
    getItemHistory: ReturnType<typeof vi.fn>;
    restoreItemStatus: ReturnType<typeof vi.fn>;
  };
} {
  const api = {
    listReports: vi.fn().mockReturnValue(of(response)),
    validateFoundReport: vi.fn().mockReturnValue(of({ id: 'report-1', referenceCode: 'FND-1', status: 'VALIDATED' })),
    flagReport: vi.fn().mockReturnValue(of({ id: 'report-1', isSuspicious: true })),
    unflagReport: vi.fn().mockReturnValue(of({ id: 'report-1', isSuspicious: false })),
    mergeReports: vi.fn().mockReturnValue(of({
      primaryReportId: 'report-1',
      mergedReportIds: ['report-2'],
      primaryReport: { id: 'report-1', referenceCode: 'FND-1', kind: 'FOUND', status: 'VALIDATED', title: 'Wallet' },
    })),
    getItemHistory: vi.fn().mockReturnValue(of({ itemId: 'item-1', total: 0, events: [] })),
    restoreItemStatus: vi.fn().mockReturnValue(of({ id: 'item-1', status: 'VALIDATED' })),
  };

  const errorService = {
    getUserFriendlyMessage: vi.fn().mockReturnValue('An error occurred. Please try again.'),
  };

  return {
    component: new AdminReportsComponent(api as never, errorService as never, 'browser' as unknown as object),
    api,
  };
}

describe('AdminReportsComponent', () => {
  it('loads reports without restricting the queue to FOUND only', () => {
    const foundReport = buildReport({
      id: 'found-1',
      kind: 'FOUND',
      status: 'PENDING_VALIDATION',
      referenceCode: 'FND-20260326-FOUND1',
    });
    const lostReport = buildReport({
      id: 'lost-1',
      kind: 'LOST',
      status: 'REPORTED',
      referenceCode: 'LST-20260326-LOST1',
      title: 'Student ID',
    });

    const { component, api } = createComponent({
      ...baseResponse,
      reports: [foundReport, lostReport],
      total: 2,
      summary: {
        totalReports: 2,
        lostReports: 1,
        foundReports: 1,
        byStatus: { pending_validation: 1, reported: 1 },
      },
    });

    component.load();

    expect(api.listReports).toHaveBeenCalledWith({ page: 1, limit: 100 });
    expect(component.allItems.map((item) => item.kind)).toEqual(['FOUND', 'LOST']);
    expect(component.canValidate(component.allItems[0])).toBe(true);
    expect(component.canValidate(component.allItems[1])).toBe(false);
  });

  it('includes a suspicious filter and keeps only flagged reports when selected', () => {
    const flaggedReport = buildReport({
      id: 'flagged-1',
      isSuspicious: true,
      flagReason: 'Duplicate finder details',
      flaggedAt: '2026-03-26T12:00:00.000Z',
    });
    const normalReport = buildReport({
      id: 'normal-1',
      referenceCode: 'FND-20260326-NORMAL1',
      title: 'Keys',
      isSuspicious: false,
    });

    const { component } = createComponent();
    component.allItems = [flaggedReport, normalReport];
    component.statusFilter = 'suspicious';

    component.applyFilters();

    expect(component.statusOptions.some((option) => option.value === 'suspicious')).toBe(true);
    expect(component.filteredItems.map((item) => item.id)).toEqual(['flagged-1']);
  });

  it('removes the suspicious flag through the API and updates the current UI state', () => {
    const flaggedReport = buildReport({
      id: 'flagged-1',
      isSuspicious: true,
      flagReason: 'Suspicious duplicate report',
      flaggedAt: '2026-03-26T12:00:00.000Z',
    });

    const { component, api } = createComponent();
    api.unflagReport.mockReturnValue(of({
      id: 'flagged-1',
      isSuspicious: false,
      flagReason: null,
      flaggedAt: null,
      suspiciousReason: null,
      suspiciousFlaggedAt: null,
    }));

    component.allItems = [flaggedReport];
    component.filteredItems = [flaggedReport];
    component.selectedItem.set(flaggedReport);

    component.unflagReport(flaggedReport);

    expect(api.unflagReport).toHaveBeenCalledWith('flagged-1');
    expect(component.allItems[0].isSuspicious).toBe(false);
    expect(component.filteredItems[0].isSuspicious).toBe(false);
    expect(component.selectedItem()?.isSuspicious).toBe(false);
    expect(component.actionMessage()).toBe('Suspicious flag removed.');
  });
});
