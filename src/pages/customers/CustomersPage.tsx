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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0f2444]" />
            Customer Master Directory
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage customer accounts, GSTIN tax classifications, and billing coordinates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] hover:bg-[#16335d] text-white rounded-sm text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>

          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm border border-slate-300 transition"
            title="Refresh customer list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div
          className={`p-3 rounded-sm flex items-center justify-between text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
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
            className="text-slate-400 hover:text-slate-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-sm border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, GSTIN, phone or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-slate-900 bg-white"
          />
        </div>

        <div className="text-xs text-slate-600 font-medium">
          Total Customers: <strong className="text-slate-900 font-bold">{customers.length}</strong>
        </div>
      </div>

      {/* Main Table / Content */}
      {loading ? (
        <div className="bg-white rounded-sm border border-slate-300 p-16 text-center shadow-xs">
          <LoadingSpinner label="Loading customer directory..." size="md" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-sm border border-rose-300 p-8 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">Failed to Load Customers</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-3">{error}</p>
          <button
            type="button"
            onClick={fetchCustomers}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] text-white rounded-sm text-xs font-semibold hover:bg-[#16335d] transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-sm border border-dashed border-slate-300 p-12 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {customers.length === 0 ? 'No customers added yet' : 'No customers found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {customers.length === 0
              ? 'Add your first customer to begin generating quotations.'
              : 'No customers matched your search query. Try clearing the search box.'}
          </p>
          {customers.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] text-white rounded-sm text-xs font-bold hover:bg-[#16335d] shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-slate-300 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Customer Name</th>
                  <th className="py-2.5 px-3.5">GSTIN</th>
                  <th className="py-2.5 px-3.5">Phone</th>
                  <th className="py-2.5 px-3.5">Location / Address</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCustomers.map((customer) => {
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/70 transition">
                      {/* Name */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-slate-900">{customer.name}</div>
                        {customer.email && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </td>

                      {/* GSTIN */}
                      <td className="py-2.5 px-3.5 font-mono">
                        {customer.gstin ? (
                          <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-none border border-slate-300">
                            {customer.gstin}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Unregistered Buyer</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                        {customer.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="py-2.5 px-3.5 text-slate-600 max-w-xs truncate">
                        {customer.address || customer.city || customer.state ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {[customer.address, customer.city, customer.state, customer.pincode]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(customer)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-[#0f2444] hover:bg-slate-100 rounded-sm text-xs font-semibold border border-slate-300 shadow-xs transition"
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

          <div className="bg-slate-50 px-3.5 py-2 border-t border-slate-300 flex items-center justify-between text-xs text-slate-600 font-medium">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-sm border border-slate-300 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-300 flex items-center justify-between bg-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
                </h3>
                <p className="text-[11px] text-slate-600">
                  Customer billing and contact details for quotation issuance
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitCustomer} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {formErrors.submit && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-sm text-rose-800 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Customer Name */}
              <div>
                <label htmlFor={fieldIdName} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Customer / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id={fieldIdName}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Modern Builders & Fabricators"
                  className={`w-full h-9 py-1.5 px-3 rounded-sm border ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  } focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white`}
                />
                {formErrors.name && (
                  <p className="text-rose-600 text-[10px] font-semibold mt-0.5">{formErrors.name}</p>
                )}
              </div>

              {/* GSTIN & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldIdGstin} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    GSTIN
                  </label>
                  <input
                    id={fieldIdGstin}
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="33AAAAA0000A1Z5"
                    maxLength={15}
                    className={`w-full h-9 py-1.5 px-3 rounded-sm border ${
                      formErrors.gstin ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } focus:outline-none focus:border-[#0f2444] font-mono text-xs text-slate-900 bg-white`}
                  />
                  {formErrors.gstin ? (
                    <p className="text-rose-600 text-[10px] font-semibold mt-0.5">{formErrors.gstin}</p>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-0.5">Leave blank if unregistered.</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdPhone} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Phone Number
                  </label>
                  <input
                    id={fieldIdPhone}
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor={fieldIdEmail} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Email Address
                </label>
                <input
                  id={fieldIdEmail}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="billing@company.com"
                  className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                />
              </div>

              {/* Billing Address */}
              <div>
                <label htmlFor={fieldIdAddress} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Billing Address
                </label>
                <textarea
                  id={fieldIdAddress}
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Door No., Street Name, Industrial Area"
                  className="w-full py-2 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                />
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={fieldIdCity} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    City
                  </label>
                  <input
                    id={fieldIdCity}
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Madurai"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdState} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    State
                  </label>
                  <input
                    id={fieldIdState}
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Tamil Nadu"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdPincode} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Pincode
                  </label>
                  <input
                    id={fieldIdPincode}
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="625001"
                    maxLength={6}
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-slate-300 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-sm bg-[#0f2444] hover:bg-[#16335d] text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
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
