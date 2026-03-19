export type CreateLostReportRequest = {
  title: string;
  category?: string;
  description?: string;
  additionalInfo?: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  contactEmail?: string;
};
