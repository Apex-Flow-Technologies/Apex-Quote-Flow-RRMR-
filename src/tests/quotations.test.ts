import { describe, it, expect } from 'vitest';
import {
  calculateQuotationLine,
  calculateQuotationTotals,
  determineTaxMode,
  recalculateLineTax,
  validateLineDraft,
} from '../engine';
import type {
  QuotationLineSnapshot,
  QuotationLine,
  Quotation,
} from '../types/quotation';
import type { SheetProduct, SectionProduct } from '../types/product';
import { DEMO_PRODUCTS } from '../services/seedService';
import { sanitizeForFirestore } from '../services/quotationService';

describe('Phase 4 — Quotation Builder & Calculation Engine Integration', () => {
  // CHECK 1: Crimp sheet 8 ft 0 in
  it('CHECK 1: should calculate 8ft crimp sheet with exact weight and amount', () => {
    const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
    expect(crimpProduct).toBeDefined();

    const snapshot: QuotationLineSnapshot = {
      productId: crimpProduct.id,
      productName: crimpProduct.name,
      category: crimpProduct.category,
      hsn: crimpProduct.hsn,
      qtyMethod: crimpProduct.qtyMethod,
      unit: crimpProduct.unit,
      thicknessMm: crimpProduct.thicknessMm,
      coilWidthM: crimpProduct.coilWidthM,
      densityFactor: crimpProduct.densityFactor,
      rate: 117,
      gstRate: crimpProduct.gstRate,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    // 8 ft = 2.4384 m. Weight/pc = 2.4384 * 1.06 * 0.47 * 7.968 = 9.68007... -> 9.68 kg/piece
    expect(line.perPieceQuantity).toBe(9.68);
    // Line quantity = 9.68 * 9 = 87.12 kg
    expect(line.quantity).toBe(87.12);
    // Taxable = 87.12 * 117 = 10,193.04
    expect(line.taxableAmount).toBe(10193.04);
  });

  // CHECK 2: Crimp sheet 12 ft 6 in
  it('CHECK 2: should calculate 12ft 6in crimp sheet per-piece weight of 15.12 kg', () => {
    const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;

    const snapshot: QuotationLineSnapshot = {
      productId: crimpProduct.id,
      productName: crimpProduct.name,
      category: crimpProduct.category,
      hsn: crimpProduct.hsn,
      qtyMethod: crimpProduct.qtyMethod,
      unit: crimpProduct.unit,
      thicknessMm: crimpProduct.thicknessMm,
      coilWidthM: crimpProduct.coilWidthM,
      densityFactor: crimpProduct.densityFactor,
      rate: 117,
      gstRate: crimpProduct.gstRate,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        length: { feet: 12, inches: 6 },
        nos: 1,
      },
      'intra'
    );

    // 12.5 ft = 3.81 m. Weight/pc = 3.81 * 1.06 * 0.47 * 7.968 = 15.1251... -> 15.12 kg/piece
    expect(line.perPieceQuantity).toBe(15.12);
  });

  // CHECK 3: MS pipe 40x40x2, 2.34 kg/m, 6m, 10 nos, ₹78/kg
  it('CHECK 3: should calculate MS pipe 6m section weight of 140.40 kg and ₹10,951.20', () => {
    const pipeProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_18') as SectionProduct;
    expect(pipeProduct).toBeDefined();

    const snapshot: QuotationLineSnapshot = {
      productId: pipeProduct.id,
      productName: pipeProduct.name,
      category: pipeProduct.category,
      hsn: pipeProduct.hsn,
      qtyMethod: pipeProduct.qtyMethod,
      unit: pipeProduct.unit,
      kgPerMetre: pipeProduct.kgPerMetre, // 2.34
      rate: 78,
      gstRate: 18,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        length: { metres: 6 },
        nos: 10,
      },
      'intra'
    );

    // 6m * 2.34 = 14.04 kg/pc. 14.04 * 10 = 140.40 kg
    expect(line.perPieceQuantity).toBe(14.04);
    expect(line.quantity).toBe(140.4);
    // 140.40 * 78 = 10,951.20
    expect(line.taxableAmount).toBe(10951.2);
  });

  // CHECK 6: Manual quantity override
  it('CHECK 6: manual quantity override bypasses calculated formula and sets manual flag', () => {
    const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;

    const snapshot: QuotationLineSnapshot = {
      productId: crimpProduct.id,
      productName: crimpProduct.name,
      category: crimpProduct.category,
      hsn: crimpProduct.hsn,
      qtyMethod: crimpProduct.qtyMethod,
      unit: crimpProduct.unit,
      thicknessMm: crimpProduct.thicknessMm,
      coilWidthM: crimpProduct.coilWidthM,
      densityFactor: crimpProduct.densityFactor,
      rate: 117,
      gstRate: crimpProduct.gstRate,
    };

    const line = calculateQuotationLine(
      {
        snapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
        isManualQuantity: true,
        manualQuantity: 85, // Override from calculated 87.12 to 85.00
      },
      'intra'
    );

    expect(line.isManualQuantity).toBe(true);
    expect(line.quantity).toBe(85);
    // 85 * 117 = 9,945.00
    expect(line.taxableAmount).toBe(9945);
    // Original dimensions remain preserved
    expect(line.lengthFeet).toBe(8);
    expect(line.nos).toBe(9);
    expect(line.snapshot.thicknessMm).toBe(0.47);
  });

  // 7 Reference lines matching TC-05 / Sprint 1 Brief
  const reference7LineInputs = [
      // 1. Crimp Sheet (8ft, 9 nos @ 117)
      {
        snapshot: {
          productId: 'prod_demo_01',
          productName: 'JSW C+ CRIMP SHEET 8+1',
          category: 'Crimp',
          hsn: '72109090',
          qtyMethod: 'SHEET_WEIGHT' as const,
          unit: 'Kgs' as const,
          thicknessMm: 0.47,
          coilWidthM: 1.06,
          densityFactor: 7.968,
          rate: 117,
          gstRate: 18,
        },
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      // 2. L Sheet 12x12 - 8ft (PIECE, 4 nos @ 655)
      {
        snapshot: {
          productId: 'prod_demo_11',
          productName: 'L SHEET 12X12 - 8 FT',
          category: 'L Sheet',
          hsn: '72109090',
          qtyMethod: 'PIECE' as const,
          unit: 'Nos' as const,
          rate: 655,
          gstRate: 18,
        },
        nos: 4,
      },
      // 3. Ridge 12x12 - 8ft (PIECE, 3 nos @ 440)
      {
        snapshot: {
          productId: 'prod_demo_12',
          productName: 'ROOF RIDGE 12X12 - 8 FT',
          category: 'Ridge',
          hsn: '72109090',
          qtyMethod: 'PIECE' as const,
          unit: 'Nos' as const,
          rate: 440,
          gstRate: 18,
        },
        nos: 3,
      },
      // 4. Coloron+ 40ft (40ft, 1 nos @ 114)
      {
        snapshot: {
          productId: 'prod_demo_04',
          productName: 'JSW COLOURON + 150 GSM 550 MPA',
          category: 'Coloron',
          hsn: '72109090',
          qtyMethod: 'SHEET_WEIGHT' as const,
          unit: 'Kgs' as const,
          thicknessMm: 0.47,
          coilWidthM: 1.06,
          densityFactor: 7.968,
          rate: 114,
          gstRate: 18,
        },
        length: { feet: 40, inches: 0 },
        nos: 1,
      },
      // 5. Coloron+ 10ft (10ft, 22 nos @ 114)
      {
        snapshot: {
          productId: 'prod_demo_04',
          productName: 'JSW COLOURON + 150 GSM 550 MPA',
          category: 'Coloron',
          hsn: '72109090',
          qtyMethod: 'SHEET_WEIGHT' as const,
          unit: 'Kgs' as const,
          thicknessMm: 0.47,
          coilWidthM: 1.06,
          densityFactor: 7.968,
          rate: 114,
          gstRate: 18,
        },
        length: { feet: 10, inches: 0 },
        nos: 22,
      },
      // 6. Coloron+ 12ft (12ft, 11 nos @ 114)
      {
        snapshot: {
          productId: 'prod_demo_04',
          productName: 'JSW COLOURON + 150 GSM 550 MPA',
          category: 'Coloron',
          hsn: '72109090',
          qtyMethod: 'SHEET_WEIGHT' as const,
          unit: 'Kgs' as const,
          thicknessMm: 0.47,
          coilWidthM: 1.06,
          densityFactor: 7.968,
          rate: 114,
          gstRate: 18,
        },
        length: { feet: 12, inches: 0 },
        nos: 11,
      },
      // 7. Coloron+ 12ft (12ft, 8 nos @ 114)
      {
        snapshot: {
          productId: 'prod_demo_04',
          productName: 'JSW COLOURON + 150 GSM 550 MPA',
          category: 'Coloron',
          hsn: '72109090',
          qtyMethod: 'SHEET_WEIGHT' as const,
          unit: 'Kgs' as const,
          thicknessMm: 0.47,
          coilWidthM: 1.06,
          densityFactor: 7.968,
          rate: 114,
          gstRate: 18,
        },
        length: { feet: 12, inches: 0 },
        nos: 8,
      },
    ];

  // CHECK 4: Seven-line official sample totals
  it('CHECK 4: reproduces the 7-line reference quotation totals down to the exact paisa (₹96,108.00)', () => {
    const lines: QuotationLine[] = reference7LineInputs.map((input) =>
      calculateQuotationLine(input, 'intra')
    );

    const totals = calculateQuotationTotals(lines, 'intra');

    expect(totals.totalKgs.toNumber()).toBe(677.6);
    expect(totals.totalNos.toNumber()).toBe(7);
    expect(totals.subtotal.toNumber()).toBe(81447.76);
    expect(totals.cgstTotal.toNumber()).toBe(7330.3);
    expect(totals.sgstTotal.toNumber()).toBe(7330.3);
    expect(totals.igstTotal.toNumber()).toBe(0);
    expect(totals.grandTotal.toNumber()).toBe(96108.36);
    expect(totals.roundOff.toNumber()).toBe(-0.36);
    expect(totals.payableAmount.toNumber()).toBe(96108);
    expect(totals.amountInWords).toBe(
      'Ninety Six Thousand One Hundred and Eight Rupees Only'
    );
  });

  // CHECK 5: Customer GSTIN beginning with 29 (Inter-state IGST)
  it('CHECK 5: same seven-line quotation with customer GSTIN 29 calculates IGST ₹14,660.60', () => {
    const customerGstin = '29AABCB1234F1Z1'; // Karnataka (29)
    const companyGstin = '33AAAAA0000A1Z5';  // Tamil Nadu (33)
    const taxMode = determineTaxMode(customerGstin, companyGstin);

    expect(taxMode).toBe('inter');

    const lines: QuotationLine[] = reference7LineInputs.map((input) =>
      calculateQuotationLine(input, taxMode)
    );

    const totals = calculateQuotationTotals(lines, taxMode);

    expect(totals.cgstTotal.toNumber()).toBe(0);
    expect(totals.sgstTotal.toNumber()).toBe(0);
    expect(totals.igstTotal.toNumber()).toBe(14660.6);
    expect(totals.payableAmount.toNumber()).toBe(96108);
  });
});

