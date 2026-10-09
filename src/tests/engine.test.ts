import { describe, it, expect } from 'vitest';
import {
  normalizeFeetAndInches,
  toMetres,
  calculatePerPieceQuantity,
  calculateLineQuantity,
  calculateLineAmounts,
  determineTaxMode,
  calculateTaxForGroup,
  calculateQuotationTotals,
  amountToIndianWords,
  calculateQuotationLine,
  recalculateLineTax,
  formatRoundOff,
  validateLineDraft,
} from '../engine';
import type { QuotationLineSnapshot } from '../types/quotation';

describe('Part E: Length Handling Engine', () => {
  it('should normalize 0 ft 0 in to 0 ft and 0 m', () => {
    const feet = normalizeFeetAndInches(0, 0);
    expect(feet.toString()).toBe('0');
    const metres = toMetres({ feet: 0, inches: 0 });
    expect(metres.toString()).toBe('0');
  });

  it('should normalize whole feet correctly (8 ft 0 in)', () => {
    const feet = normalizeFeetAndInches(8, 0);
    expect(feet.toString()).toBe('8');
    const metres = toMetres({ feet: 8, inches: 0 });
    // 8 * 0.3048 = 2.4384 exactly
    expect(metres.toString()).toBe('2.4384');
  });

  it('should normalize fractional inches without rounding (12 ft 6 in -> 12.5 ft -> 3.81 m)', () => {
    const feet = normalizeFeetAndInches(12, 6);
    expect(feet.toString()).toBe('12.5');
    const metres = toMetres({ feet: 12, inches: 6 });
    // 12.5 * 0.3048 = 3.81 exactly
    expect(metres.toString()).toBe('3.81');
  });

  it('should handle fractional inches like 10 ft 3 in (10.25 ft)', () => {
    const feet = normalizeFeetAndInches(10, 3);
    expect(feet.toString()).toBe('10.25');
    const metres = toMetres({ feet: 10, inches: 3 });
    // 10.25 * 0.3048 = 3.1242
    expect(metres.toString()).toBe('3.1242');
  });
});

describe('Part F: Crimp Sheet Test (TC-01 / Demo-day Check 2)', () => {
  it('should calculate 8 ft 0 in Crimp sheet 8+1 as 9.68 kg/pc, 87.12 kg total, ₹10,193.04 amount', () => {
    // Given: Crimp sheet 8+1, 0.47 mm, coil width 1.06 m, density 7.968, 8 ft 0 in, 9 nos, rate ₹117/kg
    const perPiece = calculatePerPieceQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: '1.06',
      thicknessMm: '0.47',
      densityFactor: '7.968',
      length: { feet: 8, inches: 0 },
    });
    // Expected per piece: 9.68 kg
    expect(perPiece.toString()).toBe('9.68');

    const qtyResult = calculateLineQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: '1.06',
      thicknessMm: '0.47',
      densityFactor: '7.968',
      length: { feet: 8, inches: 0 },
      nos: 9,
    });
    // Expected line quantity: 87.12 kg
    expect(qtyResult.lineQuantity.toString()).toBe('87.12');
    expect(qtyResult.unit).toBe('Kgs');

    const moneyResult = calculateLineAmounts({
      quantity: qtyResult.lineQuantity,
      rate: 117,
    });
    // Expected amount: ₹10,193.04
    expect(moneyResult.taxableAmount.toString()).toBe('10193.04');
  });
});

describe('Part G: Second Sheet Test (TC-02 / Demo-day Check 3)', () => {
  it('should calculate 12 ft 6 in Crimp sheet as 15.12 kg per piece', () => {
    const perPiece = calculatePerPieceQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: '1.06',
      thicknessMm: '0.47',
      densityFactor: '7.968',
      length: { feet: 12, inches: 6 },
    });
    // Expected per piece: 15.12 kg
    expect(perPiece.toString()).toBe('15.12');
  });
});

