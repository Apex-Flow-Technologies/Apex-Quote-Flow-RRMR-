import React from 'react';
import type { Quotation, QuotationLine } from '../../types/quotation';
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

const formatINR = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One-line description of how a line's quantity was derived (shown under the product name). */
function describeLine(line: QuotationLine, quotation: Quotation): string {
  const m = line.snapshot.qtyMethod;
  let s = '';
  if (m === 'SQM') {
    s = `${line.lengthValue !== undefined ? line.lengthValue : line.lengthFeet || 0} ${line.lengthUnit || 'ft'} × ${line.nos} nos · Width ${line.widthFactor || line.snapshot.widthFactor || quotation.widthFactor || 1.08}`;
  } else if (m === 'WEIGHT_PER_PIECE') {
    s = `${line.nos} nos × ${line.kgPerPiece || line.snapshot.kgPerPiece || 0} kg/pc`;
  } else if (m === 'CUSTOM') {
    s = line.nos > 1 ? `${line.nos} nos` : 'Custom item';
  } else if (m === 'SHEET_WEIGHT') {
    s = `${line.lengthFeet || 0}'${line.lengthInches || 0}" × ${line.nos} nos · ${line.snapshot.thicknessMm}mm · ${line.snapshot.coilWidthM}m`;
  } else if (m === 'SECTION_WEIGHT') {
    const len = line.lengthFeet !== undefined && line.lengthFeet !== null
      ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
      : `${line.lengthM || 0}m`;
    s = `${len} × ${line.nos} nos · ${line.snapshot.kgPerMetre} kg/m`;
  } else if (m === 'PIECE') {
    s = `${line.nos} nos`;
  }
  return line.isManualQuantity ? `${s} · Manual qty` : s;
}

interface QuotationPreviewModalProps {
  quotation: Quotation;
  onClose: () => void;
}

