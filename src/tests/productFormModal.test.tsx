import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ProductFormModal } from '../components/products/ProductFormModal';
import type { Product } from '../types/product';

const noop = vi.fn(async () => {});

const steel = {
  id: 'p1',
  name: 'MS Square Pipe',
  category: 'Pipe',
  hsn: '73066100',
  qtyMethod: 'SECTION_WEIGHT',
  unit: 'Kgs',
  kgPerMetre: 3.6,
  steelShape: 'SQUARE_PIPE',
  steelDims: { sideMm: 40, thicknessMm: 3 },
  defaultLengthM: 6,
  ratePerUnit: 62,
  gstRate: 18,
  active: true,
} as unknown as Product;

describe('ProductFormModal renders in every mode', () => {
  it('Products page: add', () => {
    const html = renderToString(<ProductFormModal mode="master" onClose={() => {}} onSubmit={noop} />);
    expect(html).toContain('Add New Product Master');
    expect(html).toContain('Create Product Master');
    expect(html).toContain('By running metre');
    expect(html).toContain('Base Rate');
  });

  it('Products page: edit a steel product with a shape', () => {
    const html = renderToString(<ProductFormModal mode="master" editingProduct={steel} onClose={() => {}} onSubmit={noop} />);
    expect(html).toContain('Edit Product: MS Square Pipe');
    expect(html).toContain('Steel / Section Weight Parameters');
    expect(html).toContain('Save Changes');
  });

  it('quotation: custom item', () => {
    const html = renderToString(
      <ProductFormModal mode="quote" initialName="Gutter" canSaveToMaster onClose={() => {}} onSubmit={noop} />
    );
    expect(html).toContain('Add Custom Item');
    expect(html).toContain('value="Gutter"');
    expect(html).toContain('Add to Quotation');
    expect(html).toContain('Also save to Products');
    // Same options as Add Product
    expect(html).toContain('By running metre');
    expect(html).toContain('Sheet · by weight');
    expect(html).toContain('Base Rate');
    expect(html).not.toContain('Active Product');
  });

  it('quotation: sales staff do not get "save to Products"', () => {
    const html = renderToString(<ProductFormModal mode="quote" onClose={() => {}} onSubmit={noop} />);
    expect(html).not.toContain('Also save to Products');
  });
});
