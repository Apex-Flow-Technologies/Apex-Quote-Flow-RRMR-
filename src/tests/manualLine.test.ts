import { describe, it, expect } from 'vitest';
import { createInitialRow, computeRowCalculation, rowFromSavedLine } from '../components/quotations/quotationRows';
import { buildProductPayload, INITIAL_FORM_STATE, validateProductForm } from '../components/products/productForm';
import type { Product } from '../types/product';

const manual = (unit: string) =>
  ({ id: 'm1', name: 'Gutter brackets (special)', category: 'Accessory', hsn: '73089090', qtyMethod: 'MANUAL', unit, ratePerUnit: 1000, gstRate: 18, active: true }) as Product;

describe('Manual lines: any unit, typed quantity', () => {
  it('2.5 Set at ₹1,000 is ₹2,500 in Set', () => {
    const row = { ...createInitialRow('a', manual('Set')), nos: '2.5' };
    const { calculatedLine, validationError } = computeRowCalculation(row, 'intra', 1.06, 0.305);
    expect(validationError).toBeNull();
    expect(calculatedLine!.quantity).toBe(2.5);
    expect(calculatedLine!.unit).toBe('Set');
    expect(calculatedLine!.taxableAmount).toBe(2500);
    expect(calculatedLine!.cgstAmount).toBe(225);
  });

  it('keeps the unit and quantity on revise', () => {
    const row = { ...createInitialRow('b', manual('Trip')), nos: '3', rate: '1800' };
    const line = computeRowCalculation(row, 'intra', 1.06, 0.305).calculatedLine!;
    const again = computeRowCalculation(rowFromSavedLine(line), 'intra', 1.06, 0.305).calculatedLine!;
    expect(again.unit).toBe('Trip');
    expect(again.quantity).toBe(3);
    expect(again.taxableAmount).toBe(5400);
  });

  it('the form needs a unit and saves the typed one', () => {
    const form = { ...INITIAL_FORM_STATE, name: 'Labour', category: 'Service', hsn: '998719', qtyMethod: 'MANUAL' as const, unit: '  ', ratePerUnit: '500', gstRate: '18' };
    expect(validateProductForm(form).unit).toBeTruthy();
    const ok = { ...form, unit: 'Day' };
    expect(validateProductForm(ok).unit).toBeUndefined();
    expect(buildProductPayload(ok).unit).toBe('Day');
  });
});
