export const MANUAL_REPORT_LOCATION_OPTION = 'Other';

export const CAMPUS_REPORT_LOCATIONS = [
  'Library',
  'Student Centre',
  'Campus Security Office',
  'Cafeteria',
  'Gymnasium',
  'Building B',
  'Building D',
  'Building E',
  'Building F',
  'Building H',
  'Building T',
  'Classroom',
  'Lecture Hall',
  'Hallway',
  'Residence',
  'Parking Lot',
  MANUAL_REPORT_LOCATION_OPTION
] as const;

export function isManualReportLocation(value: string | null | undefined): boolean {
  return (value ?? '').trim() === MANUAL_REPORT_LOCATION_OPTION;
}

export function resolveReportLocation(
  selectedLocation: string | null | undefined,
  customLocation: string | null | undefined
): string {
  const normalizedSelection = (selectedLocation ?? '').trim();

  if (isManualReportLocation(normalizedSelection)) {
    return (customLocation ?? '').trim();
  }

  return normalizedSelection;
}
