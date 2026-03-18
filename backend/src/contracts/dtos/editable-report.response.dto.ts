import type { ItemStatus } from '../enums/item-status.enum.js';
import type { Report } from '../types/report.type.js';

export type EditableReportResponse = {
  id: string;
  referenceCode: string;
  kind: Report['kind'];
  status: ItemStatus;
  title: string;
  category?: string;
  description?: string;
  location?: string;
  dateReported: string;
  contactEmail?: string;
};
