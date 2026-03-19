import { HttpError } from './route-utils.js';

export const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
};

export const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseDateFilter = (
  value: unknown,
  fieldName: 'dateFrom' | 'dateTo',
): string | undefined => {
  const raw = parseOptionalString(value);
  if (!raw) {
    return undefined;
  }

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const normalized = dateOnlyMatch
    ? (fieldName === 'dateFrom' ? `${raw}T00:00:00.000Z` : `${raw}T23:59:59.999Z`)
    : raw;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be a valid ISO date or date-time`);
  }

  if (dateOnlyMatch && parsed.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be a valid ISO date or date-time`);
  }

  return parsed.toISOString();
};

export const assertValidDateRange = (dateFrom?: string, dateTo?: string): void => {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new HttpError(400, 'BAD_REQUEST', 'dateFrom cannot be after dateTo');
  }
};
