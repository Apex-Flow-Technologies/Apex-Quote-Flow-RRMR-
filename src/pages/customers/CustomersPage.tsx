import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
} from '../../services/customerService';
import type { Customer, CreateCustomerInput } from '../../types/customer';
import {
  Users,
  Plus,
  Search,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

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

export const CustomersPage: React.FC = () => {
  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Accessible IDs for modal fields
  const fieldIdName = useId();
  const fieldIdGstin = useId();
  const fieldIdPhone = useId();
  const fieldIdEmail = useId();
  const fieldIdAddress = useId();
  const fieldIdCity = useId();
  const fieldIdState = useId();
  const fieldIdPincode = useId();

  // Fetch customers from Firestore
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      data.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(data);
    } catch (err: unknown) {
      console.error('Error fetching customers:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch customers';
      setError(`Unable to load customers from Firestore: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesGstin = c.gstin ? c.gstin.toLowerCase().includes(q) : false;
      const matchesPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
      const matchesCity = c.city ? c.city.toLowerCase().includes(q) : false;
      return matchesName || matchesGstin || matchesPhone || matchesCity;
    });
  }, [customers, searchQuery]);

  // Open modal for creating a new customer
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData(INITIAL_FORM_DATA);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing an existing customer
  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      gstin: customer.gstin || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || 'Tamil Nadu',
      pincode: customer.pincode || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Customer name is required';
    }

    if (formData.gstin.trim()) {
      const gstinVal = formData.gstin.trim().toUpperCase();
      if (gstinVal.length > 0 && gstinVal.length !== 15) {
        errors.gstin = 'GSTIN must be 15 characters (e.g. 33AAAAA0000A1Z5) or left blank';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit customer form
  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setFormErrors({});

      const customerPayload: CreateCustomerInput = {
        name: formData.name.trim(),
        gstin: formData.gstin.trim().toUpperCase() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerPayload);
        setActionMessage({
          type: 'success',
          text: `Customer "${formData.name}" updated successfully.`,
        });
      } else {
        await createCustomer(customerPayload);
        setActionMessage({
          type: 'success',
          text: `Customer "${formData.name}" registered successfully.`,
        });
      }

      setIsModalOpen(false);
      await fetchCustomers();
    } catch (err: unknown) {
      console.error('Error saving customer:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to save customer';
      setFormErrors({ submit: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Users className="w-5 h-5 text-brand" />
            Customer Master Directory
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage customer accounts, GSTIN tax classifications, and billing coordinates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>

          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition"
            title="Refresh customer list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div
          className={`p-3 rounded-control flex items-center justify-between text-xs font-medium border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-muted hover:text-ink p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-card border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, GSTIN, phone or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white font-medium"
          />
        </div>

        <div className="text-xs text-muted font-medium">
          Total Customers: <strong className="text-ink font-mono tabular-nums font-semibold">{customers.length}</strong>
        </div>
      </div>

      {/* Main Table / Content */}
      {loading ? (
        <div className="bg-white rounded-card border border-line p-16 text-center shadow-xs">
          <LoadingSpinner label="Loading customer directory..." size="md" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-card border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">Failed to Load Customers</h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-3">{error}</p>
          <button
            type="button"
            onClick={fetchCustomers}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white rounded-control text-xs font-semibold hover:bg-brand-dark transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-card border border-dashed border-line-strong p-12 text-center">
          <Users className="w-8 h-8 text-faint mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">
            {customers.length === 0 ? 'No customers added yet' : 'No customers found'}
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            {customers.length === 0
              ? 'Add your first customer to begin generating quotations.'
              : 'No customers matched your search query. Try clearing the search box.'}
          </p>
          {customers.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white rounded-control text-xs font-bold hover:bg-brand-dark shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-card border border-line shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2 border-b border-line text-faint font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Customer Name</th>
                  <th className="py-2.5 px-3.5">GSTIN</th>
                  <th className="py-2.5 px-3.5">Phone</th>
                  <th className="py-2.5 px-3.5">Location / Address</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCustomers.map((customer) => {
                  return (
                    <tr key={customer.id} className="hover:bg-brand-tint/40 transition">
                      {/* Name */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-ink">{customer.name}</div>
                        {customer.email && (
                          <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-faint" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </td>

                      {/* GSTIN */}
                      <td className="py-2.5 px-3.5 font-mono tabular-nums">
                        {customer.gstin ? (
                          <span className="font-semibold text-ink bg-surface-2 px-2 py-0.5 rounded-control border border-line">
                            {customer.gstin}
                          </span>
                        ) : (
                          <span className="text-faint text-[11px] italic">Unregistered Buyer</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3.5 text-muted font-medium font-mono tabular-nums">
                        {customer.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-faint" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-faint">&mdash;</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="py-2.5 px-3.5 text-muted max-w-xs truncate">
                        {customer.address || customer.city || customer.state ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-faint shrink-0" />
                            <span className="truncate">
                              {[customer.address, customer.city, customer.state, customer.pincode]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-faint">&mdash;</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(customer)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-muted hover:text-brand hover:bg-brand-soft rounded-control text-xs font-semibold border border-line shadow-xs transition"
                          title="Edit customer details"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-surface-2 px-4 py-2.5 border-t border-line flex items-center justify-between text-xs text-muted font-medium">
            <span>
              Showing {filteredCustomers.length} of {customers.length} customers
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT CUSTOMER MODAL (ERP Form Style)
         ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card border border-line shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
              <div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                  {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
                </h3>
                <p className="text-[11px] text-muted">
                  Customer billing and contact details for quotation issuance
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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
                  onClick={() => setIsModalOpen(false)}
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
      )}
    </div>
  );
};
