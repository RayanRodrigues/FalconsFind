import type { ItemStatus } from '../enums/item-status.enum.js';

type ReportKind = 'LOST' | 'FOUND';

export type Report = {
  id: string;
  kind: ReportKind;
  title: string;
  description?: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  contactEmail?: string;
};
