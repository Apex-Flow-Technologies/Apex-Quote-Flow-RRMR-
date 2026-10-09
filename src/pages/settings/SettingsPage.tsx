import React, { useState, useEffect, useId } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getCompanySettings,
  setCompanySettings,
} from '../../services/settingsService';
import type { CompanySettings } from '../../types/settings';
import {
  Building2,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  FileText,
  Shield,
  MapPin,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const EMPTY_SETTINGS: CompanySettings = {
  name: 'RR METAL ROOFING',
  gstin: '33AAAAA0000A1Z5',
  address: 'SF No. 123, Industrial Estate, Pollachi Main Road, Coimbatore, Tamil Nadu - 641021',
  phones: ['+91 98422 12345', '+91 98422 67890'],
  email: 'sales@rrmetalroofing.com',
  bankDetails: {
    bankName: 'HDFC Bank',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    branch: 'Coimbatore Main Branch',
  },
  defaultTerms: [
    'Quotation valid for 7 days from the date of issuance.',
    'GST @ 18% extra as applicable on all items.',
    'Transportation and unloading charges extra at actuals.',
    'Delivery within 3-5 working days from order confirmation.',
    '100% advance payment required before profiling and dispatch.',
  ],
};

export const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  // State
  const [settings, setSettings] = useState<CompanySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Unique accessible IDs for form fields
  const fieldIdName = useId();
  const fieldIdGstin = useId();
  const fieldIdEmail = useId();
  const fieldIdAddress = useId();
  const fieldIdBankName = useId();
  const fieldIdAccountNo = useId();
  const fieldIdIfsc = useId();
  const fieldIdBranch = useId();

  // Load settings from Firestore
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanySettings();
      if (data) {
        setSettings({
          name: data.name || '',
          gstin: data.gstin || '',
          address: data.address || '',
          phones: Array.isArray(data.phones) ? data.phones : [],
          email: data.email || '',
          bankDetails: {
            bankName: data.bankDetails?.bankName || '',
            accountNumber: data.bankDetails?.accountNumber || '',
            ifscCode: data.bankDetails?.ifscCode || '',
            branch: data.bankDetails?.branch || '',
          },
          defaultTerms: Array.isArray(data.defaultTerms) ? data.defaultTerms : [],
        });
      } else {
        setSettings(EMPTY_SETTINGS);
      }
    } catch (err: unknown) {
      console.error('Error fetching company settings:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch company settings';
      setError(`Unable to read settings from database: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!settings.name.trim()) {
      errors.name = 'Company name is required';
    }

    if (!settings.gstin.trim()) {
      errors.gstin = 'Company GSTIN is required';
    } else {
      const gstinClean = settings.gstin.trim().toUpperCase();
      if (gstinClean.length !== 15) {
        errors.gstin = 'GSTIN must be 15 alphanumeric characters (e.g. 33AAAAA0000A1Z5)';
      }
    }

    if (!settings.email.trim()) {
      errors.email = 'Company email is required';
    }

    if (!settings.address.trim()) {
      errors.address = 'Company billing address is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save settings to Firestore
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!validateForm()) return;

    try {
      setSaving(true);
      setActionMessage(null);

      const payload: CompanySettings = {
        name: settings.name.trim(),
        gstin: settings.gstin.trim().toUpperCase(),
        address: settings.address.trim(),
        phones: settings.phones.map((p) => p.trim()).filter(Boolean),
        email: settings.email.trim(),
        bankDetails: {
          bankName: settings.bankDetails.bankName.trim(),
          accountNumber: settings.bankDetails.accountNumber.trim(),
          ifscCode: settings.bankDetails.ifscCode.trim().toUpperCase(),
          branch: settings.bankDetails.branch.trim(),
        },
        defaultTerms: settings.defaultTerms.map((t) => t.trim()).filter(Boolean),
      };

      await setCompanySettings(payload);
      setSettings(payload);
      setActionMessage({
        type: 'success',
        text: 'Company master parameters saved successfully.',
      });
    } catch (err: unknown) {
      console.error('Error saving company settings:', err);
      const errMsg = err instanceof Error ? err.message : 'Save failed';
      setActionMessage({
        type: 'error',
        text: `Failed to save company settings: ${errMsg}. Entered changes were preserved.`,
      });
    } finally {
      setSaving(false);
    }
  };

  // Phone number handlers
  const handleAddPhone = () => {
    setSettings((prev) => ({
      ...prev,
      phones: [...prev.phones, ''],
    }));
  };

  const handlePhoneChange = (index: number, value: string) => {
    setSettings((prev) => {
      const updated = [...prev.phones];
      updated[index] = value;
      return { ...prev, phones: updated };
    });
  };

  const handleRemovePhone = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      phones: prev.phones.filter((_, i) => i !== index),
    }));
  };

  // Default terms handlers
  const handleAddTerm = () => {
    setSettings((prev) => ({
      ...prev,
      defaultTerms: [...prev.defaultTerms, ''],
    }));
  };

  const handleTermChange = (index: number, value: string) => {
    setSettings((prev) => {
      const updated = [...prev.defaultTerms];
      updated[index] = value;
      return { ...prev, defaultTerms: updated };
    });
  };

  const handleRemoveTerm = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      defaultTerms: prev.defaultTerms.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-sm border border-slate-300 p-16 text-center shadow-xs">
        <LoadingSpinner label="Loading company configuration from database..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0f2444]" />
            Company Settings &amp; Business Profile
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Legal identity, GSTIN registration, banking coordinates, and standard quotation terms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || saving}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm border border-slate-300 transition"
            title="Reload settings from database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Notice */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-300 p-3 rounded-sm flex items-center gap-2 text-xs text-amber-900">
          <Shield className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Read-Only Access: Company profile, GSTIN configuration, and bank details are restricted to Administrators.
          </span>
        </div>
      )}

      {/* Action Notification */}
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
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-sm text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadSettings}
            className="px-2.5 py-1 bg-rose-700 text-white rounded-sm text-[11px] font-semibold hover:bg-rose-800 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Section 1: Business Identity & Legal Information */}
        <div className="bg-white rounded-sm border border-slate-300 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-100 border-b border-slate-300 flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
            <Building2 className="w-4 h-4 text-[#0f2444]" />
            <span>Business Identity &amp; Tax Information</span>
          </div>

          <div className="p-5 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label htmlFor={fieldIdName} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Company Legal Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id={fieldIdName}
                    type="text"
                    disabled={!isAdmin}
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    placeholder="RR METAL ROOFING"
                    className={`w-full h-9 py-1.5 px-3 rounded-sm border ${
                      formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900 font-medium`}
                  />
                  {formErrors.name && (
                    <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdEmail} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Official Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id={fieldIdEmail}
                    type="email"
                    disabled={!isAdmin}
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="sales@rrmetalroofing.com"
                    className={`w-full h-9 py-1.5 px-3 rounded-sm border ${
                      formErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900`}
                  />
                  {formErrors.email && (
                    <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdAddress} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Official Billing &amp; Yard Address <span className="text-rose-600">*</span></span>
                  </label>
                  <textarea
                    id={fieldIdAddress}
                    rows={3}
                    disabled={!isAdmin}
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    placeholder="SF No. 123, Industrial Estate, Pollachi Main Road, Coimbatore, Tamil Nadu - 641021"
                    className={`w-full py-2 px-3 rounded-sm border ${
                      formErrors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900`}
                  />
                  {formErrors.address && (
                    <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.address}</p>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label htmlFor={fieldIdGstin} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Company GSTIN <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id={fieldIdGstin}
                    type="text"
                    disabled={!isAdmin}
                    maxLength={15}
                    value={settings.gstin}
                    onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                    placeholder="33AAAAA0000A1Z5"
                    className={`w-full h-9 py-1.5 px-3 rounded-sm border font-mono font-semibold ${
                      formErrors.gstin ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900`}
                  />
                  {formErrors.gstin ? (
                    <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.gstin}</p>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      First 2 digits represent State Code (33 = Tamil Nadu), used for automatic Intra/Inter tax classification.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Contact Phone Numbers
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleAddPhone}
                        className="text-[#0f2444] hover:text-blue-800 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Phone
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {settings.phones.map((phone, idx) => (
                      <div key={`phone-${idx}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={phone}
                          onChange={(e) => handlePhoneChange(idx, e.target.value)}
                          placeholder="+91 98422 12345"
                          className="flex-1 h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900 font-mono text-xs"
                        />
                        {isAdmin && settings.phones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhone(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                            title="Remove phone number"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Bank Details */}
        <div className="bg-white rounded-sm border border-slate-300 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-100 border-b border-slate-300 flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
            <CreditCard className="w-4 h-4 text-[#0f2444]" />
            <span>Bank Account Coordinates (Printed on Quotations)</span>
          </div>

          <div className="p-5 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label htmlFor={fieldIdBankName} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Bank Name
                  </label>
                  <input
                    id={fieldIdBankName}
                    type="text"
                    disabled={!isAdmin}
                    value={settings.bankDetails.bankName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankDetails: { ...settings.bankDetails, bankName: e.target.value },
                      })
                    }
                    placeholder="e.g. HDFC Bank / State Bank of India"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdIfsc} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    IFSC Code
                  </label>
                  <input
                    id={fieldIdIfsc}
                    type="text"
                    disabled={!isAdmin}
                    value={settings.bankDetails.ifscCode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankDetails: {
                          ...settings.bankDetails,
                          ifscCode: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    placeholder="HDFC0001234"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 font-mono font-semibold focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label htmlFor={fieldIdAccountNo} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Account Number
                  </label>
                  <input
                    id={fieldIdAccountNo}
                    type="text"
                    disabled={!isAdmin}
                    value={settings.bankDetails.accountNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankDetails: { ...settings.bankDetails, accountNumber: e.target.value },
                      })
                    }
                    placeholder="50200012345678"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 font-mono font-semibold focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdBranch} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Branch Name
                  </label>
                  <input
                    id={fieldIdBranch}
                    type="text"
                    disabled={!isAdmin}
                    value={settings.bankDetails.branch}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankDetails: { ...settings.bankDetails, branch: e.target.value },
                      })
                    }
                    placeholder="Coimbatore Main Branch"
                    className="w-full h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Default Terms & Conditions */}
        <div className="bg-white rounded-sm border border-slate-300 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
              <FileText className="w-4 h-4 text-[#0f2444]" />
              <span>Standard Quotation Terms &amp; Conditions</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleAddTerm}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#0f2444] hover:text-blue-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Term Line
              </button>
            )}
          </div>

          <div className="p-5 space-y-3 text-xs">
            <p className="text-slate-500 text-[11px]">
              Standard commercial terms automatically attached to generated quotation documents.
            </p>

            {settings.defaultTerms.map((term, idx) => (
              <div key={`term-${idx}`} className="flex items-center gap-2">
                <span className="w-7 text-right font-mono text-slate-500 text-xs shrink-0 font-semibold">
                  {String(idx + 1).padStart(2, '0')}.
                </span>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={term}
                  onChange={(e) => handleTermChange(idx, e.target.value)}
                  placeholder="Enter condition or terms..."
                  className="flex-1 h-9 py-1.5 px-3 rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] disabled:bg-slate-100 text-slate-900"
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-sm border border-transparent hover:border-slate-200 transition shrink-0"
                    title="Remove this term"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={loadSettings}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm transition"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#0f2444] hover:bg-[#16335d] text-white rounded-sm text-xs font-bold shadow-xs transition disabled:opacity-60"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Company Master</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
