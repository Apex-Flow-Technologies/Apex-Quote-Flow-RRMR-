/**
 * GSTIN validation (15 chars): 2-digit state code + PAN (5 letters, 4 digits, 1 letter)
 * + entity number + 'Z' + checksum character (base-36 mod-36 algorithm used by GSTN).
 */

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Valid Indian GST state / UT codes (01–38 plus 97 Other Territory, 99 Centre Jurisdiction). */
const VALID_STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
]);

export function gstinChecksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export interface GstinCheck {
  valid: boolean;
  error?: string;
  stateCode?: string;
}

/** Returns { valid: true } for a blank value (GSTIN is optional for unregistered buyers). */
export function validateGstin(raw: string | undefined | null): GstinCheck {
  const g = (raw || '').trim().toUpperCase();
  if (!g) return { valid: true };
  if (g.length !== 15) return { valid: false, error: `GSTIN must be 15 characters (got ${g.length}).` };
  if (!/^[0-9]{2}/.test(g)) return { valid: false, error: 'GSTIN must start with the 2-digit state code (e.g. 33 for Tamil Nadu).' };
  if (!VALID_STATE_CODES.has(g.slice(0, 2))) return { valid: false, error: `"${g.slice(0, 2)}" is not a valid GST state code.` };
  if (!GSTIN_PATTERN.test(g)) {
    return { valid: false, error: 'GSTIN format looks wrong: state code + PAN (ABCDE1234F) + entity number + Z + check digit.' };
  }
  if (gstinChecksumChar(g.slice(0, 14)) !== g[14]) {
    return { valid: false, error: 'GSTIN check digit does not match — please re-check for a typo.' };
  }
  return { valid: true, stateCode: g.slice(0, 2) };
}