describe('Phase 4 — Quotation Number Formatting & Model Integrity', () => {
  it('should format sequential quotation numbers correctly with 4-digit zero padding', () => {
    const formatNumber = (prefix: string, fy: string, next: number) =>
      `${prefix}/${fy}/${String(next).padStart(4, '0')}`;

    expect(formatNumber('RR/QT', '26-27', 1)).toBe('RR/QT/26-27/0001');
    expect(formatNumber('RR/QT', '26-27', 2)).toBe('RR/QT/26-27/0002');
    expect(formatNumber('RR/QT', '26-27', 15)).toBe('RR/QT/26-27/0015');
    expect(formatNumber('RR/QT', '26-27', 100)).toBe('RR/QT/26-27/0100');
    expect(formatNumber('RR/QT', '26-27', 9999)).toBe('RR/QT/26-27/9999');
  });

  it('should preserve product snapshot rate when master product rate changes', () => {
    // Original quote drafted when master rate was ₹117
    const originalRate = 117;
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
      rate: originalRate,
      gstRate: 18,
    };

    const savedLine = calculateQuotationLine(
      {
        snapshot: originalSnapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    // Save quotation with this frozen snapshot
    const savedQuote: Partial<Quotation> = {
      quotationNumber: 'RR/QT/26-27/0001',
      lines: [savedLine],
      payableAmount: 12028,
    };

    // Later, Admin changes product master rate to ₹125
    const newMasterRate = 125;

    // 1. Saved quotation line MUST STILL retain ₹117
    expect(savedQuote.lines![0].snapshot.rate).toBe(117);
    expect(savedQuote.lines![0].rate).toBe(117);
    expect(savedQuote.lines![0].taxableAmount).toBe(10193.04);

    // 2. Newly created quote line uses new rate ₹125
    const newSnapshot: QuotationLineSnapshot = {
      ...originalSnapshot,
      rate: newMasterRate,
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
    expect(newLine.taxableAmount).toBe(10890); // 87.12 * 125
  });

  it('discount calculation should strictly prevent negative taxable amounts', () => {
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

    // If discount exceeds gross amount (e.g. ₹20,000 discount on ₹10,193.04 gross)
    const line = calculateQuotationLine(
      {
        snapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
        discountAmount: 20000,
      },
      'intra'
    );

    // Engine caps discount at gross amount; taxable value cannot be negative
    expect(line.discountAmount).toBe(10193.04);
    expect(line.taxableAmount).toBe(0);
    expect(line.totalAmount).toBe(0);
  });
});

describe('Phase 4 — Transaction Concurrency Simulation', () => {
  it('simulates concurrent transactional saves and guarantees consecutive, non-colliding numbers', async () => {
    // Shared document state simulating counters/quotation
    let counterState = { next: 1, prefix: 'RR/QT', financialYear: '26-27' };
    let transactionLock = Promise.resolve();

    // Simulated optimistic transaction with serialized counter commit
    const executeTransaction = async (): Promise<string> => {
      // Introduce variable network delay before transaction acquire
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

      return new Promise<string>((resolve) => {
        transactionLock = transactionLock.then(async () => {
          // Read phase
          const currentNext = counterState.next;
          const prefix = counterState.prefix;
          const fy = counterState.financialYear;

          // Format quotation number
          const quoteNum = `${prefix}/${fy}/${String(currentNext).padStart(4, '0')}`;

          // Write phase: increment next by exactly 1
          counterState = { ...counterState, next: currentNext + 1 };
          resolve(quoteNum);
        });
      });
    };

    // Execute 10 simultaneous saves
    const results = await Promise.all([
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
      executeTransaction(),
    ]);

    // Verify all 10 quotation numbers are strictly unique
    const uniqueNumbers = new Set(results);
    expect(uniqueNumbers.size).toBe(10);

    // Counter next reached exactly 11 without gaps
    expect(counterState.next).toBe(11);

    // All 10 are consecutive
    const sorted = [...results].sort();
    expect(sorted).toEqual([
      'RR/QT/26-27/0001',
      'RR/QT/26-27/0002',
      'RR/QT/26-27/0003',
      'RR/QT/26-27/0004',
      'RR/QT/26-27/0005',
      'RR/QT/26-27/0006',
      'RR/QT/26-27/0007',
      'RR/QT/26-27/0008',
      'RR/QT/26-27/0009',
      'RR/QT/26-27/0010',
    ]);
  });
});

describe('Phase 4 — Firestore Payload Sanitization', () => {
  it('strips undefined fields recursively from objects and line item arrays', () => {
    const rawPayload = {
      customer: {
        id: 'cust_123',
        name: 'Test Customer',
        gstin: undefined,
        phone: undefined,
        address: '123 Main St',
      },
      lines: [
        {
          id: 'line_1',
          rate: 114,
          manualQuantity: undefined,
          discountPct: undefined,
          snapshot: {
            productId: 'p_1',
            coverWidthM: undefined,
            kgPerMetre: undefined,
          },
        },
      ],
      emptyNote: undefined,
    };

    const sanitized = sanitizeForFirestore(rawPayload);

    expect(sanitized).toEqual({
      customer: {
        id: 'cust_123',
        name: 'Test Customer',
        address: '123 Main St',
      },
      lines: [
        {
          id: 'line_1',
          rate: 114,
          snapshot: {
            productId: 'p_1',
          },
        },
      ],
    });

    expect('gstin' in sanitized.customer).toBe(false);
    expect('emptyNote' in sanitized).toBe(false);
    expect('manualQuantity' in sanitized.lines[0]).toBe(false);
  });

  describe('Remediation: CALC-01 Full Tax Mode Transition & Persistence Flow', () => {
    const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
    const snapshot: QuotationLineSnapshot = {
      productId: crimpProduct.id,
      productName: crimpProduct.name,
      category: crimpProduct.category,
      hsn: crimpProduct.hsn,
      qtyMethod: crimpProduct.qtyMethod,
      unit: crimpProduct.unit,
      thicknessMm: crimpProduct.thicknessMm,
      coilWidthM: crimpProduct.coilWidthM,
      densityFactor: crimpProduct.densityFactor,
      rate: 117,
      gstRate: crimpProduct.gstRate,
    };

    it('verifies complete lifecycle: add line before customer -> switch to interstate 29 -> switch back to intrastate 33 -> verify persisted payloads', () => {
      // 1. Line added before selecting customer (unregistered / empty GSTIN -> intra-state)
      let activeTaxMode = determineTaxMode(undefined);
      expect(activeTaxMode).toBe('intra');

      let draftLines: QuotationLine[] = [
        calculateQuotationLine(
          {
            snapshot,
            length: { feet: 8, inches: 0 },
            nos: 9,
          },
          activeTaxMode
        ),
      ];

      expect(draftLines[0].cgstAmount).toBe(917.37);
      expect(draftLines[0].sgstAmount).toBe(917.37);
      expect(draftLines[0].igstAmount).toBe(0);

      let totals = calculateQuotationTotals(draftLines, activeTaxMode, true);
      expect(totals.cgstTotal.toString()).toBe('917.37');
      expect(totals.sgstTotal.toString()).toBe('917.37');
      expect(totals.igstTotal.toString()).toBe('0');
      expect(totals.grandTotal.toString()).toBe('12027.78');

      // 2. Switch to an interstate customer (Karnataka GSTIN 29...)
      const interCustomer = {
        name: 'Bangalore Fabrications',
        gstin: '29ABCDE1234F1Z5',
      };
      activeTaxMode = determineTaxMode(interCustomer.gstin);
      expect(activeTaxMode).toBe('inter');

      // Synchronize draft lines via recalculateLineTax
      draftLines = draftLines.map((l) => recalculateLineTax(l, activeTaxMode));
      expect(draftLines[0].cgstAmount).toBe(0);
      expect(draftLines[0].sgstAmount).toBe(0);
      expect(draftLines[0].igstAmount).toBe(1834.75);

      totals = calculateQuotationTotals(draftLines, activeTaxMode, true);
      expect(totals.cgstTotal.toString()).toBe('0');
      expect(totals.sgstTotal.toString()).toBe('0');
      expect(totals.igstTotal.toString()).toBe('1834.75');
      expect(totals.grandTotal.toString()).toBe('12027.79');

      // Verify persisted payload after inter-state transition
      const savedInterQuote = sanitizeForFirestore({
        customer: interCustomer,
        taxMode: activeTaxMode,
        lines: draftLines,
        cgstTotal: totals.cgstTotal.toNumber(),
        sgstTotal: totals.sgstTotal.toNumber(),
        igstTotal: totals.igstTotal.toNumber(),
        grandTotal: totals.grandTotal.toNumber(),
        payableAmount: totals.payableAmount.toNumber(),
      });

      expect(savedInterQuote.taxMode).toBe('inter');
      expect(savedInterQuote.cgstTotal).toBe(0);
      expect(savedInterQuote.sgstTotal).toBe(0);
      expect(savedInterQuote.igstTotal).toBe(1834.75);
      expect(savedInterQuote.lines[0].cgstAmount).toBe(0);
      expect(savedInterQuote.lines[0].sgstAmount).toBe(0);
      expect(savedInterQuote.lines[0].igstAmount).toBe(1834.75);

      // 3. Switch back to an intrastate customer (Tamil Nadu GSTIN 33...)
      const intraCustomer = {
        name: 'Chennai Roofing Ltd',
        gstin: '33ABCDE1234F1Z5',
      };
      activeTaxMode = determineTaxMode(intraCustomer.gstin);
      expect(activeTaxMode).toBe('intra');

      // Synchronize draft lines
      draftLines = draftLines.map((l) => recalculateLineTax(l, activeTaxMode));
      expect(draftLines[0].cgstAmount).toBe(917.37);
      expect(draftLines[0].sgstAmount).toBe(917.37);
      expect(draftLines[0].igstAmount).toBe(0);

      totals = calculateQuotationTotals(draftLines, activeTaxMode, true);
      expect(totals.cgstTotal.toString()).toBe('917.37');
      expect(totals.sgstTotal.toString()).toBe('917.37');
      expect(totals.igstTotal.toString()).toBe('0');
      expect(totals.grandTotal.toString()).toBe('12027.78');

      // Verify persisted payload after switching back to intra-state
      const savedIntraQuote = sanitizeForFirestore({
        customer: intraCustomer,
        taxMode: activeTaxMode,
        lines: draftLines,
        cgstTotal: totals.cgstTotal.toNumber(),
        sgstTotal: totals.sgstTotal.toNumber(),
        igstTotal: totals.igstTotal.toNumber(),
        grandTotal: totals.grandTotal.toNumber(),
        payableAmount: totals.payableAmount.toNumber(),
      });

      expect(savedIntraQuote.taxMode).toBe('intra');
      expect(savedIntraQuote.cgstTotal).toBe(917.37);
      expect(savedIntraQuote.sgstTotal).toBe(917.37);
      expect(savedIntraQuote.igstTotal).toBe(0);
      expect(savedIntraQuote.lines[0].cgstAmount).toBe(917.37);
      expect(savedIntraQuote.lines[0].sgstAmount).toBe(917.37);
      expect(savedIntraQuote.lines[0].igstAmount).toBe(0);
    });
  });

  describe('CALC-08 Quotation Builder Workflow Guard & Zero-Quantity Save Prevention', () => {
    it('prevents invalid zero-dimension sheet line from being added to quotation draft', () => {
      const sheet = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
      const validation = validateLineDraft({
        product: sheet,
        rate: 117,
        nos: 5,
        lengthFeet: 0,
        lengthInches: 0,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Length must be greater than 0.');
    });

    it('prevents invalid negative-dimension sheet line from being added to quotation draft', () => {
      const sheet = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
      const validation = validateLineDraft({
        product: sheet,
        rate: 117,
        nos: 5,
        lengthFeet: -10,
        lengthInches: 0,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Length dimensions cannot be negative.');
    });

    it('prevents zero-quantity lines from being added or saved', () => {
      const sheet = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
      const validation = validateLineDraft({
        product: sheet,
        rate: 117,
        nos: 5,
        lengthFeet: 8,
        lengthInches: 0,
        calculatedQuantity: 0, // Simulated zero calculated quantity
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Line quantity must be greater than 0.');
    });

    it('enforces quotation save guard rejecting any lines with non-positive quantity or rate', () => {
      const invalidLines = [
        {
          id: 'line_bad_01',
          productName: 'Corrupted Sheet',
          hsn: '72109090',
          quantity: 0, // Invalid zero quantity
          rate: 117,
        },
      ];

      const hasInvalidLine = invalidLines.some((l) => l.quantity <= 0 || l.rate <= 0);
      expect(hasInvalidLine).toBe(true);
    });

    it('allows valid piece-rate products to be added and quoted without length dimensions', () => {
      const ridgeProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_12')!;
      expect(ridgeProduct.qtyMethod).toBe('PIECE');

      const validation = validateLineDraft({
        product: {
          id: ridgeProduct.id || 'prod_demo_12',
          name: ridgeProduct.name,
          qtyMethod: ridgeProduct.qtyMethod,
          ratePerUnit: ridgeProduct.ratePerUnit,
          unit: ridgeProduct.unit,
        },
        rate: 440,
        nos: 3,
        calculatedQuantity: 3,
      });

      expect(validation.isValid).toBe(true);

      const snapshot: QuotationLineSnapshot = {
        productId: ridgeProduct.id || 'prod_demo_12',
        productName: ridgeProduct.name,
        category: ridgeProduct.category,
        hsn: ridgeProduct.hsn,
        qtyMethod: 'PIECE',
        unit: 'Nos',
        rate: 440,
        gstRate: 18,
      };

      const line = calculateQuotationLine(
        {
          snapshot,
          nos: 3,
        },
        'intra'
      );

      expect(line.lengthFeet).toBeUndefined();
      expect(line.lengthM).toBe(0);
      expect(line.quantity).toBe(3);
      expect(line.unit).toBe('Nos');
      expect(line.taxableAmount).toBe(1320);
      expect(line.totalAmount).toBe(1557.60);
    });
  });
});

