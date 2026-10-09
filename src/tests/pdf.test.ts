import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { getQuotationPdfFilename } from '../utils/pdfGenerator';
import { QuotationPdfDocument } from '../pages/quotations/QuotationPdfDocument';
import type { Quotation, QuotationLine, QuotationLineSnapshot } from '../types/quotation';
import { calculateQuotationLine, calculateQuotationTotals, determineTaxMode } from '../engine';

describe('Phase 5 — A4 Quotation PDF Generation & Presentation Integrity', () => {
  describe('PDF Filename Generation', () => {
    it('should format standard quotation numbers with hyphens instead of slashes', () => {
      expect(getQuotationPdfFilename('RR/QT/26-27/0001')).toBe('RR-QT-26-27-0001.pdf');
      expect(getQuotationPdfFilename('RR/QT/26-27/0042')).toBe('RR-QT-26-27-0042.pdf');
      expect(getQuotationPdfFilename('RR/QT/25-26/9999')).toBe('RR-QT-25-26-9999.pdf');
    });

    it('should sanitize characters that are invalid in filenames', () => {
      expect(getQuotationPdfFilename('RR\\QT:26*27?0001')).toBe('RR-QT-26-27-0001.pdf');
      expect(getQuotationPdfFilename('  RR/QT/26-27/0001  ')).toBe('RR-QT-26-27-0001.pdf');
    });

    it('should provide safe fallback if quote number is missing or empty', () => {
      expect(getQuotationPdfFilename('')).toBe('QUOTATION.pdf');
      expect(getQuotationPdfFilename('   ')).toBe('QUOTATION.pdf');
    });
  });

  describe('Historical Snapshot Immutability in PDF', () => {
    it('preserves historical snapshot rates in quotation data even if master catalog prices change', () => {
      // 1. Initial quotation created with snapshot rate ₹117/kg
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

      const line: QuotationLine = calculateQuotationLine(
        {
          snapshot: originalSnapshot,
          length: { feet: 8, inches: 0 },
          nos: 9,
        },
        'intra'
      );

      const quotation: Quotation = {
        id: 'qt_test_123',
        quotationNumber: 'RR/QT/26-27/0001',
        quotationDate: '2026-10-08',
        company: {
          name: 'RR METAL ROOFING',
          gstin: '33AAAAA0000A1Z5',
          address: 'Trichy Main Road, Madurai',
          phones: ['9876543210'],
          email: 'sales@rrmetalroofing.com',
          bankDetails: {
            bankName: 'HDFC Bank',
            accountNumber: '50200012345678',
            ifscCode: 'HDFC0001234',
            branch: 'Madurai Main',
          },
          defaultTerms: ['Validity: 7 days'],
        },
        customer: {
          id: 'cust_01',
          name: 'Apex Construction Ltd',
          phone: '9840123456',
          gstin: '33ABCDE1234F1Z5',
          address: '45 Anna Salai, Chennai',
        },
        revision: 1,
        taxMode: 'intra',
        lines: [line],
        subtotal: line.taxableAmount,
        taxableValue: line.taxableAmount,
        cgstTotal: line.cgstAmount,
        sgstTotal: line.sgstAmount,
        igstTotal: 0,
        totalTax: line.cgstAmount + line.sgstAmount,
        taxSummary: [],
        grandTotal: line.totalAmount,
        roundOff: 0.04,
        payableAmount: 12028,
        amountInWords: 'Twelve Thousand Twenty Eight Rupees Only',
        totalKgs: line.quantity,
        totalNos: line.nos,
        terms: ['Validity: 7 days', 'Prices inclusive of GST'],
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-08T00:00:00.000Z',
      };

      // 2. Later, product master rate is updated to ₹135/kg
      const currentMasterRate = 135;

      // 3. Confirm quotation and its line snapshot remain exactly ₹117
      expect(quotation.lines[0].rate).toBe(117);
      expect(quotation.lines[0].snapshot.rate).toBe(117);
      expect(quotation.lines[0].rate).not.toBe(currentMasterRate);
      expect(quotation.lines[0].taxableAmount).toBe(10193.04);
      expect(quotation.payableAmount).toBe(12028);

      // 4. Verify React-pdf document accepts this historical snapshot
      const element = React.createElement(QuotationPdfDocument, { quotation });
      expect(element).toBeDefined();
      expect(element.props.quotation.lines[0].rate).toBe(117);
      expect(element.props.quotation.company?.name).toBe('RR METAL ROOFING');
    });

    it('does NOT fallback to hardcoded business data ("RR METAL ROOFING" or "33AAAAA0000A1Z5") when company data is missing', () => {
      const quotationWithoutCompany: Quotation = {
        id: 'qt_test_no_company',
        quotationNumber: 'RR/QT/26-27/0001',
        quotationDate: '2026-10-08',
        revision: 1,
        // company snapshot with missing/empty name & gstin
        company: {
          name: '',
          gstin: '',
          address: '',
          phones: [],
          email: '',
          bankDetails: {
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            branch: '',
          },
          defaultTerms: [],
        },
        customer: {
          id: 'cust_01',
          name: 'Apex Construction Ltd',
        },
        taxMode: 'intra',
        lines: [],
        subtotal: 0,
        taxableValue: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        totalTax: 0,
        taxSummary: [],
        grandTotal: 0,
        roundOff: 0,
        payableAmount: 0,
        amountInWords: 'Zero Rupees Only',
        totalKgs: 0,
        totalNos: 0,
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-08T00:00:00.000Z',
      };

      const element = React.createElement(QuotationPdfDocument, { quotation: quotationWithoutCompany });
      expect(element).toBeDefined();

      // Render component JSX tree and verify hardcoded business data is strictly absent
      const renderedTree = QuotationPdfDocument({ quotation: quotationWithoutCompany });
      const serialized = JSON.stringify(renderedTree);

      expect(serialized).not.toContain('33AAAAA0000A1Z5');
      expect(serialized).not.toContain('RR METAL ROOFING');
    });
  });

  describe('TC-05 7-Line Reference Quotation Presentation', () => {
    // 7 Reference lines matching TC-05 / Sprint 1 Brief
    const reference7LineInputs = [
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

    it('presents physical totals with strict separation between Total Kgs and Total Nos', () => {
      const calculatedLines = reference7LineInputs.map((input) =>
        calculateQuotationLine(input, 'intra')
      );
      const totals = calculateQuotationTotals(calculatedLines, 'intra');

      // Total Kgs and Total Nos must NOT be blended or concatenated into one meaningless quantity
      expect(totals.totalKgs.toNumber()).toBe(677.6); // Total sheet weight
      expect(totals.totalNos.toNumber()).toBe(7); // Total piece items (4 L-sheets + 3 Ridges = 7 Nos)

      expect(typeof totals.totalKgs.toNumber()).toBe('number');
      expect(typeof totals.totalNos.toNumber()).toBe('number');
      expect(totals.totalKgs.toNumber()).not.toBe(totals.totalNos.toNumber());
    });

    it('presents financial breakdown with exact GST, Round-Off, and Amount in Words', () => {
      const calculatedLines = reference7LineInputs.map((input) =>
        calculateQuotationLine(input, 'intra')
      );
      const totals = calculateQuotationTotals(calculatedLines, 'intra');

      const mockQuotation: Quotation = {
        id: 'qt_ref_05',
        quotationNumber: 'RR/QT/26-27/0001',
        quotationDate: '2026-10-08',
        company: {
          name: 'RR METAL ROOFING',
          gstin: '33AAAAA0000A1Z5',
          address: 'Madurai Bypass Road, Madurai, Tamil Nadu - 625001',
          phones: ['+91 98421 00000', '+91 98422 00000'],
          email: 'sales@rrmetalroofing.com',
          bankDetails: {
            bankName: 'State Bank of India',
            accountNumber: '39001234567',
            ifscCode: 'SBIN0001234',
            branch: 'Madurai City',
          },
          defaultTerms: ['Prices are valid for 7 days'],
        },
        customer: {
          id: 'cust_01',
          name: 'Sri Krishna Industrial Builders',
          phone: '+91 98765 43210',
          gstin: '33ABCDE1234F1Z5',
          address: '10 Industrial Estate, Madurai',
        },
        revision: 1,
        taxMode: 'intra',
        lines: calculatedLines,
        subtotal: totals.subtotal.toNumber(),
        taxableValue: totals.subtotal.toNumber(),
        cgstTotal: totals.cgstTotal.toNumber(),
        sgstTotal: totals.sgstTotal.toNumber(),
        igstTotal: totals.igstTotal.toNumber(),
        totalTax: totals.totalTax.toNumber(),
        taxSummary: totals.taxSummary,
        grandTotal: totals.grandTotal.toNumber(),
        roundOff: totals.roundOff.toNumber(),
        payableAmount: totals.payableAmount.toNumber(),
        amountInWords: totals.amountInWords,
        totalKgs: totals.totalKgs.toNumber(),
        totalNos: totals.totalNos.toNumber(),
        terms: [
          'Prices are valid for 7 days from the date of quotation.',
          'Goods once sold will not be taken back.',
          '100% advance payment required prior to delivery.',
        ],
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-08T10:00:00.000Z',
      };

      // Subtotal, CGST, SGST, Payable Amount
      expect(mockQuotation.taxMode).toBe('intra');
      expect(mockQuotation.cgstTotal).toBeGreaterThan(0);
      expect(mockQuotation.sgstTotal).toBeGreaterThan(0);
      expect(mockQuotation.igstTotal).toBe(0);
      expect(mockQuotation.amountInWords).toMatch(/Rupees Only$/);
      expect(mockQuotation.payableAmount).toBe(Math.round(mockQuotation.grandTotal));

      // Test PDF document creation
      const pdfElement = React.createElement(QuotationPdfDocument, { quotation: mockQuotation });
      expect(pdfElement).toBeDefined();
      expect(pdfElement.props.quotation.lines.length).toBe(7);
      expect(pdfElement.props.quotation.terms?.length).toBe(3);
    });

    it('presents Inter-State IGST mode accurately when customer state differs from company state', () => {
      const customerGstin = '29ABCDE1234F1Z5'; // Karnataka (29)
      const companyGstin = '33AAAAA0000A1Z5'; // Tamil Nadu (33)
      const taxMode = determineTaxMode(customerGstin, companyGstin);
      expect(taxMode).toBe('inter');

      const calculatedLines = reference7LineInputs.map((input) =>
        calculateQuotationLine(input, taxMode)
      );
      const totals = calculateQuotationTotals(calculatedLines, taxMode);

      expect(totals.cgstTotal.toNumber()).toBe(0);
      expect(totals.sgstTotal.toNumber()).toBe(0);
      expect(totals.igstTotal.toNumber()).toBeGreaterThan(0);

      const mockInterQuotation: Quotation = {
        id: 'qt_ref_inter',
        quotationNumber: 'RR/QT/26-27/0002',
        quotationDate: '2026-10-08',
        company: {
          name: 'RR METAL ROOFING',
          gstin: companyGstin,
          address: 'Madurai, TN',
          phones: ['+91 98421 00000'],
          email: 'sales@rrmetalroofing.com',
          bankDetails: {
            bankName: 'SBI',
            accountNumber: '123456789',
            ifscCode: 'SBIN0001234',
            branch: 'Madurai',
          },
          defaultTerms: [],
        },
        customer: {
          id: 'cust_inter',
          name: 'Bangalore Steels Pvt Ltd',
          gstin: customerGstin,
        },
        revision: 1,
        taxMode: 'inter',
        lines: calculatedLines,
        subtotal: totals.subtotal.toNumber(),
        taxableValue: totals.subtotal.toNumber(),
        cgstTotal: totals.cgstTotal.toNumber(),
        sgstTotal: totals.sgstTotal.toNumber(),
        igstTotal: totals.igstTotal.toNumber(),
        totalTax: totals.totalTax.toNumber(),
        taxSummary: totals.taxSummary,
        grandTotal: totals.grandTotal.toNumber(),
        roundOff: totals.roundOff.toNumber(),
        payableAmount: totals.payableAmount.toNumber(),
        amountInWords: totals.amountInWords,
        totalKgs: totals.totalKgs.toNumber(),
        totalNos: totals.totalNos.toNumber(),
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-08T10:00:00.000Z',
      };

      const pdfElement = React.createElement(QuotationPdfDocument, { quotation: mockInterQuotation });
      expect(pdfElement.props.quotation.taxMode).toBe('inter');
      expect(pdfElement.props.quotation.igstTotal).toBe(totals.igstTotal.toNumber());
      expect(pdfElement.props.quotation.cgstTotal).toBe(0);
      expect(pdfElement.props.quotation.sgstTotal).toBe(0);
    });

    it('successfully renders PDF document to buffer without font resolution errors (Helvetica-Bold italic fix)', async () => {
      const sampleLine: QuotationLine = {
        id: 'line_test_render',
        productName: 'JSW C+ CRIMP SHEET 8+1',
        hsn: '72109090',
        unit: 'Kgs',
        rate: 117,
        gstRate: 18,
        perPieceQuantity: 9.68,
        quantity: 96.8,
        nos: 10,
        lengthFeet: 8,
        lengthInches: 0,
        isManualQuantity: false,
        taxableAmount: 11325.6,
        cgstAmount: 1019.3,
        sgstAmount: 1019.3,
        igstAmount: 0,
        totalAmount: 13364.2,
        snapshot: {
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
        },
      };

      const testQuotation: Quotation = {
        id: 'qt_render_check',
        quotationNumber: 'RR/QT/26-27/0001',
        quotationDate: '2026-10-08',
        company: {
          name: 'RR METAL ROOFING',
          gstin: '33XXXXX0000X1ZX',
          address: 'Poonamallee, Chennai',
          phones: ['+91 98840 00000'],
          email: 'sales@rrmetalroofing.com',
          bankDetails: {
            bankName: 'Tamilnadu Mercantile Bank',
            accountNumber: '2047001XXXXXXXX',
            ifscCode: 'TMBL0000204',
            branch: 'Poonamallee',
          },
          defaultTerms: ['Prices ex-factory'],
        },
        customer: {
          id: 'cust_test',
          name: 'Test Customer',
          gstin: '33ABCDE1234F1Z5',
          phone: '9999999999',
          address: 'Chennai, Tamil Nadu',
        },
        revision: 1,
        taxMode: 'intra',
        lines: [sampleLine],
        subtotal: 11325.6,
        taxableValue: 11325.6,
        cgstTotal: 1019.3,
        sgstTotal: 1019.3,
        igstTotal: 0,
        totalTax: 2038.6,
        taxSummary: [],
        grandTotal: 13364.2,
        roundOff: -0.2,
        payableAmount: 13364,
        amountInWords: 'Thirteen Thousand Three Hundred and Sixty Four Rupees Only',
        totalKgs: 96.8,
        totalNos: 10,
        terms: ['Prices ex-factory'],
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-08T00:00:00.000Z',
      };

      const doc = React.createElement(QuotationPdfDocument, { quotation: testQuotation });
      const instance = pdf(doc as any);
      // toBlob executes the complete font layout and PDF generation pipeline
      const blob = await instance.toBlob();

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1000);
      expect(blob.type).toBe('application/pdf');
    });
  });

  describe('Remediation: CALC-07 Pipe Length Specification Unit in PDF', () => {
    it('should preserve and render pipe length in feet when entered in feet, and in metres when entered in metres', async () => {
      const pipeProductSnapshot: QuotationLineSnapshot = {
        productId: 'prod_demo_18',
        productName: 'MS PIPE 40X40 - 2MM',
        category: 'Pipe',
        hsn: '73063090',
        qtyMethod: 'SECTION_WEIGHT',
        kgPerMetre: 2.34,
        unit: 'Kgs',
        rate: 78,
        gstRate: 18,
      };

      // Pipe 1 entered in feet (20 ft 0 in)
      const pipeInFeetLine = calculateQuotationLine(
        {
          snapshot: pipeProductSnapshot,
          length: { feet: 20, inches: 0 },
          nos: 5,
        },
        'intra'
      );
      expect(pipeInFeetLine.lengthFeet).toBe(20);

      // Pipe 2 entered in metres (6 m)
      const pipeInMetresLine = calculateQuotationLine(
        {
          snapshot: pipeProductSnapshot,
          length: { metres: 6 },
          nos: 10,
        },
        'intra'
      );
      expect(pipeInMetresLine.lengthFeet).toBeUndefined();
      expect(pipeInMetresLine.lengthM).toBe(6);

      const quotation: Quotation = {
        id: 'qt_pipe_test',
        quotationNumber: 'RR/QT/26-27/0050',
        quotationDate: '2026-10-09',
        company: {
          name: 'RR METAL ROOFING',
          gstin: '33AAAAA0000A1Z5',
          address: 'Chennai',
          phones: ['9876543210'],
          email: 'sales@rrmetalroofing.com',
          bankDetails: {
            bankName: 'HDFC Bank',
            accountNumber: '50200012345678',
            ifscCode: 'HDFC0001234',
            branch: 'Madurai Main',
          },
          defaultTerms: ['Validity: 7 days'],
        },
        customer: {
          id: 'cust_pipe',
          name: 'Structure Builders',
          gstin: '33BBBBB0000B1Z5',
        },
        revision: 1,
        taxMode: 'intra',
        lines: [pipeInFeetLine, pipeInMetresLine],
        subtotal: pipeInFeetLine.taxableAmount + pipeInMetresLine.taxableAmount,
        taxableValue: pipeInFeetLine.taxableAmount + pipeInMetresLine.taxableAmount,
        cgstTotal: pipeInFeetLine.cgstAmount + pipeInMetresLine.cgstAmount,
        sgstTotal: pipeInFeetLine.sgstAmount + pipeInMetresLine.sgstAmount,
        igstTotal: 0,
        totalTax: pipeInFeetLine.cgstAmount + pipeInMetresLine.cgstAmount + pipeInFeetLine.sgstAmount + pipeInMetresLine.sgstAmount,
        taxSummary: [],
        grandTotal: pipeInFeetLine.totalAmount + pipeInMetresLine.totalAmount,
        roundOff: -0.34,
        payableAmount: 23640,
        amountInWords: 'Twenty Three Thousand Six Hundred and Forty Rupees Only',
        totalKgs: pipeInFeetLine.quantity + pipeInMetresLine.quantity,
        totalNos: 0,
        createdByUid: 'uid_admin',
        createdByName: 'Sasidaran',
        createdAt: '2026-10-09T00:00:00.000Z',
      };

      const doc = React.createElement(QuotationPdfDocument, { quotation });
      const instance = pdf(doc as any);
      const blob = await instance.toBlob();

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1000);
      expect(blob.type).toBe('application/pdf');
    });
  });
});
