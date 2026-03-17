export type CreateFoundReportRequest = {
  title: string;
  category?: string;
  description?: string;
  foundLocation: string;
  foundAt?: string;
  contactEmail?: string;
  photoDataUrl: string;
};
