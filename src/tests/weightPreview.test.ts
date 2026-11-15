import { describe, it, expect } from 'vitest';
import { createInitialRow, computeRowCalculation, weightPreview, type EditableRowState } from '../components/quotations/quotationRows';
import type { Product } from '../types/product';

const steel = {
  id: 'steel_rhs_120x60x4_5',
  name: 'MS Rectangular Pipe 120 × 60 × 4.5 mm',
  category: 'Pipe',
  hsn: '73066100',
  qtyMethod: 'SECTION_WEIGHT',
  unit: 'Kgs',
  kgPerMetre: 11.672,
  defaultLengthM: 6,
  ratePerUnit: 0,
  gstRate: 18,
  active: true,
} as unknown as Product;

describe('weightPreview (steel before a rate is entered)', () => {
  it('shows kg from kg/m × length × lengths even with no rate', () => {
    const row: EditableRowState = { ...createInitialRow('r1', steel), nos: '3' };
    const r = { ...row, ...computeRowCalculation(row, 'intra') };
    expect(r.calculatedLine).toBeNull(); // still needs a rate to price
    const wp = weightPreview(r)!;
    expect(wp.perPiece).toBeCloseTo(70.032, 2); // 11.672 × 6
    expect(wp.quantity).toBeCloseTo(210.1, 1);
    expect(wp.unit).toBe('Kgs');
  });

  it('matches the priced line once a rate is entered', () => {
    const row: EditableRowState = { ...createInitialRow('r2', steel), nos: '2', rate: '62' };
    const r = { ...row, ...computeRowCalculation(row, 'intra') };
    expect(weightPreview(r)!.quantity).toBe(r.calculatedLine!.quantity);
  });

  it('returns null for non-steel rows', () => {
    expect(weightPreview({ ...createInitialRow('r3') })).toBeNull();
  });
});
