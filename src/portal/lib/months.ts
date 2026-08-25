import type { PeriodMonth } from './types';
import { uid } from './calc';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Parse "Apr to Jun 2026" → Apr 2026, May 2026, Jun 2026 */
export function monthsFromPeriodLabel(periodLabel: string): PeriodMonth[] {
  const match = periodLabel.match(/^(\w{3})\s+to\s+(\w{3})\s+(\d{4})$/i);
  if (!match) return defaultQuarterMonths();

  const startIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase().slice(0, 3));
  const endIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[2].toLowerCase().slice(0, 3));
  const year = match[3];

  if (startIdx < 0 || endIdx < 0) return defaultQuarterMonths();

  const labels: string[] = [];
  let i = startIdx;
  while (true) {
    labels.push(`${MONTH_NAMES[i]} ${year}`);
    if (i === endIdx) break;
    i = (i + 1) % 12;
    if (labels.length > 12) break;
  }

  return labels.map((label) => ({ id: uid('month'), label }));
}

export function defaultQuarterMonths(): PeriodMonth[] {
  return monthsFromPeriodLabel('Apr to Jun 2026');
}

export function nextMonthLabel(existing: PeriodMonth[]): string {
  if (existing.length === 0) return 'Apr 2026';
  const last = existing[existing.length - 1].label;
  const match = last.match(/^(\w{3})\s+(\d{4})$/);
  if (!match) return `Month ${existing.length + 1}`;
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  const year = Number(match[2]);
  if (idx < 0) return `Month ${existing.length + 1}`;
  const nextIdx = (idx + 1) % 12;
  const nextYear = nextIdx === 0 ? year + 1 : year;
  return `${MONTH_NAMES[nextIdx]} ${nextYear}`;
}

export function periodLabelFromMonths(months: PeriodMonth[]): string {
  if (months.length === 0) return 'Custom period';
  if (months.length === 1) return months[0].label;
  const first = months[0].label.split(' ')[0];
  const lastParts = months[months.length - 1].label.split(' ');
  return `${first} to ${lastParts[0]} ${lastParts[1] || ''}`.trim();
}
