import { describe, it, expect } from 'vitest';
import {
  createInitialRow,
  computeRowCalculation,
  type EditableRowState,
} from '../components/quotations/EditableQuotationTable';
import {
  calculateQuotationTotals,
  formatQtyMethodLabel,
  formatRoundOff,
} from '../engine';
import type { Product, SheetProduct, SectionProduct } from '../types/product';
import type { QuotationLine } from '../types/quotation';
import { DEMO_PRODUCTS } from '../services/seedService';

describe('Priority 3 — Editable Quotation Table & Fast Entry Suite', () => {
  const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
  const pipeProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_18') as SectionProduct;
  const screwProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_15') as Product;
  const ridgeProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_12') as Product;

  const mockAreaProduct: Product = {
    id: 'prod_test_area',
    name: 'TEST POLYCARBONATE SHEET 2MM',
    category: 'Polycarbonate',
    hsn: '39206100',
    qtyMethod: 'AREA',
    unit: 'Sq.Mtr',
    ratePerUnit: 450,
    baseRate: 450,
    minRate: 400,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    coilWidthM: 1.0,
    stockMethod: 'PIECE',
  };

  const mockRunningProduct: Product = {
    id: 'prod_test_running',
    name: 'TEST FLASHING STRIP',
    category: 'Accessories',
    hsn: '72109090',
    qtyMethod: 'RUNNING_LENGTH',
    unit: 'R.Mtr',
    ratePerUnit: 120,
    baseRate: 120,
    minRate: 100,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  };

  describe('1. Initial Row Creation & Defaults', () => {
    it('creates a clean blank initial row with default dimensions and nos=1', () => {
      const row = createInitialRow('test_row_1');
      expect(row.id).toBe('test_row_1');
      expect(row.product).toBeNull();
      expect(row.productSearch).toBe('');
      expect(row.isProductDropdownOpen).toBe(false);
      expect(row.lengthFeet).toBe('8');
      expect(row.lengthInches).toBe('0');
      expect(row.lengthMetres).toBe('6');
      expect(row.lengthUnit).toBe('ft_in');
      expect(row.nos).toBe('1');
      expect(row.rate).toBe('');
      expect(row.discountAmount).toBe('');
      expect(row.discountPct).toBe('');
      expect(row.isManualQuantity).toBe(false);
      expect(row.calculatedLine).toBeNull();
      expect(row.validationError).toBeNull();
    });

    it('creates an initial row pre-populated from a sheet product with ft_in default', () => {
      const row = createInitialRow('test_sheet_row', crimpProduct);
      expect(row.product).toEqual(crimpProduct);
      expect(row.productSearch).toBe(crimpProduct.name);
      expect(row.rate).toBe(String(crimpProduct.ratePerUnit));
      expect(row.lengthUnit).toBe('ft_in');
    });

    it('creates an initial row pre-populated from a pipe product with metres default', () => {
      const row = createInitialRow('test_pipe_row', pipeProduct);
      expect(row.product).toEqual(pipeProduct);
      expect(row.productSearch).toBe(pipeProduct.name);
      expect(row.rate).toBe(String(pipeProduct.ratePerUnit));
      expect(row.lengthUnit).toBe('metres');
    });
  });

  describe('2. Calculation Across All Quantity Methods', () => {
    it('returns null line and null error when no product is selected', () => {
      const row = createInitialRow('row_empty');
      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBeNull();
    });

    it('calculates SHEET_WEIGHT (Crimp 8ft 0in, 9 nos @ ₹117/kg) with Decimal accuracy', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_crimp', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();

      const line = result.calculatedLine!;
      // 8 ft = 2.4384 m. Weight/pc = 2.4384 * 1.06 * 0.47 * 7.968 = 9.68 kg/piece
      expect(line.perPieceQuantity).toBe(9.68);
      // Line quantity = 9.68 * 9 = 87.12 kg
      expect(line.quantity).toBe(87.12);
      // Taxable = 87.12 * 117 = 10,193.04 (Amount before GST)
      expect(line.taxableAmount).toBe(10193.04);
      expect(line.gstRate).toBe(18);
      expect(line.cgstAmount).toBe(917.37);
      expect(line.sgstAmount).toBe(917.37);
    });

    it('calculates SECTION_WEIGHT using metres (MS Pipe 40x40, 6m, 5 nos @ ₹78/kg)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_pipe', pipeProduct),
        lengthUnit: 'metres',
        lengthMetres: '6',
        nos: '5',
        rate: '78',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();

      const line = result.calculatedLine!;
      // 6m * 2.34 kg/m = 14.04 kg/pc. 14.04 * 5 = 70.20 kg
      expect(line.perPieceQuantity).toBe(14.04);
      expect(line.quantity).toBe(70.2);
      // 70.20 * 78 = 5475.60
      expect(line.taxableAmount).toBe(5475.6);
    });

    it('calculates SECTION_WEIGHT using feet & inches (MS Pipe 40x40, 19ft 8.22in)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_pipe_ft', pipeProduct),
        lengthUnit: 'ft_in',
        lengthFeet: '19',
        lengthInches: '8.22',
        nos: '2',
        rate: '78',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();
      expect(result.calculatedLine!.quantity).toBeGreaterThan(0);
    });

    it('calculates PIECE method (Fixing Screws 100 nos @ ₹6/pc)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_screw', screwProduct),
        nos: '100',
        rate: '6',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();

      const line = result.calculatedLine!;
      expect(line.quantity).toBe(100);
      expect(line.taxableAmount).toBe(600);
    });

    it('calculates PIECE method for accessory (Ridge 8ft, 3 nos @ ₹690/pc)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_ridge', ridgeProduct),
        nos: '3',
        rate: '690',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      expect(line.quantity).toBe(3);
      expect(line.taxableAmount).toBe(2070);
    });

    it('calculates AREA method (Polycarbonate 10ft length, 1m cover width, 2 nos @ ₹450/sqm)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_area', mockAreaProduct),
        lengthFeet: '10',
        lengthInches: '0',
        nos: '2',
        rate: '450',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();
      const line = result.calculatedLine!;
      // 10 ft = 3.048 m. Area/pc = 3.048 * 1.0 = 3.05 sq.m. 2 pcs = 6.10 sq.m
      expect(line.quantity).toBe(6.1);
      // 6.10 * 450 = 2745.00
      expect(line.taxableAmount).toBe(2745);
    });

    it('calculates RUNNING_LENGTH method (Flashing strip 10ft, 3 nos @ ₹120/rm)', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_running', mockRunningProduct),
        lengthFeet: '10',
        lengthInches: '0',
        nos: '3',
        rate: '120',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();
      const line = result.calculatedLine!;
      expect(line.quantity).toBeGreaterThan(0);
      expect(line.taxableAmount).toBeGreaterThan(0);
    });
  });

  describe('3. Dynamic Row Edits & Tax Modes', () => {
    it('applies custom rate override', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_rate_override', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '1',
        rate: '130', // Overriding default 117
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      expect(line.rate).toBe(130);
      // 9.68 kg * 130 = 1258.40
      expect(line.taxableAmount).toBe(1258.4);
    });

    it('applies fixed discount amount correctly', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_disc_amt', screwProduct),
        nos: '100',
        rate: '6',
        discountAmount: '50',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      // 100 * 6 = 600 - 50 = 550
      expect(line.taxableAmount).toBe(550);
      expect(line.discountAmount).toBe(50);
    });

    it('applies percentage discount correctly', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_disc_pct', screwProduct),
        nos: '100',
        rate: '6',
        discountPct: '10',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      // 100 * 6 = 600 - 10% (60) = 540
      expect(line.taxableAmount).toBe(540);
      expect(line.discountPct).toBe(10);
    });

    it('switches tax distribution correctly in inter-state taxMode', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_inter', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
      };

      const result = computeRowCalculation(row, 'inter');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      expect(line.cgstAmount).toBe(0);
      expect(line.sgstAmount).toBe(0);
      expect(line.igstAmount).toBe(1834.75); // 10193.04 * 18% = 1834.7472 -> 1834.75
    });

    it('supports manual quantity override when enabled', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_manual', crimpProduct),
        isManualQuantity: true,
        manualQuantity: '105.5',
        nos: '10',
        rate: '117',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.validationError).toBeNull();
      const line = result.calculatedLine!;
      expect(line.isManualQuantity).toBe(true);
      expect(line.quantity).toBe(105.5);
      // 105.5 * 117 = 12343.50
      expect(line.taxableAmount).toBe(12343.5);
    });
  });

  describe('4. Manual Quantity Override Lifecycle & Reactivity', () => {
    it('enables manual quantity override and recalculates taxable amount', () => {
      const baseRow: EditableRowState = {
        ...createInitialRow('row_base', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
      };
      const initialCalc = computeRowCalculation(baseRow, 'intra').calculatedLine!;
      expect(initialCalc.quantity).toBe(87.12);
      expect(initialCalc.isManualQuantity).toBe(false);

      const manualRow: EditableRowState = {
        ...baseRow,
        isManualQuantity: true,
        manualQuantity: '85',
      };
      const manualCalc = computeRowCalculation(manualRow, 'intra').calculatedLine!;
      expect(manualCalc.isManualQuantity).toBe(true);
      expect(manualCalc.quantity).toBe(85);
      // Taxable = 85 * 117 = 9945.00
      expect(manualCalc.taxableAmount).toBe(9945);
    });

    it('edits manual quantity override and immediately reflects new values', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_edit_manual', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
        isManualQuantity: true,
        manualQuantity: '85',
      };
      const editedRow: EditableRowState = {
        ...row,
        manualQuantity: '90.5',
      };
      const calc = computeRowCalculation(editedRow, 'intra').calculatedLine!;
      expect(calc.quantity).toBe(90.5);
      // 90.5 * 117 = 10588.50
      expect(calc.taxableAmount).toBe(10588.5);
    });

    it('preserves manual quantity when dimensions (feet/inches) change without silent overwrite', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_dim_change', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
        isManualQuantity: true,
        manualQuantity: '85',
      };
      // User changes length from 8ft to 12ft
      const updatedRow: EditableRowState = {
        ...row,
        lengthFeet: '12',
      };
      const calc = computeRowCalculation(updatedRow, 'intra').calculatedLine!;
      // perPieceQuantity recomputes from 12ft (14.52 kg/pc)
      expect(calc.perPieceQuantity).toBe(14.52);
      // But line quantity MUST remain strictly locked to 85 kg
      expect(calc.quantity).toBe(85);
      expect(calc.taxableAmount).toBe(9945);
    });

    it('preserves manual quantity when pieces (nos) change', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_nos_change', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
        isManualQuantity: true,
        manualQuantity: '85',
      };
      // User changes pieces from 9 to 15
      const updatedRow: EditableRowState = {
        ...row,
        nos: '15',
      };
      const calc = computeRowCalculation(updatedRow, 'intra').calculatedLine!;
      expect(calc.nos).toBe(15);
      // Line quantity must remain strictly locked to 85 kg
      expect(calc.quantity).toBe(85);
      expect(calc.taxableAmount).toBe(9945);
    });

    it('recalculates amount using active manual quantity when rate changes', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_rate_change', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
        isManualQuantity: true,
        manualQuantity: '85',
      };
      // User changes rate from 117 to 125
      const updatedRow: EditableRowState = {
        ...row,
        rate: '125',
      };
      const calc = computeRowCalculation(updatedRow, 'intra').calculatedLine!;
      expect(calc.rate).toBe(125);
      expect(calc.quantity).toBe(85);
      // 85 * 125 = 10625.00
      expect(calc.taxableAmount).toBe(10625);
    });

    it('returns to calculated mode and recomputes quantity from product geometry', () => {
      const manualRow: EditableRowState = {
        ...createInitialRow('row_reset', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
        isManualQuantity: true,
        manualQuantity: '85',
      };
      expect(computeRowCalculation(manualRow, 'intra').calculatedLine!.quantity).toBe(85);

      // Return to calculated quantity
      const resetRow: EditableRowState = {
        ...manualRow,
        isManualQuantity: false,
        manualQuantity: '',
      };
      const calc = computeRowCalculation(resetRow, 'intra').calculatedLine!;
      expect(calc.isManualQuantity).toBe(false);
      // Recomputed: 8ft crimp, 9 nos = 87.12 kg
      expect(calc.quantity).toBe(87.12);
      expect(calc.taxableAmount).toBe(10193.04);
    });

    it('validates manual quantity must be greater than zero and numeric', () => {
      const rowZero: EditableRowState = {
        ...createInitialRow('row_zero_manual', crimpProduct),
        isManualQuantity: true,
        manualQuantity: '0',
      };
      expect(computeRowCalculation(rowZero, 'intra').calculatedLine).toBeNull();
      expect(computeRowCalculation(rowZero, 'intra').validationError).toBe('Manual quantity must be greater than 0.');

      const rowNeg: EditableRowState = {
        ...createInitialRow('row_neg_manual', crimpProduct),
        isManualQuantity: true,
        manualQuantity: '-10',
      };
      expect(computeRowCalculation(rowNeg, 'intra').calculatedLine).toBeNull();
      expect(computeRowCalculation(rowNeg, 'intra').validationError).toBe('Manual quantity must be greater than 0.');

      const rowEmpty: EditableRowState = {
        ...createInitialRow('row_empty_manual', crimpProduct),
        isManualQuantity: true,
        manualQuantity: '',
      };
      expect(computeRowCalculation(rowEmpty, 'intra').calculatedLine).toBeNull();
      expect(computeRowCalculation(rowEmpty, 'intra').validationError).toBe('Manual quantity must be greater than 0.');

      const rowNaN: EditableRowState = {
        ...createInitialRow('row_nan_manual', crimpProduct),
        isManualQuantity: true,
        manualQuantity: 'invalid_qty',
      };
      expect(computeRowCalculation(rowNaN, 'intra').calculatedLine).toBeNull();
      expect(computeRowCalculation(rowNaN, 'intra').validationError).toBe('Please enter valid numeric values.');
    });

    it('duplicating a manual override row preserves manual override state with a unique ID', () => {
      const originalRow: EditableRowState = {
        ...createInitialRow('row_dup_orig', crimpProduct),
        isManualQuantity: true,
        manualQuantity: '95.5',
        rate: '117',
      };
      const duplicatedRow: EditableRowState = {
        ...originalRow,
        id: 'row_dup_cloned_123',
      };
      expect(duplicatedRow.id).not.toBe(originalRow.id);
      expect(duplicatedRow.isManualQuantity).toBe(true);
      expect(duplicatedRow.manualQuantity).toBe('95.5');
      const calc = computeRowCalculation(duplicatedRow, 'intra').calculatedLine!;
      expect(calc.quantity).toBe(95.5);
    });
  });

  describe('5. Inline Validation & Guarding Against Incomplete Rows', () => {
    it('catches zero or negative nos as validation error', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_invalid_nos', crimpProduct),
        nos: '0',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBe('Nos must be at least 1.');
    });

    it('catches zero or negative rate as validation error', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_invalid_rate', crimpProduct),
        rate: '0',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBe('Rate must be greater than 0.');
    });

    it('catches invalid non-numeric rate string as validation error', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_nan_rate', crimpProduct),
        rate: 'abc',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBeDefined();
    });

    it('catches zero length for dimension-based sheet product', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_zero_len', crimpProduct),
        lengthFeet: '0',
        lengthInches: '0',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBe('Length must be greater than 0.');
    });

    it('catches negative discount as validation error', () => {
      const row: EditableRowState = {
        ...createInitialRow('row_neg_disc', screwProduct),
        nos: '10',
        rate: '5',
        discountAmount: '-50',
      };

      const result = computeRowCalculation(row, 'intra');
      expect(result.calculatedLine).toBeNull();
      expect(result.validationError).toBe('Discount cannot be negative.');
    });
  });

  describe('6. Document Totals & Multi-Row Integration', () => {
    it('aggregates multiple valid rows into precise quotation totals and round-off', () => {
      const row1 = {
        ...createInitialRow('r1', crimpProduct),
        lengthFeet: '8',
        lengthInches: '0',
        nos: '9',
        rate: '117',
      };
      const row2 = {
        ...createInitialRow('r2', pipeProduct),
        lengthUnit: 'metres' as const,
        lengthMetres: '6',
        nos: '5',
        rate: '78',
      };
      const row3 = {
        ...createInitialRow('r3', screwProduct),
        nos: '100',
        rate: '6',
      };

      const calc1 = computeRowCalculation(row1, 'intra').calculatedLine!;
      const calc2 = computeRowCalculation(row2, 'intra').calculatedLine!;
      const calc3 = computeRowCalculation(row3, 'intra').calculatedLine!;

      const validLines: QuotationLine[] = [calc1, calc2, calc3];

      const totals = calculateQuotationTotals(validLines, 'intra', true);

      // Subtotal = 10193.04 + 5475.60 + 600.00 = 16268.64
      expect(totals.subtotal.toFixed(2)).toBe('16268.64');
      // CGST = 917.37 + 492.80 + 54.00 = 1464.17
      expect(totals.cgstTotal.toFixed(2)).toBe('1464.17');
      // SGST = 1464.17
      expect(totals.sgstTotal.toFixed(2)).toBe('1464.17');
      // Grand Total = 16268.64 + 1464.17 + 1464.17 = 19196.98
      expect(totals.grandTotal.toFixed(2)).toBe('19196.98');
      // Round-off is +0.02 to round to nearest integer 19197.00
      expect(totals.payableAmount.toFixed(2)).toBe('19197.00');
      expect(totals.amountInWords).toContain('Rupees');
    });

    it('correctly filters out incomplete draft rows while retaining completed rows', () => {
      const completeRow = {
        ...createInitialRow('row_ok', screwProduct),
        nos: '50',
        rate: '6',
      };
      const incompleteRow = {
        ...createInitialRow('row_incomplete', crimpProduct),
        nos: '0', // invalid
      };
      const emptyRow = createInitialRow('row_empty');

      const rows: EditableRowState[] = [
        {
          ...completeRow,
          ...computeRowCalculation(completeRow, 'intra'),
        },
        {
          ...incompleteRow,
          ...computeRowCalculation(incompleteRow, 'intra'),
        },
        {
          ...emptyRow,
          ...computeRowCalculation(emptyRow, 'intra'),
        },
      ];

      const validLines = rows
        .map((r) => r.calculatedLine)
        .filter((l): l is QuotationLine => l !== null);

      expect(validLines.length).toBe(1);
      expect(validLines[0].productName).toBe(screwProduct.name);
    });
  });

  describe('7. Labeling & UI Wording Verification', () => {
    it('verifies CEO review quantity method label changes', () => {
      expect(formatQtyMethodLabel('SHEET_WEIGHT')).toBe('Sheet · by weight');
      expect(formatQtyMethodLabel('SECTION_WEIGHT')).toBe('Pipe · by weight');
      expect(formatQtyMethodLabel('PIECE')).toBe('Per piece');
      expect(formatQtyMethodLabel('AREA')).toBe('By area');
      expect(formatQtyMethodLabel('RUNNING_LENGTH')).toBe('By running metre');
    });

    it('verifies round-off formatting produces clean display', () => {
      expect(formatRoundOff(0.24)).toBe('+₹0.24');
      expect(formatRoundOff(-0.35)).toBe('-₹0.35');
      expect(formatRoundOff(0)).toBe('₹0.00');
    });
  });
});
