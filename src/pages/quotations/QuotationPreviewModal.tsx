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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-card shadow-lg border border-line-strong max-w-5xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Top Bar */}
        <div className="p-4 bg-white text-ink flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-brand-soft text-brand flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight flex items-center gap-2 text-ink">
                <span className="font-mono tabular-nums">{quotation.quotationNumber}</span>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
                  {quotation.taxMode === 'intra' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                </span>
              </div>
              <div className="text-[11px] text-muted">
                Created by {quotation.createdByName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quotation Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs max-h-[80vh]">
          {/* Header Grid: Company & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-line">
            {/* Company Block */}
            <div className="bg-surface-2 p-4 rounded-control border border-line-strong">
              <div className="flex items-center gap-1.5 font-bold text-ink text-sm mb-1.5">
                <Building2 className="w-4 h-4 text-brand shrink-0" />
                <span>{quotation.company?.name || '—'}</span>
              </div>
              <div className="space-y-0.5 text-muted text-[11px]">
                <p>
                  <span className="font-semibold text-ink">GSTIN:</span>{' '}
                  <span className="font-mono font-medium text-ink">
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
            <div className="bg-surface-2 p-4 rounded-control border border-line-strong">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-ink text-sm">
                  <User className="w-4 h-4 text-brand shrink-0" />
                  <span>{quotation.customer.name}</span>
                </div>
                {quotation.quotationDate && (
                  <div className="flex items-center gap-1 text-[11px] text-muted font-medium font-mono tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-faint" />
                    <span>{quotation.quotationDate}</span>
                  </div>
                )}
              </div>
              <div className="space-y-0.5 text-muted text-[11px]">
                <p>
                  <span className="font-semibold text-ink">GSTIN:</span>{' '}
                  {quotation.customer.gstin ? (
                    <span className="font-mono font-medium text-ink">
                      {quotation.customer.gstin}
                    </span>
                  ) : (
                    <span className="text-faint italic">Unregistered Buyer</span>
                  )}
                </p>
                {quotation.customer.phone && <p>Phone: {quotation.customer.phone}</p>}
                {quotation.customer.address && <p>Address: {quotation.customer.address}</p>}
              </div>
            </div>
          </div>

          {/* Quotation Lines Table */}
          <div className="border border-line-strong rounded-control overflow-hidden shadow-xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-2 border-b border-line text-faint font-semibold text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">HSN</th>
                    <th className="py-2.5 px-3 text-center">Nos</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">Amount before GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quotation.lines.map((line, idx) => (
                    <tr key={line.id || idx} className="hover:bg-surface-2/60 transition">
                      <td className="py-2.5 px-3 text-center font-mono text-muted">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-ink">{line.productName}</div>
                        <div className="text-[11px] text-muted">
                          {line.snapshot.qtyMethod === 'SHEET_WEIGHT' && (
                            <span>
                              Thick: {line.snapshot.thicknessMm}mm &bull; Coil: {line.snapshot.coilWidthM}m
                            </span>
                          )}
                          {line.snapshot.qtyMethod === 'SECTION_WEIGHT' && (
                            <span>Section: {line.snapshot.kgPerMetre} kg/m</span>
                          )}
                          {line.snapshot.qtyMethod === 'PIECE' && <span>Per piece</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted text-[11px]">
                        {line.hsn}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-ink">
                        {line.nos ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-ink">
                        {Number(line.quantity).toFixed(2)} {line.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted">
                        ₹{Number(line.rate).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted">
                        {line.gstRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                        ₹{Number(line.taxableAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quantities, Amount in Words & Totals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Quantities & Amount in Words */}
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-control border border-line-strong shadow-xs">
                <div className="font-bold text-muted text-[10.5px] uppercase tracking-wider mb-2.5">
                  Quantity
                </div>
                <div className={`grid ${quotation.totalNos != null && quotation.totalNos > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs`}>
                  <div className="p-3 bg-surface-2 rounded-control border border-line-strong">
                    <span className="text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Weight</span>
                    <span className="text-base font-mono tabular-nums font-bold text-ink">
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </span>
                  </div>
                  {quotation.totalNos != null && quotation.totalNos > 0 && (
                    <div className="p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Qty in Nos</span>
                      <span className="text-base font-mono tabular-nums font-bold text-ink">
                        {quotation.totalNos} Nos
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount in words (pale-blue box with blue left border) */}
              <div className="bg-brand-soft border-l-4 border-l-brand border border-line-strong p-3.5 rounded-control">
                <div className="text-[10.5px] uppercase font-bold text-faint tracking-wider mb-1">
                  Amount in Words
                </div>
                <div className="text-xs font-semibold text-ink italic leading-relaxed">
                  {quotation.amountInWords}
                </div>
              </div>
            </div>

            {/* Financial Summary Card (White card, clean label/value rows, grand total bold blue) */}
            <div className="bg-white border border-line-strong rounded-control shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal (Taxable Value):</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">
                    ₹{Number(quotation.subtotal).toFixed(2)}
                  </span>
                </div>

                {quotation.taxMode === 'intra' ? (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>CGST (Central Tax):</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">
                        ₹{Number(quotation.cgstTotal).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>SGST (State Tax):</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">
                        ₹{Number(quotation.sgstTotal).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted">
                    <span>IGST (Integrated Tax):</span>
                    <span className="font-mono tabular-nums font-semibold text-ink">
                      ₹{Number(quotation.igstTotal).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-muted border-t border-line pt-2">
                  <span>Total with Tax:</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">
                    ₹{Number(quotation.grandTotal).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-muted">
                  <span>Round-off:</span>
                  <span className="font-mono tabular-nums text-ink">
                    {formatRoundOff(quotation.roundOff)}
                  </span>
                </div>
              </div>

              {/* Total Payable banner (Clean white/surface card with 25px blue grand total) */}
              <div className="flex justify-between items-baseline border-t border-line bg-surface-2/60 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Total payable:</span>
                <span className="text-2xl font-mono tabular-nums text-brand font-bold">
                  ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Bank Details & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-line text-[11px]">
            {/* Bank details */}
            {quotation.company?.bankDetails && (
              <div className="space-y-1 bg-surface-2 p-3.5 rounded-control border border-line-strong">
                <div className="font-bold text-muted flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                  <CreditCard className="w-3.5 h-3.5 text-faint" />
                  <span>Bank Account Details</span>
                </div>
                <p className="text-muted leading-relaxed">
                  Bank: <strong className="text-ink font-medium">{quotation.company.bankDetails.bankName}</strong>
                  <br />
                  A/C No:{' '}
                  <span className="font-mono font-medium text-ink">
                    {quotation.company.bankDetails.accountNumber}
                  </span>
                  <br />
                  IFSC:{' '}
                  <span className="font-mono font-medium text-ink">
                    {quotation.company.bankDetails.ifscCode}
                  </span>{' '}
                  &bull; Branch: {quotation.company.bankDetails.branch}
                </p>
              </div>
            )}

            {/* Terms */}
            {quotation.terms && quotation.terms.length > 0 && (
              <div className="space-y-1 bg-surface-2 p-3.5 rounded-control border border-line-strong">
                <div className="font-bold text-muted flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                  <FileCheck2 className="w-3.5 h-3.5 text-faint" />
                  <span>Terms &amp; Conditions</span>
                </div>
                <ol className="list-decimal pl-4 text-muted space-y-0.5 leading-relaxed">
                  {quotation.terms.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-line flex flex-wrap items-center justify-between gap-3">
          <QuotationPdfActions quotation={quotation} variant="modal" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-surface-2 text-muted hover:text-ink border border-line-strong rounded-control text-xs font-semibold transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
