import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CustomerFormModal, validateCustomerForm } from '../components/customers/CustomerFormModal';
import type { Customer } from '../types/customer';

const noop = vi.fn(async () => {});

describe('CustomerFormModal', () => {
  it('new customer from a quotation keeps the typed name', () => {
    const html = renderToString(<CustomerFormModal initialName="Sri Murugan Traders" onClose={() => {}} onSubmit={noop} />);
    expect(html).toContain('Add New Customer');
    expect(html).toContain('value="Sri Murugan Traders"');
    expect(html).toContain('Save Customer');
  });

  it('edit fills the existing details', () => {
    const c = { id: 'c1', name: 'ABC Builders', gstin: '33AAAAA0000A1Z5', city: 'Madurai' } as Customer;
    const html = renderToString(<CustomerFormModal editingCustomer={c} onClose={() => {}} onSubmit={noop} />);
    expect(html).toContain('Edit Customer: ABC Builders');
    expect(html).toContain('value="Madurai"');
    expect(html).toContain('Update Customer');
  });

  it('needs a name; GSTIN may be blank but not wrong', () => {
    expect(validateCustomerForm({ name: '', gstin: '' }).name).toBeTruthy();
    expect(validateCustomerForm({ name: 'X', gstin: '' })).toEqual({});
    expect(validateCustomerForm({ name: 'X', gstin: '33ABC' }).gstin).toBeTruthy();
  });
});
