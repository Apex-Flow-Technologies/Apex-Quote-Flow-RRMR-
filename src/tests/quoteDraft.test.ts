import { describe, it, expect, beforeEach } from 'vitest';
import {
  draftKey,
  saveDraft,
  loadDraft,
  clearDraft,
  parkDraft,
  clearAllDrafts,
  serializeRows,
  rowsSignature,
  draftHasContent,
} from '../utils/quoteDraft';
import {
  createInitialRow,
  createCustomRow,
  computeRowCalculation,
  rowFromSavedLine,
  type EditableRowState,
} from '../components/quotations/quotationRows';
import { buildProductPayload, oneOffProduct, INITIAL_FORM_STATE } from '../components/products/productForm';
import type { Product } from '../types/product';

// Minimal localStorage for the node test environment
class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const steel = {
  id: 'steel_rhs', name: 'MS Rect Pipe 120x60x4.5', category: 'Pipe', hsn: '73066100',
  qtyMethod: 'SECTION_WEIGHT', unit: 'Kgs', kgPerMetre: 11.672, defaultLengthM: 6,
  ratePerUnit: 62, gstRate: 18, active: true,
} as unknown as Product;

const sheet = oneOffProduct(buildProductPayload({
  ...INITIAL_FORM_STATE, name: 'Crimp sheet 0.47', qtyMethod: 'SHEET_WEIGHT', unit: 'Kgs', ratePerUnit: '110',
}));

function calc(rows: EditableRowState[]) {
  return rows.map((r) => ({ ...r, ...computeRowCalculation(r, 'intra', 1.08, 0.305) }));
}
const total = (rows: EditableRowState[]) =>
  rows.reduce((sum, r) => sum + (r.calculatedLine?.totalAmount ?? 0), 0);

describe('quotation drafts on this device', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage: new MemoryStorage() };
  });

  it('every kind of line comes back with the same totals', () => {
    const rows = calc([
      { ...createInitialRow('a', steel), isManualQuantity: true, manualQuantity: '250', nos: '1' }, // steel sold by kg
      { ...createInitialRow('b', steel), nos: '4', discountPct: '5' }, // steel by lengths, with discount
      { ...createInitialRow('c', sheet), lengthFeet: '12', lengthInches: '6', nos: '10', colour: 'Blue' }, // one-off sheet + colour
      createCustomRow('Labour', '1500', '2'), // old quick custom line
      createInitialRow('d'), // empty last row
    ]);
    const key = draftKey('u1');
    saveDraft(key, { customer: null, quotationDate: '2026-11-23', widthFactor: '1.08', isGstEnabled: true, advanceAmount: '', rows });
    const back = loadDraft(key)!;
    expect(back.rows.every((r) => r.calculatedLine === null)).toBe(true);
    const restored = calc(back.rows);
    expect(total(restored)).toBeCloseTo(total(rows), 2);
    expect(total(restored)).toBeGreaterThan(0);
    expect(restored[2].calculatedLine!.colour).toBe('Blue');
    expect(restored[0].calculatedLine!.quantity).toBe(250);
  });

  it('keeps nothing until there is a customer or a line', () => {
    const key = draftKey('u1');
    saveDraft(key, { customer: null, quotationDate: '', widthFactor: '1.08', isGstEnabled: true, advanceAmount: '', rows: [createInitialRow()] });
    expect(loadDraft(key)).toBeNull();
    expect(draftHasContent({ customer: null, rows: [createInitialRow('x', steel)] })).toBe(true);
  });

  it('separates users and quotations, parks on Back, clears on discard and logout', () => {
    const rows = [createInitialRow('a', steel)];
    const base = { customer: null, quotationDate: '', widthFactor: '1.08', isGstEnabled: true, advanceAmount: '', rows };
    const k1 = draftKey('u1');
    const k2 = draftKey('u2');
    const kr = draftKey('u1', { mode: 'revise', quotationId: 'q9', revision: 2 });
    expect(new Set([k1, k2, kr]).size).toBe(3);
    saveDraft(k1, base);
    saveDraft(k2, base);
    saveDraft(kr, base);
    parkDraft(k1);
    expect(loadDraft(k1)!.parked).toBe(true);
    saveDraft(k1, base); // typing again un-parks it
    expect(loadDraft(k1)!.parked).toBeUndefined();
    clearDraft(k1);
    expect(loadDraft(k1)).toBeNull();
    expect(loadDraft(k2)).not.toBeNull();
    clearAllDrafts();
    expect(loadDraft(k2)).toBeNull();
    expect(loadDraft(kr)).toBeNull();
  });

  it('an untouched revise matches its baseline even though row ids differ', () => {
    const line = calc([{ ...createInitialRow('a', steel), nos: '3' }])[0].calculatedLine!;
    expect(rowsSignature([rowFromSavedLine(line)])).toBe(rowsSignature([rowFromSavedLine(line)]));
    const edited = { ...rowFromSavedLine(line), nos: '4' };
    expect(rowsSignature([edited])).not.toBe(rowsSignature([rowFromSavedLine(line)]));
    expect(serializeRows([edited])[0].calculatedLine).toBeNull();
  });
});
