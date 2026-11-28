import { describe, it, expect } from 'vitest';
import {
  parseSteelSize,
  legacySteelSizeDims,
  steelSizeProduct,
  flashingPerSheet,
  STEEL_SIZE_KINDS,
  STEEL_SIZE_KIND_ORDER,
  ITEM_PRESETS,
  type SteelSizeKind,
} from '../components/quotations/steelSize';
import {
  createSteelSizeRow,
  applySteelSize,
  computeRowCalculation,
  rowFromSavedLine,
  rowMethod,
  switchSteelLengthUnit,
  workingText,
  type EditableRowState,
} from '../components/quotations/quotationRows';
import { describeSteelLine, describeFlashingLine } from '../utils/steelLine';

const kg = (shape: SteelSizeKind, dims: Record<string, string>) => {
  const r = parseSteelSize({ shape, dims });
  if (!r.ok) throw new Error(`${shape}: ${r.error}`);
  return r;
};

/** A line of the given type with its boxes filled (and any other row fields). */
const line = (shape: SteelSizeKind, dims: Record<string, string>, extra: Partial<EditableRowState> = {}) => {
  const base = createSteelSizeRow(shape);
  return applySteelSize({ ...base, id: `r_${shape}`, ...extra, steelSize: { shape, dims: { ...base.steelSize!.dims, ...dims } } });
};
const calc = (row: EditableRowState) => computeRowCalculation(row, 'intra', 1.06, 0.305);

describe('Steel by type: weight per metre (maiak-m.bg formulas)', () => {
  const cases: [SteelSizeKind, Record<string, string>, number, string][] = [
    ['SQUARE_PIPE', { a: '40', t: '1.3' }, 1.556958, 'MS Square Tube 40 × 40 × 1.3 mm'],
    ['SQUARE_PIPE', { a: '60', t: '3.2' }, 5.56926, 'MS Square Tube 60 × 60 × 3.2 mm'],
    ['RECT_PIPE', { a: '80', b: '40', t: '3' }, 5.248107, 'MS Rectangular Tube 80 × 40 × 3 mm'],
    ['ROUND_PIPE', { d: '21.3', t: '2' }, 0.951451, 'MS Round Tube 21.3 OD × 2 mm'], // maiak-m.bg shows 0.95
    ['PLATE', { t: '5', w: '1250' }, 49.0625, 'MS Plate 5 mm (1250 wide)'],
    ['CHEQUERED_PLATE', { t: '6', w: '1250' }, 62.625, 'MS Chequered Plate 6 mm (1250 wide)'], // chart 50.10 kg/m²
    ['CHEQUERED_PLATE', { t: '8', w: '1250' }, 82.25, 'MS Chequered Plate 8 mm (1250 wide)'], // chart 65.80 kg/m²
    ['CHEQUERED_PLATE', { t: '7', w: '1250' }, 72.4375, 'MS Chequered Plate 7 mm (1250 wide)'], // off chart: 7 × 7.85 + 3
    ['ROUND_BAR', { d: '16' }, 1.578342, 'MS Round Bar 16 mm'],
    ['SQUARE_BAR', { a: '12' }, 1.1304, 'MS Square Bar 12 mm'],
    ['FLAT', { w: '50', t: '6' }, 2.355, 'MS Flat 50 × 6 mm'],
    ['EQUAL_ANGLE', { a: '50', t: '6' }, 4.5, 'MS Angle 50 × 50 × 6 mm'], // RR card
    ['EQUAL_ANGLE', { a: '55', t: '5' }, 4.12125, 'MS Angle 55 × 55 × 5 mm'], // formula
    ['UNEQUAL_ANGLE', { a: '75', b: '50', t: '6' }, 5.6049, 'MS Angle 75 × 50 × 6 mm'],
    ['CHANNEL', { size: '100x50' }, 9.6, 'MS Channel ISMC 100 × 50'],
    ['BEAM', { size: '200x100' }, 25.9, 'MS Beam ISMB 200 × 100'],
  ];
  for (const [shape, dims, kgm, name] of cases) {
    it(`${shape} ${JSON.stringify(dims)}`, () => {
      const r = kg(shape, dims);
      expect(r.kgPerMetre).toBeCloseTo(kgm, 6);
      expect(r.name).toBe(name);
    });
  }

  it('steel types have a Brand box, shown in front of the name', () => {
    expect(STEEL_SIZE_KINDS.SQUARE_PIPE.fields.map((f) => f.key)).toEqual(['a', 't', 'brand']);
    expect(kg('SQUARE_PIPE', { a: '40', t: '1.3', brand: 'Apollo' }).name).toBe('Apollo MS Square Tube 40 × 40 × 1.3 mm');
    expect(kg('SQUARE_PIPE', { a: '40', t: '1.3' }).name).toBe('MS Square Tube 40 × 40 × 1.3 mm');
  });

  it('every type in the picker has boxes', () => {
    expect(STEEL_SIZE_KIND_ORDER).not.toContain('UNEQUAL_ANGLE');
    expect(STEEL_SIZE_KIND_ORDER).not.toContain('SHEET_WEIGHT'); // replaced by the kg/ft sheet
    expect(STEEL_SIZE_KIND_ORDER).not.toContain('RIDGE_GUTTER'); // split into Ridge and Gutter
    expect(STEEL_SIZE_KIND_ORDER).toContain('PROFILE_RIDGE');
    expect(STEEL_SIZE_KIND_ORDER).toHaveLength(Object.keys(STEEL_SIZE_KINDS).length - 3);
    for (const k of STEEL_SIZE_KIND_ORDER) expect(STEEL_SIZE_KINDS[k].fields.length).toBeGreaterThan(0);
  });

  it('chequered plate 5 mm, 1250 × 2500 sheet = 132.03 kg as on the chart', () => {
    const r = calc(line('CHEQUERED_PLATE', { t: '5', w: '1250' }, { lengthMetres: '2.5', nos: '1', rate: '80' }));
    expect(r.calculatedLine!.quantity).toBe(132.03);
  });
});

