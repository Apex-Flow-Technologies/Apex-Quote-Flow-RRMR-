/**
 * Unsaved quotation drafts, kept on this device (localStorage) per signed-in user,
 * so leaving the builder (another page, a refresh) does not lose the lines typed so far.
 * Only the inputs are stored; prices are recalculated when the draft is restored.
 * Drafts are cleared on save, on Discard and on logout.
 */
import type { Customer } from '../types/customer';
import type { EditableRowState } from '../components/quotations/quotationRows';

const PREFIX = 'rrmr.quoteDraft.v1.';

export interface DraftSourceRef {
  mode: 'revise' | 'duplicate';
  quotationId: string;
  revision: number;
}

export interface QuoteDraft {
  savedAt: number;
  source?: DraftSourceRef;
  customer: Customer | null;
  quotationDate: string;
  widthFactor: string;
  isGstEnabled: boolean;
  advanceAmount: string;
  rows: EditableRowState[];
  /** Left with the Back button: offer it on the list instead of reopening it. */
  parked?: boolean;
}

export function draftKey(uid: string, source?: DraftSourceRef | null): string {
  return source
    ? `${PREFIX}${uid}.${source.mode}.${source.quotationId}.r${source.revision}`
    : `${PREFIX}${uid}.new`;
}

/** Inputs only: no calculated line, no open dropdowns. */
export function serializeRows(rows: EditableRowState[]): EditableRowState[] {
  return rows.map((r) => ({
    ...r,
    calculatedLine: null,
    validationError: null,
    isProductDropdownOpen: false,
    highlightedProductIndex: 0,
  }));
}

/** Compares lines by their inputs (row ids are random, so they are left out). */
export function rowsSignature(rows: EditableRowState[]): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return JSON.stringify(serializeRows(rows).map(({ id: _id, ...rest }) => rest));
}

/** Worth keeping: a picked customer or at least one filled line. */
export function draftHasContent(d: Pick<QuoteDraft, 'customer' | 'rows'>): boolean {
  return Boolean(d.customer) || d.rows.some((r) => r.product || r.isCustomItem);
}

export function countDraftLines(d: Pick<QuoteDraft, 'rows'>): number {
  return d.rows.filter((r) => r.product || r.isCustomItem).length;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadDraft(key: string): QuoteDraft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as QuoteDraft;
    if (!d || !Array.isArray(d.rows)) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: Omit<QuoteDraft, 'savedAt' | 'rows'> & { rows: EditableRowState[] }): void {
  const s = storage();
  if (!s) return;
  try {
    if (!draftHasContent(draft)) {
      s.removeItem(key);
      return;
    }
    s.setItem(key, JSON.stringify({ ...draft, rows: serializeRows(draft.rows), savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the quote still works, it just is not kept.
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Marks the draft as left on purpose (Back button). */
export function parkDraft(key: string): void {
  const d = loadDraft(key);
  const s = storage();
  if (!d || !s) return;
  try {
    s.setItem(key, JSON.stringify({ ...d, parked: true }));
  } catch {
    /* ignore */
  }
}

/** Removes every quotation draft on this device (on logout: may be a shared shop PC). */
export function clearAllDrafts(): void {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* ignore */
  }
}