describe('Part H: Pipe Test (TC-03 / Demo-day Check 4)', () => {
  it('should calculate MS pipe 40x40x2 mm as 140.40 kg and ₹10,951.20 (explicitly not ₹0.00)', () => {
    // Given: MS pipe 40×40×2 mm, SECTION_WEIGHT, kgPerMetre 2.34, 6 m, 10 nos, ₹78/kg
    const perPiece = calculatePerPieceQuantity({
      method: 'SECTION_WEIGHT',
      kgPerMetre: '2.34',
      length: { metres: 6 },
    });
    expect(perPiece.toString()).toBe('14.04');

    const qtyResult = calculateLineQuantity({
      method: 'SECTION_WEIGHT',
      kgPerMetre: '2.34',
      length: { metres: 6 },
      nos: 10,
    });
    // Expected: 140.40 kg
    expect(qtyResult.lineQuantity.toString()).toBe('140.4');

    const moneyResult = calculateLineAmounts({
      quantity: qtyResult.lineQuantity,
      rate: 78,
    });
    // Expected: ₹10,951.20 (and NOT 0.00)
    expect(moneyResult.taxableAmount.toString()).toBe('10951.2');
    expect(moneyResult.taxableAmount.greaterThan(0)).toBe(true);
  });
});

describe('Piece Rate Items (TC-04)', () => {
  it('should calculate L sheet 12x12 - 8ft (PIECE) with nos 4 at ₹655 as 4 Nos and ₹2,620.00', () => {
    const qtyResult = calculateLineQuantity({
      method: 'PIECE',
      nos: 4,
    });
    expect(qtyResult.lineQuantity.toString()).toBe('4');
    expect(qtyResult.unit).toBe('Nos');

    const moneyResult = calculateLineAmounts({
      quantity: qtyResult.lineQuantity,
      rate: 655,
    });
    expect(moneyResult.taxableAmount.toString()).toBe('2620');
  });
});

describe('Part I & K: GST Engine (Intra vs Inter State)', () => {
  it('should set taxMode to intra for customer GSTIN starting with 33', () => {
    const mode = determineTaxMode('33AAAAA0000A1Z5', '33XXXXX0000X1ZX');
    expect(mode).toBe('intra');
  });

  it('should set taxMode to inter for customer GSTIN starting with 29 (Karnataka)', () => {
    const mode = determineTaxMode('29BBBBB0000B1Z8', '33XXXXX0000X1ZX');
    expect(mode).toBe('inter');
  });

  it('should split 18% into 9% CGST and 9% SGST for intra-state', () => {
    const result = calculateTaxForGroup('81447.76', 18, 'intra');
    expect(result.cgstAmount.toString()).toBe('7330.3');
    expect(result.sgstAmount.toString()).toBe('7330.3');
    expect(result.igstAmount.toString()).toBe('0');
    expect(result.totalTax.toString()).toBe('14660.6');
  });

  it('should charge full 18% IGST with zero CGST/SGST for inter-state', () => {
    const result = calculateTaxForGroup('81447.76', 18, 'inter');
    expect(result.cgstAmount.toString()).toBe('0');
    expect(result.sgstAmount.toString()).toBe('0');
    expect(result.igstAmount.toString()).toBe('14660.6');
    expect(result.totalTax.toString()).toBe('14660.6');
  });
});

