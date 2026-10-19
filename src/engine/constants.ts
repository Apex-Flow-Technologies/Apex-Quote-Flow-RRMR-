import Decimal from 'decimal.js';

// Exact metric conversion factor: 1 foot = 0.3048 metres (legacy)
export const FT_TO_M = new Decimal('0.3048');

// Sprint 2 client-verified conversion factor: 1 foot = 0.305 metres (defaults to 0.305, not 0.3048)
export const DEFAULT_FEET_TO_METRE = new Decimal('0.305');

// Sprint 2 quotation width factor defaults to 1.08
export const DEFAULT_WIDTH_FACTOR = new Decimal('1.08');

// Coated roofing steel density factor: 7.968 kg/m²/mm
// (7.85 bare steel + zinc/alu-zinc coating + paint system)
export const DEFAULT_DENSITY_FACTOR = new Decimal('7.968');

// Tamil Nadu state GST prefix
export const TAMIL_NADU_STATE_CODE = '33';

// Standard roofing GST rate: 18%
export const DEFAULT_GST_RATE = new Decimal('18');
