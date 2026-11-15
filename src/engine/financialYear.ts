/**
 * Indian financial year helpers (April → March).
 *
 * Quotation numbers are RR/QT/{FY}/{0001…}, restarting at 0001 every 1 April.
 * FY 26-27 keeps the original counter document (`counters/quotation`) so numbering continues
 * unchanged; every later year gets its own document (`counters/quotation-27-28`, …).
 */

export const LEGACY_COUNTER_FY = '26-27';
export const LEGACY_COUNTER_DOC = 'quotation';

/** "2027-03-31" → "26-27", "2027-04-01" → "27-28". Accepts a Date or YYYY-MM-DD string. */
export function financialYearFor(date: Date | string = new Date()): string {
  let year: number;
  let month: number; // 1-12
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    year = Number(date.slice(0, 4));
    month = Number(date.slice(5, 7));
  } else {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return financialYearFor(new Date());
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }
  const start = month >= 4 ? year : year - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}

/** Firestore counter document id for a financial year. */
export function counterDocIdFor(fy: string): string {
  return fy === LEGACY_COUNTER_FY ? LEGACY_COUNTER_DOC : `quotation-${fy}`;
}