describe('Sheets and accessories by type', () => {
  it('roofing sheet (Sq.Mtr): name from the boxes, colour on the line, 17 ft 4 in × 10', () => {
    const row = line(
      'SHEET_SQM',
      { brand: 'JSW Colouron+', profile: 'Crimp', t: '0.47', colour: 'Red' },
      { lengthFeet: '17', lengthInches: '4', nos: '10', rate: '117' }
    );
    expect(rowMethod(row)).toBe('SQM');
    const l = calc(row).calculatedLine!;
    expect(l.productName).toBe('JSW Colouron+ Crimp 0.47 mm');
    expect(l.colour).toBe('Red');
    expect(l.unit).toBe('Sq.Mtr');
    expect(l.quantity).toBe(56.04);
    expect(l.taxableAmount).toBe(6556.52);
    expect(l.hsn).toBe('72109090');
  });

  it('typed text that is not in the list is kept', () => {
    const l = calc(line('SHEET_SQM', { brand: 'Everest', profile: 'Wave' }, { rate: '300' })).calculatedLine!;
    expect(l.productName).toBe('Everest Wave');
  });

  it('roofing sheet (by weight): coil width starts at 1.06, 12 ft 6 in × 8', () => {
    const row = line('SHEET_WEIGHT', { t: '0.47' }, { lengthFeet: '12', lengthInches: '6', nos: '8', rate: '114' });
    expect(row.steelSize!.dims.coil).toBe('1.06');
    const l = calc(row).calculatedLine!;
    expect(l.unit).toBe('Kgs');
    expect(l.perPieceQuantity).toBe(15.13);
    expect(l.quantity).toBe(121.04);
  });

  it('by-weight sheet needs the thickness', () => {
    const r = parseSteelSize({ shape: 'SHEET_WEIGHT', dims: { coil: '1.06' } });
    expect(!r.ok && r.missing).toBe(true);
  });

  it('polycarbonate sheet has its own HSN', () => {
    const p = steelSizeProduct({ shape: 'POLYCARBONATE', dims: { t: '2', colour: 'Clear' } }, 'x')!;
    expect(p.name).toBe('Polycarbonate sheet 2 mm');
    expect(p.hsn).toBe('39206110');
  });

  it('ridge priced per piece', () => {
    const row = line('RIDGE_GUTTER', { item: 'Ridge', size: '12x12', length: '8 ft', brand: 'JSW Colouron+', t: '0.47' }, { nos: '5', rate: '690' });
    expect(rowMethod(row)).toBe('PIECE');
    const l = calc(row).calculatedLine!;
    expect(l.productName).toBe('JSW Colouron+ Ridge 12 × 12 0.47 mm – 8 ft');
    expect(l.unit).toBe('Nos');
    expect(l.taxableAmount).toBe(3450);
  });

  it('ridge and gutter are cut from the sheet; sizes in separate boxes', () => {
    const r = calc(line('RIDGE', { a: '1', b: '1' }, { nos: '4', rate: '1' })).calculatedLine!; // ridge starts in ft
    expect(r.productName).toBe('Ridge 1 × 1 ft');
    expect(r.nos).toBe(2); // 24 in → 2 a sheet; 4 pcs → 2 sheets
    expect(r.unit).toBe('Sq.Mtr');
    expect(r.quantity).toBe(5.26); // 2 × 2.63
    // non-standard 1.5 × 1.5 ft ridge: 36 in → only 1 a sheet
    expect(calc(line('RIDGE', { a: '1.5', b: '1.5' }, { nos: '3', rate: '1' })).calculatedLine!.nos).toBe(3);
    // gutter: Side A × Side B like ridge; 8 × 8 in → 16 in → 3 a sheet
    const g8 = calc(line('GUTTER', { a: '8', b: '8' }, { nos: '4', rate: '1' })).calculatedLine!;
    expect(g8.nos).toBe(2); // 4 pcs ÷ 3 a sheet → 2 sheets
    expect(g8.productName).toBe('Gutter 8 × 8 in');
    expect(STEEL_SIZE_KINDS.GUTTER.fields.map((f) => f.key).slice(0, 3)).toEqual(['a', 'b', 'su']);
    // only the girth known: Side B left empty; 24 in → 2 a sheet; over 24 in → 1
    const g = calc(line('GUTTER', { item: 'Barge gutter', a: '24' }, { nos: '4', rate: '1' })).calculatedLine!;
    expect(g.nos).toBe(2);
    expect(g.productName).toBe('Barge gutter 24 in');
    expect(calc(line('GUTTER', { a: '30' }, { nos: '4', rate: '1' })).calculatedLine!.nos).toBe(4);
    const back = rowFromSavedLine(r);
    expect(back.nos).toBe('4');
    expect(back.steelSize!.dims).toMatchObject({ a: '1', b: '1', su: 'ft' });
    expect(ITEM_PRESETS.RIDGE).toEqual(['Ridge']);
    expect(ITEM_PRESETS.GUTTER).toEqual(['Gutter', 'Barge gutter']);
    expect(ITEM_PRESETS.FLASHING).toEqual(['L flashing', 'Ridge', 'Barge L flashing']);
    expect(STEEL_SIZE_KINDS.FLASHING.fields.some((f) => f.key === 'item')).toBe(false);
    expect(createSteelSizeRow('GUTTER', 'Barge gutter').steelSize!.dims.item).toBe('Barge gutter');
    expect(createSteelSizeRow('FLASHING').steelSize!.dims).toMatchObject({ item: 'L flashing', su: 'in' });
  });

  it('UPVC and tile sheet (Sq.Mtr) use the sheet formula; tile sheet by weight uses kg/ft', () => {
    const base = { lengthUnit: 'in' as const, lengthValue: '126', nos: '5', rate: '1' };
    const u = calc(line('UPVC_SHEET', { t: '2', wf: '1.08' }, base)).calculatedLine!;
    expect(u.productName).toBe('UPVC sheet 2 mm');
    expect(u.quantity).toBe(17.29);
    expect(calc(line('TILE_SQM', { wf: '1.08' }, base)).calculatedLine!.quantity).toBe(17.29);
    const tw = calc(line('TILE_KGFT', {}, base)).calculatedLine!;
    expect(tw.unit).toBe('Kgs');
    expect(tw.quantity).toBe(65.1); // 10.5 ft × 1.24 × 5
  });

  it('air vent: per piece, base always one of the two', () => {
    const row = createSteelSizeRow('AIR_VENT');
    expect(row.steelSize!.dims.base).toBe('Polycarbonate base');
    const l = calc(line('AIR_VENT', { base: 'Aluminium base' }, { nos: '3', rate: '1500' })).calculatedLine!;
    expect(l.productName).toBe('Air vent – aluminium base');
    expect(l.unit).toBe('Nos');
    expect(l.taxableAmount).toBe(4500);
    expect(parseSteelSize({ shape: 'AIR_VENT', dims: { base: '' } }).ok).toBe(false);
    expect(parseSteelSize({ shape: 'AIR_VENT', dims: { base: 'Steel base' } }).ok).toBe(false);
  });

  it('plain sheet uses the Sq.Mtr sheet formula', () => {
    const p = calc(line('PLAIN_SHEET', { brand: 'JSW', t: '0.47', wf: '1.08', colour: 'Blue' }, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' })).calculatedLine!;
    expect(p.productName).toBe('JSW Plain sheet 0.47 mm');
    expect(p.unit).toBe('Sq.Mtr');
    expect(p.quantity).toBe(17.29); // 126 ÷ 12 × 0.305 × 1.08 × 5
    expect(p.colour).toBe('Blue');
    expect(createSteelSizeRow('PLAIN_SHEET').lengthUnit).toBe('ft_in');
  });

  it('profile ridge is priced on the sheet length only', () => {
    const p = calc(line('PROFILE_RIDGE', { wf: '1.08' }, { lengthFeet: '10', lengthInches: '0', nos: '3', rate: '1' })).calculatedLine!;
    expect(p.productName).toBe('Profile ridge');
    expect(p.quantity).toBe(9.88); // 10 × 0.305 × 1.08 × 3 = 9.882
    expect(STEEL_SIZE_KINDS.PROFILE_RIDGE.fields.some((f) => f.key === 'a')).toBe(false);
  });

  it('older lines with one size text box still work', () => {
    expect(calc(line('FLASHING', { size: '6x6' }, { nos: '12', rate: '1' })).calculatedLine!.nos).toBe(3);
  });

  it('ridge / gutter needs the item', () => {
    expect(parseSteelSize({ shape: 'RIDGE_GUTTER', dims: { size: '12x12' } }).ok).toBe(false);
  });

  it('screws', () => {
    const p = steelSizeProduct({ shape: 'FIXING', dims: { item: 'Self drilling screw', size: '55 mm' } }, 'y')!;
    expect(p.name).toBe('Self drilling screw 55 mm');
    expect(p.hsn).toBe('73181500');
  });

  it('HSN can be changed on the line', () => {
    const p = steelSizeProduct({ shape: 'SHEET_SQM', dims: {}, hsn: '72107000' }, 'z')!;
    expect(p.hsn).toBe('72107000');
  });
});

describe('Roofing sheet by weight (kg per foot)', () => {
  it('126 in × 1.24 kg/ft: 13.02 kg a sheet, 5 sheets 65.10 kg', () => {
    const row = line('SHEET_KGFT', { brand: 'JSW Colouron+', profile: 'Crimp', colour: 'Red' }, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '114' });
    expect(row.steelSize!.dims.kgft).toBe('1.24');
    expect(row.lengthUnit).toBe('in');
    const l = calc(row).calculatedLine!;
    expect(l.perPieceQuantity).toBe(13.02);
    expect(l.quantity).toBe(65.1);
    expect(l.unit).toBe('Kgs');
    expect(l.productName).toBe('JSW Colouron+ Crimp');
    expect(l.colour).toBe('Red');
    expect(l.taxableAmount).toBe(7421.4);
  });

  it('quote and PDF describe it in kg/ft', () => {
    const l = calc(line('SHEET_KGFT', {}, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' })).calculatedLine!;
    expect(describeSteelLine(l)).toBe('126 in × 5 nos · 1.24 kg/ft');
    const t = calc(line('RECT_PIPE', { a: '80', b: '40', t: '2' }, { nos: '1', rate: '1' })).calculatedLine!;
    expect(describeSteelLine(t)).toBe('6m × 1 nos · 3.588 kg/m');
  });

  it('the same sheet in ft + in, ft, m and mm', () => {
    const q = (extra: Partial<EditableRowState>) => calc(line('SHEET_KGFT', {}, { nos: '5', rate: '1', ...extra })).calculatedLine!.quantity;
    expect(q({ lengthUnit: 'ft_in', lengthFeet: '10', lengthInches: '6' })).toBe(65.1);
    expect(q({ lengthUnit: 'ft', lengthValue: '10.5' })).toBe(65.1);
    expect(q({ lengthUnit: 'metres', lengthMetres: '3.2025' })).toBe(65.1);
  });

  it('new lines start in ft + in, and kg/ft can be changed', () => {
    expect(createSteelSizeRow('SHEET_KGFT').lengthUnit).toBe('ft_in');
    const l = calc(line('SHEET_KGFT', { kgft: '1.5' }, { lengthUnit: 'ft', lengthValue: '10', nos: '1', rate: '1' })).calculatedLine!;
    expect(l.quantity).toBe(15);
  });

  it('kg/ft is required', () => {
    const r = parseSteelSize({ shape: 'SHEET_KGFT', dims: { kgft: '' } });
    expect(!r.ok && r.missing).toBe(true);
  });
});

/** "6x6" → { a: '6', b: '6' }; "1x1 ft" → feet; "24" → one girth box */
const sides = (size: string): Record<string, string> => {
  const ft = /ft/.test(size);
  const [a, b] = size.replace(/ft/, '').split('x').map((x) => x.trim());
  return { a, ...(b ? { b } : {}), su: ft ? 'ft' : 'in' };
};

describe('Flashing cut from 8 ft × 4 ft sheets', () => {
  const cut = (size: string, pcs: string, extra: Record<string, string> = {}) =>
    calc(line('FLASHING', { ...sides(size), ...extra }, { nos: pcs, rate: '1500' })).calculatedLine!;

  it('pieces per 48 in sheet: 6x6 → 4, 8x8 → 3, 1x1 ft → 2, 18x18 → 1', () => {
    expect(flashingPerSheet('6x6', 48)).toMatchObject({ girth: 12, perSheet: 4 });
    expect(flashingPerSheet('8x8', 48)).toMatchObject({ girth: 16, perSheet: 3 });
    expect(flashingPerSheet('1x1 ft', 48)).toMatchObject({ girth: 24, perSheet: 2 });
    expect(flashingPerSheet('1x1', 48)).toMatchObject({ girth: 24, perSheet: 2 });
    expect(flashingPerSheet('12x12', 48)).toMatchObject({ girth: 24, perSheet: 2 });
    expect(flashingPerSheet('18x18', 48)).toMatchObject({ perSheet: 1 });
  });

  it('whole sheets, priced by Sq.Mtr: 8 ft × 0.305 × 1.08 = 2.63 a sheet (rounded down)', () => {
    expect(cut('6x6', '4').nos).toBe(1);
    expect(cut('6x6', '4').quantity).toBe(2.63); // 2.6352 → 2.63
    const l = cut('6x6', '12');
    expect(l.nos).toBe(3);
    expect(l.quantity).toBe(7.89); // RR's example: 2.63 × 3
    expect(l.unit).toBe('Sq.Mtr');
    expect(l.widthFactor).toBe(1.08);
    expect(l.taxableAmount).toBe(11835); // 7.89 × 1500
    const ten = cut('6x6', '10');
    expect(ten.snapshot.steelSizeDims?.pcs).toBe('10');
    expect(describeFlashingLine(ten)).toBe('10 pcs · 4 per 48 in sheet = 3 sheets');
  });

  it('8x8 × 3 pcs → 1 sheet; 1x1 ft × 2 pcs → 1 sheet; 12 pcs of 6x6 → 3 sheets', () => {
    expect(cut('8x8', '3').nos).toBe(1);
    expect(cut('1x1 ft', '2').nos).toBe(1);
    expect(cut('6x6', '12').nos).toBe(3);
  });

  it('the width factor and sheet length can be changed', () => {
    const l = calc(line('FLASHING', { a: '6', b: '6', wf: '1.22' }, { nos: '4', rate: '1', lengthFeet: '10', lengthInches: '0' })).calculatedLine!;
    expect(l.quantity).toBe(3.72); // 10 × 0.305 × 1.22 = 3.721 → 3.72
  });

  it('a piece wider than the sheet is explained', () => {
    const r = parseSteelSize({ shape: 'FLASHING', dims: { item: 'L flashing', a: '30', b: '30', su: 'in', sheet: '48', wf: '1.28' } });
    expect(!r.ok && r.error).toMatch(/wider than the 48 in sheet/);
  });

  it('revise shows the pieces again, not the sheets', () => {
    const back = rowFromSavedLine(cut('6x6', '10'));
    expect(back.nos).toBe('10');
    expect(calc(back).calculatedLine!.quantity).toBe(7.89);
  });
});

describe('Width factor on the line and the working shown', () => {
  it('Sq.Mtr sheet: line width factor 1.08 → 126 in × 5 = 17.29 Sq.Mtr (client example)', () => {
    const row = line('SHEET_SQM', { wf: '1.08' }, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' });
    const l = calc(row).calculatedLine!;
    expect(l.quantity).toBe(17.29);
    expect(l.widthFactor).toBe(1.08);
  });

  it('empty width box uses the quotation width factor', () => {
    const l = calc(line('SHEET_SQM', {}, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' })).calculatedLine!;
    expect(l.widthFactor).toBe(1.06);
    expect(l.quantity).toBe(16.97);
  });

  it('working text for each kind of line', () => {
    const show = (r: EditableRowState) => workingText({ ...r, ...calc(r) });
    expect(show(line('FLASHING', { a: '6', b: '6' }, { nos: '12', rate: '1' }))).toBe(
      '12 pcs ÷ 4 a sheet = 3 sheets · 8 ft = 2.44 m × 1.08 = 2.63 Sq.Mtr a sheet × 3 = 7.89 Sq.Mtr'
    );
    expect(show(line('RECT_PIPE', { a: '80', b: '40', t: '2' }, { nos: '1', rate: '1' }))).toBe(
      '6 m × 3.588 kg/m = 21.53 kg each × 1 = 21.53 kg'
    );
    expect(show(line('SHEET_KGFT', {}, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' }))).toBe(
      '126 in = 10.5 ft × 1.24 kg/ft = 13.02 kg each × 5 = 65.1 kg'
    );
    expect(show(line('SHEET_SQM', { wf: '1.08' }, { lengthUnit: 'in', lengthValue: '126', nos: '5', rate: '1' }))).toBe(
      '126 in = 3.2025 m × 1.08 = 3.4587 Sq.Mtr each × 5 = 17.29 Sq.Mtr'
    );
  });
});

describe('Sheet length in any unit', () => {
  const sheet = (extra: Partial<EditableRowState>) => line('SHEET_SQM', { brand: 'JSW Colouron+', t: '0.47' }, { nos: '10', rate: '117', ...extra });

  it('5.3 m, 5300 mm and 5.3 m typed as ft give the same Sq.Mtr', () => {
    const m = calc(sheet({ lengthUnit: 'metres', lengthMetres: '5.3' })).calculatedLine!;
    const mm = calc(sheet({ lengthUnit: 'mm', lengthValue: '5300' })).calculatedLine!;
    expect(mm.quantity).toBe(m.quantity);
    expect(m.quantity).toBe(56.18); // 5.3 × 1.06 × 10
  });

  it('17.4 ft (decimal feet) and 17 ft 4.8 in are the same', () => {
    const ft = calc(sheet({ lengthUnit: 'ft', lengthValue: '17.4' })).calculatedLine!;
    const ftIn = calc(sheet({ lengthUnit: 'ft_in', lengthFeet: '17', lengthInches: '4.8' })).calculatedLine!;
    expect(ft.quantity).toBe(ftIn.quantity);
  });

  it('a by-weight sheet in inches', () => {
    const l = calc(line('SHEET_WEIGHT', { t: '0.47' }, { lengthUnit: 'in', lengthValue: '150', nos: '8', rate: '114' })).calculatedLine!;
    expect(l.quantity).toBe(121.04); // 150 in = 12 ft 6 in
  });

  it('revise keeps a sheet length typed in mm or m', () => {
    for (const extra of [{ lengthUnit: 'mm' as const, lengthValue: '5300' }, { lengthUnit: 'metres' as const, lengthMetres: '5.3' }]) {
      const l = calc(sheet(extra)).calculatedLine!;
      const back = rowFromSavedLine(l);
      expect(back.lengthUnit).toBe(extra.lengthUnit);
      expect(calc(back).calculatedLine!.quantity).toBe(l.quantity);
    }
  });
});

describe('Steel length in any unit', () => {
  const tube = (extra: Partial<EditableRowState>) => line('SQUARE_PIPE', { a: '40', t: '1.3' }, { nos: '1', rate: '70', ...extra });

  it('6 m and 6000 mm give the same weight', () => {
    const m = calc(tube({ lengthUnit: 'metres', lengthMetres: '6' })).calculatedLine!.quantity;
    const mm = calc(tube({ lengthUnit: 'mm', lengthValue: '6000' })).calculatedLine!;
    expect(mm.quantity).toBe(m);
    expect(mm.lengthUnit).toBe('mm');
  });

  it('20 ft = 6.1 m', () => {
    expect(calc(tube({ lengthUnit: 'ft', lengthValue: '20' })).calculatedLine!.quantity).toBe(9.5);
  });

  it('switching the unit keeps the length', () => {
    const row = tube({ lengthUnit: 'metres', lengthMetres: '6' });
    expect(switchSteelLengthUnit(row, 'mm')).toMatchObject({ lengthUnit: 'mm', lengthValue: '6000' });
    expect(switchSteelLengthUnit(row, 'ft')).toMatchObject({ lengthUnit: 'ft', lengthValue: '19.672' });
    expect(switchSteelLengthUnit(row, 'ft_in')).toMatchObject({ lengthUnit: 'ft_in', lengthFeet: '19', lengthInches: '8.07' });
    // switching back and forth does not change the weight
    for (const u of ['mm', 'ft', 'in', 'ft_in'] as const) {
      expect(calc({ ...row, ...switchSteelLengthUnit(row, u) }).calculatedLine!.quantity).toBe(calc(row).calculatedLine!.quantity);
    }
  });

  it('revise keeps a length typed in mm', () => {
    const l = calc(tube({ lengthUnit: 'mm', lengthValue: '2500' })).calculatedLine!;
    const back = rowFromSavedLine(l);
    expect(back.lengthUnit).toBe('mm');
    expect(back.lengthValue).toBe('2500');
  });
});

describe('Steel by type: on a quote line', () => {
  it('80 × 40 × 2 rectangular tube, 6 m: 21.53 kg as on maiak-m.bg', () => {
    expect(calc(line('RECT_PIPE', { a: '80', b: '40', t: '2' }, { nos: '1', rate: '70' })).calculatedLine!.perPieceQuantity).toBe(21.53);
  });

  it('6 m × 10 lengths of 40 × 40 × 1.3 at ₹70/kg, rounded once', () => {
    const l = calc(line('SQUARE_PIPE', { a: '40', t: '1.3' }, { nos: '10', rate: '70' })).calculatedLine!;
    // 6 × 1.556958 × 10 = 93.417 kg
    expect(l.quantity).toBe(93.42);
    expect(l.taxableAmount).toBe(6539.22);
    expect(l.snapshot.steelSizeDims).toEqual({ a: '40', t: '1.3' });
  });

  it('a plate line starts at 2.5 m, a sheet line takes feet + inches', () => {
    expect(createSteelSizeRow('PLATE').lengthMetres).toBe('2.5');
    expect(createSteelSizeRow('SHEET_SQM').lengthUnit).toBe('ft_in');
    expect(rowMethod(createSteelSizeRow('PLATE'))).toBe('SECTION_WEIGHT');
  });

  it('empty boxes are a hint, not an error', () => {
    expect(calc(createSteelSizeRow('RECT_PIPE')).validationError).toBeNull();
  });

  for (const [shape, dims, extra] of [
    ['RECT_PIPE', { a: '80', b: '40', t: '3' }, { nos: '4', rate: '68' }],
    ['SHEET_SQM', { brand: 'JSW Pragathi+', t: '0.47', colour: 'Blue' }, { nos: '6', rate: '400', lengthFeet: '10' }],
    ['SHEET_WEIGHT', { t: '0.5' }, { nos: '3', rate: '118' }],
    ['RIDGE_GUTTER', { item: 'Valley gutter', size: '24 inch' }, { nos: '2', rate: '980' }],
    ['FLASHING', { a: '6', b: '6' }, { nos: '10', rate: '1500' }],
    ['FIXING', { item: 'EPDM washer' }, { nos: '200', rate: '2' }],
  ] as [SteelSizeKind, Record<string, string>, Partial<EditableRowState>][]) {
    it(`revise brings back a ${shape} line with the same amount`, () => {
      const l = calc(line(shape, dims, extra)).calculatedLine!;
      const back = rowFromSavedLine(l);
      expect(back.steelSize?.shape).toBe(shape);
      expect(back.steelSize?.dims).toMatchObject(dims);
      const again = calc(back).calculatedLine!;
      expect(again.quantity).toBe(l.quantity);
      expect(again.taxableAmount).toBe(l.taxableAmount);
      expect(again.productName).toBe(l.productName);
      expect(again.colour).toBe(l.colour);
    });
  }

  it('older single-box lines open in separate boxes', () => {
    expect(legacySteelSizeDims('SQUARE_PIPE', '40x40x1.3')).toEqual({ a: '40', t: '1.3' });
    expect(legacySteelSizeDims('SQUARE_PIPE', '40 x 1.3')).toEqual({ a: '40', t: '1.3' });
  });
});
