import { describe, it, expect } from 'vitest';
import { searchProducts } from '../components/quotations/productSearch';
import { buildSteelCatalogue } from '../data/steelCatalogue';
import type { Product } from '../types/product';

const products = [
  ...(buildSteelCatalogue() as unknown as Product[]),
  { id: 'c', name: 'JSW C+ CRIMP SHEET 10+1', category: 'Crimp', hsn: '72109090' } as Product,
];
const names = (q: string) => searchProducts(products, q).map((p) => p.name);

describe('Product search', () => {
  it('any word order, × / x / spaces all work', () => {
    expect(names('square 60 3.2')).toEqual(['MS Square Pipe 60 × 60 × 3.2 mm']);
    expect(names('60x60x3.2')).toContain('MS Square Pipe 60 × 60 × 3.2 mm');
    expect(names('angle 50x6')).toEqual(['MS Angle 50 × 50 × 6 mm']);
  });
  it('numbers match whole sizes only', () => {
    expect(names('round bar 12')).toEqual(['MS Round Bar 12 mm']);
    expect(names('ismc 100')).toEqual(['MS Channel ISMC 100 × 50', 'MS Channel ISMC 350 × 100', 'MS Channel ISMC 400 × 100']);
  });
  it('text and HSN prefix', () => {
    expect(names('crimp')).toEqual(['JSW C+ CRIMP SHEET 10+1']);
    expect(names('7210').length).toBe(1);
    expect(names('7306').length).toBe(25); // capped
  });
});
