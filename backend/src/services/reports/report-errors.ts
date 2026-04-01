export class ReportPhotoUploadError extends Error {
  constructor(
    public readonly code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ReportPhotoUploadError';
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super('Report not found');
    this.name = 'ReportNotFoundError';
  }
}

export class ReportEditConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportEditConflictError';
  }
}

export class ReportValidationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationConflictError';
  }
}

export class ReportMergeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportMergeConflictError';
  }
}
