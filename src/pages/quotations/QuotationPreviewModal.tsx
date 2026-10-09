import React from 'react';
import type { Quotation } from '../../types/quotation';
import { formatRoundOff } from '../../engine';
import { QuotationPdfActions } from './QuotationPdfActions';
import {
  FileText,
  X,
  Building2,
  User,
  CreditCard,
  FileCheck2,
  Calendar,
} from 'lucide-react';

interface QuotationPreviewModalProps {
  quotation: Quotation;
  onClose: () => void;
}

export const QuotationPreviewModal: React.FC<QuotationPreviewModalProps> = ({
  quotation,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-sm shadow-2xl border border-slate-300 max-w-5xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Top Bar */}
        <div className="p-3.5 bg-[#0f2444] text-white flex items-center justify-between border-b border-[#0c1e38]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            <div>
              <div className="font-bold text-sm tracking-wide flex items-center gap-2">
                <span className="font-mono">{quotation.quotationNumber}</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-none bg-blue-900 text-sky-200 border border-sky-400/40">
                  {quotation.taxMode === 'intra' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                Created by {quotation.createdByName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-sm transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quotation Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs max-h-[80vh]">
          {/* Header Grid: Company & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
            {/* Company Block */}
            <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm mb-1">
                <Building2 className="w-4 h-4 text-[#0f2444] shrink-0" />
                <span>{quotation.company?.name || '—'}</span>
              </div>
              <div className="space-y-0.5 text-slate-600 text-[11px]">
                <p>
                  <span className="font-bold text-slate-700">GSTIN:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {quotation.company?.gstin || '—'}
                  </span>
                </p>
                <p>{quotation.company?.address}</p>
                {quotation.company?.email && <p>Email: {quotation.company.email}</p>}
                {quotation.company?.phones && quotation.company.phones.length > 0 && (
                  <p>Phone: {quotation.company.phones.join(', ')}</p>
                )}
              </div>
            </div>

            {/* Customer & Quote Meta Block */}
            <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                  <User className="w-4 h-4 text-[#0f2444] shrink-0" />
                  <span>{quotation.customer.name}</span>
                </div>
                {quotation.quotationDate && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{quotation.quotationDate}</span>
                  </div>
                )}
              </div>
              <div className="space-y-0.5 text-slate-600 text-[11px]">
                <p>
                  <span className="font-bold text-slate-700">GSTIN:</span>{' '}
                  {quotation.customer.gstin ? (
                    <span className="font-mono font-bold text-slate-900">
                      {quotation.customer.gstin}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Unregistered Buyer</span>
                  )}
                </p>
                {quotation.customer.phone && <p>Phone: {quotation.customer.phone}</p>}
                {quotation.customer.address && <p>Address: {quotation.customer.address}</p>}
              </div>
            </div>
          </div>

          {/* Quotation Lines Table */}
          <div className="border border-slate-300 rounded-sm overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">HSN</th>
                    <th className="py-2.5 px-3 text-center">Nos</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right" title="Line taxable amount plus individual rounded GST">Est. Total (₹)*</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.lines.map((line, index) => {
                    const snap = line.snapshot;
                    return (
                      <tr key={line.id || index} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{line.productName}</div>
                          <div className="text-[11px] text-slate-500">
                            {snap.qtyMethod === 'SHEET_WEIGHT' && (
                              <span>
                                {line.lengthFeet}&apos;{line.lengthInches || 0}&quot; &bull;{' '}
                                {snap.thicknessMm}mm &bull; {snap.coilWidthM}m coil
                              </span>
                            )}
                            {snap.qtyMethod === 'SECTION_WEIGHT' && (
                              <span>
                                {line.lengthFeet !== undefined && line.lengthFeet !== null
                                  ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
                                  : `${line.lengthM}m`}{' '}
                                &bull; {snap.kgPerMetre} kg/m
                              </span>
                            )}
                            {snap.qtyMethod === 'PIECE' && <span>Piece Rate</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {line.hsn}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {line.nos}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {Number(line.quantity).toFixed(2)} {line.unit}
                          {line.isManualQuantity && (
                            <span className="block text-[9px] uppercase font-bold text-amber-700">
                              (Manual)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₹{Number(line.rate).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          ₹{Number(line.taxableAmount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {line.gstRate}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(line.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 italic">
                * Note: Line item totals reflect individual half-up GST rounding. Official document GST, Grand Total, and Round-Off are calculated on aggregate taxable turnover per HSN group as mandated by GST statutory rules.
              </div>
            </div>
          </div>

          {/* Totals & Tax Summary Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Totals & HSN Tax Summary */}
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-sm border border-slate-300">
                <div className="font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
                  Physical Quantity Summary
                </div>
                <div className="flex items-center gap-5 text-xs font-bold text-slate-800">
                  <div>
                    Total Weight:{' '}
                    <span className="text-[#0f2444] font-mono font-bold">
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </span>
                  </div>
                  <div>
                    Total Pieces:{' '}
                    <span className="text-[#0f2444] font-mono font-bold">
                      {Number(quotation.totalNos)} Nos
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount in Words */}
              <div className="bg-slate-50 p-3 rounded-sm border border-slate-300">
                <div className="text-[10px] uppercase font-bold text-slate-700 tracking-wider mb-0.5">
                  Amount in Words
                </div>
                <div className="text-xs font-bold text-slate-900 italic">
                  {quotation.amountInWords}
                </div>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-xs overflow-hidden text-xs">
              <div className="p-3.5 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Taxable Value):</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{Number(quotation.subtotal).toFixed(2)}
                  </span>
                </div>

                {quotation.taxMode === 'intra' ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{Number(quotation.cgstTotal).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{Number(quotation.sgstTotal).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      ₹{Number(quotation.igstTotal).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2">
                  <span>Total with Tax:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{Number(quotation.grandTotal).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Round-off:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatRoundOff(quotation.roundOff)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold bg-[#0f2444] text-white p-3.5">
                <span className="uppercase tracking-wide">Final Payable Amount:</span>
                <span className="text-base font-mono text-amber-300 font-bold">
                  ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Bank Details & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-[11px]">
            {/* Bank details */}
            {quotation.company?.bankDetails && (
              <div className="space-y-1 bg-slate-50 p-3 rounded-sm border border-slate-300">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                  <span>Bank Account Details</span>
                </div>
                <p className="text-slate-600">
                  Bank: <strong className="text-slate-900">{quotation.company.bankDetails.bankName}</strong>
                  <br />
                  A/C No:{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {quotation.company.bankDetails.accountNumber}
                  </span>
                  <br />
                  IFSC:{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {quotation.company.bankDetails.ifscCode}
                  </span>{' '}
                  &bull; Branch: {quotation.company.bankDetails.branch}
                </p>
              </div>
            )}

            {/* Terms */}
            {quotation.terms && quotation.terms.length > 0 && (
              <div className="space-y-1 bg-slate-50 p-3 rounded-sm border border-slate-300">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <FileCheck2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Terms &amp; Conditions</span>
                </div>
                <ol className="list-decimal pl-4 text-slate-600 space-y-0.5">
                  {quotation.terms.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <QuotationPdfActions quotation={quotation} variant="modal" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-sm text-xs font-semibold transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
