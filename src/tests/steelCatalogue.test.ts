import { describe, it, expect } from 'vitest';
import { buildSteelCatalogue } from '../data/steelCatalogue';

const catalogue = buildSteelCatalogue();
const byName = (n: string) => {
  const item = catalogue.find((i) => i.name === n);
  if (!item) throw new Error(`missing ${n}`);
  return item;
};

describe('Steel catalogue', () => {
  it('has unique ids and names, all Kgs / SECTION_WEIGHT / 18% GST', () => {
    expect(new Set(catalogue.map((i) => i.id)).size).toBe(catalogue.length);
    expect(new Set(catalogue.map((i) => i.name)).size).toBe(catalogue.length);
    for (const i of catalogue) {
      expect(i.qtyMethod).toBe('SECTION_WEIGHT');
      expect(i.unit).toBe('Kgs');
      expect(i.gstRate).toBe(18);
      expect(i.kgPerMetre).toBeGreaterThan(0);
      expect(i.defaultLengthM).toBeGreaterThan(0);
    }
  });

  it('excludes rails, tee and window sections', () => {
    expect(catalogue.some((i) => /rail|tee|window/i.test(i.name))).toBe(false);
  });

  it('round pipes match the Madhav IS 1161 chart within 1.5%', () => {
    const chart: [string, number][] = [
      ['MS Round Pipe 21.3 OD × 2 mm', 0.952],
      ['MS Round Pipe 33.7 OD × 3.2 mm', 2.41],
      ['MS Round Pipe 42.4 OD × 3.2 mm', 3.09],
      ['MS Round Pipe 48.3 OD × 3.2 mm', 3.56],
      ['MS Round Pipe 76.1 OD × 3.6 mm', 6.44],
      ['MS Round Pipe 42.4 OD × 4 mm', 3.79],
      ['MS Round Pipe 114.3 OD × 4.5 mm', 12.2],
      ['MS Round Pipe 168.3 OD × 6.3 mm', 25.2],
      ['MS Round Pipe 219.1 OD × 6.3 mm', 33.1],
    ];
    for (const [name, kg] of chart) {
      expect(Math.abs(byName(name).kgPerMetre - kg) / kg).toBeLessThan(0.015);
    }
  });

  it('square / rectangular pipes match the IS 4923 chart within 1%', () => {
    const chart: [string, number][] = [
      ['MS Square Pipe 25 × 25 × 1.6 mm', 1.12],
      ['MS Square Pipe 40 × 40 × 3.2 mm', 3.49],
      ['MS Square Pipe 60 × 60 × 3.2 mm', 5.5],
      ['MS Square Pipe 150 × 150 × 5 mm', 22.26],
      ['MS Square Pipe 180 × 180 × 6 mm', 32.05],
      ['MS Rectangular Pipe 50 × 25 × 2 mm', 2.15],
      ['MS Rectangular Pipe 80 × 40 × 3.2 mm', 5.5],
      ['MS Rectangular Pipe 120 × 60 × 4.5 mm', 11.67],
    ];
    for (const [name, kg] of chart) {
      expect(Math.abs(byName(name).kgPerMetre - kg) / kg).toBeLessThan(0.01);
    }
  });

  it('plates / flats / bars agree with RR weight card', () => {
    // Plate card is kg/m² → kg/m for a 1500 mm wide plate = 1.5 × card
    expect(byName('MS Plate 5 mm (1500 wide)').kgPerMetre).toBeCloseTo(39.25 * 1.5, 2);
    expect(byName('MS Plate 25 mm (1500 wide)').kgPerMetre).toBeCloseTo(196.25 * 1.5, 2);
    // Chequered: card kg/m² × 1.25 m width
    expect(byName('Chequered Plate 5 mm (1250 wide)').kgPerMetre).toBeCloseTo(43.5 * 1.25, 3);
    expect(byName('Chequered Plate 5 mm (1250 wide)').defaultLengthM).toBe(2.5);
    // Flats: card is 1-decimal
    expect(byName('MS Flat 50 × 6 mm').kgPerMetre).toBeCloseTo(2.4, 1);
    expect(byName('MS Flat 100 × 25 mm').kgPerMetre).toBeCloseTo(19.6, 1);
    // Bars
    expect(byName('MS Round Bar 12 mm').kgPerMetre).toBeCloseTo(0.89, 2);
    expect(byName('MS Round Bar 50 mm').kgPerMetre).toBeCloseTo(15.42, 1);
    expect(byName('MS Square Bar 20 mm').kgPerMetre).toBeCloseTo(3.14, 2);
    expect(byName('MS Square Bar 100 mm').kgPerMetre).toBeCloseTo(78.5, 2);
  });

  it('chart sections carry the card kg/m', () => {
    expect(byName('MS Angle 50 × 50 × 6 mm').kgPerMetre).toBe(4.5);
    expect(byName('MS Channel ISMC 100 × 50').kgPerMetre).toBe(9.6);
    expect(byName('MS Beam ISMB 200 × 100').kgPerMetre).toBe(25.9);
  });
});