export const QuotationPreviewModal: React.FC<QuotationPreviewModalProps> = ({
  quotation,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-ink/40 backdrop-blur-xs">
      <div className="bg-white sm:rounded-card shadow-lg sm:border border-line-strong max-w-5xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-4 pt-[max(0.875rem,env(safe-area-inset-top))] sm:pt-4 bg-white text-ink flex items-center justify-between border-b border-line gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-control bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-sm tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2 text-ink">
                <span className="font-mono tabular-nums">{quotation.quotationNumber}</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase px-1.5 sm:px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
                  {quotation.isGstEnabled === false
                    ? 'Non-GST (Composition / Unregistered)'
                    : quotation.taxMode === 'intra'
                      ? 'Intra-State (CGST+SGST)'
                      : 'Inter-State (IGST)'}
                </span>
              </div>
              <div className="text-[11px] text-muted truncate">
                Created by {quotation.createdByName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quotation Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5 text-xs flex-1 min-h-0">
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

          {/* Quotation Lines — mobile cards */}
          <div className="md:hidden space-y-2.5">
            <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-faint px-0.5">
              <span>Items ({quotation.lines.length})</span>
              <span>Taxable value</span>
            </div>
            {quotation.lines.map((line, idx) => (
              <div key={line.id || idx} className="bg-white border border-line-strong rounded-card p-3.5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex gap-2.5">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-brand-soft text-brand text-[10px] font-bold font-mono flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink text-[13px] leading-snug break-words">{line.productName}</div>
                      <div className="text-[11px] text-muted mt-0.5">{describeLine(line, quotation)}</div>
                      <div className="text-[10.5px] text-faint font-mono mt-0.5">HSN {line.hsn}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono tabular-nums font-bold text-ink text-[13px]">
                    ₹{formatINR(line.taxableAmount)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-surface-2 rounded-control px-2 py-1.5 border border-line">
                    <div className="text-faint uppercase tracking-wider text-[9.5px] font-semibold">Qty</div>
                    <div className="font-mono tabular-nums font-semibold text-ink">
                      {line.unit === 'Nos' ? Number(line.quantity) : Number(line.quantity).toFixed(2)} {line.unit}
                    </div>
                  </div>
                  <div className="bg-surface-2 rounded-control px-2 py-1.5 border border-line">
                    <div className="text-faint uppercase tracking-wider text-[9.5px] font-semibold">Rate</div>
                    <div className="font-mono tabular-nums font-semibold text-ink">₹{Number(line.rate).toFixed(2)}</div>
                  </div>
                  <div className="bg-surface-2 rounded-control px-2 py-1.5 border border-line">
                    <div className="text-faint uppercase tracking-wider text-[9.5px] font-semibold">GST</div>
                    <div className="font-mono tabular-nums font-semibold text-ink">
                      {quotation.isGstEnabled === false ? '0%' : `${line.gstRate}%`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quotation Lines Table — tablet / desktop */}
          <div className="hidden md:block border border-line-strong rounded-control overflow-hidden shadow-xs bg-white">
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
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quotation.lines.map((line, idx) => (
                    <tr key={line.id || idx} className="hover:bg-surface-2/60 transition">
                      <td className="py-2.5 px-3 text-center font-mono text-muted">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-ink">{line.productName}</div>
                        <div className="text-[11px] text-muted">
                          {line.snapshot.qtyMethod === 'SQM' && (
                            <span>
                              {line.lengthValue !== undefined ? line.lengthValue : (line.lengthFeet || 0)} {line.lengthUnit || 'ft'} &times; {line.nos} nos &bull; Width: {line.widthFactor || line.snapshot.widthFactor || quotation.widthFactor || 1.08}
                            </span>
                          )}
                          {line.snapshot.qtyMethod === 'WEIGHT_PER_PIECE' && (
                            <span>
                              {line.nos} nos &times; {line.kgPerPiece || line.snapshot.kgPerPiece || 0} kg/pc
                            </span>
                          )}
                          {(line.snapshot.qtyMethod === 'CUSTOM' || (line as unknown as { isCustomItem?: boolean }).isCustomItem) && (
                            <span>{line.nos > 1 ? `${line.nos} nos` : 'Custom item'}</span>
                          )}
                          {line.snapshot.qtyMethod === 'SHEET_WEIGHT' && (
                            <span>
                              {line.lengthFeet || 0}&apos;{line.lengthInches || 0}&quot; &times; {line.nos} nos &bull; Thick: {line.snapshot.thicknessMm}mm &bull; Coil: {line.snapshot.coilWidthM}m
                            </span>
                          )}
                          {line.snapshot.qtyMethod === 'SECTION_WEIGHT' && (
                            <span>
                              {line.lengthFeet !== undefined && line.lengthFeet !== null
                                ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
                                : `${line.lengthM || 0}m`
                              } &times; {line.nos} nos &bull; Section: {line.snapshot.kgPerMetre} kg/m
                            </span>
                          )}
                          {line.snapshot.qtyMethod === 'PIECE' && <span>{line.nos} nos &bull; Per piece</span>}
                          {line.isManualQuantity && (
                            <span className="ml-1.5 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                              (Manual)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted text-[11px]">
                        {line.hsn}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-ink">
                        {line.nos ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-ink">
                        {line.unit === 'Nos' ? `${Number(line.quantity)} ${line.unit}` : `${Number(line.quantity).toFixed(2)} ${line.unit}`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted">
                        ₹{Number(line.rate).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted">
                        {quotation.isGstEnabled === false ? '0%' : `${line.gstRate}%`}
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
              <div className="bg-white p-3.5 sm:p-4 rounded-control border border-line-strong shadow-xs">
                <div className="font-bold text-muted text-[10.5px] uppercase tracking-wider mb-2.5">
                  Physical Quantities
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs">
                  {Number(quotation.totalSqMtr || 0) > 0 && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Area</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">
                        {Number(quotation.totalSqMtr).toFixed(2)} Sq.Mtr
                      </span>
                    </div>
                  )}
                  {Number(quotation.totalKgs || 0) > 0 && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Weight</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">
                        {Number(quotation.totalKgs).toFixed(2)} Kgs
                      </span>
                    </div>
                  )}
                  {quotation.totalNos != null && quotation.totalNos > 0 && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong col-span-2 sm:col-span-1">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Qty in Nos</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">
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

                {quotation.isGstEnabled !== false ? (
                  quotation.taxMode === 'intra' ? (
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
                  )
                ) : null}

                <div className="flex justify-between text-muted border-t border-line pt-2">
                  <span className="font-semibold text-ink">Grand Total:</span>
                  <span className="font-mono tabular-nums font-bold text-ink">
                    ₹{Number(quotation.grandTotal).toFixed(2)}
                  </span>
                </div>

                {Number(quotation.roundOff || 0) !== 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Round-off:</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatRoundOff(quotation.roundOff)}
                    </span>
                  </div>
                )}

                {quotation.advanceAmount !== undefined && quotation.advanceAmount !== null && Number(quotation.advanceAmount) > 0 && (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>Total Payable:</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">
                        ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-semibold">Advance Received:</span>
                      <span className="font-mono tabular-nums font-bold">
                        ₹{Number(quotation.advanceAmount).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Total Payable or Balance Due Banner */}
              {quotation.advanceAmount !== undefined && quotation.advanceAmount !== null && Number(quotation.advanceAmount) > 0 ? (
                <div className="flex justify-between items-baseline border-t border-line bg-amber-50/70 p-4 gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 shrink-0">Balance Due:</span>
                  <span className="text-xl sm:text-2xl font-mono tabular-nums text-amber-700 font-bold text-right truncate">
                    ₹{Number(quotation.balanceDue ?? (quotation.payableAmount - Number(quotation.advanceAmount))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-baseline border-t border-line bg-surface-2/60 p-4 gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0">Total Payable:</span>
                  <span className="text-xl sm:text-2xl font-mono tabular-nums text-brand font-bold text-right truncate">
                    ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
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
        <div className="p-3.5 sm:p-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white border-t border-line shadow-[0_-4px_16px_rgba(16,24,40,0.06)] sm:shadow-none flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="w-full sm:w-auto">
            <QuotationPdfActions quotation={quotation} variant="modal" />
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] px-4 py-2 bg-white hover:bg-surface-2 text-muted hover:text-ink border border-line-strong rounded-control text-xs font-semibold transition flex items-center justify-center"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
