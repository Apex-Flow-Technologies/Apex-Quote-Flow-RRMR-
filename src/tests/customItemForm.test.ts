import { describe, it, expect } from 'vitest';
import {
  customItemFormState,
  validateProductForm,
  buildProductPayload,
  oneOffProduct,
  unitForMethod,
  type ProductFormData,
} from '../components/products/productForm';
import { createInitialRow, computeRowCalculation, rowFromSavedLine } from '../components/quotations/quotationRows';
import type { QuantityMethod } from '../types/product';

const METHODS: QuantityMethod[] = [
  'SQM', 'WEIGHT_PER_PIECE', 'PIECE', 'CUSTOM', 'SHEET_WEIGHT',
  'SECTION_WEIGHT', 'AREA', 'RUNNING_LENGTH', 'LENGTH_FT', 'MANUAL',
];

function formFor(method: QuantityMethod): ProductFormData {
  return {
    ...customItemFormState('Test item'),
    qtyMethod: method,
    unit: unitForMethod(method),
    ratePerUnit: '125',
    gstRate: '12',
    kgPerPiece: '40',
    kgPerMetre: '4.5',
  };
}

describe('custom item uses the product form (every calculation method)', () => {
  for (const method of METHODS) {
    it(`${method}: form → quote line → revise keeps the same totals and GST`, () => {
      const form = formFor(method);
      expect(validateProductForm(form)).toEqual({});
      const product = oneOffProduct(buildProductPayload(form));
      expect(product.id.startsWith('custom_')).toBe(false);

      let row = { ...createInitialRow('r1', product), nos: '2' };
      if (method === 'MANUAL') row = { ...row, isManualQuantity: true, manualQuantity: '10' };
      const first = computeRowCalculation(row, 'intra', 1.08, 0.305);
      expect(first.validationError).toBeNull();
      const line = first.calculatedLine!;
      expect(line).not.toBeNull();
      expect(line.quantity).toBeGreaterThan(0);
      expect(line.snapshot.gstRate).toBe(12);
      expect(line.snapshot.productName).toBe('Test item');

      const revised = rowFromSavedLine(line);
      expect(revised.isCustomItem).toBeFalsy();
      const again = computeRowCalculation(revised, 'intra', 1.08, 0.305).calculatedLine!;
      expect(again.quantity).toBe(line.quantity);
      expect(line.totalAmount).toBeGreaterThan(0);
      expect(again.totalAmount).toBe(line.totalAmount);
      expect(again.taxableAmount).toBe(line.taxableAmount);
      expect(again.snapshot.gstRate).toBe(12);
    });
  }

  it('a plain custom line needs only a name and a rate', () => {
    const form = { ...customItemFormState('Labour charge'), ratePerUnit: '1500' };
    expect(validateProductForm(form)).toEqual({});
    const product = oneOffProduct(buildProductPayload(form));
    const line = computeRowCalculation(createInitialRow('r', product), 'intra').calculatedLine!;
    expect(line.quantity).toBe(1);
    expect(line.snapshot.unit).toBe('Nos');
  });

  it('rejects a missing name or rate', () => {
    const errors = validateProductForm(customItemFormState(''));
    expect(errors.name).toBeTruthy();
    expect(errors.ratePerUnit).toBeTruthy();
  });
});
