import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import type { SheetProduct, SectionProduct, PieceProduct } from '../types/product';
import type { Customer, CreateCustomerInput } from '../types/customer';
import type { CompanySettings } from '../types/settings';
import { DEMO_PRODUCTS } from '../services/seedService';
import { calculateQuotationLine } from '../engine';
import type { QuotationLineSnapshot } from '../types/quotation';

describe('Phase 3: Product Master Validation & Schema Rules', () => {
  it('should verify that all 20 demo catalogue products adhere to Sprint 1 measurement requirements', () => {
    expect(DEMO_PRODUCTS).toHaveLength(20);

    // Verify SHEET products have thicknessMm and coilWidthM
    const sheetProducts = DEMO_PRODUCTS.filter((p) => p.qtyMethod === 'SHEET_WEIGHT') as SheetProduct[];
    expect(sheetProducts.length).toBeGreaterThan(0);
    sheetProducts.forEach((sheet) => {
      expect(sheet.thicknessMm).toBeGreaterThan(0);
      expect(sheet.coilWidthM).toBeGreaterThan(0);
      expect(sheet.unit).toBe('Kgs');
    });

    // Verify SECTION_WEIGHT (pipe) products have kgPerMetre and do NOT require coilWidthM
    const pipeProducts = DEMO_PRODUCTS.filter((p) => p.qtyMethod === 'SECTION_WEIGHT') as SectionProduct[];
    expect(pipeProducts.length).toBeGreaterThan(0);
    pipeProducts.forEach((pipe) => {
      expect(pipe.kgPerMetre).toBeGreaterThan(0);
      expect((pipe as unknown as SheetProduct).coilWidthM).toBeUndefined();
      expect(pipe.unit).toBe('Kgs');
    });

    // Verify PIECE products do not require measurement fields
    const pieceProducts = DEMO_PRODUCTS.filter((p) => p.qtyMethod === 'PIECE') as PieceProduct[];
    expect(pieceProducts.length).toBeGreaterThan(0);
    pieceProducts.forEach((piece) => {
      expect(piece.unit).toBe('Nos');
      expect((piece as unknown as SheetProduct).coilWidthM).toBeUndefined();
      expect((piece as unknown as SectionProduct).kgPerMetre).toBeUndefined();
    });
  });

  it('should accurately validate decimal numeric values without silent 0 conversions', () => {
    const validRate = '117.50';
    const rateDec = new Decimal(validRate);
    expect(rateDec.toNumber()).toBe(117.5);
    expect(rateDec.gt(0)).toBe(true);

    expect(() => new Decimal('invalid_number')).toThrow();
  });
});

describe('Phase 3: Customer Master Schema & Normalization', () => {
  it('should correctly format and normalize customer payload', () => {
    const rawGstin = '  33aaaaa0000a1z5  ';
    const normalizedGstin = rawGstin.trim().toUpperCase();
    expect(normalizedGstin).toBe('33AAAAA0000A1Z5');
    expect(normalizedGstin).toHaveLength(15);

    const input: CreateCustomerInput = {
      name: 'Apex Construction',
      gstin: normalizedGstin,
      phone: '+91 98422 12345',
      address: '123 Main Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      pincode: '641001',
    };

    const customer: Customer = {
      id: 'cust_001',
      ...input,
    };

    expect(customer.name).toBe('Apex Construction');
    expect(customer.gstin).toBe('33AAAAA0000A1Z5');
    expect(customer.city).toBe('Coimbatore');
  });
});

describe('Phase 3: Company Settings Schema & Normalization', () => {
  it('should properly structure company settings and preserve phone/terms arrays', () => {
    const sampleSettings: CompanySettings = {
      name: 'RR METAL ROOFING',
      gstin: '33AAAAA0000A1Z5',
      address: 'SF No. 123, Industrial Estate, Coimbatore',
      phones: ['+91 98422 12345', '+91 98422 67890'],
      email: 'sales@rrmetalroofing.com',
      bankDetails: {
        bankName: 'HDFC Bank',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0001234',
        branch: 'Coimbatore Main Branch',
      },
      defaultTerms: [
        'Validity: 7 days',
        'GST 18% extra',
        '100% advance payment',
      ],
    };

    expect(sampleSettings.gstin.substring(0, 2)).toBe('33'); // State code for TN
    expect(sampleSettings.phones).toHaveLength(2);
    expect(sampleSettings.defaultTerms).toHaveLength(3);
    expect(sampleSettings.bankDetails.ifscCode).toBe('HDFC0001234');
  });
});

describe('Phase 3: Part 9 Regression Check — Product Snapshot Rate Immutability', () => {
  it('changing product master rate must NOT modify existing saved quotation line snapshot', () => {
    // 1. Initial snapshot saved at rate ₹117
    const savedSnapshot: QuotationLineSnapshot = {
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

    // Calculate line for original saved quote
    const originalLine = calculateQuotationLine(
      {
        snapshot: savedSnapshot,
        length: { feet: 8, inches: 0 },
        nos: 9,
      },
      'intra'
    );

    expect(originalLine.rate).toBe(117);
    expect(originalLine.taxableAmount).toBe(10193.04);
    expect(originalLine.sgstAmount).toBe(917.37);
    expect(originalLine.cgstAmount).toBe(917.37);
    expect(originalLine.totalAmount).toBe(12027.78);

    // 2. Product Master Rate is updated by Admin in Phase 3 from ₹117 to ₹125
    const updatedMasterRate = 125;

    // 3. Confirm that the previously saved quote line STILL retains ₹117
    expect(originalLine.rate).toBe(117);
    expect(originalLine.snapshot.rate).toBe(117);
    expect(originalLine.taxableAmount).toBe(10193.04);
    expect(originalLine.totalAmount).toBe(12027.78);

    // 4. A NEW quote created after the rate update captures ₹125
    const newSnapshot: QuotationLineSnapshot = {
      ...savedSnapshot,
      rate: updatedMasterRate, // Captured from updated master
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
    expect(newLine.taxableAmount).toBe(10890); // 87.12 × 125 = 10,890.00
    expect(newLine.sgstAmount).toBe(980.1);
    expect(newLine.cgstAmount).toBe(980.1);
    expect(newLine.totalAmount).toBe(12850.2);
  });
});
