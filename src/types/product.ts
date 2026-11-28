import type { SteelShape, SteelDims } from '../engine/steel';

export type QuantityMethod =
  | 'SQM'
  | 'WEIGHT_PER_PIECE'
  | 'PIECE'
  | 'CUSTOM'
  | 'SHEET_WEIGHT'
  | 'SECTION_WEIGHT'
  | 'AREA'
  | 'RUNNING_LENGTH'
  | 'LENGTH_FT'
  | 'MANUAL';

export type ProductUnit = 'Kgs' | 'Nos' | 'Sq.Mtr' | 'R.Mtr' | 'Ft' | (string & {});

/** Units offered on Manual / Custom lines; any other unit can be typed. */
export const SUGGESTED_UNITS = ['Nos', 'Kgs', 'Sq.Mtr', 'Sq.Ft', 'R.Mtr', 'Mtr', 'Ft', 'Set', 'Lot', 'Bundle', 'Box', 'Roll', 'Litre', 'Trip', 'Day', 'Job'];

/** Manual and Custom lines: the quantity, unit and rate are all typed by hand. */
export function isTypedQuantityMethod(method?: string): boolean {
  return method === 'MANUAL' || method === 'CUSTOM';
}

export type StockMethod = 'WEIGHT' | 'PIECE' | 'NONE';

export interface BaseProduct {
  id: string;
  name: string;
  category: string; // e.g. "Sheet", "Accessory", "Structural", "Screw", "Crimp", "Coloron", "Plain", "Ridge", "Pipe"
  hsn: string;
  ratePerUnit: number;
  baseRate?: number;
  minRate?: number;
  unit: ProductUnit;
  gstRate: number; // e.g. 18 for 18%
  active: boolean;
  isPlaceholder?: boolean;
  stockMethod?: StockMethod;
  stockUom?: ProductUnit;
  kgPerPiece?: number; // for structural steel products
  thicknessMm?: number;
  coilWidthM?: number;
  coverWidthM?: number;
  widthFactor?: number;
  createdAt?: string | number | Record<string, unknown>;
  updatedAt?: string | number | Record<string, unknown>;
}

export interface SqmProduct extends BaseProduct {
  qtyMethod: 'SQM';
  widthFactor?: number;
  coilWidthM?: number;
  coverWidthM?: number;
  thicknessMm?: number;
}

export interface WeightPerPieceProduct extends BaseProduct {
  qtyMethod: 'WEIGHT_PER_PIECE';
  kgPerPiece: number;
  thicknessMm?: number;
}

export interface CustomProduct extends BaseProduct {
  qtyMethod: 'CUSTOM';
}

export interface SheetProduct extends BaseProduct {
  qtyMethod: 'SHEET_WEIGHT';
  thicknessMm: number;
  coilWidthM: number;
  coverWidthM?: number;
  densityFactor?: number; // default 7.968 kg/m²/mm
  thickness?: number;
  coilWidth?: number;
}

export interface SectionProduct extends BaseProduct {
  qtyMethod: 'SECTION_WEIGHT';
  kgPerMetre: number;
  thicknessMm?: number;
  thickness?: number;
  // Structural steel: shape + dimensions the kg/m was derived from (IS formula)
  steelShape?: SteelShape;
  steelDims?: SteelDims;
  // Length pre-filled on new quotation lines (metres). Default 6 m; chequered plate 2.5 m.
  defaultLengthM?: number;
}

export interface PieceProduct extends BaseProduct {
  qtyMethod: 'PIECE';
  thicknessMm?: number;
  consumesFromProductId?: string;
  consumptionKgPerPiece?: number;
  thickness?: number;
}

export interface OtherProduct extends BaseProduct {
  qtyMethod: 'AREA' | 'RUNNING_LENGTH' | 'LENGTH_FT' | 'MANUAL';
  coilWidthM?: number;
  coverWidthM?: number;
  thicknessMm?: number;
  thickness?: number;
}

export type Product =
  | SqmProduct
  | WeightPerPieceProduct
  | CustomProduct
  | SheetProduct
  | SectionProduct
  | PieceProduct
  | OtherProduct;

export type CreateProductInput =
  | (Omit<SqmProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<WeightPerPieceProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<CustomProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<SheetProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<SectionProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<PieceProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string })
  | (Omit<OtherProduct, 'createdAt' | 'updatedAt' | 'id'> & { id?: string });

export type CalculationMethod = QuantityMethod;

/**
 * Human-readable label formatting for product quantity calculation methods
 * as per CEO review specifications.
 */
export function formatQtyMethodLabel(method: QuantityMethod | string): string {
  switch (method) {
    case 'SQM':
      return 'Square Metre (Sq.Mtr)';
    case 'WEIGHT_PER_PIECE':
      return 'Structural Steel (kg/pc)';
    case 'PIECE':
      return 'Per piece';

    case 'CUSTOM':
      return 'Custom line';
    case 'SHEET_WEIGHT':
      return 'Sheet · by weight';
    case 'SECTION_WEIGHT':
      return 'Steel · by weight';

    case 'AREA':
      return 'By area';
    case 'RUNNING_LENGTH':
      return 'By running metre';
    case 'LENGTH_FT':
      return 'By feet';
    case 'MANUAL':
      return 'Manual (any quantity and unit)';
    default:
      return method;
  }
}
