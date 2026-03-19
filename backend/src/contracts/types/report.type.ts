import type { ItemStatus } from '../enums/item-status.enum.js';

type ReportKind = 'LOST' | 'FOUND';
type ReportSourceEnv = 'development' | 'production';

export type Report = {
  id: string;
  kind: ReportKind;
  title: string;
  category?: string;
  description?: string;
  additionalInfo?: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  contactEmail?: string;
  photoUrl?: string;
  sourceEnv?: ReportSourceEnv;
};
