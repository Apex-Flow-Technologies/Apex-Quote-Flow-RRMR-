import { describe, it, expect } from 'vitest';
import {
  parseSteelSize,
  legacySteelSizeDims,
  steelSizeProduct,
  STEEL_SIZE_KINDS,
  STEEL_SIZE_KIND_ORDER,
  type SteelSizeKind,
} from '../components/quotations/steelSize';
import {
  createSteelSizeRow,
  applySteelSize,
  computeRowCalculation,
  rowFromSavedLine,
  rowMethod,
  switchSteelLengthUnit,
  type EditableRowState,
} from '../components/quotations/quotationRows';

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
      expect(r.kgPerMetre).toBe(kgm);
      expect(r.name).toBe(name);
    });
  }

  it('every type in the picker has boxes', () => {
    expect(STEEL_SIZE_KIND_ORDER).not.toContain('UNEQUAL_ANGLE');
    expect(STEEL_SIZE_KIND_ORDER).toHaveLength(Object.keys(STEEL_SIZE_KINDS).length - 1);
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
      { brand: 'JSW Colouron+', profile: 'Crimp 8+1', t: '0.47', coating: '150 GSM', colour: 'Red' },
      { lengthFeet: '17', lengthInches: '4', nos: '10', rate: '117' }
    );
    expect(rowMethod(row)).toBe('SQM');
    const l = calc(row).calculatedLine!;
    expect(l.productName).toBe('JSW Colouron+ Crimp 8+1 0.47 mm 150 GSM');
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
    const row = line('FLASHING', { item: 'Ridge', size: '12x12', length: '8 ft', brand: 'JSW Colouron+', t: '0.47' }, { nos: '5', rate: '690' });
    expect(rowMethod(row)).toBe('PIECE');
    const l = calc(row).calculatedLine!;
    expect(l.productName).toBe('JSW Colouron+ Ridge 12 × 12 0.47 mm – 8 ft');
    expect(l.unit).toBe('Nos');
    expect(l.taxableAmount).toBe(3450);
  });

  it('flashing needs the item', () => {
    expect(parseSteelSize({ shape: 'FLASHING', dims: { size: '12x12' } }).ok).toBe(false);
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
    expect(switchSteelLengthUnit(row, 'ft')).toMatchObject({ lengthUnit: 'ft', lengthValue: '19.67' });
    expect(switchSteelLengthUnit(row, 'ft_in')).toMatchObject({ lengthUnit: 'ft_in', lengthFeet: '19', lengthInches: '8.1' });
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
    ['FLASHING', { item: 'Valley gutter', size: '24 inch' }, { nos: '2', rate: '980' }],
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
