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
  archivedAt?: string | null;
  contactEmail?: string;
  photoUrl?: string;
  photoUrls?: string[];
  isSuspicious: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
  suspiciousReason?: string | null;
  suspiciousFlaggedByUid?: string | null;
  suspiciousFlaggedByEmail?: string | null;
  suspiciousFlaggedByRole?: string | null;
  suspiciousFlaggedAt?: string | null;
};
