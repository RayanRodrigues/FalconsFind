import type { ItemStatus } from '../enums/item-status.enum.js';
import type { UserRole } from '../enums/user-role.enum.js';

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
  archivedAt?: string | null;
  sourceEnv?: ReportSourceEnv;
  isSuspicious?: boolean;
  suspiciousReason?: string | null;
  suspiciousFlaggedByUid?: string | null;
  suspiciousFlaggedByEmail?: string | null;
  suspiciousFlaggedByRole?: Extract<UserRole, 'ADMIN' | 'SECURITY'> | null;
  suspiciousFlaggedAt?: string | null;
  mergedIntoReportId?: string | null;
  mergedIntoReferenceCode?: string | null;
  mergedAt?: string | null;
  mergedByUid?: string | null;
  mergedByEmail?: string | null;
  mergedByRole?: Extract<UserRole, 'ADMIN' | 'SECURITY'> | null;
};
