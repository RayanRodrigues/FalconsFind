import type { ItemStatus } from '../enums/item-status.enum.js';
import type { Report } from '../types/report.type.js';

export type MergeDuplicateReportsResponse = {
  primaryReportId: string;
  mergedReportIds: string[];
  primaryReport: {
    id: string;
    referenceCode: string;
    kind: Report['kind'];
    status: ItemStatus;
    title: string;
  };
};
