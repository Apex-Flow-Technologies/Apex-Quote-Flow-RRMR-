import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Quotation } from '../../types/quotation';
import { formatRoundOff } from '../../engine';

export const FONT_FAMILY = 'Noto Sans';

/**
 * Resolves local font asset URL for both:
 * 1. Browser runtime (local dev server & deployed Firebase Hosting)
 * 2. Node.js environment (Vitest test suite)
 */
const getFontSource = (filename: string): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(`${cleanBase}fonts/${filename}`, window.location.origin).href;
  }
  // Fallback for Node.js / Vitest test runner
  return `public/fonts/${filename}`;
};

Font.register({
  family: FONT_FAMILY,
  fonts: [
    { src: getFontSource('NotoSans-Regular.ttf'), fontWeight: 'normal' },
    { src: getFontSource('NotoSans-SemiBold.ttf'), fontWeight: 'semibold' },
    { src: getFontSource('NotoSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});

interface QuotationPdfDocumentProps {
  quotation: Quotation;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: '#1e293b',
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 28,
    lineHeight: 1.3,
  },
  // Header Section
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#1d4ed8',
  },
  companyDetails: {
    width: '58%',
  },
  companyName: {
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  companyAddress: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 2,
    lineHeight: 1.25,
  },
  companyContact: {
    fontSize: 7.5,
    color: '#64748b',
  },
  quoteMetaDetails: {
    width: '38%',
    alignItems: 'flex-end',
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1d4ed8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  quoteNumberBadge: {
    fontSize: 9.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#eff6ff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 3,
    borderWidth: 0.5,
    borderColor: '#bfdbfe',
  },
  quoteDateText: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 2,
  },
  taxModeBadge: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1e40af',
    textTransform: 'uppercase',
  },

  // Customer Card
  customerCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  customerColLeft: {
    width: '60%',
  },
  customerColRight: {
    width: '38%',
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 9.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  customerText: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.2,
  },
  gstinHighlight: {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // Table
  tableContainer: {
    borderWidth: 0.75,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4.5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#fafafa',
  },
  colSNo: { width: '5%', textAlign: 'center' },
  colDesc: { width: '37%', paddingRight: 4 },
  colHsn: { width: '10%', textAlign: 'center' },
  colQty: { width: '13%', textAlign: 'right', paddingRight: 3 },
  colRate: { width: '11%', textAlign: 'right', paddingRight: 3 },
  colDisc: { width: '8%', textAlign: 'right', paddingRight: 3 },
  colTaxable: { width: '16%', textAlign: 'right' },

  productName: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  productSpecs: {
    fontSize: 6.8,
    color: '#64748b',
    marginTop: 1,
  },
  manualTag: {
    fontSize: 6,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#d97706',
  },

  // Totals & Bottom Section
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bottomLeftCol: {
    width: '54%',
    justifyContent: 'space-between',
  },
  bottomRightCol: {
    width: '43%',
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
  },

  // Physical Totals Box
  qtySummaryBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 0.75,
    borderColor: '#bbf7d0',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qtyBoxItem: {
    alignItems: 'center',
  },
  qtyBoxLabel: {
    fontSize: 6.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#166534',
    textTransform: 'uppercase',
  },
  qtyBoxValue: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#14532d',
    marginTop: 1,
  },

  // Words Box
  wordsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  wordsLabel: {
    fontSize: 6.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  wordsText: {
    fontSize: 7.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1e3a8a',
    lineHeight: 1.2,
  },

  // Bank Details
  bankBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
  },
  bankTitle: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  bankText: {
    fontSize: 7,
    color: '#475569',
    lineHeight: 1.25,
  },

  // Financial Breakdown rows
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 7.5,
    color: '#475569',
  },
  summaryValue: {
    fontSize: 7.5,
    color: '#0f172a',
  },
  summaryRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    marginTop: 2,
  },
  summaryLabelBold: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryValueBold: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  payableBox: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payableLabel: {
    fontSize: 8.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payableValue: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Terms Section
  termsContainer: {
    borderTopWidth: 0.75,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 4,
  },
  termsTitle: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  termItem: {
    fontSize: 6.5,
    color: '#64748b',
    marginBottom: 1.5,
    lineHeight: 1.2,
  },

  // Footer (Fixed at bottom of every page)
  pageFooter: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6.5,
    color: '#94a3b8',
  },
  footerPageNum: {
    fontSize: 6.5,
    color: '#94a3b8',
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
  },
});

