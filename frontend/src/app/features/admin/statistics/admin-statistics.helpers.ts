export function normalizeStatus(status?: string): string {
  return String(status ?? '').trim().toLowerCase();
}

export function formatLocationLabel(location: string): string {
  return location
    .replace(/\bflor\b/gi, 'Floor')
    .replace(/\bfloor\b/gi, 'Floor')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveChartColor(label: string): string {
  switch (label.toLowerCase()) {
    case 'validated': return '#70e07d';
    case 'claimed': return '#4ea1ff';
    case 'returned': return '#d04d74';
    case 'archived': return '#94a3b8';
    default: return '#c13f63';
  }
}

export function toDateKey(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDateWindow(latestDate: Date, totalDays: number): string[] {
  const dates: string[] = [];
  const end = new Date(latestDate);
  end.setHours(0, 0, 0, 0);

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - index);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}
