export const MANUAL_REPORT_CATEGORY_OPTION = 'Other';

export const REPORT_CATEGORIES = [
  'Electronics',
  'Wallets & Purses',
  'Keys',
  'ID Cards',
  'Clothing',
  'Backpacks & Bags',
  'Books',
  'Jewelry',
  'Eyewear',
  'Personal Items',
  MANUAL_REPORT_CATEGORY_OPTION
] as const;

export function isManualReportCategory(value: string | null | undefined): boolean {
  return (value ?? '').trim() === MANUAL_REPORT_CATEGORY_OPTION;
}

export function resolveReportCategory(
  selectedCategory: string | null | undefined,
  customCategory: string | null | undefined
): string {
  const normalizedSelection = (selectedCategory ?? '').trim();

  if (isManualReportCategory(normalizedSelection)) {
    return (customCategory ?? '').trim();
  }

  return normalizedSelection;
}
