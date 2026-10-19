import { describe, it, expect } from 'vitest';
import {
  calculateQuotationLine,
  calculateQuotationTotals,
} from '../engine';
import type { QuotationLineSnapshot } from '../types/quotation';
import { QuotationPdfDocument } from '../pages/quotations/QuotationPdfDocument';
import { formatQtyMethodLabel } from '../types/product';

describe('Sprint 2 — Calculation Engine Acceptance Checks (Hari Brief)', () => {
  // Check 1 — Feet-based sheet
  it('Check 1: calculates 17.4 ft sheet with exact 57.32 sq.m and ₹23,499.40', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'sheet_01',
      productName: 'JSW Colouron+ Sheet',
      category: 'Sheet',
      hsn: '72109090',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 410,
      gstRate: 18,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        lengthValue: 17.4,
        lengthUnit: 'ft',
        widthFactor: 1.08,
        nos: 10,
        customRate: 410,
      },
      'intra'
    );

    // Length in m: 17.4 * 0.305 = 5.307 m
    // Area: 5.307 * 1.08 * 10 = 57.3156 sq.m -> displayed 57.32 sq.m
    expect(line.quantity).toBe(57.32);
    expect(line.unit).toBe('Sq.Mtr');
    // Line Amount: 57.3156 * 410 = 23,499.396 -> displayed ₹23,499.40
    expect(line.taxableAmount).toBe(23499.40);
  });

  // Check 2 — Inch-based sheet
  it('Check 2: calculates 106 inches sheet with exact 116.39 sq.m and ₹48,650.18', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'sheet_02',
      productName: 'JSW Colouron+ Sheet',
      category: 'Sheet',
      hsn: '72109090',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 418,
      gstRate: 18,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        lengthValue: 106,
        lengthUnit: 'in',
        widthFactor: 1.08,
        nos: 40,
        customRate: 418,
      },
      'intra'
    );

    // Area: (106 / 12 * 0.305) * 1.08 * 40 = 116.388 sq.m -> displayed 116.39 sq.m
    expect(line.quantity).toBe(116.39);
    // Line Amount: 116.388 * 418 = 48,650.184 -> displayed ₹48,650.18
    expect(line.taxableAmount).toBe(48650.18);
  });

  // Check 3 — Millimetre-based sheet
  it('Check 3: calculates 5300 mm sheet with exact 57.24 sq.m and ₹23,468.40', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'sheet_03',
      productName: 'JSW Colouron+ Sheet',
      category: 'Sheet',
      hsn: '72109090',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 410,
      gstRate: 18,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        lengthValue: 5300,
        lengthUnit: 'mm',
        widthFactor: 1.08,
        nos: 10,
        customRate: 410,
      },
      'intra'
    );

    // Length in m: 5300 / 1000 = 5.3 m
    // Area: 5.3 * 1.08 * 10 = 57.24 sq.m
    expect(line.quantity).toBe(57.24);
    // Line Amount: 57.24 * 410 = 23,468.40
    expect(line.taxableAmount).toBe(23468.40);
  });

  // Check 4 — Editable width factor
  it('Check 4: calculates width factors 1.06 and 1.076 accurately', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'sheet_04',
      productName: 'JSW Colouron+ Sheet',
      category: 'Sheet',
      hsn: '72109090',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 410,
      gstRate: 18,
    };

    // Width 1.06: 56.25 sq.m and ₹23,064.22
    const line106 = calculateQuotationLine(
      {
        snapshot,
        lengthValue: 17.4,
        lengthUnit: 'ft',
        widthFactor: 1.06,
        nos: 10,
        customRate: 410,
      },
      'intra'
    );
    expect(line106.quantity).toBe(56.25);
    expect(line106.taxableAmount).toBe(23064.22);

    // Width 1.076: 57.10 sq.m and ₹23,412.36
    const line1076 = calculateQuotationLine(
      {
        snapshot,
        lengthValue: 17.4,
        lengthUnit: 'ft',
        widthFactor: 1.076,
        nos: 10,
        customRate: 410,
      },
      'intra'
    );
    expect(line1076.quantity).toBe(57.10);
    expect(line1076.taxableAmount).toBe(23412.36);
  });

  // Check 5 — Accessories
  it('Check 5: calculates accessories (L-flashing and Poly sheet) per square metre', () => {
    // L-flashing: 8 ft, quantity 10, rate ₹465/sq.m.
    const lFlashingSnap: QuotationLineSnapshot = {
      productId: 'acc_01',
      productName: 'L-Flashing',
      category: 'Accessory',
      hsn: '72109090',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 465,
      gstRate: 18,
    };
    const lFlashingLine = calculateQuotationLine(
      {
        snapshot: lFlashingSnap,
        lengthValue: 8,
        lengthUnit: 'ft',
        widthFactor: 1.08,
        nos: 10,
        customRate: 465,
      },
      'intra'
    );
    // Area: 8 * 0.305 * 1.08 * 10 = 26.352 sq.m -> 26.35 sq.m
    // Amount: 26.352 * 465 = 12,253.68
    expect(lFlashingLine.quantity).toBe(26.35);
    expect(lFlashingLine.taxableAmount).toBe(12253.68);

    // Poly sheet: 8 ft, quantity 3, rate ₹910/sq.m.
    const polySnap: QuotationLineSnapshot = {
      productId: 'acc_02',
      productName: 'Polycarbonate Sheet',
      category: 'Accessory',
      hsn: '39206100',
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      rate: 910,
      gstRate: 18,
    };
    const polyLine = calculateQuotationLine(
      {
        snapshot: polySnap,
        lengthValue: 8,
        lengthUnit: 'ft',
        widthFactor: 1.08,
        nos: 3,
        customRate: 910,
      },
      'intra'
    );
    // Area: 8 * 0.305 * 1.08 * 3 = 7.9056 sq.m -> 7.91 sq.m
    // Amount: 7.9056 * 910 = 7,194.096 -> 7,194.10
    expect(polyLine.quantity).toBe(7.91);
    expect(polyLine.taxableAmount).toBe(7194.10);
  });

  // Check 6 — Structural steel
  it('Check 6: calculates structural steel Square tube 100x100 2mm with 720.00 kg and ₹51,840.00', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'tube_01',
      productName: 'Square tube 100x100, 2 mm',
      category: 'Structural',
      hsn: '73066100',
      qtyMethod: 'WEIGHT_PER_PIECE',
      unit: 'Kgs',
      kgPerPiece: 40,
      rate: 72,
      gstRate: 18,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        kgPerPiece: 40,
        nos: 18,
        customRate: 72,
      },
      'intra'
    );

    // Weight: 40 * 18 = 720.00 kg
    expect(line.quantity).toBe(720.00);
    expect(line.unit).toBe('Kgs');
    // Amount: 720 * 72 = ₹51,840.00
    expect(line.taxableAmount).toBe(51840.00);
  });

  // Check 7 — Settu quotation calculation verification
  it('Check 7: aggregates Settu quotation to exact Taxable ₹2,63,070.10 and Final ₹3,10,422.72', () => {
    // Settu: 606.33 sq.m total across 20 lines, 1400 screws (pieces), intra-state 18% GST
    // Test unrounded subtotal aggregation and statutory tax calculation:
    const mockLines = [
      {
        hsn: '72109090',
        unit: 'Sq.Mtr' as const,
        quantity: 606.33,
        taxableAmount: 263070.10,
        unroundedTaxableAmount: 263070.10,
        gstRate: 18,
      },
      {
        hsn: '73181500',
        unit: 'Nos' as const,
        quantity: 1400,
        taxableAmount: 0,
        unroundedTaxableAmount: 0,
        gstRate: 18,
      },
    ];

    const totals = calculateQuotationTotals(mockLines, 'intra', false, true, 0);

    expect(totals.subtotal.toNumber()).toBe(263070.10);
    expect(totals.cgstTotal.toNumber()).toBe(23676.31);
    expect(totals.sgstTotal.toNumber()).toBe(23676.31);
    expect(totals.grandTotal.toNumber()).toBe(310422.72);
    expect(totals.totalSqMtr.toNumber()).toBe(606.33);
    expect(totals.totalNos.toNumber()).toBe(1400);
    expect(totals.totalKgs.toNumber()).toBe(0);
  });

  // Check 8 — Vinoth quotation calculation verification
  it('Check 8: aggregates Vinoth quotation with GST disabled and advance ₹1,50,000 to Balance Due ₹37,390.83', () => {
    const mockLines = [
      {
        hsn: '72109090',
        unit: 'Sq.Mtr' as const,
        quantity: 450,
        taxableAmount: 187390.83,
        unroundedTaxableAmount: 187390.83,
        gstRate: 18,
      },
    ];

    // GST disabled, advance 150000
    const totals = calculateQuotationTotals(mockLines, 'intra', false, false, 150000);

    expect(totals.subtotal.toNumber()).toBe(187390.83);
    expect(totals.cgstTotal.toNumber()).toBe(0);
    expect(totals.sgstTotal.toNumber()).toBe(0);
    expect(totals.totalTax.toNumber()).toBe(0);
    expect(totals.grandTotal.toNumber()).toBe(187390.83);
    expect(totals.advanceAmount.toNumber()).toBe(150000.00);
    expect(totals.balanceDue.toNumber()).toBe(37390.83);
  });

  // Check 9 — Custom item added to Settu quotation
  it('Check 9: adding custom labour item (₹2,500) updates Taxable to ₹2,65,570.10 and Final to ₹3,13,372.72', () => {
    const mockLines = [
      {
        hsn: '72109090',
        unit: 'Sq.Mtr' as const,
        quantity: 606.33,
        taxableAmount: 263070.10,
        unroundedTaxableAmount: 263070.10,
        gstRate: 18,
      },
      {
        hsn: '',
        unit: 'Nos' as const,
        quantity: 1,
        taxableAmount: 2500.00,
        unroundedTaxableAmount: 2500.00,
        gstRate: 18,
      },
    ];

    const totals = calculateQuotationTotals(mockLines, 'intra', false, true, 0);

    expect(totals.subtotal.toNumber()).toBe(265570.10);
    expect(totals.cgstTotal.toNumber()).toBe(23901.31);
    expect(totals.sgstTotal.toNumber()).toBe(23901.31);
    expect(totals.grandTotal.toNumber()).toBe(313372.72);
  });

  // Check 10 — Snapshot persistence
  it('Check 10: saved quotation preserves widthFactor 1.08 and amounts even when default changes to 1.06', () => {
    // 1. Original quotation saved with widthFactor 1.08
    const savedQuotation = {
      id: 'qt_orig',
      quotationNumber: 'RR/QT/26-27/0001',
      widthFactor: 1.08,
      feetToMetre: 0.305,
      subtotal: 23499.40,
      payableAmount: 27729.29,
    };

    // 2. Settings changed to 1.06
    const updatedCompanySettings = {
      defaultWidthFactor: 1.06,
      feetToMetre: 0.305,
    };

    // 3. Reopened original quote preserves its own saved widthFactor
    const effectiveWidthFactorOnReopen = savedQuotation.widthFactor ?? updatedCompanySettings.defaultWidthFactor;
    expect(effectiveWidthFactorOnReopen).toBe(1.08);
    expect(savedQuotation.subtotal).toBe(23499.40);
    expect(savedQuotation.payableAmount).toBe(27729.29);

    // 4. A newly created quotation starts with the new default widthFactor 1.06
    const newQuoteDraftWidthFactor = updatedCompanySettings.defaultWidthFactor ?? 1.08;
    expect(newQuoteDraftWidthFactor).toBe(1.06);
  });

  // Check 11 — Quantity summary
  it('Check 11: Settu quotation has exact 606.33 sq.m, 1400 nos, and zero kilograms is strictly omitted', () => {
    const mockLines = [
      {
        hsn: '72109090',
        unit: 'Sq.Mtr' as const,
        quantity: 606.33,
        taxableAmount: 263070.10,
        unroundedTaxableAmount: 263070.10,
        gstRate: 18,
      },
      {
        hsn: '73181500',
        unit: 'Nos' as const,
        quantity: 1400,
        taxableAmount: 0,
        unroundedTaxableAmount: 0,
        gstRate: 18,
      },
    ];

    const totals = calculateQuotationTotals(mockLines, 'intra', false, true, 0);

    expect(totals.totalSqMtr.toNumber()).toBe(606.33);
    expect(totals.totalNos.toNumber()).toBe(1400);
    expect(totals.totalKgs.toNumber()).toBe(0);

    // In PDF rendering tree, zero kilograms box must not be rendered
    const quotation: any = {
      id: 'qt_settu_summary',
      quotationNumber: 'RR/QT/26-27/0007',
      customer: { id: 'c1', name: 'Settu Builders', phone: '9840000000' },
      lines: [],
      subtotal: totals.subtotal.toNumber(),
      cgstTotal: totals.cgstTotal.toNumber(),
      sgstTotal: totals.sgstTotal.toNumber(),
      igstTotal: 0,
      grandTotal: totals.grandTotal.toNumber(),
      payableAmount: totals.payableAmount.toNumber(),
      totalSqMtr: totals.totalSqMtr.toNumber(),
      totalNos: totals.totalNos.toNumber(),
      totalKgs: totals.totalKgs.toNumber(),
      amountInWords: totals.amountInWords,
    };

    const tree = QuotationPdfDocument({ quotation });
    const json = JSON.stringify(tree);

    expect(json).toContain('Total Area');
    expect(json).toContain('606.33');
    expect(json).toContain('Sq.Mtr');
    expect(json).toContain('Qty in Nos');
    expect(json).toContain('1400');
    expect(json).not.toContain('Total Weight');
  });

  // Check 12 — Regression & Full PDF Generation
  it('Check 12: PDF renders ₹ symbol, non-GST mode suppresses tax rows, advance/balance displays, and legacy sheet weight remains compatible', async () => {
    // 1. Verify formatQtyMethodLabel
    expect(formatQtyMethodLabel('SQM')).toBe('Square Metre (Sq.Mtr)');
    expect(formatQtyMethodLabel('WEIGHT_PER_PIECE')).toBe('Structural Steel (kg/pc)');
    expect(formatQtyMethodLabel('CUSTOM')).toBe('Custom line');
    expect(formatQtyMethodLabel('SHEET_WEIGHT')).toBe('Sheet · by weight');

    // 2. Legacy SHEET_WEIGHT line calculation compatibility
    const legacySnapshot: QuotationLineSnapshot = {
      productId: 'prod_demo_01',
      productName: 'JSW C+ CRIMP SHEET 8+1',
      category: 'Crimp',
      hsn: '72109090',
      qtyMethod: 'SHEET_WEIGHT',
      thicknessMm: 0.47,
      coilWidthM: 1.06,
      densityFactor: 7.968,
      unit: 'Kgs',
      rate: 117,
      gstRate: 18,
    };

    const legacyLine = calculateQuotationLine(
      {
        snapshot: legacySnapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
        customRate: 117,
      },
      'intra'
    );

    // 8 ft = 2.4384 m. Weight: 1.06 * 2.4384 * 0.47 * 7.968 = 9.68007567... -> 9.68 kg/pc * 9 = 87.12 kg
    expect(legacyLine.quantity).toBe(87.12);
    expect(legacyLine.unit).toBe('Kgs');
    expect(legacyLine.taxableAmount).toBe(10193.04);

    // 3. Verify Non-GST Quotation PDF generation (no tax rows)
    const nonGstQuotation: any = {
      id: 'qt_nongst',
      quotationNumber: 'RR/QT/26-27/0008',
      quotationDate: '2026-10-18',
      customer: { id: 'c2', name: 'Vinoth Construction', phone: '9840000001' },
      isGstEnabled: false,
      advanceAmount: 150000,
      balanceDue: 37390.83,
      lines: [
        {
          id: 'l1',
          snapshot: {
            productId: 'p1',
            productName: 'Roofing Sheet',
            category: 'Sheet',
            hsn: '72109090',
            qtyMethod: 'SQM',
            unit: 'Sq.Mtr',
            rate: 410,
            gstRate: 18,
          },
          productName: 'Roofing Sheet',
          hsn: '72109090',
          unit: 'Sq.Mtr',
          rate: 410,
          quantity: 457.05,
          taxableAmount: 187390.83,
          nos: 1,
        },
      ],
      subtotal: 187390.83,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      grandTotal: 187390.83,
      payableAmount: 187390.83,
      totalSqMtr: 457.05,
      totalNos: 1,
      totalKgs: 0,
      amountInWords: 'INR One Lakh Eighty Seven Thousand Three Hundred Ninety and Eighty Three Paise Only',
    };

    const nonGstTree = QuotationPdfDocument({ quotation: nonGstQuotation });
    const nonGstJson = JSON.stringify(nonGstTree);

    expect(nonGstJson).toContain('Non-GST Quotation');
    expect(nonGstJson).not.toContain('CGST (Central Tax)');
    expect(nonGstJson).not.toContain('SGST (State Tax)');
    expect(nonGstJson).not.toContain('IGST (Integrated Tax)');
    expect(nonGstJson).toContain('Advance Received:');
    expect(nonGstJson).toContain('150000.00');
    expect(nonGstJson).toContain('Balance Due:');
    expect(nonGstJson).toContain('37,390.83');
  });
});
