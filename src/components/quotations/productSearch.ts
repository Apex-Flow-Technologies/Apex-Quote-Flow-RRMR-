import type { Product } from '../../types/product';

const norm = (s: string) =>
  s.toLowerCase().replace(/[×*]/g, 'x').replace(/(\d)\s*x\s*(?=\d)/g, '$1 ');
const isNum = (t: string) => /^\d+(\.\d+)?$/.test(t);

/**
 * Product search for the quotation line picker.
 * Every word must match, in any order: "square 60 3.2", "angle 50x6", "ismc 100", "crimp".
 * Numbers match whole sizes only ("12" ≠ "125", "4" = "4.0"); 4+ digit numbers also match HSN prefixes.
 */
export function searchProducts(products: Product[], query: string, limit = 25): Product[] {
  if (!query.trim()) return products.slice(0, 15);
  const tokens = norm(query).split(/[\s,]+/).filter(Boolean);
  return products
    .filter((p) => {
      const text = `${norm(p.name)} ${norm(p.category)}`;
      const words = text.split(/[\s()]+/).filter(Boolean);
      return tokens.every((t) => {
        if (t.length >= 4 && /^\d+$/.test(t) && p.hsn.startsWith(t)) return true;
        return isNum(t) ? words.some((w) => w === t || Number(w) === Number(t)) : text.includes(t);
      });
    })
    .slice(0, limit);
}
