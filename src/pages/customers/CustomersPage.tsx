import { validateGstin } from '../../engine/gstin';
import React, { useState, useEffect, useMemo } from 'react';
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
import { CustomerFormModal } from '../../components/customers/CustomerFormModal';

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
    setIsModalOpen(true);
  };

  // Open modal for editing an existing customer
  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  // Save (errors are shown inside the form)
  const handleSaveCustomer = async (customerPayload: CreateCustomerInput) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, customerPayload);
      setActionMessage({ type: 'success', text: `Customer "${customerPayload.name}" updated successfully.` });
    } else {
      await createCustomer(customerPayload);
      setActionMessage({ type: 'success', text: `Customer "${customerPayload.name}" registered successfully.` });
    }
    setIsModalOpen(false);
    await fetchCustomers();
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
          {/* Phone: customer cards (tap to call, edit) */}
          <ul className="md:hidden divide-y divide-line">
            {filteredCustomers.map((customer) => {
              const gst = validateGstin(customer.gstin);
              return (
                <li key={customer.id} className="p-4 flex gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-brand-soft text-brand font-bold flex items-center justify-center">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink text-sm leading-snug break-words">{customer.name}</div>
                    <div className="text-[11px] font-mono mt-0.5">
                      {customer.gstin ? (
                        <span className={gst.valid ? 'text-muted' : 'text-danger'}>
                          {customer.gstin}
                          {!gst.valid && ' · check GSTIN'}
                        </span>
                      ) : (
                        <span className="text-faint italic font-sans">Unregistered buyer</span>
                      )}
                    </div>
                    {(customer.address || customer.city) && (
                      <div className="text-[11px] text-muted mt-0.5 line-clamp-2">
                        {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2.5">
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-control border border-line-strong text-xs font-semibold text-ink"
                        >
                          <Phone className="w-3.5 h-3.5 text-brand" /> {customer.phone}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(customer)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-control border border-line-strong text-xs font-semibold text-ink"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-brand" /> Edit
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
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
        <CustomerFormModal
          editingCustomer={editingCustomer}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSaveCustomer}
        />
      )}
    </div>
  );
};
