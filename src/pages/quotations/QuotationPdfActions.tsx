import React, { useState } from 'react';
import type { Quotation } from '../../types/quotation';
import { getQuotationPdfFilename, triggerBlobDownload } from '../../utils/pdfGenerator';
import { Download, ExternalLink, Loader2 } from 'lucide-react';

// The PDF engine is fetched the first time someone generates a PDF, then cached.
const renderPdf = async (q: Quotation): Promise<Blob> =>
  (await import('./pdfRender')).renderQuotationPdfBlob(q);

interface QuotationPdfActionsProps {
  quotation: Quotation;
  variant?: 'modal' | 'table' | 'card';
}

export const QuotationPdfActions: React.FC<QuotationPdfActionsProps> = ({
  quotation,
  variant = 'modal',
}) => {
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setGenerating(true);
      setError(null);

      const blob = await renderPdf(quotation);
      const filename = getQuotationPdfFilename(quotation.quotationNumber);

      triggerBlobDownload(blob, filename);
    } catch (err: unknown) {
      console.error('PDF generation error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenInNewTab = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open the tab synchronously (inside the tap) — iPhone Safari blocks window.open after an await.
    const tab = window.open('', '_blank');
    try {
      setGenerating(true);
      setError(null);

      const blob = await renderPdf(quotation);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: unknown) {
      tab?.close();
      console.error('PDF preview error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to open PDF';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (variant === 'card') {
    return (
      <button
        onClick={handleDownload}
        disabled={generating}
        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-brand bg-brand-soft hover:bg-brand/10 active:bg-brand/15 rounded-control transition text-xs font-semibold border border-brand/20 disabled:opacity-50"
        title={`Download ${quotation.quotationNumber} PDF`}
      >
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>PDF</span>
      </button>
    );
  }

  if (variant === 'table') {
    return (
      <button
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-muted hover:text-ink hover:bg-surface-2 rounded-control transition text-xs font-semibold border border-line-strong disabled:opacity-50"
        title={`Download ${quotation.quotationNumber} PDF`}
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>PDF</span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
      {error && (
        <span className="text-[11px] text-danger font-semibold mr-2">
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={handleOpenInNewTab}
        disabled={generating}
        className="min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 rounded-control border border-line-strong transition disabled:opacity-50"
        title="Open A4 PDF preview in new browser tab"
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
        ) : (
          <ExternalLink className="w-3.5 h-3.5" />
        )}
        <span>Preview PDF</span>
      </button>

      <button
        type="button"
        onClick={handleDownload}
        disabled={generating}
        className="min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-control shadow-xs transition disabled:opacity-50"
        title={`Download ${getQuotationPdfFilename(quotation.quotationNumber)}`}
      >
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Generating A4 PDF...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </>
        )}
      </button>
    </div>
  );
};
