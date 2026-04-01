import type { Report } from '../../contracts/index.js';
import { ItemStatus } from '../../contracts/index.js';
import { resolveSourceEnv } from '../../utils/app-env.js';

export const currentSourceEnv: NonNullable<Report['sourceEnv']> = resolveSourceEnv();

export const formatDateSegment = (date: Date): string => {
  const year = date.getUTCFullYear().toString();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const createReferenceCode = (prefix: 'LST' | 'FND', docId: string, createdAt: Date): string => {
  const normalizedId = docId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = normalizedId.slice(-8);
  return `${prefix}-${formatDateSegment(createdAt)}-${suffix}`;
};

export const isEditableReportStatus = (status: Report['status']): boolean => {
  return status === ItemStatus.REPORTED || status === ItemStatus.PENDING_VALIDATION;
};

export const isItemStatus = (value: unknown): value is ItemStatus => {
  return typeof value === 'string' && Object.values(ItemStatus).includes(value as ItemStatus);
};

export const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
};

const mergeableReportFields: Array<keyof Pick<
  Report,
  'category' | 'description' | 'additionalInfo' | 'location' | 'contactEmail' | 'photoUrl'
>> = ['category', 'description', 'additionalInfo', 'location', 'contactEmail', 'photoUrl'];

export const buildPrimaryMergePatch = (
  primaryReport: Report,
  duplicateReports: Report[],
): Partial<Report> => {
  const patch: Partial<Report> = {};

  for (const field of mergeableReportFields) {
    if (hasMeaningfulValue(primaryReport[field])) {
      continue;
    }

    const nextValue = duplicateReports
      .map((report) => report[field])
      .find((value) => hasMeaningfulValue(value));

    if (nextValue !== undefined) {
      patch[field] = nextValue;
    }
  }

  return patch;
};