export const QuotationPdfDocument: React.FC<QuotationPdfDocumentProps> = ({
  quotation,
}) => {
  const company = quotation.company;
  const customer = quotation.customer;
  const isIntra = quotation.taxMode === 'intra';

  return (
    <Document title={`Quotation ${quotation.quotationNumber}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* =========================================================================
            HEADER SECTION (Uses quotation.company snapshot)
           ========================================================================= */}
        <View style={styles.headerContainer}>
          <View style={styles.companyDetails}>
            <Text style={styles.companyName}>
              {company?.name || '—'}
            </Text>
            {company?.address && (
              <Text style={styles.companyAddress}>{company.address}</Text>
            )}
            <Text style={styles.companyContact}>
              GSTIN: <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold', color: '#0f172a' }}>{company?.gstin || '—'}</Text>
              {company?.phones && company.phones.length > 0 && ` • Phone: ${company.phones.join(', ')}`}
            </Text>
            {company?.email && (
              <Text style={styles.companyContact}>Email: {company.email}</Text>
            )}
          </View>

          <View style={styles.quoteMetaDetails}>
            <Text style={styles.quoteTitle}>QUOTATION</Text>
            <Text style={styles.quoteNumberBadge}>
              {quotation.quotationNumber}
            </Text>
            <Text style={styles.quoteDateText}>
              Date: <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>{quotation.quotationDate || '—'}</Text>
            </Text>
            <Text style={styles.taxModeBadge}>
              {isIntra ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
            </Text>
          </View>
        </View>

        {/* =========================================================================
            CUSTOMER SECTION (Uses quotation.customer snapshot)
           ========================================================================= */}
        <View style={styles.customerCard}>
          <View style={styles.customerColLeft}>
            <Text style={styles.sectionLabel}>Customer / Billed To</Text>
            <Text style={styles.customerName}>{customer.name}</Text>
            {customer.address && (
              <Text style={styles.customerText}>{customer.address}</Text>
            )}
          </View>

          <View style={styles.customerColRight}>
            <Text style={styles.sectionLabel}>Tax Details</Text>
            <Text style={styles.customerText}>
              GSTIN:{' '}
              {customer.gstin ? (
                <Text style={styles.gstinHighlight}>{customer.gstin}</Text>
              ) : (
                <Text style={{ color: '#64748b' }}>Unregistered Buyer</Text>
              )}
            </Text>
            {customer.phone && (
              <Text style={styles.customerText}>Phone: {customer.phone}</Text>
            )}
          </View>
        </View>

        {/* =========================================================================
            ITEMS TABLE (Uses quotation.lines and line-level snapshots)
           ========================================================================= */}
        <View style={styles.tableContainer}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colSNo]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description &amp; Specifications</Text>
            <Text style={[styles.tableHeaderCell, styles.colHsn]}>HSN</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Quantity</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate (₹)</Text>
            <Text style={[styles.tableHeaderCell, styles.colDisc]}>Disc (₹)</Text>
            <Text style={[styles.tableHeaderCell, styles.colTaxable]}>Taxable Value (₹)</Text>
          </View>

          {/* Lines */}
          {quotation.lines.map((line, index) => {
            const snap = line.snapshot;
            const isSheet = snap.qtyMethod === 'SHEET_WEIGHT';
            const isPipe = snap.qtyMethod === 'SECTION_WEIGHT';
            const isPiece = snap.qtyMethod === 'PIECE';

            return (
              <View
                key={line.id || index}
                wrap={false}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowEven : {}]}
              >
                <Text style={[styles.colSNo, { color: '#94a3b8' }]}>{index + 1}</Text>

                <View style={styles.colDesc}>
                  <Text style={styles.productName}>{line.productName}</Text>
                  <Text style={styles.productSpecs}>
                    {isSheet && (
                      `${line.lengthFeet || 0}'${line.lengthInches || 0}" × ${line.nos} nos • ${snap.thicknessMm}mm • ${snap.coilWidthM}m coil`
                    )}
                    {isPipe && (
                      `${line.lengthFeet !== undefined && line.lengthFeet !== null
                        ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
                        : `${line.lengthM || 0}m`
                      } × ${line.nos} nos • ${snap.kgPerMetre} kg/m`
                    )}
                    {isPiece && `${line.nos} nos • Per piece`}
                  </Text>
                </View>

                <Text style={[styles.colHsn, { color: '#475569' }]}>{line.hsn}</Text>

                <View style={styles.colQty}>
                  <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>
                    {Number(line.quantity).toFixed(2)} {line.unit}
                  </Text>
                  {line.isManualQuantity && (
                    <Text style={styles.manualTag}>(Manual)</Text>
                  )}
                </View>

                <Text style={styles.colRate}>{Number(line.rate).toFixed(2)}</Text>

                <Text style={[styles.colDisc, { color: '#64748b' }]}>
                  {line.discountAmount && line.discountAmount > 0
                    ? Number(line.discountAmount).toFixed(2)
                    : '—'}
                </Text>

                <Text style={[styles.colTaxable, { fontFamily: FONT_FAMILY, fontWeight: 'bold' }]}>
                  {Number(line.taxableAmount).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* =========================================================================
            TOTALS, AMOUNTS, BANK & SUMMARY (Uses authoritative saved totals)
           ========================================================================= */}
        <View wrap={false} style={styles.bottomContainer}>
          {/* Left Column: Physical Quantities, Amount in Words & Bank */}
          <View style={styles.bottomLeftCol}>
            {/* Physical Quantities Box */}
            <View style={styles.qtySummaryBox}>
              <View style={styles.qtyBoxItem}>
                <Text style={styles.qtyBoxLabel}>Total Weight</Text>
                <Text style={styles.qtyBoxValue}>
                  {Number(quotation.totalKgs).toFixed(2)} Kgs
                </Text>
              </View>
              {Number(quotation.totalNos) > 0 && (
                <View style={styles.qtyBoxItem}>
                  <Text style={styles.qtyBoxLabel}>Qty in Nos</Text>
                  <Text style={styles.qtyBoxValue}>
                    {Number(quotation.totalNos)} Nos
                  </Text>
                </View>
              )}
            </View>

            {/* Amount in Words */}
            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>Amount in Words (INR)</Text>
              <Text style={styles.wordsText}>
                {quotation.amountInWords}
              </Text>
            </View>

            {/* Bank Details */}
            {company?.bankDetails && (
              <View style={styles.bankBox}>
                <Text style={styles.bankTitle}>Bank Details for Payment</Text>
                <Text style={styles.bankText}>
                  Bank: <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>{company.bankDetails.bankName}</Text>
                  {' • '}A/C: <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>{company.bankDetails.accountNumber}</Text>
                  {'\n'}IFSC: <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>{company.bankDetails.ifscCode}</Text>
                  {' • '}Branch: {company.bankDetails.branch}
                </Text>
              </View>
            )}
          </View>

          {/* Right Column: Authoritative Financial Totals */}
          <View style={styles.bottomRightCol}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal (Taxable Value):</Text>
              <Text style={styles.summaryValue}>₹{Number(quotation.subtotal).toFixed(2)}</Text>
            </View>

            {isIntra ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>CGST (Central Tax):</Text>
                  <Text style={styles.summaryValue}>₹{Number(quotation.cgstTotal).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>SGST (State Tax):</Text>
                  <Text style={styles.summaryValue}>₹{Number(quotation.sgstTotal).toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IGST (Integrated Tax):</Text>
                <Text style={styles.summaryValue}>₹{Number(quotation.igstTotal).toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.summaryRowBold}>
              <Text style={styles.summaryLabelBold}>Grand Total:</Text>
              <Text style={styles.summaryValueBold}>₹{Number(quotation.grandTotal).toFixed(2)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round-off:</Text>
              <Text style={styles.summaryValue}>
                {formatRoundOff(quotation.roundOff)}
              </Text>
            </View>

            <View style={styles.payableBox}>
              <Text style={styles.payableLabel}>Total Payable:</Text>
              <Text style={styles.payableValue}>
                ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================================
            TERMS & CONDITIONS (Uses quotation.terms snapshot)
           ========================================================================= */}
        {quotation.terms && quotation.terms.length > 0 && (
          <View wrap={false} style={styles.termsContainer}>
            <Text style={styles.termsTitle}>Terms &amp; Conditions:</Text>
            {quotation.terms.map((term, i) => (
              <Text key={i} style={styles.termItem}>
                {i + 1}. {term}
              </Text>
            ))}
          </View>
        )}

        {/* =========================================================================
            PAGE FOOTER (Fixed at the bottom of every page)
           ========================================================================= */}
        <View fixed style={styles.pageFooter}>
          <Text style={styles.footerText}>
            {company?.name ? `${company.name} • ` : ''}Quotation {quotation.quotationNumber} • Computer-generated document
          </Text>
          <Text
            style={styles.footerPageNum}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};
