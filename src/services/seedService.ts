import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CreateProductInput } from '../types/product';
import type { CompanySettings } from '../types/settings';
import { ensureQuotationCounter } from './counterService';
import { getCompanySettings, setCompanySettings } from './settingsService';

/**
 * The official 20 demo catalogue products from the Sprint 1 Brief and demo specification.
 * Every product is explicitly tagged with `isPlaceholder: true`.
 */
export const DEMO_PRODUCTS: CreateProductInput[] = [
  // 1. Crimp Sheets
  {
    id: 'prod_demo_01',
    name: 'JSW C+ CRIMP SHEET 8+1',
    category: 'Crimp',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.47,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 117,
    baseRate: 117,
    minRate: 110,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_02',
    name: 'JSW C+ CRIMP SHEET 10+1',
    category: 'Crimp',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.47,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 119,
    baseRate: 119,
    minRate: 112,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_03',
    name: 'JSW C+ CRIMP SHEET 8+1 (0.50)',
    category: 'Crimp',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.50,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 121,
    baseRate: 121,
    minRate: 115,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  // 2. Colour-Coated Sheets (Colouron+)
  {
    id: 'prod_demo_04',
    name: 'JSW COLOURON + 150 GSM 550 MPA',
    category: 'Coloron',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.47,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 114,
    baseRate: 114,
    minRate: 108,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_05',
    name: 'JSW COLOURON + 120 GSM 550 MPA',
    category: 'Coloron',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.45,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 110,
    baseRate: 110,
    minRate: 105,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_06',
    name: 'JSW COLOURON + 150 GSM (0.50)',
    category: 'Coloron',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.50,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 118,
    baseRate: 118,
    minRate: 112,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  // 3. Plain Sheets
  {
    id: 'prod_demo_07',
    name: 'JSW C+ PLAIN SHEET 40X4',
    category: 'Plain',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.47,
    coilWidthM: 1.06,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 114,
    baseRate: 114,
    minRate: 108,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_08',
    name: 'JSW C+ PLAIN SHEET 8X4',
    category: 'Plain',
    hsn: '72109090',
    qtyMethod: 'SHEET_WEIGHT',
    thicknessMm: 0.47,
    coilWidthM: 1.22,
    densityFactor: 7.968,
    unit: 'Kgs',
    ratePerUnit: 114,
    baseRate: 114,
    minRate: 108,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  // 4. L Sheets / Bends (Sold by Piece)
  {
    id: 'prod_demo_09',
    name: 'JSW C+ L SHEET 12X12 - 8FT',
    category: 'L Sheet',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 655,
    baseRate: 655,
    minRate: 600,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_10',
    name: 'JSW C+ L SHEET 8X8 - 8FT',
    category: 'L Sheet',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 440,
    baseRate: 440,
    minRate: 400,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_11',
    name: 'JSW C+ L SHEET 6X6 - 8FT',
    category: 'L Sheet',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 330,
    baseRate: 330,
    minRate: 300,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  // 5. Ridges & Gutters (Sold by Piece)
  {
    id: 'prod_demo_12',
    name: 'JSW C+ RIDGE 12X12 - 8FT',
    category: 'Ridge',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 690,
    baseRate: 690,
    minRate: 630,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_13',
    name: 'JSW C+ VALLEY GUTTER 24 - 8FT',
    category: 'Ridge',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 980,
    baseRate: 980,
    minRate: 900,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_14',
    name: 'RIDGE FLASHING 18X18 - 8FT',
    category: 'Ridge',
    hsn: '72109090',
    qtyMethod: 'PIECE',
    thicknessMm: 0.47,
    unit: 'Nos',
    ratePerUnit: 760,
    baseRate: 760,
    minRate: 700,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  // 6. Fasteners / Fixing Hardware (Sold by Piece)
  {
    id: 'prod_demo_15',
    name: 'SELF DRILLING SCREW 55MM',
    category: 'Fixing',
    hsn: '73181500',
    qtyMethod: 'PIECE',
    unit: 'Nos',
    ratePerUnit: 6,
    baseRate: 6,
    minRate: 5,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_16',
    name: 'SELF DRILLING SCREW 80MM',
    category: 'Fixing',
    hsn: '73181500',
    qtyMethod: 'PIECE',
    unit: 'Nos',
    ratePerUnit: 9,
    baseRate: 9,
    minRate: 7.5,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  {
    id: 'prod_demo_17',
    name: 'EPDM WASHER',
    category: 'Fixing',
    hsn: '73181500',
    qtyMethod: 'PIECE',
    unit: 'Nos',
    ratePerUnit: 2,
    baseRate: 2,
    minRate: 1.5,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'PIECE',
  },
  // 7. Structural Sections & Pipes (Sold by Weight via SECTION_WEIGHT)
  {
    id: 'prod_demo_18',
    name: 'MS PIPE 40X40 - 2MM',
    category: 'Pipe',
    hsn: '73063090',
    qtyMethod: 'SECTION_WEIGHT',
    thicknessMm: 2.0,
    kgPerMetre: 2.34, // IS 4923 table
    unit: 'Kgs',
    ratePerUnit: 78,
    baseRate: 78,
    minRate: 72,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_19',
    name: 'MS PIPE 50X50 - 2MM',
    category: 'Pipe',
    hsn: '73063090',
    qtyMethod: 'SECTION_WEIGHT',
    thicknessMm: 2.0,
    kgPerMetre: 2.96, // IS 4923 table
    unit: 'Kgs',
    ratePerUnit: 78,
    baseRate: 78,
    minRate: 72,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
  {
    id: 'prod_demo_20',
    name: 'MS C PURLIN 80X40 - 2MM',
    category: 'Pipe',
    hsn: '72169900',
    qtyMethod: 'SECTION_WEIGHT',
    thicknessMm: 2.0,
    kgPerMetre: 3.14,
    unit: 'Kgs',
    ratePerUnit: 74,
    baseRate: 74,
    minRate: 68,
    gstRate: 18,
    active: true,
    isPlaceholder: true,
    stockMethod: 'WEIGHT',
  },
];

export const PLACEHOLDER_COMPANY_SETTINGS: CompanySettings = {
  name: 'RR METAL ROOFING',
  gstin: '33XXXXX0000X1ZX',
  address: 'Bangalore Highway, Senneerkuppam,\nPoonamallee, Chennai - 600 056.',
  phones: ['+91 98840 00000', '+91 72009 00000'],
  email: 'sales@rrmetalroofing.com',
  bankDetails: {
    bankName: 'Tamilnadu Mercantile Bank - Poonamallee',
    accountNumber: '2047001XXXXXXXX',
    ifscCode: 'TMBL0000204',
    branch: 'Poonamallee',
  },
  defaultTerms: [
    'Prices quoted are ex-factory Chennai.',
    'Loading charges included; unloading at site is customer responsibility.',
    'Quotation valid as per standard commercial validity terms.',
    '100% advance payment required before profiling and dispatch.',
  ],
};

export interface SeedResult {
  productsSeeded: number;
  counterInitialized: boolean;
  settingsInitialized: boolean;
}

/**
 * Repeatable, safe, idempotent database seeder.
 * Only seeds demo products, default counter, and company placeholder settings if not already present.
 */
export async function seedDemoDatabase(): Promise<SeedResult> {
  let productsCount = 0;

  // 1. Check existing products
  const productsSnap = await getDocs(collection(db, 'products'));
  const existingProductIds = new Set(productsSnap.docs.map((d) => d.id));

  const batch = writeBatch(db);
  for (const product of DEMO_PRODUCTS) {
    if (product.id && !existingProductIds.has(product.id)) {
      const docRef = doc(db, 'products', product.id);
      batch.set(docRef, {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      productsCount++;
    }
  }

  if (productsCount > 0) {
    await batch.commit();
  }

  // 2. Ensure Quotation Counter
  const counterResult = await ensureQuotationCounter();

  // 3. Ensure Company Settings
  let settingsInitialized = false;
  const existingSettings = await getCompanySettings();
  if (!existingSettings) {
    await setCompanySettings(PLACEHOLDER_COMPANY_SETTINGS);
    settingsInitialized = true;
  }

  return {
    productsSeeded: productsCount,
    counterInitialized: counterResult.initialized,
    settingsInitialized,
  };
}