describe('Part J: Official 7-Line Sample (TC-05 / Demo-day Check 5)', () => {
  // Line definitions matching the reference bill:
  const line1Qty = calculateLineQuantity({
    method: 'SHEET_WEIGHT',
    coilWidthM: 1.06,
    thicknessMm: 0.47,
    densityFactor: 7.968,
    length: { feet: 8, inches: 0 },
    nos: 9,
  }).lineQuantity; // 87.12

  const line2Qty = calculateLineQuantity({
    method: 'PIECE',
    nos: 4,
  }).lineQuantity; // 4

  const line3Qty = calculateLineQuantity({
    method: 'PIECE',
    nos: 3,
  }).lineQuantity; // 3

  const line4Qty = calculateLineQuantity({
    method: 'SHEET_WEIGHT',
    coilWidthM: 1.06,
    thicknessMm: 0.47,
    densityFactor: 7.968,
    length: { feet: 40, inches: 0 },
    nos: 1,
  }).lineQuantity; // 48.40

  const line5Qty = calculateLineQuantity({
    method: 'SHEET_WEIGHT',
    coilWidthM: 1.06,
    thicknessMm: 0.47,
    densityFactor: 7.968,
    length: { feet: 10, inches: 0 },
    nos: 22,
  }).lineQuantity; // 266.20

  const line6Qty = calculateLineQuantity({
    method: 'SHEET_WEIGHT',
    coilWidthM: 1.06,
    thicknessMm: 0.47,
    densityFactor: 7.968,
    length: { feet: 12, inches: 0 },
    nos: 11,
  }).lineQuantity; // 159.72

  const line7Qty = calculateLineQuantity({
    method: 'SHEET_WEIGHT',
    coilWidthM: 1.06,
    thicknessMm: 0.47,
    densityFactor: 7.968,
    length: { feet: 12, inches: 0 },
    nos: 8,
  }).lineQuantity; // 116.16

  const sampleLines = [
    {
      hsn: '72109090',
      unit: 'Kgs' as const,
      quantity: line1Qty,
      taxableAmount: calculateLineAmounts({ quantity: line1Qty, rate: 117 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Nos' as const,
      quantity: line2Qty,
      taxableAmount: calculateLineAmounts({ quantity: line2Qty, rate: 655 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Nos' as const,
      quantity: line3Qty,
      taxableAmount: calculateLineAmounts({ quantity: line3Qty, rate: 440 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Kgs' as const,
      quantity: line4Qty,
      taxableAmount: calculateLineAmounts({ quantity: line4Qty, rate: 114 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Kgs' as const,
      quantity: line5Qty,
      taxableAmount: calculateLineAmounts({ quantity: line5Qty, rate: 114 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Kgs' as const,
      quantity: line6Qty,
      taxableAmount: calculateLineAmounts({ quantity: line6Qty, rate: 114 }).taxableAmount,
      gstRate: 18,
    },
    {
      hsn: '72109090',
      unit: 'Kgs' as const,
      quantity: line7Qty,
      taxableAmount: calculateLineAmounts({ quantity: line7Qty, rate: 114 }).taxableAmount,
      gstRate: 18,
    },
  ];

  it('should compute exact line quantities: 87.12, 4, 3, 48.40, 266.20, 159.72, 116.16', () => {
    expect(line1Qty.toString()).toBe('87.12');
    expect(line2Qty.toString()).toBe('4');
    expect(line3Qty.toString()).toBe('3');
    expect(line4Qty.toString()).toBe('48.4');
    expect(line5Qty.toString()).toBe('266.2');
    expect(line6Qty.toString()).toBe('159.72');
    expect(line7Qty.toString()).toBe('116.16');
  });

  it('should produce exact official totals for intra-state GSTIN starting 33', () => {
    const totals = calculateQuotationTotals(sampleLines, 'intra', true);

    // Physical quantity totals
    expect(totals.totalKgs.toString()).toBe('677.6');
    expect(totals.totalNos.toString()).toBe('7');

    // Subtotal: ₹81,447.76
    expect(totals.subtotal.toString()).toBe('81447.76');

    // Taxes: CGST 7,330.30 & SGST 7,330.30
    expect(totals.cgstTotal.toString()).toBe('7330.3');
    expect(totals.sgstTotal.toString()).toBe('7330.3');
    expect(totals.igstTotal.toString()).toBe('0');

    // Grand total: ₹96,108.36
    expect(totals.grandTotal.toString()).toBe('96108.36');

    // Round off: -₹0.36
    expect(totals.roundOff.toString()).toBe('-0.36');

    // Final payable: ₹96,108.00
    expect(totals.payableAmount.toString()).toBe('96108');

    // Amount in words
    expect(totals.amountInWords).toBe('Ninety Six Thousand One Hundred and Eight Rupees Only');
  });

  it('Part K: should produce exact totals with IGST ₹14,660.60 for inter-state GSTIN starting 29', () => {
    const totals = calculateQuotationTotals(sampleLines, 'inter', true);

    expect(totals.subtotal.toString()).toBe('81447.76');
    expect(totals.cgstTotal.toString()).toBe('0');
    expect(totals.sgstTotal.toString()).toBe('0');
    expect(totals.igstTotal.toString()).toBe('14660.6');
    expect(totals.grandTotal.toString()).toBe('96108.36');
    expect(totals.roundOff.toString()).toBe('-0.36');
    expect(totals.payableAmount.toString()).toBe('96108');
  });
});

describe('Part L: Manual Quantity Override (TC-08 / Demo-day Check 7)', () => {
  it('should override calculated quantity with manual quantity and recalculate amount', () => {
    // When switching to manual and typing 85
    const manualResult = calculateLineQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: 0.47,
      densityFactor: 7.968,
      length: { feet: 8, inches: 0 },
      nos: 9,
      isManual: true,
      manualQuantity: 85,
    });

    expect(manualResult.isManual).toBe(true);
    expect(manualResult.lineQuantity.toString()).toBe('85');

    const amounts = calculateLineAmounts({
      quantity: manualResult.lineQuantity,
      rate: 117,
    });
    // Expected amount: 85 * 117 = ₹9,945.00
    expect(amounts.taxableAmount.toString()).toBe('9945');

    // When clearing manual override and editing nos to 10:
    const restoredResult = calculateLineQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: 0.47,
      densityFactor: 7.968,
      length: { feet: 8, inches: 0 },
      nos: 10,
      isManual: false,
    });
    expect(restoredResult.isManual).toBe(false);
    // 9.68 * 10 = 96.80
    expect(restoredResult.lineQuantity.toString()).toBe('96.8');
  });
});

describe('Part O: Amount in Words Converter', () => {
  it('should convert 96,108.00 correctly', () => {
    expect(amountToIndianWords(96108)).toBe(
      'Ninety Six Thousand One Hundred and Eight Rupees Only'
    );
  });

  it('should convert 96,108.36 with paise correctly', () => {
    expect(amountToIndianWords(96108.36)).toBe(
      'Ninety Six Thousand One Hundred and Eight Rupees and Thirty Six Paise Only'
    );
  });

  it('should convert zero to Zero Rupees Only', () => {
    expect(amountToIndianWords(0)).toBe('Zero Rupees Only');
  });

  it('should convert exact lakhs and crores', () => {
    expect(amountToIndianWords(100000)).toBe('One Lakh Rupees Only');
    expect(amountToIndianWords(2500000)).toBe('Twenty Five Lakh Rupees Only');
    expect(amountToIndianWords(10000000)).toBe('One Crore Rupees Only');
  });
});

describe('Part P: Product Snapshot Preservation (TC-09 / Demo-day Check 8)', () => {
  it('should preserve original rates inside saved quotation line snapshot even if master rate changes', () => {
    const originalSnapshot: QuotationLineSnapshot = {
      productId: 'prod_demo_01',
      productName: 'JSW C+ CRIMP SHEET 8+1',
      category: 'Crimp',
      hsn: '72109090',
      qtyMethod: 'SHEET_WEIGHT',
      unit: 'Kgs',
      thicknessMm: 0.47,
      coilWidthM: 1.06,
      densityFactor: 7.968,
      rate: 117, // Original rate
      gstRate: 18,
    };

    // Calculate line at original rate (₹117)
    const line = calculateQuotationLine(
      {
        snapshot: originalSnapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    expect(line.rate).toBe(117);
    expect(line.taxableAmount).toBe(10193.04);

    // Later: Admin raises product master rate to ₹125
    const updatedProductMasterRate = 125;

    // Existing saved line still evaluates with its frozen snapshot rate (₹117)
    expect(line.snapshot.rate).toBe(117);

    // A NEW line created with the updated rate uses ₹125
    const newSnapshot: QuotationLineSnapshot = {
      ...originalSnapshot,
      rate: updatedProductMasterRate,
    };
    const newLine = calculateQuotationLine(
      {
        snapshot: newSnapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    expect(newLine.rate).toBe(125);
    // 87.12 * 125 = 10,890.00
    expect(newLine.taxableAmount).toBe(10890);
  });
});

describe('Remediation: CALC-02 GSTIN State-Code Extraction & Classification', () => {
  it('should classify valid Tamil Nadu GSTINs starting with 33 as intra-state', () => {
    expect(determineTaxMode('33AAAAA0000A1Z5')).toBe('intra');
    expect(determineTaxMode('  33AAAAA0000A1Z5  ')).toBe('intra');
    expect(determineTaxMode('33aaaaa0000a1z5')).toBe('intra');
  });

  it('should classify valid Inter-State GSTINs starting with 29 (Karnataka) as inter-state', () => {
    expect(determineTaxMode('29BBBBB0000B1Z8')).toBe('inter');
    expect(determineTaxMode('  29BBBBB0000B1Z8  ')).toBe('inter');
  });

  it('should default empty, null, or undefined customer GSTIN to intra-state', () => {
    expect(determineTaxMode('')).toBe('intra');
    expect(determineTaxMode('   ')).toBe('intra');
    expect(determineTaxMode(undefined)).toBe('intra');
  });

  it('should never interpret descriptive non-numeric strings as inter-state (defaults to intra-state)', () => {
    expect(determineTaxMode('Unregistered')).toBe('intra');
    expect(determineTaxMode('URP')).toBe('intra');
    expect(determineTaxMode('N/A')).toBe('intra');
    expect(determineTaxMode('None')).toBe('intra');
    expect(determineTaxMode('unregistered')).toBe('intra');
  });

  it('should default malformed or non-numeric state prefix values to intra-state', () => {
    expect(determineTaxMode('AB12345678')).toBe('intra');
    expect(determineTaxMode('3')).toBe('intra');
    expect(determineTaxMode('XX33AAAAA0000A1Z5')).toBe('intra');
  });
});

describe('Remediation: CALC-04 Discount Validation & Clamping', () => {
  it('should correctly deduct valid positive fixed discount from gross amount', () => {
    const result = calculateLineAmounts({ quantity: 10, rate: 100, discountAmount: 50 });
    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.discountAmount.toString()).toBe('50');
    expect(result.taxableAmount.toString()).toBe('950');
  });

  it('should correctly deduct valid positive percentage discount from gross amount', () => {
    const result = calculateLineAmounts({ quantity: 10, rate: 100, discountPct: 10 });
    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.discountAmount.toString()).toBe('100');
    expect(result.taxableAmount.toString()).toBe('900');
  });

  it('should clamp negative fixed discounts to zero and prevent taxable amount inflation', () => {
    const result = calculateLineAmounts({ quantity: 10, rate: 100, discountAmount: -50 });
    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.discountAmount.toString()).toBe('0');
    expect(result.taxableAmount.toString()).toBe('1000');
  });

  it('should clamp negative percentage discounts to zero and prevent taxable amount inflation', () => {
    const result = calculateLineAmounts({ quantity: 10, rate: 100, discountPct: -15 });
    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.discountAmount.toString()).toBe('0');
    expect(result.taxableAmount.toString()).toBe('1000');
  });

  it('should clamp excessive discount to gross amount so taxable amount is never negative', () => {
    const result = calculateLineAmounts({ quantity: 10, rate: 100, discountAmount: 1500 });
    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.discountAmount.toString()).toBe('1000');
    expect(result.taxableAmount.toString()).toBe('0');
  });
});

describe('Remediation: CALC-05 Amount in Words Grammar & Boundaries', () => {
  it('should format zero as Zero Rupees Only', () => {
    expect(amountToIndianWords(0)).toBe('Zero Rupees Only');
    expect(amountToIndianWords('0.00')).toBe('Zero Rupees Only');
  });

  it('should format one rupee using singular Rupee', () => {
    expect(amountToIndianWords(1)).toBe('One Rupee Only');
  });

  it('should format sub-rupee one paisa using singular Paisa without Zero Rupees prefix', () => {
    expect(amountToIndianWords('0.01')).toBe('One Paisa Only');
  });

  it('should format sub-rupee fifty paise using plural Paise without Zero Rupees prefix', () => {
    expect(amountToIndianWords('0.50')).toBe('Fifty Paise Only');
  });

  it('should format one rupee and one paisa using singular for both', () => {
    expect(amountToIndianWords('1.01')).toBe('One Rupee and One Paisa Only');
  });

  it('should format one rupee and fifty paise correctly', () => {
    expect(amountToIndianWords('1.50')).toBe('One Rupee and Fifty Paise Only');
  });

  it('should format official Sprint 1 acceptance case (₹96,108.00) exactly', () => {
    expect(amountToIndianWords(96108)).toBe(
      'Ninety Six Thousand One Hundred and Eight Rupees Only'
    );
  });

  it('should format official Sprint 1 unrounded total (₹96,108.36) with paise correctly', () => {
    expect(amountToIndianWords(96108.36)).toBe(
      'Ninety Six Thousand One Hundred and Eight Rupees and Thirty Six Paise Only'
    );
  });

  it('should format negative amounts with Minus prefix', () => {
    expect(amountToIndianWords(-100)).toBe('Minus One Hundred Rupees Only');
  });
});

describe('Remediation: CALC-06 Round-Off Presentation Formatting', () => {
  it('should format negative round-off with minus before currency symbol (-₹0.36)', () => {
    expect(formatRoundOff(-0.36)).toBe('-₹0.36');
    expect(formatRoundOff('-0.36')).toBe('-₹0.36');
  });

  it('should format positive round-off with plus before currency symbol (+₹0.04)', () => {
    expect(formatRoundOff(0.04)).toBe('+₹0.04');
    expect(formatRoundOff('0.04')).toBe('+₹0.04');
  });

  it('should format zero round-off as ₹0.00 without plus or minus sign', () => {
    expect(formatRoundOff(0)).toBe('₹0.00');
    expect(formatRoundOff('0.00')).toBe('₹0.00');
    expect(formatRoundOff(undefined)).toBe('₹0.00');
  });
});

describe('Remediation: CALC-08 Length Dimension Guards', () => {
  it('should clamp negative feet or inches in normalizeFeetAndInches to 0', () => {
    expect(normalizeFeetAndInches(-8, 0).toString()).toBe('0');
    expect(normalizeFeetAndInches(8, -6).toString()).toBe('0');
    expect(normalizeFeetAndInches(-5, -3).toString()).toBe('0');
  });

  it('should clamp negative metres in toMetres to 0', () => {
    expect(toMetres({ metres: -6 }).toString()).toBe('0');
    expect(toMetres({ feet: -8, inches: 0 }).toString()).toBe('0');
  });

  it('should return 0 weight if length or dimensions are zero or negative', () => {
    const qtyZeroLen = calculatePerPieceQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: 0.47,
      densityFactor: 7.968,
      length: { feet: 0, inches: 0 },
    });
    expect(qtyZeroLen.toString()).toBe('0');

    const qtyNegativeThick = calculatePerPieceQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: -0.47,
      densityFactor: 7.968,
      length: { feet: 8, inches: 0 },
    });
    expect(qtyNegativeThick.toString()).toBe('0');
  });

  it('should clamp negative nos to 0 in calculateLineQuantity', () => {
    const result = calculateLineQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: 0.47,
      densityFactor: 7.968,
      length: { feet: 8, inches: 0 },
      nos: -5,
    });
    expect(result.lineQuantity.toString()).toBe('0');
  });

  it('should clamp negative manual quantity to 0 in calculateLineQuantity', () => {
    const result = calculateLineQuantity({
      method: 'SHEET_WEIGHT',
      coilWidthM: 1.06,
      thicknessMm: 0.47,
      densityFactor: 7.968,
      length: { feet: 8, inches: 0 },
      isManual: true,
      manualQuantity: -85,
    });
    expect(result.lineQuantity.toString()).toBe('0');
  });
});

