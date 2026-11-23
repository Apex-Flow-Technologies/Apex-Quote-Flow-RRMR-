import { createPortal } from 'react-dom';
import React, { useState, useId } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { validateGstin } from '../../engine/gstin';
import type { Customer, CreateCustomerInput } from '../../types/customer';

interface CustomerFormData {
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

const INITIAL_FORM_DATA: CustomerFormData = {
  name: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
};

function formDataFromCustomer(customer: Customer): CustomerFormData {
  return {
    name: customer.name,
    gstin: customer.gstin || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    city: customer.city || '',
    state: customer.state || 'Tamil Nadu',
    pincode: customer.pincode || '',
  };
}

/** Field → message; empty when valid. */
export function validateCustomerForm(formData: { name: string; gstin: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!formData.name.trim()) errors.name = 'Customer name is required';
  const gstinCheck = validateGstin(formData.gstin);
  if (!gstinCheck.valid) errors.gstin = `${gstinCheck.error} Leave blank for unregistered buyers.`;
  return errors;
}

interface CustomerFormModalProps {
  editingCustomer?: Customer | null;
  /** Pre-filled name (e.g. what was typed in the quotation's customer search). */
  initialName?: string;
  /** Shown under the title. */
  subtitle?: string;
  onClose: () => void;
  /** Throw to show the error in the form. */
  onSubmit: (payload: CreateCustomerInput) => Promise<void>;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  editingCustomer = null,
  initialName = '',
  subtitle = 'Customer billing and contact details for quotation issuance',
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<CustomerFormData>(() =>
    editingCustomer ? formDataFromCustomer(editingCustomer) : { ...INITIAL_FORM_DATA, name: initialName }
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fieldIdName = useId();
  const fieldIdGstin = useId();
  const fieldIdPhone = useId();
  const fieldIdEmail = useId();
  const fieldIdAddress = useId();
  const fieldIdCity = useId();
  const fieldIdState = useId();
  const fieldIdPincode = useId();

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const errors = validateCustomerForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      setIsSubmitting(true);
      await onSubmit({
        name: formData.name.trim(),
        gstin: formData.gstin.trim().toUpperCase() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
      });
    } catch (err: unknown) {
      console.error('Error saving customer:', err);
      setFormErrors({ submit: err instanceof Error ? err.message : 'Failed to save customer' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card border border-line shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
              <div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                  {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
                </h3>
                <p className="text-[11px] text-muted">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-ink p-1 rounded-control"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitCustomer} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {formErrors.submit && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-control text-rose-900 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Customer Name */}
              <div>
                <label htmlFor={fieldIdName} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                  Customer / Business Name <span className="text-danger">*</span>
                </label>
                <input
                  id={fieldIdName}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Modern Builders & Fabricators"
                  className={`w-full h-9 py-1.5 px-3 rounded-control border ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                  } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium`}
                />
                {formErrors.name && (
                  <p className="text-danger text-[10px] font-semibold mt-0.5">{formErrors.name}</p>
                )}
              </div>

              {/* GSTIN & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldIdGstin} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    id={fieldIdGstin}
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="33AAAAA0000A1Z5"
                    maxLength={15}
                    className={`w-full h-9 py-1.5 px-3 rounded-control border ${
                      formErrors.gstin ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                    } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-mono tabular-nums text-xs text-ink bg-white font-medium`}
                  />
                  {formErrors.gstin ? (
                    <p className="text-danger text-[10px] font-semibold mt-0.5">{formErrors.gstin}</p>
                  ) : (
                    <p className="text-[10px] text-muted mt-0.5">Leave blank if unregistered.</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdPhone} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    id={fieldIdPhone}
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full h-9 py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor={fieldIdEmail} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  id={fieldIdEmail}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="billing@company.com"
                  className="w-full h-9 py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium"
                />
              </div>

              {/* Billing Address */}
              <div>
                <label htmlFor={fieldIdAddress} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                  Billing Address
                </label>
                <textarea
                  id={fieldIdAddress}
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Door No., Street Name, Industrial Area"
                  className="w-full py-2 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium"
                />
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={fieldIdCity} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    id={fieldIdCity}
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Madurai"
                    className="w-full h-9 py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdState} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    id={fieldIdState}
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Tamil Nadu"
                    className="w-full h-9 py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdPincode} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    Pincode
                  </label>
                  <input
                    id={fieldIdPincode}
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="625001"
                    maxLength={6}
                    className="w-full h-9 py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-xs text-ink bg-white font-medium font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-control border border-line-strong bg-white text-muted hover:text-ink hover:bg-surface-2 font-semibold text-xs shadow-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-control bg-brand hover:bg-brand-dark text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
  // On top of everything (the page header too); plain render where there is no DOM (tests)
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
};
