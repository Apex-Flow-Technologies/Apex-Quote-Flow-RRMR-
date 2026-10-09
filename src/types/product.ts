export type QuantityMethod =
  | 'SHEET_WEIGHT'
  | 'SECTION_WEIGHT'
  | 'PIECE'
  | 'AREA'
  | 'RUNNING_LENGTH'
  | 'LENGTH_FT'
  | 'MANUAL';

export type ProductUnit = 'Kgs' | 'Nos' | 'Sq.Mtr' | 'R.Mtr' | 'Ft';

export type StockMethod = 'WEIGHT' | 'PIECE' | 'NONE';

export interface BaseProduct {
  id: string;
  name: string;
  category: string; // e.g. "Crimp", "Coloron", "Plain", "L Sheet", "Ridge", "Fixing", "Pipe"
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
  createdAt?: string | number | Record<string, unknown>;
  updatedAt?: string | number | Record<string, unknown>;
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
  coverWidthM?: number;
  thicknessMm?: number;
  thickness?: number;
}

export type Product = SheetProduct | SectionProduct | PieceProduct | OtherProduct;

export type CreateProductInput =
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
    case 'SHEET_WEIGHT':
      return 'Sheet · by weight';
    case 'SECTION_WEIGHT':
      return 'Pipe · by weight';
    case 'PIECE':
      return 'Per piece';
    case 'AREA':
      return 'By area';
    case 'RUNNING_LENGTH':
      return 'By running metre';
    case 'LENGTH_FT':
      return 'By feet';
    case 'MANUAL':
      return 'Manual';
    default:
      return method;
  }
}