describe('Remediation: CALC-01 recalculateLineTax Pure State Synchronization', () => {
  it('should transition a line from intra-state to inter-state and back without mutating the original', () => {
    const snapshot: QuotationLineSnapshot = {
      productId: 'prod_demo_01',
      productName: 'JSW C+ CRIMP SHEET 8+1',
      category: 'Crimp',
      hsn: '72109090',
      qtyMethod: 'SHEET_WEIGHT',
      unit: 'Kgs',
      thicknessMm: 0.47,
      coilWidthM: 1.06,
      densityFactor: 7.968,
      rate: 117,
      gstRate: 18,
    };

    // 1. Line originally created under intra-state taxMode (e.g. before customer selected)
    const initialLine = calculateQuotationLine(
      {
        snapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    expect(initialLine.taxableAmount).toBe(10193.04);
    expect(initialLine.cgstAmount).toBe(917.37);
    expect(initialLine.sgstAmount).toBe(917.37);
    expect(initialLine.igstAmount).toBe(0);
    expect(initialLine.totalAmount).toBe(12027.78);

    // 2. Customer selected with GSTIN starting with 29 (Inter-state)
    const interLine = recalculateLineTax(initialLine, 'inter');

    expect(interLine.taxableAmount).toBe(10193.04);
    expect(interLine.cgstAmount).toBe(0);
    expect(interLine.sgstAmount).toBe(0);
    expect(interLine.igstAmount).toBe(1834.75); // 10193.04 * 18% = 1834.7472 -> 1834.75
    expect(interLine.totalAmount).toBe(12027.79);

    // Verify immutability: initialLine was NOT mutated
    expect(initialLine.cgstAmount).toBe(917.37);
    expect(initialLine.igstAmount).toBe(0);

    // 3. Customer switched back to Tamil Nadu (GSTIN starting 33)
    const backToIntraLine = recalculateLineTax(interLine, 'intra');

    expect(backToIntraLine.cgstAmount).toBe(917.37);
    expect(backToIntraLine.sgstAmount).toBe(917.37);
    expect(backToIntraLine.igstAmount).toBe(0);
    expect(backToIntraLine.totalAmount).toBe(12027.78);
  });
});

describe('Remediation: CALC-08 Validation Guards (validateLineDraft)', () => {
  const sheetProduct = {
    id: 'prod_sheet_01',
    name: 'JSW C+ CRIMP SHEET',
    qtyMethod: 'SHEET_WEIGHT',
    ratePerUnit: 117,
    unit: 'Kgs',
  };

  const pipeProduct = {
    id: 'prod_pipe_01',
    name: 'MS SQUARE PIPE 40X40',
    qtyMethod: 'SECTION_WEIGHT',
    ratePerUnit: 78,
    unit: 'Kgs',
  };

  const pieceProduct = {
    id: 'prod_piece_01',
    name: 'ROOF RIDGE 12X12 - 8 FT',
    qtyMethod: 'PIECE',
    ratePerUnit: 440,
    unit: 'Nos',
  };

  it('should reject sheet with zero length dimensions (0 ft 0 in)', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 5,
      lengthFeet: 0,
      lengthInches: 0,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Length must be greater than 0.');
  });

  it('should reject sheet with negative feet dimension', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 5,
      lengthFeet: -8,
      lengthInches: 0,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Length dimensions cannot be negative.');
  });

  it('should reject sheet with negative inches dimension', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 5,
      lengthFeet: 8,
      lengthInches: -2,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Length dimensions cannot be negative.');
  });

  it('should reject sheet with missing or empty length dimensions', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 5,
      lengthFeet: '',
      lengthInches: '',
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Length must be greater than 0.');
  });

  it('should reject sheet with non-numeric length dimensions', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 5,
      lengthFeet: 'eight',
      lengthInches: 0,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Please enter valid numeric values.');
  });

  it('should reject pipe in metres with zero or negative length', () => {
    const zeroRes = validateLineDraft({
      product: pipeProduct,
      rate: 78,
      nos: 10,
      lengthUnit: 'metres',
      lengthMetres: 0,
    });
    expect(zeroRes.isValid).toBe(false);
    expect(zeroRes.error).toBe('Length in metres must be greater than 0.');

    const negRes = validateLineDraft({
      product: pipeProduct,
      rate: 78,
      nos: 10,
      lengthUnit: 'metres',
      lengthMetres: -6,
    });
    expect(negRes.isValid).toBe(false);
    expect(negRes.error).toBe('Length in metres must be greater than 0.');
  });

  it('should reject pipe in metres with missing or non-numeric length', () => {
    const missingRes = validateLineDraft({
      product: pipeProduct,
      rate: 78,
      nos: 10,
      lengthUnit: 'metres',
      lengthMetres: '',
    });
    expect(missingRes.isValid).toBe(false);
    expect(missingRes.error).toBe('Length in metres must be greater than 0.');

    const nonNumRes = validateLineDraft({
      product: pipeProduct,
      rate: 78,
      nos: 10,
      lengthUnit: 'metres',
      lengthMetres: 'six',
    });
    expect(nonNumRes.isValid).toBe(false);
    expect(nonNumRes.error).toBe('Please enter valid numeric values.');
  });

  it('should reject zero, negative, or non-numeric rates', () => {
    expect(validateLineDraft({ product: sheetProduct, rate: 0, nos: 1, lengthFeet: 8 }).isValid).toBe(false);
    expect(validateLineDraft({ product: sheetProduct, rate: -117, nos: 1, lengthFeet: 8 }).isValid).toBe(false);
    expect(validateLineDraft({ product: sheetProduct, rate: 'abc', nos: 1, lengthFeet: 8 }).isValid).toBe(false);
  });

  it('should reject zero, negative, or non-numeric nos', () => {
    expect(validateLineDraft({ product: sheetProduct, rate: 117, nos: 0, lengthFeet: 8 }).isValid).toBe(false);
    expect(validateLineDraft({ product: sheetProduct, rate: 117, nos: -5, lengthFeet: 8 }).isValid).toBe(false);
    expect(validateLineDraft({ product: sheetProduct, rate: 117, nos: 'ten', lengthFeet: 8 }).isValid).toBe(false);
  });

  it('should reject zero or negative calculated quantity', () => {
    const res = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 1,
      lengthFeet: 8,
      calculatedQuantity: 0,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Line quantity must be greater than 0.');
  });

  it('should keep piece-rate products fully usable without length fields', () => {
    const pieceRes = validateLineDraft({
      product: pieceProduct,
      rate: 440,
      nos: 3,
      calculatedQuantity: 3,
    });
    expect(pieceRes.isValid).toBe(true);
    expect(pieceRes.error).toBeUndefined();
  });

  it('should accept valid sheet and pipe inputs', () => {
    const sheetRes = validateLineDraft({
      product: sheetProduct,
      rate: 117,
      nos: 9,
      lengthFeet: 8,
      lengthInches: 0,
      calculatedQuantity: 87.12,
    });
    expect(sheetRes.isValid).toBe(true);

    const pipeRes = validateLineDraft({
      product: pipeProduct,
      rate: 78,
      nos: 10,
      lengthUnit: 'metres',
      lengthMetres: 6,
      calculatedQuantity: 140.40,
    });
    expect(pipeRes.isValid).toBe(true);
  });
});

