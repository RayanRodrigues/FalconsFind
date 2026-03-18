import type { ItemStatus } from '../enums/item-status.enum.js';
import type { Report } from '../types/report.type.js';

export type AdminReportResponse = {
  id: string;
  kind: Report['kind'];
  title: string;
  category?: string;
  description?: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  contactEmail?: string;
  photoUrl?: string;
};
