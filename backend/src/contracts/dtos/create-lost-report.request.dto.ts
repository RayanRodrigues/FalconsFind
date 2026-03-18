export type CreateLostReportRequest = {
  title: string;
  description?: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  contactEmail?: string;
};
