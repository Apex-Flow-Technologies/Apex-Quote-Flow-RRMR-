import { lineLengthText } from '../../components/quotations/quotationRows';
import React from 'react';
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
import { describeSteelLine, describeFlashingLine, isSteelByKg } from '../../utils/steelLine';

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
    fontSize: 9.5,
    color: '#1e293b',
    paddingTop: 30,
    paddingBottom: 38,
    paddingHorizontal: 28,
    lineHeight: 1.35,
  },
  // Header Section
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1d4ed8',
  },
  companyDetails: {
    width: '54%',
    paddingRight: 8,
  },
  companyName: {
    fontSize: 16,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 8.5,
    color: '#475569',
    marginBottom: 3,
    lineHeight: 1.35,
  },
  companyContact: {
    fontSize: 8.5,
    color: '#64748b',
    lineHeight: 1.35,
  },
  quoteMetaDetails: {
    width: '45%',
    alignItems: 'flex-end',
  },
  quoteTitleContainer: {
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  quoteTitle: {
    fontSize: 18,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1d4ed8',
    letterSpacing: 1.5,
    lineHeight: 1.15,
    textAlign: 'right',
  },
  quoteNumberBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 10,
    marginBottom: 6,
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  quoteNumberText: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1e3a8a',
    letterSpacing: 0.4,
    textAlign: 'right',
    lineHeight: 1.15,
  },
  quoteMetaBlock: {
    alignItems: 'flex-end',
  },
  quoteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 2.5,
  },
  quoteMetaLabel: {
    fontSize: 8.5,
    color: '#64748b',
    marginRight: 5,
  },
  quoteMetaValue: {
    fontSize: 8.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  taxModeBadge: {
    fontSize: 8.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },

  // Customer Card
  customerCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 9,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerColLeft: {
    width: '56%',
  },
  customerColRight: {
    width: '42%',
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  customerName: {
    fontSize: 11,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 3,
  },
  customerText: {
    fontSize: 8.5,
    color: '#475569',
    lineHeight: 1.35,
  },
  gstinHighlight: {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // Table
  tableContainer: {
    // Borders live on the header and rows (not one box), so a page break leaves no empty bordered space
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderBottomWidth: 1.25,
    paddingVertical: 6.5,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#cbd5e1',
    borderRightColor: '#cbd5e1',
    borderBottomWidth: 0.75,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6.5,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#fafafa',
  },
  tableRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  colSNo: { width: '5%', textAlign: 'center' },
  colDesc: { width: '37%', paddingRight: 5 },
  colHsn: { width: '10%', textAlign: 'center' },
  colQty: { width: '13%', textAlign: 'right', paddingRight: 4 },
  colRate: { width: '11%', textAlign: 'right', paddingRight: 4 },
  colDisc: { width: '8%', textAlign: 'right', paddingRight: 4 },
  colTaxable: { width: '16%', textAlign: 'right' },

  productName: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  productSpecs: {
    fontSize: 7.8,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 1.25,
  },
  manualTag: {
    fontSize: 6.8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#d97706',
  },

  // Totals & Bottom Section
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bottomLeftCol: {
    width: '53%',
    justifyContent: 'flex-start',
  },
  bottomRightCol: {
    width: '44%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 9,
  },

  // Physical Totals Box
  qtySummaryBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 5,
    padding: 7,
    marginBottom: 7,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qtyBoxItem: {
    alignItems: 'center',
  },
  qtyBoxLabel: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qtyBoxValue: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#14532d',
    marginTop: 2,
  },

  // Words Box
  wordsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 7,
    marginBottom: 7,
  },
  wordsLabel: {
    fontSize: 7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2.5,
  },
  wordsText: {
    fontSize: 8.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#1e3a8a',
    lineHeight: 1.3,
  },

  // Bank Details
  bankBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 7,
    marginBottom: 0,
  },
  bankTitle: {
    fontSize: 7.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 2.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bankText: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.3,
  },

  // Financial Breakdown rows
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: '#475569',
  },
  summaryValue: {
    fontSize: 8.5,
    color: '#0f172a',
  },
  summaryRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
    marginTop: 2.5,
  },
  summaryLabelBold: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryValueBold: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  payableBox: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payableLabel: {
    fontSize: 9.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payableValue: {
    fontSize: 12,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Terms Section & Signatory
  termsRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  termsCol: {
    width: '60%',
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  termItem: {
    fontSize: 7.5,
    color: '#64748b',
    marginBottom: 2,
    lineHeight: 1.3,
  },
  signatoryCol: {
    width: '35%',
    alignItems: 'flex-end',
  },
  signatoryCompany: {
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'right',
  },
  signatoryLabel: {
    fontSize: 7.5,
    color: '#64748b',
    borderTopWidth: 0.75,
    borderTopColor: '#94a3b8',
    paddingTop: 3,
    width: 120,
    textAlign: 'center',
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
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  footerPageNum: {
    fontSize: 7.5,
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
            <View style={styles.quoteTitleContainer}>
              <Text style={styles.quoteTitle}>QUOTATION</Text>
            </View>
            <View style={styles.quoteNumberBadge}>
              <Text style={styles.quoteNumberText}>
                {quotation.quotationNumber}
              </Text>
            </View>
            <View style={styles.quoteMetaBlock}>
              <View style={styles.quoteMetaRow}>
                <Text style={styles.quoteMetaLabel}>Date:</Text>
                <Text style={styles.quoteMetaValue}>{quotation.quotationDate || '—'}</Text>
              </View>
              {quotation.widthFactor !== undefined && (
                <View style={styles.quoteMetaRow}>
                  <Text style={styles.quoteMetaLabel}>Width Factor:</Text>
                  <Text style={styles.quoteMetaValue}>{quotation.widthFactor}</Text>
                </View>
              )}
              <View style={styles.quoteMetaRow}>
                <Text style={styles.quoteMetaLabel}>Tax Status:</Text>
                <Text style={styles.taxModeBadge}>
                  {quotation.isGstEnabled === false
                    ? 'Non-GST Quotation'
                    : isIntra
                    ? 'Intra-State (CGST + SGST)'
                    : 'Inter-State (IGST)'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* =========================================================================
            CUSTOMER SECTION (Uses quotation.customer snapshot)
           ========================================================================= */}
        <View style={styles.customerCard}>
          <View style={styles.customerColLeft}>
            <Text style={styles.sectionLabel}>Customer / Billed To</Text>
            <Text style={styles.customerName}>{customer?.name || '—'}</Text>
            {customer?.address && (
              <Text style={styles.customerText}>{customer.address}</Text>
            )}
          </View>

          <View style={styles.customerColRight}>
            <Text style={styles.sectionLabel}>Tax Details</Text>
            <Text style={styles.customerText}>
              GSTIN:{' '}
              {customer?.gstin ? (
                <Text style={styles.gstinHighlight}>{customer.gstin}</Text>
              ) : (
                <Text style={{ color: '#64748b' }}>Unregistered Buyer</Text>
              )}
            </Text>
            {customer?.phone && (
              <Text style={styles.customerText}>Phone: {customer.phone}</Text>
            )}
          </View>
        </View>

        {/* =========================================================================
            ITEMS TABLE (Uses quotation.lines and line-level snapshots)
           ========================================================================= */}
        <View style={styles.tableContainer}>
          {/* Header */}
          <View fixed style={styles.tableHeader}>
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
            const isSqm = snap.qtyMethod === 'SQM';
            const isWeightPerPiece = snap.qtyMethod === 'WEIGHT_PER_PIECE';
            const isCustom = snap.qtyMethod === 'CUSTOM' || (line as unknown as { isCustomItem?: boolean }).isCustomItem;
            const isSheet = snap.qtyMethod === 'SHEET_WEIGHT';
            const isPipe = snap.qtyMethod === 'SECTION_WEIGHT';
            const isPiece = snap.qtyMethod === 'PIECE';

            return (
              <View
                key={line.id || index}
                wrap={false}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowEven : {}, index === quotation.lines.length - 1 ? styles.tableRowLast : {}]}
              >
                <Text style={[styles.colSNo, { color: '#94a3b8' }]}>{index + 1}</Text>

                <View style={styles.colDesc}>
                  <Text style={styles.productName}>{line.productName}{line.colour ? ` • Colour: ${line.colour}` : ''}</Text>
                  <Text style={styles.productSpecs}>
                    {isSqm && (
                      `${describeFlashingLine(line, '•') ? `${describeFlashingLine(line, '•')} • ` : ''}${lineLengthText(line)} × ${line.nos} ${describeFlashingLine(line) ? 'sheets' : 'nos'} • Width: ${line.widthFactor || snap.widthFactor || quotation.widthFactor || 1.08}`
                    )}
                    {isWeightPerPiece && (
                      `${line.nos} nos × ${line.kgPerPiece || snap.kgPerPiece || 0} kg/pc`
                    )}
                    {isCustom && (
                      line.nos > 1 ? `${line.nos} nos` : 'Custom item'
                    )}
                    {isSheet && (
                      `${line.lengthFeet || 0}'${line.lengthInches || 0}" × ${line.nos} nos • ${snap.thicknessMm}mm • ${snap.coilWidthM}m coil`
                    )}
                    {isPipe && describeSteelLine(line, '•')}
                    {isPiece && (describeFlashingLine(line, '•') ?? `${line.nos} nos • Per piece`)}
                    {(snap.qtyMethod === 'AREA' || snap.qtyMethod === 'RUNNING_LENGTH' || snap.qtyMethod === 'LENGTH_FT') && (
                      `${line.lengthFeet || 0}'${line.lengthInches || 0}" × ${line.nos} nos`
                    )}
                  </Text>
                </View>

                <Text style={[styles.colHsn, { color: '#475569' }]}>{line.hsn}</Text>

                <View style={styles.colQty}>
                  <Text style={{ fontFamily: FONT_FAMILY, fontWeight: 'bold' }}>
                    {line.unit === 'Nos' ? `${Number(line.quantity)} ${line.unit}` : `${Number(line.quantity).toFixed(2)} ${line.unit}`}
                  </Text>
                  {line.isManualQuantity && !isSteelByKg(line) && (
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
            {((Number(quotation.totalSqMtr || 0) > 0) || (Number(quotation.totalKgs || 0) > 0) || (Number(quotation.totalNos || 0) > 0)) && (
              <View style={styles.qtySummaryBox}>
                {Number(quotation.totalSqMtr || 0) > 0 && (
                  <View style={styles.qtyBoxItem}>
                    <Text style={styles.qtyBoxLabel}>Total Area</Text>
                    <Text style={styles.qtyBoxValue}>
                      {Number(quotation.totalSqMtr).toFixed(2)} Sq.Mtr
                    </Text>
                  </View>
                )}
                {Number(quotation.totalKgs || 0) > 0 && (
                  <View style={styles.qtyBoxItem}>
                    <Text style={styles.qtyBoxLabel}>Total Weight</Text>
                    <Text style={styles.qtyBoxValue}>
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </Text>
                  </View>
                )}
                {Number(quotation.totalNos || 0) > 0 && (
                  <View style={styles.qtyBoxItem}>
                    <Text style={styles.qtyBoxLabel}>Qty in Nos</Text>
                    <Text style={styles.qtyBoxValue}>
                      {Number(quotation.totalNos)} Nos
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Amount in Words */}
            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>Amount in Words (INR)</Text>
              <Text style={styles.wordsText}>
                {quotation.amountInWords}
              </Text>
            </View>

            {/* Bank Details */}
            {company?.bankDetails && company.bankDetails.bankName && (
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

            {quotation.isGstEnabled !== false ? (
              isIntra ? (
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
              )
            ) : null}

            <View style={styles.summaryRowBold}>
              <Text style={styles.summaryLabelBold}>Grand Total:</Text>
              <Text style={styles.summaryValueBold}>₹{Number(quotation.grandTotal).toFixed(2)}</Text>
            </View>

            {Number(quotation.roundOff || 0) !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round-off:</Text>
                <Text style={styles.summaryValue}>
                  {formatRoundOff(quotation.roundOff)}
                </Text>
              </View>
            )}

            {quotation.advanceAmount !== undefined && quotation.advanceAmount !== null && Number(quotation.advanceAmount) > 0 ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Payable:</Text>
                  <Text style={styles.summaryValue}>
                    ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#047857' }]}>Advance Received:</Text>
                  <Text style={[styles.summaryValue, { color: '#047857', fontFamily: FONT_FAMILY, fontWeight: 'bold' }]}>
                    ₹{Number(quotation.advanceAmount).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.payableBox}>
                  <Text style={styles.payableLabel}>Balance Due:</Text>
                  <Text style={styles.payableValue}>
                    ₹{Number(quotation.balanceDue ?? (quotation.payableAmount - Number(quotation.advanceAmount))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.payableBox}>
                <Text style={styles.payableLabel}>Total Payable:</Text>
                <Text style={styles.payableValue}>
                  ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* =========================================================================
            TERMS & CONDITIONS & SIGNATORY (Uses quotation.terms snapshot)
           ========================================================================= */}
        {quotation.terms && quotation.terms.length > 0 && (
          <View wrap={false} style={styles.termsRow}>
            <View style={styles.termsCol}>
              <Text style={styles.termsTitle}>Terms &amp; Conditions:</Text>
              {quotation.terms.map((term, i) => (
                <Text key={i} style={styles.termItem}>
                  {i + 1}. {term}
                </Text>
              ))}
            </View>
            <View style={styles.signatoryCol}>
              {company?.name && (
                <Text style={styles.signatoryCompany}>For {company.name}</Text>
              )}
              <View style={{ height: 24 }} />
              <Text style={styles.signatoryLabel}>Authorised Signatory</Text>
            </View>
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
