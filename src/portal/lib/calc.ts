import type { ExpenseLine, PeriodMonth, Submission, TradeType } from './types';
import { BEAUTICIAN_CATEGORIES, TAXI_CATEGORIES } from './types';
import { defaultQuarterMonths, monthsFromPeriodLabel } from './months';

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function categoriesFor(trade: TradeType): string[] {
  return trade === 'taxi' ? [...TAXI_CATEGORIES] : [...BEAUTICIAN_CATEGORIES];
}

export function emptyValues(months: PeriodMonth[]): Record<string, number> {
  return Object.fromEntries(months.map((m) => [m.id, 0]));
}

export function defaultLines(trade: TradeType, months: PeriodMonth[]): ExpenseLine[] {
  const values = emptyValues(months);
  return categoriesFor(trade).map((category) => ({
    id: uid('line'),
    category,
    values: { ...values },
  }));
}

export function lineTotal(line: ExpenseLine, months: PeriodMonth[]) {
  return round2(months.reduce((sum, m) => sum + (Number(line.values[m.id]) || 0), 0));
}

export function monthExpenseTotal(lines: ExpenseLine[], monthId: string) {
  return round2(lines.reduce((sum, line) => sum + (Number(line.values[monthId]) || 0), 0));
}

export function totalExpenditure(lines: ExpenseLine[], months: PeriodMonth[]) {
  return round2(months.reduce((sum, m) => sum + monthExpenseTotal(lines, m.id), 0));
}

export function totalIncome(sub: Pick<Submission, 'income' | 'months'>) {
  return round2(sub.months.reduce((sum, m) => sum + (Number(sub.income[m.id]) || 0), 0));
}

export function monthProfit(sub: Pick<Submission, 'income' | 'months'>, lines: ExpenseLine[], monthId: string) {
  const income = Number(sub.income[monthId]) || 0;
  return round2(income - monthExpenseTotal(lines, monthId));
}

export function totalProfit(sub: Pick<Submission, 'income' | 'months'>, lines: ExpenseLine[]) {
  return round2(totalIncome(sub) - totalExpenditure(lines, sub.months));
}

export function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}


export function tradeLabel(trade: TradeType) {
  return trade === 'taxi' ? 'Taxi driver' : 'Beautician';
}

export function isEditableStatus(status: Submission['status'], admin = false) {
  if (status === 'signed') return false;
  if (admin) return true;
  return status === 'draft' || status === 'submitted';
}

export function isClientSignable(status: Submission['status']) {
  return status === 'ready_to_sign';
}

export function isAdminSignable(status: Submission['status']) {
  return status === 'client_signed';
}

/** Build months + income/lines from legacy month1/2/3 shape */
export function migrateLegacySubmission(raw: Record<string, unknown>): Submission {
  const periodLabel = String(raw.periodLabel || 'Apr to Jun 2026');
  const months = monthsFromPeriodLabel(periodLabel);
  const [m1, m2, m3] = months;

  const income: Record<string, number> = {};
  if (m1) income[m1.id] = Number(raw.incomeMonth1) || 0;
  if (m2) income[m2.id] = Number(raw.incomeMonth2) || 0;
  if (m3) income[m3.id] = Number(raw.incomeMonth3) || 0;

  const legacyLines = (raw.lines as Array<Record<string, unknown>>) || [];
  const lines: ExpenseLine[] = legacyLines.map((line) => {
    if (line.values) return line as unknown as ExpenseLine;
    const values: Record<string, number> = {};
    if (m1) values[m1.id] = Number(line.month1) || 0;
    if (m2) values[m2.id] = Number(line.month2) || 0;
    if (m3) values[m3.id] = Number(line.month3) || 0;
    return {
      id: String(line.id),
      category: String(line.category),
      values,
      custom: Boolean(line.custom),
    };
  });

  let status = String(raw.status || 'draft') as Submission['status'];
  if (status === 'signed' && !raw.adminSignature && raw.signature) {
    status = 'signed';
  }

  const clientSig = (raw.clientSignature || raw.signature) as Submission['clientSignature'];

  return {
    id: String(raw.id),
    userId: String(raw.userId),
    periodLabel,
    tradeType: raw.tradeType as TradeType,
    status,
    months,
    income,
    lines,
    files: (raw.files as Submission['files']) || [],
    signDocument: raw.signDocument as Submission['signDocument'],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    signedAt: raw.signedAt ? String(raw.signedAt) : undefined,
    clientSignature: clientSig,
    adminSignature: raw.adminSignature as Submission['adminSignature'],
    signedDocumentHtml: raw.signedDocumentHtml ? String(raw.signedDocumentHtml) : undefined,
  };
}

export function ensureSubmissionShape(sub: Partial<Submission> & { id: string }): Submission {
  if (sub.months && sub.income && sub.lines?.[0]?.values) {
    return sub as Submission;
  }
  return migrateLegacySubmission(sub as Record<string, unknown>);
}

export { defaultQuarterMonths, monthsFromPeriodLabel };