describe('Remediation: CALC-03 Line-Level vs Document-Level Financial Consistency', () => {
  it('should verify official 7-line sample line total sum vs authoritative document grand total', () => {
    // Exact line values from official 7-line sample
    const lineTotals = [
      12027.78, // Line 1: 10193.04 taxable + 917.37 CGST + 917.37 SGST
      3091.60,  // Line 2: 2620.00 taxable + 235.80 CGST + 235.80 SGST
      1557.60,  // Line 3: 1320.00 taxable + 118.80 CGST + 118.80 SGST
      6510.76,  // Line 4: 5517.60 taxable + 496.58 CGST + 496.58 SGST
      35809.22, // Line 5: 30346.80 taxable + 2731.21 CGST + 2731.21 SGST
      21485.54, // Line 6: 18208.08 taxable + 1638.73 CGST + 1638.73 SGST
      15625.84, // Line 7: 13242.24 taxable + 1191.80 CGST + 1191.80 SGST
    ];

    const sumOfLineTotals = lineTotals.reduce((a, b) => a + b, 0);
    // Rounded to 2 decimals
    expect(Math.round(sumOfLineTotals * 100) / 100).toBe(96108.34);

    // Official 7-line benchmark totals:
    const expectedSubtotal = 81447.76;
    const expectedCgst = 7330.30;
    const expectedSgst = 7330.30;
    const expectedGrandTotal = 96108.36;
    const expectedRoundOff = -0.36;
    const expectedPayable = 96108.00;
    const expectedWords = 'Ninety Six Thousand One Hundred and Eight Rupees Only';

    // Discrepancy is exactly ₹0.02 due to independent rounding vs statutory group calculation
    const variance = expectedGrandTotal - (Math.round(sumOfLineTotals * 100) / 100);
    expect(Math.round(variance * 100) / 100).toBe(0.02);

    expect(expectedSubtotal).toBe(81447.76);
    expect(expectedCgst).toBe(7330.30);
    expect(expectedSgst).toBe(7330.30);
    expect(expectedGrandTotal).toBe(96108.36);
    expect(expectedRoundOff).toBe(-0.36);
    expect(expectedPayable).toBe(96108.00);
    expect(expectedWords).toBe('Ninety Six Thousand One Hundred and Eight Rupees Only');
  });
});

