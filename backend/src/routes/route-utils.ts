export const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';
export const REPORT_REFERENCE_CODE_PATTERN = /^(LST|FND)-\d{8}-[A-Z0-9]{8}$/;

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const assertValidReportReferenceCode = (referenceCode: string): void => {
  if (!REPORT_REFERENCE_CODE_PATTERN.test(referenceCode)) {
    throw new HttpError(400, 'BAD_REQUEST', 'referenceCode must be a valid FalconFind report code');
  }
};
