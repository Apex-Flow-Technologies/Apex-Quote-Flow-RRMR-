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

  it('adds each quote method exactly as the Custom Item button does, with the right quantity', () => {
    const expected: Partial<Record<QuantityMethod, [number, string]>> = {
      SQM: [5.73, 'Sq.Mtr'], // 17.4 ft × 0.305 × 1.08
      WEIGHT_PER_PIECE: [40, 'Kgs'],
      PIECE: [1, 'Nos'],
      CUSTOM: [1, 'Nos'],
      SHEET_WEIGHT: [9.69, 'Kgs'], // 8 ft sheet, 0.47 mm × 1.06 m
      SECTION_WEIGHT: [27, 'Kgs'], // 6 m × 4.5 kg/m
    };
    for (const [method, [qty, unit]] of Object.entries(expected) as [QuantityMethod, [number, string]][]) {
      const product = oneOffProduct(buildProductPayload(formFor(method)));
      const { calculatedLine, validationError } = computeRowCalculation(createInitialRow(undefined, product), 'intra', 1.08, 0.305);
      expect(validationError, method).toBeNull();
      expect(calculatedLine!.quantity, method).toBeCloseTo(qty, 2);
      expect(calculatedLine!.snapshot.unit, method).toBe(unit);
    }
  });

  it('a custom line keeps the unit picked in the form', () => {
    const form = { ...customItemFormState('Labour'), unit: 'Sq.Mtr' as const, ratePerUnit: '40' };
    const line = computeRowCalculation({ ...createInitialRow('r', oneOffProduct(buildProductPayload(form))), nos: '50' }, 'intra').calculatedLine!;
    expect(line.quantity).toBe(50);
    expect(line.snapshot.unit).toBe('Sq.Mtr');
    expect(rowFromSavedLine(line).product!.unit).toBe('Sq.Mtr');
  });

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

describe('lengths and sheet colour survive save and revise', () => {
  it('feet + inches methods keep a non-default length through revise', () => {
    for (const method of ['SHEET_WEIGHT', 'AREA', 'RUNNING_LENGTH', 'LENGTH_FT'] as QuantityMethod[]) {
      const product = oneOffProduct(buildProductPayload(formFor(method)));
      const row = { ...createInitialRow('r', product), lengthFeet: '12', lengthInches: '6', nos: '3' };
      const line = computeRowCalculation(row, 'intra', 1.08, 0.305).calculatedLine!;
      expect(line, method).not.toBeNull();
      expect(line.lengthFeet, method).toBe(12);
      expect(line.lengthInches, method).toBe(6);
      const revised = rowFromSavedLine(line);
      expect(revised.lengthFeet, method).toBe('12');
      expect(revised.lengthInches, method).toBe('6');
      const again = computeRowCalculation(revised, 'intra', 1.08, 0.305).calculatedLine!;
      expect(again.quantity, method).toBe(line.quantity);
    }
    const ft = oneOffProduct(buildProductPayload(formFor('LENGTH_FT')));
    const q = computeRowCalculation({ ...createInitialRow('r', ft), lengthFeet: '12', lengthInches: '6', nos: '3' }, 'intra').calculatedLine!;
    expect(q.quantity).toBe(37.5); // 12.5 ft × 3
  });

  it('a sheet line keeps its colour; a non-sheet line ignores it', () => {
    const sheet = oneOffProduct(buildProductPayload(formFor('SHEET_WEIGHT')));
    const line = computeRowCalculation({ ...createInitialRow('r', sheet), colour: ' Brick Red ' }, 'intra').calculatedLine!;
    expect(line.colour).toBe('Brick Red');
    const revised = rowFromSavedLine(line);
    expect(revised.colour).toBe('Brick Red');
    expect(computeRowCalculation(revised, 'intra').calculatedLine!.colour).toBe('Brick Red');

    const piece = oneOffProduct(buildProductPayload(formFor('PIECE')));
    expect(computeRowCalculation({ ...createInitialRow('r', piece), colour: 'Blue' }, 'intra').calculatedLine!.colour).toBeUndefined();
  });
});
