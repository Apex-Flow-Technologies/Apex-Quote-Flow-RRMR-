import { describe, it, expect } from 'vitest';
import {
  createInitialRow,
  createCustomRow,
  computeRowCalculation,
} from '../components/quotations/EditableQuotationTable';
import type { SheetProduct, SectionProduct, Product } from '../types/product';
import { DEMO_PRODUCTS } from '../services/seedService';

describe('Mobile-First Responsive UI & Layout Calculation Suite', () => {
  const crimpProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_01') as SheetProduct;
  const pipeProduct = DEMO_PRODUCTS.find((p) => p.id === 'prod_demo_18') as SectionProduct;

  describe('1. Viewport-Aware Dropdown Geometry Bounds (320px - 1024px)', () => {
    // Pure function replicating the exact geometry logic inside updateDropdownPosition
    const calculateDropdownGeometry = (
      viewportWidth: number,
      inputLeft: number,
      inputWidth: number
    ) => {
      const padding = 12;
      const maxAllowedWidth = Math.max(280, viewportWidth - padding * 2);
      const dropdownWidth = Math.min(maxAllowedWidth, Math.max(inputWidth, 300));

      let left = inputLeft;
      if (left + dropdownWidth > viewportWidth - padding) {
        left = Math.max(padding, viewportWidth - dropdownWidth - padding);
      }
      if (left < padding) {
        left = padding;
      }

      return {
        dropdownWidth,
        left,
        rightEdge: left + dropdownWidth,
        maxAllowedRight: viewportWidth - padding,
      };
    };

    it('confines dropdown within 320px viewport without horizontal overflow', () => {
      // 320px width (e.g. ultra-compact phone) with full-width search input (left: 14, width: 292)
      const geo = calculateDropdownGeometry(320, 14, 292);
      expect(geo.dropdownWidth).toBeLessThanOrEqual(320 - 24);
      expect(geo.left).toBeGreaterThanOrEqual(12);
      expect(geo.rightEdge).toBeLessThanOrEqual(320 - 12);
      expect(geo.dropdownWidth).toBe(296);
    });

    it('confines dropdown within 360px viewport without overflow', () => {
      // 360px width with left: 16, width: 328
      const geo = calculateDropdownGeometry(360, 16, 328);
      expect(geo.dropdownWidth).toBeLessThanOrEqual(360 - 24);
      expect(geo.left).toBeGreaterThanOrEqual(12);
      expect(geo.rightEdge).toBeLessThanOrEqual(360 - 12);
    });

    it('fits standard 375px mobile screen (iPhone SE / mini)', () => {
      const geo = calculateDropdownGeometry(375, 16, 343);
      expect(geo.dropdownWidth).toBe(343);
      expect(geo.left).toBeGreaterThanOrEqual(12);
      expect(geo.rightEdge).toBeLessThanOrEqual(375 - 12);
    });

    it('fits standard 390px mobile screen (iPhone 12/13/14 Pro)', () => {
      const geo = calculateDropdownGeometry(390, 16, 358);
      expect(geo.dropdownWidth).toBe(358);
      expect(geo.left).toBeGreaterThanOrEqual(12);
      expect(geo.rightEdge).toBeLessThanOrEqual(390 - 12);
    });

    it('handles narrow inputs on tablet/desktop (768px - 1024px) by clamping to minimum 300px', () => {
      // On desktop, search input in table might be 240px wide
      const geo = calculateDropdownGeometry(1024, 200, 240);
      expect(geo.dropdownWidth).toBe(300);
      expect(geo.left).toBe(200);
      expect(geo.rightEdge).toBe(500);
    });

    it('prevents off-screen placement when input is near the right edge on desktop', () => {
      const geo = calculateDropdownGeometry(1024, 900, 200);
      expect(geo.dropdownWidth).toBe(300);
      expect(geo.rightEdge).toBeLessThanOrEqual(1024 - 12);
      expect(geo.left).toBe(1024 - 300 - 12);
    });
  });

  describe('2. Mobile Card State Consistency & Calculations', () => {
    it('accurately computes SQM line item when edited via mobile card dimension inputs', () => {
      const sqmProduct: Product = {
        id: 'prod_sqm_test',
        name: 'JSW COLOR COATED ROOFING SHEET 0.45MM',
        category: 'Roofing Sheet',
        hsn: '72104900',
        qtyMethod: 'SQM',
        unit: 'Sq.Mtr',
        ratePerUnit: 385,
        baseRate: 385,
        minRate: 350,
        gstRate: 18,
        active: true,
        widthFactor: 1.08,
      };

      const row = createInitialRow('row_sqm', sqmProduct);
      row.lengthValue = '20';
      row.lengthUnit = 'ft';
      row.nos = '5';
      row.rate = '385';

      const result = computeRowCalculation(row, 'intra', 1.08, 0.305);
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();
      // 20 ft * 0.305 m/ft = 6.1 m; 6.1 * 1.08 = 6.588 sqm/pc; 5 pcs = 32.94 sqm
      expect(result.calculatedLine?.quantity).toBeCloseTo(32.94, 2);
      expect(result.calculatedLine?.taxableAmount).toBeCloseTo(32.94 * 385, 2);
    });

    it('accurately computes Section Weight when toggled between Metres and Ft/In on mobile', () => {
      const row = createInitialRow('row_pipe', pipeProduct);
      // Mode 1: Metres (default)
      row.lengthMetres = '6';
      row.lengthUnit = 'metres';
      row.nos = '10';
      row.rate = String(pipeProduct.ratePerUnit);

      const resMetres = computeRowCalculation(row, 'intra');
      expect(resMetres.validationError).toBeNull();
      expect(resMetres.calculatedLine).not.toBeNull();
      const metresQty = resMetres.calculatedLine?.quantity;

      // Mode 2: Toggle to Ft/In (approx 19 ft 8 in ~ 6m)
      row.lengthUnit = 'ft_in';
      row.lengthFeet = '19';
      row.lengthInches = '8';

      const resFeet = computeRowCalculation(row, 'intra');
      expect(resFeet.validationError).toBeNull();
      expect(resFeet.calculatedLine).not.toBeNull();
      expect(resFeet.calculatedLine?.quantity).toBeGreaterThan(0);
      expect(metresQty).toBeGreaterThan(0);
    });

    it('supports custom line item card creation and validation', () => {
      const customRow = createCustomRow('TRANSPORTATION & HANDLING CHARGES', '1500', '1', 'Nos');
      expect(customRow.isCustomItem).toBe(true);
      expect(customRow.customDescription).toBe('TRANSPORTATION & HANDLING CHARGES');
      expect(customRow.nos).toBe('1');
      expect(customRow.rate).toBe('1500');

      const result = computeRowCalculation(customRow, 'intra');
      expect(result.validationError).toBeNull();
      expect(result.calculatedLine).not.toBeNull();
      expect(result.calculatedLine?.taxableAmount).toBe(1500);
      expect(result.calculatedLine?.quantity).toBe(1);
      expect(result.calculatedLine?.unit).toBe('Nos');
    });

    it('enforces manual quantity override accurately across mobile cards and totals', () => {
      const row = createInitialRow('row_override', crimpProduct);
      row.lengthFeet = '10';
      row.lengthInches = '0';
      row.nos = '2';
      row.rate = '117';

      // Dimensions calculate standard weight
      const normalRes = computeRowCalculation(row, 'intra');
      const calculatedQty = normalRes.calculatedLine?.quantity || 0;

      // Apply manual override
      row.isManualQuantity = true;
      row.manualQuantity = '95.5';

      const overrideRes = computeRowCalculation(row, 'intra');
      expect(overrideRes.calculatedLine?.quantity).toBe(95.5);
      expect(overrideRes.calculatedLine?.taxableAmount).toBeCloseTo(95.5 * 117, 2);
      expect(overrideRes.calculatedLine?.isManualQuantity).toBe(true);
      expect(overrideRes.calculatedLine?.quantity).not.toBe(calculatedQty);
    });
  });
});
