import type {
  AdminReportResponse,
  FlagReportRequest,
  MergeDuplicateReportsRequest,
  MergeDuplicateReportsResponse,
  Report,
} from '../../contracts/index.js';
import type { UserRole } from '../../contracts/index.js';

export type SupportedPhotoMimeType = 'image/jpeg' | 'image/png';

export type ReportFlagActor = {
  uid: string;
  email?: string | null;
  role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
};

export type ReportMergeActor = {
  uid: string;
  email?: string | null;
  role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
};

export type ReportValidationActor = {
  uid: string;
  email?: string | null;
  role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
};

export type ListAdminReportsParams = {
  page: number;
  limit: number;
  kind?: Report['kind'];
  status?: Report['status'];
  search?: string;
  flagged?: boolean;
};

export type FlagReportResult = {
  id: string;
  report: Pick<
    AdminReportResponse,
    | 'isSuspicious'
    | 'suspiciousReason'
    | 'suspiciousFlaggedAt'
    | 'suspiciousFlaggedByUid'
    | 'suspiciousFlaggedByEmail'
    | 'suspiciousFlaggedByRole'
  >;
};

export type MergeDuplicateReportsPayload = MergeDuplicateReportsRequest;
export type MergeDuplicateReportsResult = MergeDuplicateReportsResponse;
