/**
 * Generates the standardized filename for a quotation PDF.
 * Converts slashes to hyphens:
 * Example: "RR/QT/26-27/0001" -> "RR-QT-26-27-0001.pdf"
 */
export function getQuotationPdfFilename(quotationNumber?: string): string {
  if (!quotationNumber || !quotationNumber.trim()) {
    return 'QUOTATION.pdf';
  }
  const sanitized = quotationNumber.trim().replace(/[\/\\:*?"<>|]/g, '-');
  return `${sanitized}.pdf`;
}

/**
 * Initiates a browser file download for a given Blob.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
