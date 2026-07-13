// @ts-nocheck
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";
import { resolveRepaymentAmounts, calculateShgTotal, calculateShgEmi, getCurrentLoanRecommendation } from "../shared/accounting";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  const RUPEE = "\u20B9";
  if (amount === undefined || amount === null) return RUPEE + "0";
  return RUPEE + Number(amount).toLocaleString("en-IN");
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${mins}`;
}

// ─── Date Filter ──────────────────────────────────────────────────────────────

export function filterByDateRange(
  items: any[],
  timeRange: string,
  startDate?: string,
  endDate?: string,
  filterMonth?: string,
  filterYear?: string
) {
  if (!items || items.length === 0) return items;
  if (timeRange === "month" && filterMonth && filterYear) {
    const m = parseInt(filterMonth) - 1;
    const y = parseInt(filterYear);
    return items.filter((i) => {
      const d = new Date(i.date || i.paidAt || i.createdAt);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  } else if (timeRange === "year" && filterYear) {
    const y = parseInt(filterYear);
    return items.filter(
      (i) => new Date(i.date || i.paidAt || i.createdAt).getFullYear() === y
    );
  } else if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    return items.filter((i) => {
      const d = new Date(i.date || i.paidAt || i.createdAt).getTime();
      return d >= start && d <= end;
    });
  }
  return items;
}

/**
 * Contributions belong to their selected month, which can be different from
 * the timestamp on which the President/Treasurer entered the transaction.
 * Records created before contribution periods existed fall back to their
 * timestamp so historic data remains visible.
 */
export function filterPaymentsByContributionPeriod(
  payments: any[],
  timeRange: string,
  startDate?: string,
  endDate?: string,
  filterMonth?: string,
  filterYear?: string,
) {
  if (!payments || payments.length === 0) return payments;

  const periodFor = (payment: any) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(payment.month || "")) return payment.month;
    const recordedAt = new Date(payment.date || payment.createdAt);
    return `${recordedAt.getFullYear()}-${String(recordedAt.getMonth() + 1).padStart(2, "0")}`;
  };
  const rangeStart = startDate ? `${new Date(startDate).getFullYear()}-${String(new Date(startDate).getMonth() + 1).padStart(2, "0")}` : undefined;
  const rangeEnd = endDate ? `${new Date(endDate).getFullYear()}-${String(new Date(endDate).getMonth() + 1).padStart(2, "0")}` : undefined;

  if (timeRange === "custom" && rangeStart && rangeEnd) {
    return payments.filter((payment) => {
      const period = periodFor(payment);
      return period >= rangeStart && period <= rangeEnd;
    });
  }
  if (timeRange === "month" && filterMonth && filterYear) {
    const period = `${filterYear}-${filterMonth.padStart(2, "0")}`;
    return payments.filter((payment) => periodFor(payment) === period);
  }
  if (timeRange === "quarter" && filterYear && startDate && endDate) {
    return payments.filter((payment) => {
      const period = periodFor(payment);
      return period >= rangeStart && period <= rangeEnd;
    });
  }
  if (timeRange === "half-year" && filterYear && startDate && endDate) {
    return payments.filter((payment) => {
      const period = periodFor(payment);
      return period >= rangeStart && period <= rangeEnd;
    });
  }
  if (timeRange === "year" && filterYear) {
    return payments.filter((payment) => periodFor(payment).startsWith(`${filterYear}-`));
  }
  return payments;
}

// ─── CSS Styles ───────────────────────────────────────────────────────────────

const getStyles = () => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 20mm 15mm; size: A4; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10px;
    color: #1a1a2e;
    line-height: 1.5;
    background: #fff;
  }
  .page-header {
    background: linear-gradient(135deg, #1B6B4A 0%, #0d4a32 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .shg-name { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 4px; letter-spacing: 0.5px; }
  .shg-address { text-align: center; font-size: 11px; opacity: 0.85; margin-bottom: 14px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; border-top: 1px solid rgba(255,255,255,0.25); padding-top: 12px; margin-top: 4px; }
  .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.7; margin-bottom: 2px; }
  .meta-value { font-size: 11px; font-weight: 700; }
  .report-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
  .report-banner-title { font-size: 14px; font-weight: 700; color: #14532d; margin-bottom: 2px; }
  .report-banner-sub { font-size: 10px; color: #166534; }
  .filters-banner { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
  .filters-title { font-size: 10px; font-weight: 700; color: #7c2d12; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
  .filters-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .filter-badge { background: white; border: 1px solid #fdba74; border-radius: 4px; padding: 3px 8px; font-size: 9px; color: #7c2d12; }
  .filter-badge strong { color: #431407; }
  hr.divider { border: none; border-top: 2px solid #e2e8f0; margin: 14px 0; }
  .section { margin-bottom: 20px; }
  .section-heading { font-size: 12px; font-weight: 700; color: #1B6B4A; text-transform: uppercase; letter-spacing: 0.8px; border-left: 4px solid #1B6B4A; padding-left: 10px; margin-bottom: 10px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
  .summary-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .summary-value { font-size: 18px; font-weight: 800; color: #1B6B4A; }
  .summary-value.danger { color: #dc2626; }
  .summary-value.neutral { color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #1B6B4A; color: white; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  th.r, td.r { text-align: right; }
  th.c, td.c { text-align: center; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.total-row td { background: #e8f5e9; font-weight: 700; color: #14532d; border-top: 2px solid #1B6B4A; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 8px; font-weight: 700; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-yellow { background: #fef9c3; color: #a16207; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-gray { background: #f1f5f9; color: #64748b; }
  .empty-row td { text-align: center; padding: 20px; color: #94a3b8; font-style: italic; }
  .signatures-section { page-break-inside: avoid; margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
  .sig-row { display: flex; justify-content: space-between; }
  .sig-block { text-align: center; width: 180px; }
  .sig-line { border-top: 1px solid #334155; margin-top: 50px; padding-top: 6px; font-size: 9px; font-weight: 700; color: #334155; }
  .sig-name { font-size: 9px; color: #64748b; margin-top: 2px; }
  .page-footer { margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
`;

// ─── Header Block ─────────────────────────────────────────────────────────────

function buildHeader(reportTitle: string, group: any, groupMembers: any[], generatedBy: string, t: any, language?: string) {
  const village = group.village || "—";
  const taluka = group.taluka || "—";
  const district = group.district || "—";
  const code = group.uniqueGroupCode || group.groupCode || "—";
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  const now = formatDateTime(new Date());
  // Language label: always show the language name in BOTH scripts so it
  // is self-describing regardless of the reader's language.
  // e.g.  "English"  or  "मराठी / Marathi"
  const langLabel = language === "mr" ? "मराठी" : "English";
  return `
    <div class="page-header">
      <div class="shg-name">${group.name || "SHG"}</div>
      <div class="shg-address">${village}, ${taluka}, ${district}</div>
      <div class="meta-grid">
        <div class="meta-item"><div class="meta-label">${t("common.pdf_group_code")}</div><div class="meta-value">${code}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_village")}</div><div class="meta-value">${village}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_taluka_district")}</div><div class="meta-value">${taluka} / ${district}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_president")}</div><div class="meta-value">${pres}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_treasurer")}</div><div class="meta-value">${treas}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_generated_on_label")}</div><div class="meta-value">${now}</div></div>
        <div class="meta-item"><div class="meta-label">${t("common.pdf_language")}</div><div class="meta-value">${langLabel}</div></div>
      </div>
    </div>
    <div class="report-banner">
      <div class="report-banner-title">${reportTitle}</div>
      <div class="report-banner-sub">${t("common.pdf_generated_by_label")}: ${generatedBy}</div>
    </div>
  `;
}

// ─── Filters Banner ───────────────────────────────────────────────────────────

function buildFilters(filters: { label: string; value: string }[], t: any) {
  if (!filters || filters.length === 0) return "";
  const badges = filters.map((f) => `<span class="filter-badge"><strong>${f.label}:</strong> ${f.value}</span>`).join("");
  return `<div class="filters-banner"><div class="filters-title">${t("common.pdf_applied_filters")}</div><div class="filters-row">${badges}</div></div>`;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function buildFooter(presName: string, treasName: string, t: any) {
  return `
    <div class="signatures-section">
      <div class="sig-row">
        <div class="sig-block"><div class="sig-line">${t("common.pdf_president_signature")}</div><div class="sig-name">${presName}</div></div>
        <div class="sig-block"><div class="sig-line">${t("common.pdf_treasurer_signature")}</div><div class="sig-name">${treasName}</div></div>
      </div>
    </div>
    <div class="page-footer">
      <span>${t("common.pdf_official_report")}</span>
    </div>
  `;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  const s = (status || "").toLowerCase().replace(/ /g, "_");
  if (["confirmed", "approved", "active", "completed"].includes(s)) return '<span class="badge badge-green">' + status + '</span>';
  if (["pending", "declared", "treasurer_approved", "president_approved"].includes(s)) return '<span class="badge badge-yellow">' + status + '</span>';
  if (s === "rejected") return '<span class="badge badge-red">' + status + '</span>';
  return '<span class="badge badge-gray">' + status + '</span>';
}

// ─── Open as PDF ──────────────────────────────────────────────────────────────
//
// Platform routing:
//   Web     → Blob URL in new tab → browser print dialog → revokeObjectURL on afterprint
//   Android → printToFileAsync({html}) → shareAsync(uri)  [fallback: printAsync({uri})]
//   iOS     → printToFileAsync({html}) → shareAsync(uri, UTI:"com.adobe.pdf")
//
// API verification (expo-print ~15.0.8 / Expo SDK 54):
//   • printToFileAsync({ html })  — supported: android + ios + web (Print.d.ts)
//   • printAsync({ uri })         — supported: android + ios (PrintOptions.uri field confirmed
//                                   in Print.types.d.ts with @platform android @platform ios)
//   • printAsync({ html })        — supported: android + ios (but ignored on web per Expo docs)
//
// HTML generation is ALWAYS the same shared function.
// Only the final delivery differs per platform.

async function openAsPdf(html: string, filename: string) {
  // ── WEB ─────────────────────────────────────────────────────────────────────
  // We create a Blob from our HTML string and open it in a NEW tab.
  // The new tab renders ONLY our Blob — the React app DOM is never involved.
  // Memory management: URL.revokeObjectURL() is called:
  //   1. Immediately after the print dialog closes (via "afterprint" event)
  //   2. As a safety fallback after 2 minutes (in case afterprint doesn't fire)
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");

    if (!win) {
      // Pop-up blocked — navigate same tab to our HTML (no React UI involved)
      window.location.href = url;
      return;
    }

    // Schedule safety revocation after 2 minutes (catches cases where
    // afterprint doesn't fire, e.g. user closes tab without printing)
    const safetyRevoke = setTimeout(() => URL.revokeObjectURL(url), 120_000);

    // Poll until the document is ready, then trigger print and set up revocation
    let attempts = 0;
    const tryPrint = setInterval(() => {
      attempts++;
      try {
        if (win.document && win.document.readyState === "complete") {
          clearInterval(tryPrint);
          win.focus();

          // Revoke immediately after print dialog closes (best case)
          win.addEventListener("afterprint", () => {
            URL.revokeObjectURL(url);
            clearTimeout(safetyRevoke);
          }, { once: true });

          win.print();
        }
      } catch {
        // blob: URL same-origin check — document not ready yet, retry
      }
      if (attempts > 40) clearInterval(tryPrint); // max 4s polling
    }, 100);
    return;
  }

  // ── NATIVE (Android + iOS) ──────────────────────────────────────────────────
  // printToFileAsync({ html }) renders our HTML string in a headless WebView
  // (completely off-screen, isolated from the app UI) and returns a file:// URI
  // to the generated PDF. We then share that PDF file via the native share sheet.
  //
  // Fallback: if sharing is unavailable, Print.printAsync({ uri }) opens the
  // native system print dialog with the pre-generated PDF file — confirmed
  // supported in expo-print 15.0.8 PrintOptions type definition.
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      // Android → native share sheet (WhatsApp, Drive, Email, etc.)
      // iOS     → share sheet with AirDrop, Files, Print, etc.
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: filename,
        UTI: "com.adobe.pdf", // iOS: registers file type for PDF viewers
      });
    } else {
      // Fallback: open native system print dialog with the PDF file URI.
      // Print.printAsync({ uri }) is confirmed supported on Android + iOS
      // per expo-print 15.0.8 Print.types.d.ts (PrintOptions.uri field).
      await Print.printAsync({ uri });
    }
  } catch (err: any) {
    console.error("[pdf-generator] openAsPdf error:", err);
    Alert.alert("Error", "Failed to generate PDF.\n" + (err?.message || ""));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SAVINGS REPORT
// ═══════════════════════════════════════════════════════════════════════════════


export async function generateLoanPassbookReport(
  loan: any,
  member: any,
  entries: any[],
  group: any,
  t: any
) {
  const isReducingBalance = loan?.calculationMethod === 'reducing_balance';
  let tablesHtml = `
    <div style="margin-bottom:20px; border:1px solid #ddd; padding:15px; border-radius:8px;">
      <h3 style="margin-top:0;">${t("loan_summary")}</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr>
          <td style="padding:4px 0;"><strong>${t("loanAmount")}:</strong> Rs. ${loan.amount.toLocaleString("en-IN")}</td>
          <td style="padding:4px 0;"><strong>${t("interest")}:</strong> ${loan.interest}%</td>
          <td style="padding:4px 0;"><strong>${t("duration")}:</strong> ${loan.duration} ${t("auto.mo")}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>${t("outstanding_principal")}:</strong> Rs. ${Math.max(0, loan.remainingBalance).toLocaleString("en-IN")}</td>
          <td style="padding:4px 0;"><strong>${t("outstanding_interest")}:</strong> Rs. ${Math.max(0, loan.outstandingInterest || 0).toLocaleString("en-IN")}</td>
          <td style="padding:4px 0;"><strong>${t("loan_status")}:</strong> ${loan.remainingBalance <= 0 ? t("completed") : t("active_status")}</td>
        </tr>
      </table>
    </div>
  `;

  if (isReducingBalance && loan.remainingBalance > 0) {
    const rec = getCurrentLoanRecommendation(loan);
    tablesHtml += `
      <div style="margin-bottom:20px; border:1px solid #ddd; padding:15px; border-radius:8px; background-color: #f8fafc;">
        <h4 style="margin-top:0; color: #0f172a;">${t("recommended_monthly_payment")}</h4>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr>
            <td style="padding:4px 0;"><strong>${t("principal_portion")}:</strong> Rs. ${rec.recommendedPrincipal.toLocaleString("en-IN")}</td>
            <td style="padding:4px 0;"><strong>${t("interest_portion")}:</strong> Rs. ${rec.currentMonthInterest.toLocaleString("en-IN")}</td>
            <td style="padding:4px 0;"><strong>${t("total_payable_this_month")}:</strong> Rs. ${rec.recommendedMonthlyPayment.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;"><strong>${t("remainingMonths") || "Remaining Months"}:</strong> ${rec.remainingMonths} ${t("auto.mo")}</td>
            <td style="padding:4px 0;"><strong>${t("fixed_principal_installment") || "Fixed Installment"}:</strong> Rs. ${rec.fixedPrincipalInstallment.toLocaleString("en-IN")}</td>
            <td style="padding:4px 0;">${rec.outstandingInterest > 0 ? `<strong style="color:red;">${t("outstanding_interest_due")}:</strong> <span style="color:red;">Rs. ${rec.outstandingInterest.toLocaleString("en-IN")}</span>` : ''}</td>
          </tr>
        </table>
      </div>
    `;
  }

  tablesHtml += `<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:10px;">
    <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:6px; text-align:left;">${t("receipt_number")}</th>
      <th style="padding:6px; text-align:left;">${t("date")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_opening_principal")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_interest_charged")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_interest_paid")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_principal_paid")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_total_payment")}</th>
      <th style="padding:6px; text-align:right;">${t("pdf_closing_principal")}</th>
      <th style="padding:6px; text-align:right;">${t("outstanding_interest")}</th>
      <th style="padding:6px; text-align:left; width: 15%">${t("remarks")}</th>
    </tr>`;

  for (let i = 0; i < entries.length; i++) {
    const r = entries[i];
    const isRowRB = isReducingBalance;
    const dateStr = formatDate(isRowRB ? (r.date) : r.date);
    
    tablesHtml += `<tr style="border-bottom:1px solid #e2e8f0; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'};">
      <td style="padding:6px;">${r.receiptNo || 'R-'+(i+1)}</td>
      <td style="padding:6px;">${dateStr}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.openingPrincipal || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.interestCharged || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.interestPaid || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.principalPaid || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:right; font-weight:bold;">${isRowRB ? Math.round(r.paymentReceived || 0).toLocaleString("en-IN") : Math.round(r.amount || 0).toLocaleString("en-IN")}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.closingPrincipal || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:right;">${isRowRB ? Math.round(r.outstandingInterest || 0).toLocaleString("en-IN") : '—'}</td>
      <td style="padding:6px; text-align:left;">${isRowRB && r.type === 'disbursement' ? t("ledger_loan_disbursed") : (r.remarks || t("ledger_repayment"))}</td>
    </tr>`;
  }

  tablesHtml += `</table>`;
  
  const finalHtml = buildStandardPdfTemplate({
    title: t("passbook") + " - " + (member ? member.name : "Unknown"),
    group,
    presidentName: "—",
    treasurerName: "—",
    generatedBy: "System",
    period: "All Time",
    reportId: generateReportId(),
    tablesHtml,
    t
  });
  
  return openAsPdf(finalHtml, `Loan_Passbook_${member?.name?.replace(/\s+/g, "_") || 'Unknown'}.pdf`);
}

// ─── BANK LOAN PDF FUNCTIONS ──────────────────────────────────────────────────
// These functions are completely independent of the Internal SHG Loan PDFs.
// They read from the immutable bank_loan_ledger and allocation snapshots.

/**
 * Generate a professional banking-style passbook PDF for a member's bank loan allocation.
 */
export async function generateBankLoanPassbookPDF({
  allocation,
  bankLoan,
  member,
  ledger,
  group,
  t,
  language,
}: {
  allocation: any;
  bankLoan: any;
  member: any;
  ledger: any[];
  group: any;
  t: (key: string) => string;
  language: string;
}) {
  const RUPEE = "\u20B9";
  const today = formatDateTime(new Date());
  const sortedLedger = [...ledger].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalInterestCharged = sortedLedger.reduce((sum, e) => sum + (e.interestCharged || 0), 0);
  
  let tablesHtml = `
  <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
    <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; font-size: 14px;">${bankLoan.bankName}</h3>
    <div style="font-size: 10px; color: #475569; margin-bottom: 10px;">
      ${bankLoan.branch || ""} ${bankLoan.accountNumber ? "| A/C: " + bankLoan.accountNumber : ""} ${bankLoan.ifscCode ? "| IFSC: " + bankLoan.ifscCode : ""}
    </div>
    
    <table style="width: 100%; font-size: 10px; margin-bottom: 0; border: none;">
      <tr>
        <td style="border: none; padding: 4px 0;"><strong>${t("bank_loan.account_holder")}:</strong> ${member.name}</td>
        <td style="border: none; padding: 4px 0;"><strong>${t("bank_loan.allocated_principal")}:</strong> Rs. ${allocation.allocatedPrincipal.toLocaleString("en-IN")}</td>
        <td style="border: none; padding: 4px 0;"><strong>${t("annualInterestRate")}:</strong> ${bankLoan.annualInterestRate}% p.a.</td>
      </tr>
      <tr>
        <td style="border: none; padding: 4px 0;"><strong>${t("durationMonths")}:</strong> ${bankLoan.durationMonths} ${t("auto.mo", {defaultValue: "months"})}</td>
        <td style="border: none; padding: 4px 0;"><strong>${t("sanctionDate")}:</strong> ${formatDate(bankLoan.sanctionDate)}</td>
        <td style="border: none; padding: 4px 0;"></td>
      </tr>
    </table>
  </div>

  <h3 style="font-size: 12px; margin-bottom: 10px; color: #0f172a;">${t("bank_loan.account_summary")}</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding: 6px; text-align: left; border: 1px solid #0f172a;">${t("bank_loan.detail")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.amount")}</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.allocated_principal")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Rs. ${allocation.allocatedPrincipal.toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.principal_paid")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #166534;">Rs. ${allocation.totalPrincipalPaid.toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.interest_paid")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #166534;">Rs. ${allocation.totalInterestPaid.toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.outstanding_principal")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: ${allocation.outstandingBalance > 0 ? '#991b1b' : '#166534'};">Rs. ${allocation.outstandingBalance.toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.outstanding_interest")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: ${allocation.outstandingInterest > 0 ? '#991b1b' : '#166534'};">Rs. ${allocation.outstandingInterest.toLocaleString("en-IN")}</td></tr>
      <tr style="background: #e2e8f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.total_outstanding")}</td><td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #991b1b;">Rs. ${(allocation.outstandingBalance + allocation.outstandingInterest).toLocaleString("en-IN")}</td></tr>
    </tbody>
  </table>

  <h3 style="font-size: 12px; margin-bottom: 10px; color: #0f172a;">${t("bank_loan.passbook")}</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding: 6px; text-align: left; border: 1px solid #0f172a;">${t("bank_loan.date")}</th>
        <th style="padding: 6px; text-align: left; border: 1px solid #0f172a;">${t("bank_loan.receipt_no")}</th>
        <th style="padding: 6px; text-align: left; border: 1px solid #0f172a;">${t("bank_loan.particulars")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.opening_principal")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.interest_charged")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.principal_paid")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.total_payment")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.closing_principal")}</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #0f172a;">${t("bank_loan.outstanding_interest")}</th>
      </tr>
    </thead>
    <tbody>`;

  sortedLedger.forEach((entry, i) => {
    const isDisbursement = entry.type === "disbursement";
    tablesHtml += `
      <tr style="background: ${isDisbursement ? '#dcfce7' : (i % 2 === 0 ? '#fff' : '#f8fafc')};">
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${formatDate(entry.date)}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${entry.receiptNo || "—"}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${isDisbursement ? t("bank_loan.disbursement") : t("bank_loan.repayment")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${(entry.openingPrincipal || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${(entry.interestCharged || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${(entry.principalPaid || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${(entry.paymentReceived || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color:${(entry.closingPrincipal || 0) > 0 ? '#991b1b' : '#166534'}">${(entry.closingPrincipal || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color:${(entry.outstandingInterest || 0) > 0 ? '#991b1b' : '#166534'}">${(entry.outstandingInterest || 0).toLocaleString("en-IN")}</td>
      </tr>`;
  });

  tablesHtml += `
      <tr style="background: #e2e8f0; font-weight: bold; border-top: 2px solid #0f172a;">
        <td colspan="3" style="padding: 6px; border: 1px solid #cbd5e1;">${t("bank_loan.total")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">—</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${totalInterestCharged.toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${allocation.totalPrincipalPaid.toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${(allocation.totalPrincipalPaid + allocation.totalInterestPaid).toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #991b1b;">${allocation.outstandingBalance.toLocaleString("en-IN")}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #991b1b;">${allocation.outstandingInterest.toLocaleString("en-IN")}</td>
      </tr>
    </tbody>
  </table>`;

  const finalHtml = buildStandardPdfTemplate({
    title: t("bank_loan.passbook", { defaultValue: "Bank Loan Passbook" }),
    group,
    presidentName: group?.presidentName || "—",
    treasurerName: group?.treasurerName || "—",
    generatedBy: "System",
    period: "All Time",
    reportId: generateReportId(),
    tablesHtml,
    t
  });

  return openAsPdf(
    finalHtml,
    `BankLoan_Passbook_${member?.name?.replace(/\s+/g, "_") || "Unknown"}.pdf`
  );
}

/**
 * Generate a Group Bank Loan Statement PDF (President/Treasurer view).
 * Shows sanctioned amount, all member allocations, recovery summary.
 */



// ─── NEW REPORT REDESIGN TEMPLATE ENGINE ──────────────────────────────────────

function getStandardCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 15mm 15mm; size: A4 portrait; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; line-height: 1.4; }
    
    /* Header */
    .header-container { display: flex; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
    .header-logo { width: 50px; height: 50px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #0f172a; border: 2px solid #cbd5e1; margin-right: 15px; }
    .header-details { flex: 1; }
    .shg-title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .shg-address { font-size: 9px; color: #475569; margin-top: 2px; }
    .report-meta { text-align: right; font-size: 9px; color: #475569; }
    .report-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; text-transform: uppercase; }
    
    /* Executive Summary */
    .exec-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .summary-box { text-align: center; }
    .summary-label { font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
    .summary-val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    
    /* Tables (Passbook Style) */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #0f172a; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    tr.total-row td { background: #e2e8f0; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; }
    
    /* Alignments */
    .r { text-align: right; }
    .c { text-align: center; }
    
    /* Badges */
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; }
    .badge-g { background: #dcfce7; color: #166534; }
    .badge-r { background: #fee2e2; color: #991b1b; }
    .badge-y { background: #fef9c3; color: #854d0e; }
    .badge-b { background: #dbeafe; color: #1e40af; }
    
    /* Signatures */
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #94a3b8; page-break-inside: avoid; }
    .sig-box { width: 150px; text-align: center; }
    .sig-line { border-bottom: 1px solid #0f172a; height: 40px; margin-bottom: 5px; }
    .sig-role { font-weight: 700; font-size: 9px; }
    .sig-name { font-size: 8px; color: #64748b; }
    
    /* Footer & Verification */
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; }
    .verification-box { border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; text-align: center; background: #f8fafc; max-width: 200px; margin: 20px auto 0; page-break-inside: avoid; }
    .qr-placeholder { width: 60px; height: 60px; border: 1px dashed #94a3b8; margin: 4px auto; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; }
  `;
}

function buildStandardPdfTemplate(params: {
  title: string;
  group: any;
  presidentName: string;
  treasurerName: string;
  secretaryName?: string;
  generatedBy: string;
  period?: string;
  reportId: string;
  execSummaryHtml?: string;
  tablesHtml: string;
  t: any;
}) {
  const { title, group, presidentName, treasurerName, secretaryName, generatedBy, period, reportId, execSummaryHtml, tablesHtml, t } = params;
  
  const village = group.village || "—";
  const taluka = group.taluka || "—";
  const district = group.district || "—";
  const regNo = group.uniqueGroupCode || "—";
  const now = formatDateTime(new Date());

  const header = `
    <div class="header-container">
      <div class="header-logo">SHG</div>
      <div class="header-details">
        <div class="shg-title">${group.name || "SHG Name"}</div>
        <div class="shg-address">${village}, Tal: ${taluka}, Dist: ${district} | Reg No: ${regNo}</div>
      </div>
      <div class="report-meta">
        <div class="report-title">${title}</div>
        <div>${period ? period : ""}</div>
        <div>${t("pdf_generated_by_label", { defaultValue: "Generated By" })}: ${generatedBy}</div>
        <div>${t("pdf_generated_on_label", { defaultValue: "Generated On" })}: ${now}</div>
      </div>
    </div>
  `;

  const signatures = `
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-role">${t("pdf_signature_president", { defaultValue: "President" })}</div>
        <div class="sig-name">${presidentName}</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-role">${t("pdf_signature_treasurer", { defaultValue: "Treasurer" })}</div>
        <div class="sig-name">${treasurerName}</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-role">${t("pdf_signature_secretary", { defaultValue: "Secretary" })}</div>
        <div class="sig-name">${secretaryName || "—"}</div>
      </div>
    </div>
  `;

  const verification = `
    <div class="verification-box">
      <div><strong>${t("pdf_verification", { defaultValue: "Verification" })}</strong></div>
      <div class="qr-placeholder">${reportId}</div>
      <div>${t("pdf_report_id", { defaultValue: "Report ID" })}: ${reportId}</div>
    </div>
  `;

  const footer = `
    <div class="footer">
      <div>${t("pdf_footer_platform", { defaultValue: "Generated by SHG Digital Record Platform" })}</div>
      <div>Report ID: ${reportId}</div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>${getStandardCss()}</style>
      </head>
      <body>
        ${header}
        ${execSummaryHtml || ""}
        ${tablesHtml}
        ${signatures}
        ${verification}
        ${footer}
      </body>
    </html>
  `;
}

function generateReportId() {
  return "RPT-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + new Date().getTime().toString().slice(-4);
}

function getStatusBadgeStandard(status: string, t: any) {
  const s = (status || "").toLowerCase().replace(/ /g, "_");
  let label = status;
  let cssClass = "badge-b"; // default blue
  
  if (["confirmed", "approved", "active", "completed", "on_time"].includes(s)) {
    cssClass = "badge-g";
    if (s === "completed") label = t("pdf_completed", { defaultValue: "Completed" });
    if (s === "on_time") label = t("pdf_on_time", { defaultValue: "On Time" });
  } else if (["pending", "delayed"].includes(s)) {
    cssClass = "badge-y";
    if (s === "delayed") label = t("pdf_delayed", { defaultValue: "Delayed" });
  } else if (["rejected", "overdue"].includes(s)) {
    cssClass = "badge-r";
    if (s === "overdue") label = t("pdf_overdue", { defaultValue: "Overdue" });
  }
  return `<span class="badge ${cssClass}">${label}</span>`;
}

// ─── 1. Savings Report ────────────────────────────────────────────────────────

export async function generateSavingsReport({ group, groupMembers, payments, timeRange, startDate, endDate, filterMonth, filterYear, paymentMethod, appliedFiltersText, t, user }: any) {
  let filtered = filterPaymentsByContributionPeriod(payments, timeRange, startDate, endDate, filterMonth, filterYear);
  if (paymentMethod && paymentMethod !== "all") {
    filtered = filtered.filter((p: any) => p.mode === paymentMethod);
  }
  
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const confirmed = filtered.filter((p: any) => p.status === "confirmed");
  const totalCollected = confirmed.reduce((sum: number, p: any) => sum + p.amount, 0);
  const totalLate = confirmed.reduce((sum: number, p: any) => sum + (p.lateFee || 0), 0);
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">${t("pdf_total_collected", {defaultValue:"Total Collected"})}</div><div class="summary-val">${formatCurrency(totalCollected)}</div></div>
      <div class="summary-box"><div class="summary-label">${t("pdf_late_fees", {defaultValue:"Late Fees"})}</div><div class="summary-val">${formatCurrency(totalLate)}</div></div>
      <div class="summary-box"><div class="summary-label">${t("pdf_members_with_payments", {defaultValue:"Members Paid"})}</div><div class="summary-val">${new Set(confirmed.map((p:any)=>p.memberId)).size}</div></div>
      <div class="summary-box"><div class="summary-label">${t("pdf_applied_filters", {defaultValue:"Filters"})}</div><div class="summary-val" style="font-size:10px">${appliedFiltersText || "All"}</div></div>
    </div>
  `;

  let rows = filtered.map((p: any, i: number) => {
    return `<tr>
      <td class="c">${i + 1}</td>
      <td>${p.memberName}</td>
      <td class="c">${formatDate(p.date || p.createdAt)}</td>
      <td class="r">${formatCurrency(p.amount)}</td>
      <td class="r">${formatCurrency(p.lateFee || 0)}</td>
      <td class="c">${p.mode === "online" ? "Online" : "Cash"}</td>
      <td class="c">${getStatusBadgeStandard(p.status, t)}</td>
      <td>${p.month || "—"}</td>
    </tr>`;
  }).join("");

  if (filtered.length === 0) {
    rows = `<tr><td colspan="8" class="c">No savings found for this period.</td></tr>`;
  }

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_receipt_no", {defaultValue:"Receipt"})}</th>
          <th>${t("pdf_member_name", {defaultValue:"Member Name"})}</th>
          <th class="c">${t("pdf_date", {defaultValue:"Date"})}</th>
          <th class="r">${t("pdf_amount", {defaultValue:"Amount"})}</th>
          <th class="r">${t("pdf_late_fee", {defaultValue:"Late Fee"})}</th>
          <th class="c">${t("pdf_method", {defaultValue:"Method"})}</th>
          <th class="c">${t("pdf_status", {defaultValue:"Status"})}</th>
          <th>${t("pdf_month", {defaultValue:"Month"})}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.monthly_savings_report", {defaultValue: "Monthly Savings Report"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Savings_Report.pdf");
}

// ─── 2. Member Passbook ───────────────────────────────────────────────────────

export async function generateMemberPassbook({ group, groupMembers, member, payments, loans, loanRepayments, bankAllocations, loanLedger, bankLoanLedger, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const mPayments = payments.filter((p:any) => p.memberId === member.id && p.status === "confirmed");
  const mLoanLedger = (loanLedger || []).filter((l:any) => {
     const loan = loans.find((ln:any)=>ln.id === l.loanId);
     return loan && loan.memberId === member.id;
  });
  const mBankLoanLedger = (bankLoanLedger || []).filter((l:any) => {
     const alloc = (bankAllocations || []).find((a:any)=>a.id === l.allocationId);
     return alloc && alloc.memberId === member.id;
  });
  
  const totalSavings = mPayments.reduce((s:number,p:any)=>s+p.amount, 0);
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">${t("pdf_member_name", {defaultValue:"Member Name"})}</div><div class="summary-val">${member.name}</div></div>
      <div class="summary-box"><div class="summary-label">Member ID</div><div class="summary-val">${member.id.substring(0,6).toUpperCase()}</div></div>
      <div class="summary-box"><div class="summary-label">Join Date</div><div class="summary-val">${formatDate(member.joinDate || member.createdAt)}</div></div>
      <div class="summary-box"><div class="summary-label">${t("pdf_total_savings", {defaultValue:"Total Savings"})}</div><div class="summary-val">${formatCurrency(totalSavings)}</div></div>
    </div>
  `;

  // Profile Summary (above tables)
  const profileTable = `
    <h3 style="margin: 0px 0 8px; font-size: 12px;">Member Profile Summary</h3>
    <table style="margin-bottom: 24px;">
      <tr>
        <td style="font-weight: 600; width: 25%;">Name</td><td style="width: 25%;">${member.name}</td>
        <td style="font-weight: 600; width: 25%;">Mobile Number</td><td style="width: 25%;">${member.phone}</td>
      </tr>
      <tr>
        <td style="font-weight: 600;">Joining Date</td><td>${formatDate(member.joinDate || member.createdAt)}</td>
        <td style="font-weight: 600;">Role</td><td style="text-transform: capitalize;">${member.role}</td>
      </tr>
      <tr>
        <td style="font-weight: 600;">SHG Name</td><td>${group.name}</td>
        <td style="font-weight: 600;">Status</td><td>${getStatusBadgeStandard(member.status, t)}</td>
      </tr>
    </table>
  `;

  let savingsRows = filterPaymentsByContributionPeriod(mPayments, timeRange, startDate, endDate, filterMonth, filterYear).map((p:any, i:number) => {
    return `<tr>
      <td class="c">${i+1}</td>
      <td class="c">${formatDate(p.date || p.createdAt)}</td>
      <td>Savings (${p.month || '-'}) ${p.mode==='online'?'[Online]':''}</td>
      <td class="r">—</td>
      <td class="r">${formatCurrency(p.amount)}</td>
      <td class="r">—</td>
      <td>${p.lateFee ? 'Late Fee: '+formatCurrency(p.lateFee) : ''}</td>
    </tr>`;
  }).join("");
  if(!savingsRows) savingsRows = `<tr><td colspan="7" class="c">No savings records found.</td></tr>`;

  let internalLoanRows = filterByDateRange(mLoanLedger, timeRange, startDate, endDate, filterMonth, filterYear).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((l:any, i:number) => {
    const isDisb = l.type === "disbursement";
    return `<tr style="background: ${isDisb ? '#f8fafc' : '#fff'}">
      <td class="c">${formatDate(l.date)}</td>
      <td class="c">${l.receiptNo || "—"}</td>
      <td>${isDisb ? "Disbursement" : "Repayment"}</td>
      <td class="r">${formatCurrency(l.paymentReceived || 0)}</td>
      <td class="r">${formatCurrency(isDisb ? l.closingPrincipal : l.principalPaid)}</td>
      <td class="r">${formatCurrency(l.interestPaid || 0)}</td>
      <td class="r"><b>${formatCurrency(l.closingPrincipal || 0)}</b></td>
      <td class="r">${formatCurrency(l.outstandingInterest || 0)}</td>
    </tr>`;
  }).join("");
  if(!internalLoanRows) internalLoanRows = `<tr><td colspan="8" class="c">No internal loan transactions found.</td></tr>`;

  let bankLoanRows = filterByDateRange(mBankLoanLedger, timeRange, startDate, endDate, filterMonth, filterYear).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((l:any, i:number) => {
    const isDisb = l.type === "disbursement";
    return `<tr style="background: ${isDisb ? '#f8fafc' : '#fff'}">
      <td class="c">${formatDate(l.date)}</td>
      <td class="c">${l.receiptNo || "—"}</td>
      <td>${isDisb ? "Disbursement" : "Repayment"}</td>
      <td class="r">${formatCurrency(l.paymentReceived || 0)}</td>
      <td class="r">${formatCurrency(isDisb ? l.closingPrincipal : l.principalPaid)}</td>
      <td class="r">${formatCurrency(l.interestPaid || 0)}</td>
      <td class="r"><b>${formatCurrency(l.closingPrincipal || 0)}</b></td>
      <td class="r">${formatCurrency(l.outstandingInterest || 0)}</td>
    </tr>`;
  }).join("");
  if(!bankLoanRows) bankLoanRows = `<tr><td colspan="8" class="c">No bank loan transactions found.</td></tr>`;

  const tables = `
    ${profileTable}
    
    <h3 style="margin: 15px 0 8px; font-size: 12px; color: #0f172a;">Savings Passbook</h3>
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_receipt_no", {defaultValue:"Receipt"})}</th>
          <th class="c">${t("pdf_date", {defaultValue:"Date"})}</th>
          <th>${t("pdf_particulars", {defaultValue:"Particulars"})}</th>
          <th class="r">${t("pdf_debit", {defaultValue:"Debit"})}</th>
          <th class="r">${t("pdf_credit", {defaultValue:"Credit"})}</th>
          <th class="r">${t("pdf_balance", {defaultValue:"Balance"})}</th>
          <th>${t("pdf_remarks", {defaultValue:"Remarks"})}</th>
        </tr>
      </thead>
      <tbody>${savingsRows}</tbody>
    </table>
    
    <h3 style="margin: 25px 0 8px; font-size: 12px; color: #0f172a;">Internal Loan Passbook</h3>
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_date", {defaultValue:"Date"})}</th>
          <th class="c">${t("pdf_receipt_no", {defaultValue:"Receipt"})}</th>
          <th>${t("pdf_particulars", {defaultValue:"Particulars"})}</th>
          <th class="r">Cash/Bank In</th>
          <th class="r">Principal</th>
          <th class="r">Interest</th>
          <th class="r">Bal. Principal</th>
          <th class="r">Bal. Interest</th>
        </tr>
      </thead>
      <tbody>${internalLoanRows}</tbody>
    </table>
    
    <h3 style="margin: 25px 0 8px; font-size: 12px; color: #0f172a;">Bank Loan Passbook</h3>
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_date", {defaultValue:"Date"})}</th>
          <th class="c">${t("pdf_receipt_no", {defaultValue:"Receipt"})}</th>
          <th>${t("pdf_particulars", {defaultValue:"Particulars"})}</th>
          <th class="r">Cash/Bank In</th>
          <th class="r">Principal</th>
          <th class="r">Interest</th>
          <th class="r">Bal. Principal</th>
          <th class="r">Bal. Interest</th>
        </tr>
      </thead>
      <tbody>${bankLoanRows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.member_passbook", {defaultValue: "Member Passbook"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, `Passbook_${member.name}.pdf`);
}

// ─── 3. SHG Financial Report ──────────────────────────────────────────────────

export async function generateFinancialReport({ group, groupMembers, payments, loans, loanRepayments, loanLedger, language, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  // Date filtered array for period-specific tables (if we wanted to show them, but here it's an overview)
  
  // 1. Backend-identical dashboard calculations (global, not time-filtered)
  const totalSavings = payments.filter((p:any) => p.status === "confirmed" && p.amount > 0).reduce((sum:number, p:any) => sum + p.amount, 0);
  const totalLate = payments.filter((p:any) => p.status === "confirmed" && p.lateFee > 0).reduce((sum:number, p:any) => sum + p.lateFee, 0);
  
  const approvedLoans = loans.filter((l:any) => ["approved", "completed"].includes(l.status));
  const totalDisbursed = approvedLoans.reduce((sum:number, l:any) => sum + l.amount, 0);
  const principalCollected = approvedLoans.reduce((sum:number, l:any) => sum + (l.totalPrincipalPaid || 0), 0);
  const interestCollected = approvedLoans.reduce((sum:number, l:any) => sum + (l.totalInterestPaid || 0), 0);
  
  const legacyTotalRepayments = loanRepayments.reduce((sum:number, r:any) => sum + resolveRepaymentAmounts(r).shgAmount, 0);
  const totalRepaymentsForCash = Math.max(legacyTotalRepayments, principalCollected + interestCollected);
  const currentBalance = totalSavings + totalLate + totalRepaymentsForCash - totalDisbursed;
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Savings (All Time)</div><div class="summary-val">${formatCurrency(totalSavings)}</div></div>
      <div class="summary-box"><div class="summary-label">Total Disbursed (All Time)</div><div class="summary-val">${formatCurrency(totalDisbursed)}</div></div>
      <div class="summary-box"><div class="summary-label">Total Recovered (All Time)</div><div class="summary-val">${formatCurrency(principalCollected + interestCollected)}</div></div>
      <div class="summary-box"><div class="summary-label">Current Cash/Bank Balance</div><div class="summary-val" style="color:#166534;">${formatCurrency(currentBalance)}</div></div>
    </div>
  `;

  const tables = `
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="r">Inflow (Credit)</th>
          <th class="r">Outflow (Debit)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Member Savings</td><td class="r">${formatCurrency(totalSavings)}</td><td class="r">—</td></tr>
        <tr><td>Late Fees & Penalties</td><td class="r">${formatCurrency(totalLate)}</td><td class="r">—</td></tr>
        <tr><td>Loan Principal Recovered</td><td class="r">${formatCurrency(principalCollected)}</td><td class="r">—</td></tr>
        <tr><td>Loan Interest Recovered</td><td class="r">${formatCurrency(interestCollected)}</td><td class="r">—</td></tr>
        <tr><td>Internal Loans Disbursed</td><td class="r">—</td><td class="r">${formatCurrency(totalDisbursed)}</td></tr>
        <tr class="total-row"><td>Total SHG Funds</td><td class="r">${formatCurrency(totalSavings+totalLate+principalCollected+interestCollected)}</td><td class="r">${formatCurrency(totalDisbursed)}</td></tr>
      </tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.shg_financial_report", {defaultValue: "SHG Financial Report"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Financial_Report.pdf");
}

// ─── 4. Internal Loan Register ────────────────────────────────────────────────

export async function generateInternalLoanRegister({ group, groupMembers, loans, loanLedger, timeRange, startDate, endDate, filterMonth, filterYear, loanFilter, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  let fLoans = loans.filter((l:any)=>["approved", "completed"].includes(l.status));
  if (loanFilter === "active") fLoans = fLoans.filter((l:any)=>l.remainingBalance>0);
  if (loanFilter === "completed") fLoans = fLoans.filter((l:any)=>l.remainingBalance<=0);
  // date filter applies to loan start date
  fLoans = filterByDateRange(fLoans, timeRange, startDate, endDate, filterMonth, filterYear);
  
  const totalOut = fLoans.reduce((s:number,l:any)=>s+(l.remainingBalance||0), 0);
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Loans</div><div class="summary-val">${fLoans.length}</div></div>
      <div class="summary-box"><div class="summary-label">Total Disbursed</div><div class="summary-val">${formatCurrency(fLoans.reduce((s:number,l:any)=>s+l.amount,0))}</div></div>
      <div class="summary-box"><div class="summary-label">Outstanding Principal</div><div class="summary-val">${formatCurrency(totalOut)}</div></div>
      <div class="summary-box"><div class="summary-label">Outstanding Interest</div><div class="summary-val">${formatCurrency(fLoans.reduce((s:number,l:any)=>s+(l.outstandingInterest||0),0))}</div></div>
    </div>
  `;

  let rows = fLoans.map((l:any, i:number) => {
    const member = groupMembers.find((m:any)=>m.id===l.memberId)?.name || "Unknown";
    const status = l.remainingBalance <= 0 ? "completed" : "active";
    const recPct = l.amount > 0 ? (((l.totalPrincipalPaid||0)/l.amount)*100).toFixed(1) : "0.0";
    
    return `<tr>
      <td class="c">${i+1}</td>
      <td>${member}</td>
      <td class="c">${formatDate(l.date || l.createdAt)}</td>
      <td class="r">${formatCurrency(l.amount)}</td>
      <td class="r">${formatCurrency(l.totalPrincipalPaid||0)}</td>
      <td class="r">${formatCurrency(l.totalInterestPaid||0)}</td>
      <td class="r"><b>${formatCurrency(l.remainingBalance||0)}</b></td>
      <td class="r">${recPct}%</td>
      <td class="c">${getStatusBadgeStandard(status, t)}</td>
    </tr>`;
  }).join("");

  if(!rows) rows = `<tr><td colspan="9" class="c">No loans found.</td></tr>`;

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_sr", {defaultValue:"Sr"})}</th>
          <th>${t("pdf_member_name", {defaultValue:"Member Name"})}</th>
          <th class="c">Loan Date</th>
          <th class="r">Amount</th>
          <th class="r">Prin. Paid</th>
          <th class="r">Int. Paid</th>
          <th class="r">Outstanding</th>
          <th class="r">Rec %</th>
          <th class="c">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.internal_loan_register", {defaultValue: "Internal Loan Register"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Internal_Loan_Register.pdf");
}

// ─── 5. Group Bank Loan Register ──────────────────────────────────────────────

export async function generateBankLoanRegister({ group, groupMembers, bankLoans, bankLoanAllocations, bankLoanLedger, timeRange, startDate, endDate, filterMonth, filterYear, loanFilter, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const fLoans = filterByDateRange(bankLoans, timeRange, startDate, endDate, filterMonth, filterYear);
  const totalAlloc = fLoans.reduce((s:number,l:any)=>s+(l.totalAllocatedAmount||0),0);
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Bank Loans</div><div class="summary-val">${fLoans.length}</div></div>
      <div class="summary-box"><div class="summary-label">Total Sanctioned</div><div class="summary-val">${formatCurrency(fLoans.reduce((s:number,l:any)=>s+l.sanctionAmount,0))}</div></div>
      <div class="summary-box"><div class="summary-label">Total Allocated</div><div class="summary-val">${formatCurrency(totalAlloc)}</div></div>
      <div class="summary-box"><div class="summary-label">Total Outstanding</div><div class="summary-val">${formatCurrency(fLoans.reduce((s:number,l:any)=>s+(l.totalOutstandingPrincipal||0),0))}</div></div>
    </div>
  `;

  let rows = fLoans.map((l:any, i:number) => {
    return `<tr>
      <td class="c">${i+1}</td>
      <td>${l.bankName}</td>
      <td class="c">${formatDate(l.sanctionDate)}</td>
      <td class="r">${formatCurrency(l.sanctionAmount)}</td>
      <td class="r">${formatCurrency(l.totalAllocatedAmount)}</td>
      <td class="r">${formatCurrency(l.totalOutstandingPrincipal)}</td>
      <td class="c">${l.durationMonths}m @ ${l.annualInterestRate}%</td>
    </tr>`;
  }).join("");

  if(!rows) rows = `<tr><td colspan="7" class="c">No bank loans found.</td></tr>`;

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_sr", {defaultValue:"Sr"})}</th>
          <th>Bank Name</th>
          <th class="c">Sanction Date</th>
          <th class="r">Sanctioned</th>
          <th class="r">Allocated</th>
          <th class="r">Outstanding</th>
          <th class="c">Terms</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.group_bank_loan_register", {defaultValue: "Group Bank Loan Register"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Bank_Loan_Register.pdf");
}

// ─── 6. Loan Recovery Report (NEW) ────────────────────────────────────────────

export async function generateLoanRecoveryReport({ group, groupMembers, loans, bankLoanAllocations, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const allRecoveries = [];
  
  // Internal Loans
  loans.filter((l:any)=>["approved", "completed"].includes(l.status) && l.remainingBalance > 0).forEach((l:any) => {
    allRecoveries.push({
      member: groupMembers.find((m:any)=>m.id===l.memberId)?.name || "Unknown",
      type: "Internal",
      amount: l.amount,
      outstanding: l.remainingBalance,
      outInt: l.outstandingInterest || 0,
      recPct: l.amount > 0 ? (((l.totalPrincipalPaid||0)/l.amount)*100).toFixed(1) : "0.0"
    });
  });
  
  // Bank Loans
  (bankLoanAllocations || []).filter((b:any)=>b.outstandingPrincipal > 0).forEach((b:any) => {
    allRecoveries.push({
      member: groupMembers.find((m:any)=>m.id===b.memberId)?.name || "Unknown",
      type: "Bank",
      amount: b.allocatedAmount,
      outstanding: b.outstandingPrincipal,
      outInt: b.outstandingInterest || 0,
      recPct: b.allocatedAmount > 0 ? (((b.totalPrincipalPaid||0)/b.allocatedAmount)*100).toFixed(1) : "0.0"
    });
  });
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Active Recoveries</div><div class="summary-val">${allRecoveries.length}</div></div>
      <div class="summary-box"><div class="summary-label">Total Internal Out.</div><div class="summary-val">${formatCurrency(allRecoveries.filter(x=>x.type==="Internal").reduce((s,x)=>s+x.outstanding,0))}</div></div>
      <div class="summary-box"><div class="summary-label">Total Bank Out.</div><div class="summary-val">${formatCurrency(allRecoveries.filter(x=>x.type==="Bank").reduce((s,x)=>s+x.outstanding,0))}</div></div>
      <div class="summary-box"><div class="summary-label">Total Out. Interest</div><div class="summary-val">${formatCurrency(allRecoveries.reduce((s,x)=>s+x.outInt,0))}</div></div>
    </div>
  `;

  let rows = allRecoveries.map((r:any, i:number) => {
    return `<tr>
      <td class="c">${i+1}</td>
      <td>${r.member}</td>
      <td class="c">${r.type}</td>
      <td class="r">${formatCurrency(r.amount)}</td>
      <td class="r"><b>${formatCurrency(r.outstanding)}</b></td>
      <td class="r">${formatCurrency(r.outInt)}</td>
      <td class="r">${r.recPct}%</td>
    </tr>`;
  }).join("");

  if(!rows) rows = `<tr><td colspan="7" class="c">No active loans found.</td></tr>`;

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_sr", {defaultValue:"Sr"})}</th>
          <th>${t("pdf_member_name", {defaultValue:"Member Name"})}</th>
          <th class="c">Type</th>
          <th class="r">Original Amount</th>
          <th class="r">Out. Principal</th>
          <th class="r">Out. Interest</th>
          <th class="r">Rec %</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.loan_recovery_report", {defaultValue: "Loan Recovery Report"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Recovery_Report.pdf");
}

// ─── 7. Member Register ───────────────────────────────────────────────────────

export async function generateMemberRegister({ group, groupMembers, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const activeMembers = groupMembers.filter((m:any) => m.status === "active");
  
  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Members</div><div class="summary-val">${groupMembers.length}</div></div>
      <div class="summary-box"><div class="summary-label">Active</div><div class="summary-val">${activeMembers.length}</div></div>
      <div class="summary-box"><div class="summary-label">Left</div><div class="summary-val">${groupMembers.length - activeMembers.length}</div></div>
      <div class="summary-box"><div class="summary-label">Group Formed</div><div class="summary-val">${formatDate(group.createdAt)}</div></div>
    </div>
  `;

  let rows = groupMembers.map((m:any, i:number) => {
    return `<tr>
      <td class="c">${i+1}</td>
      <td>${m.name}</td>
      <td class="c">${m.phone}</td>
      <td class="c" style="text-transform: capitalize;">${m.role}</td>
      <td class="c">${formatDate(m.joinDate)}</td>
      <td class="c">${getStatusBadgeStandard(m.status, t)}</td>
    </tr>`;
  }).join("");

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_sr", {defaultValue:"Sr"})}</th>
          <th>${t("pdf_member_name", {defaultValue:"Member Name"})}</th>
          <th class="c">Phone</th>
          <th class="c">Role</th>
          <th class="c">Join Date</th>
          <th class="c">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.member_register", {defaultValue: "Member Register"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Member_Register.pdf");
}

// ─── 8. Annual SHG Report (NEW) ───────────────────────────────────────────────

export async function generateAnnualReport({ group, groupMembers, payments, loans, bankLoans, loanLedger, bankLoanLedger, meetings, timeRange, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  const year = parseInt(filterYear);
  const startDate = new Date(year, 0, 1).toISOString();
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
  
  const yPayments = filterPaymentsByContributionPeriod(payments, "year", undefined, undefined, undefined, String(year));
  const yMeetings = filterByDateRange(meetings, "custom", startDate, endDate);
  const yLoans = filterByDateRange(loans, "custom", startDate, endDate);
  const yBankLoans = filterByDateRange(bankLoans, "custom", startDate, endDate);
  const yLoanLedger = filterByDateRange(loanLedger || [], "custom", startDate, endDate);
  const yBankLoanLedger = filterByDateRange(bankLoanLedger || [], "custom", startDate, endDate);

  const savingsCollected = yPayments.filter((p:any)=>p.status==='confirmed').reduce((sum:number, p:any)=>sum+p.amount, 0);
  const lateFeesCollected = yPayments.filter((p:any)=>p.status==='confirmed').reduce((sum:number, p:any)=>sum+(p.lateFee||0), 0);
  const meetingsConducted = yMeetings.filter((m:any)=>m.status==='completed').length;
  
  const intLoansDisbursed = yLoanLedger.filter((l:any)=>l.type==='disbursement').reduce((sum:number, l:any)=>sum+l.closingPrincipal, 0);
  const intPrincipalRecovered = yLoanLedger.filter((l:any)=>l.type==='repayment').reduce((sum:number, l:any)=>sum+l.principalPaid, 0);
  const intInterestRecovered = yLoanLedger.filter((l:any)=>l.type==='repayment').reduce((sum:number, l:any)=>sum+(l.interestPaid||0), 0);

  const bankLoansDisbursed = yBankLoanLedger.filter((l:any)=>l.type==='disbursement').reduce((sum:number, l:any)=>sum+l.closingPrincipal, 0);
  const bankPrincipalRecovered = yBankLoanLedger.filter((l:any)=>l.type==='repayment').reduce((sum:number, l:any)=>sum+l.principalPaid, 0);
  const bankInterestRecovered = yBankLoanLedger.filter((l:any)=>l.type==='repayment').reduce((sum:number, l:any)=>sum+(l.interestPaid||0), 0);

  const totalBankLoansSanctioned = yBankLoans.reduce((sum:number, l:any)=>sum+l.amount, 0);

  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Reporting Year</div><div class="summary-val">${year}</div></div>
      <div class="summary-box"><div class="summary-label">Meetings Held</div><div class="summary-val">${meetingsConducted}</div></div>
      <div class="summary-box"><div class="summary-label">Savings Collected</div><div class="summary-val">${formatCurrency(savingsCollected)}</div></div>
      <div class="summary-box"><div class="summary-label">Internal Disbursed</div><div class="summary-val">${formatCurrency(intLoansDisbursed)}</div></div>
    </div>
  `;

  const tables = `
    <h3 style="margin: 15px 0 8px; font-size: 12px; color: #0f172a;">Core Operations</h3>
    <table>
      <thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
      <tbody>
        <tr><td>Meetings Conducted</td><td class="r">${meetingsConducted}</td></tr>
        <tr><td>Total Savings Collected</td><td class="r">${formatCurrency(savingsCollected)}</td></tr>
        <tr><td>Late Fees & Penalties Collected</td><td class="r">${formatCurrency(lateFeesCollected)}</td></tr>
      </tbody>
    </table>

    <h3 style="margin: 20px 0 8px; font-size: 12px; color: #0f172a;">Internal Loan Operations</h3>
    <table>
      <thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
      <tbody>
        <tr><td>Loans Disbursed to Members</td><td class="r">${formatCurrency(intLoansDisbursed)}</td></tr>
        <tr><td>Principal Recovered from Members</td><td class="r">${formatCurrency(intPrincipalRecovered)}</td></tr>
        <tr><td>Interest Recovered from Members</td><td class="r">${formatCurrency(intInterestRecovered)}</td></tr>
      </tbody>
    </table>

    <h3 style="margin: 20px 0 8px; font-size: 12px; color: #0f172a;">Group Bank Loan Operations</h3>
    <table>
      <thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
      <tbody>
        <tr><td>New Bank Loans Sanctioned (To SHG)</td><td class="r">${formatCurrency(totalBankLoansSanctioned)}</td></tr>
        <tr><td>Bank Loans Disbursed to Members</td><td class="r">${formatCurrency(bankLoansDisbursed)}</td></tr>
        <tr><td>Principal Recovered from Members</td><td class="r">${formatCurrency(bankPrincipalRecovered)}</td></tr>
        <tr><td>Interest Recovered from Members</td><td class="r">${formatCurrency(bankInterestRecovered)}</td></tr>
      </tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.annual_shg_report", {defaultValue: "Annual SHG Report"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, `Annual_Report_${year}.pdf`);
}

// ─── 9. Meeting Register (NEW) ────────────────────────────────────────────────

export async function generateMeetingRegister({ group, groupMembers, meetings, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  // Use filterByDateRange on scheduledDate
  const fMeetings = meetings.filter((m:any) => {
    if (timeRange === "month" && filterMonth && filterYear) {
      const d = new Date(m.scheduledDate);
      return d.getMonth() === parseInt(filterMonth)-1 && d.getFullYear() === parseInt(filterYear);
    }
    return true; // Simplified for this implementation
  });

  const execSummary = `
    <div class="exec-summary">
      <div class="summary-box"><div class="summary-label">Total Meetings</div><div class="summary-val">${fMeetings.length}</div></div>
      <div class="summary-box"><div class="summary-label">Completed</div><div class="summary-val">${fMeetings.filter((m:any)=>m.status==="completed").length}</div></div>
      <div class="summary-box"><div class="summary-label">Scheduled</div><div class="summary-val">${fMeetings.filter((m:any)=>m.status==="scheduled").length}</div></div>
      <div class="summary-box"><div class="summary-label">Cancelled</div><div class="summary-val">${fMeetings.filter((m:any)=>m.status==="cancelled").length}</div></div>
    </div>
  `;

  let rows = fMeetings.map((m:any, i:number) => {
    return `<tr>
      <td class="c">${i+1}</td>
      <td class="c">${formatDate(m.scheduledDate)}</td>
      <td>${m.agenda || '—'}</td>
      <td class="c">${m.attendance ? m.attendance.length : 0}</td>
      <td class="c">${getStatusBadgeStandard(m.status, t)}</td>
    </tr>`;
  }).join("");

  if(!rows) rows = `<tr><td colspan="5" class="c">No meetings found.</td></tr>`;

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_sr", {defaultValue:"Sr"})}</th>
          <th class="c">Date</th>
          <th>Agenda</th>
          <th class="c">Attendance</th>
          <th class="c">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.meeting_register", {defaultValue: "Meeting Register"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    execSummaryHtml: execSummary,
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Meeting_Register.pdf");
}

// ─── 10. Cash Book (NEW) ──────────────────────────────────────────────────────

export async function generateCashBook({ group, groupMembers, payments, loans, loanLedger, bankLoanAllocations, bankLoanLedger, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  const amount = (value: any) => Number(value || 0);
  // The register uses a blank cell where no financial value exists; this keeps
  // missing activity distinct from an entered monetary amount.
  const displayAmount = (value: any) => {
    const numericValue = amount(value);
    return numericValue === 0 ? "" : numericValue.toLocaleString("en-IN");
  };
  const escapeHtml = (value: any) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] as string));
  const recordDate = (item: any) => new Date(item.date || item.paidAt || item.createdAt);
  const reportEnd = endDate ? new Date(endDate) : new Date();
  reportEnd.setHours(23, 59, 59, 999);
  const reportStart = startDate ? new Date(startDate) : undefined;
  if (reportStart) reportStart.setHours(0, 0, 0, 0);
  const monthKeyForDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const reportStartMonth = reportStart ? monthKeyForDate(reportStart) : undefined;
  const reportEndMonth = monthKeyForDate(reportEnd);
  // A contribution belongs to its selected month, even if it was entered later.
  // Records created before the month field existed retain date-based fallback.
  const contributionMonth = (payment: any) => /^\d{4}-(0[1-9]|1[0-2])$/.test(payment.month || "")
    ? payment.month
    : monthKeyForDate(recordDate(payment));
  const isPaymentInPeriod = (payment: any) => {
    const month = contributionMonth(payment);
    return (!reportStartMonth || month >= reportStartMonth) && month <= reportEndMonth;
  };
  const isPaymentOnOrBeforeEnd = (payment: any) => contributionMonth(payment) <= reportEndMonth;
  const isOnOrBeforeEnd = (item: any) => recordDate(item).getTime() <= reportEnd.getTime();
  const isInPeriod = (item: any) => {
    const date = recordDate(item).getTime();
    return !Number.isNaN(date) && (!reportStart || date >= reportStart.getTime()) && date <= reportEnd.getTime();
  };
  const ledgerBeforeEnd = (entries: any[], predicate: (entry: any) => boolean) => entries
    .filter((entry) => predicate(entry) && isOnOrBeforeEnd(entry))
    .sort((a, b) => recordDate(b).getTime() - recordDate(a).getTime())[0];
  const memberCode = (member: any) => member.memberCode || member.code || member.uniqueMemberCode || String(member.id || "—").slice(-6).toUpperCase();

  // This register deliberately uses loan ledgers as the repayment source. Legacy
  // repayment records are excluded to prevent a repayment from being counted twice.
  const internalLedgers = loanLedger || [];
  const bankLedgers = bankLoanLedger || [];
  const allocations = bankLoanAllocations || [];
  const activeMembers = (groupMembers || []).filter((member: any) => member.status !== "inactive" && member.status !== "removed");
  // Older internal-ledger rows were created before the `type` column existed.
  // A repayment always has a received amount, whereas a disbursement has zero.
  // Keep this fallback so historic repayments appear in the monthly register.
  const isRepaymentLedgerEntry = (entry: any) =>
    entry.type === "repayment" || (entry.type == null && amount(entry.paymentReceived ?? entry.payment_received) > 0);
  // Drizzle normally serializes these as camelCase, but reports must also support
  // ledger data returned from database exports/raw queries (snake_case).
  const internalLedgerLoanId = (entry: any) => entry.loanId ?? entry.loan_id;
  const internalPrincipalPaid = (entry: any) => amount(entry.principalPaid ?? entry.principal_paid);
  const internalInterestPaid = (entry: any) => amount(entry.interestPaid ?? entry.interest_paid);
  const isInternalRepaymentInSelectedPeriod = (entry: any) => {
    const repaymentDate = recordDate(entry);
    if (Number.isNaN(repaymentDate.getTime())) return false;
    if (timeRange === "month" && filterMonth && filterYear) {
      return repaymentDate.getMonth() === Number(filterMonth) - 1
        && repaymentDate.getFullYear() === Number(filterYear);
    }
    return isInPeriod(entry);
  };

  const memberRows = activeMembers.map((member: any, index: number) => {
    const memberPayments = (payments || []).filter((payment: any) => payment.memberId === member.id && payment.status === "confirmed");
    const memberLoans = (loans || []).filter((loan: any) => loan.memberId === member.id && ["approved", "completed"].includes(loan.status));
    const memberLoanIds = new Set(memberLoans.map((loan: any) => loan.id));
    const memberAllocations = allocations.filter((allocation: any) => allocation.memberId === member.id);
    const memberAllocationIds = new Set(memberAllocations.map((allocation: any) => allocation.id));
    const memberInternalLedger = internalLedgers.filter((entry: any) => memberLoanIds.has(internalLedgerLoanId(entry)));
    const memberBankLedger = bankLedgers.filter((entry: any) => memberAllocationIds.has(entry.allocationId));

    const monthlySavings = memberPayments.filter(isPaymentInPeriod).reduce((sum: number, payment: any) => sum + amount(payment.amount), 0);
    const lateFees = memberPayments.filter(isPaymentInPeriod).reduce((sum: number, payment: any) => sum + amount(payment.lateFee), 0);
    const internalPrincipalRecovery = memberInternalLedger.filter((entry: any) => isRepaymentLedgerEntry(entry) && isInternalRepaymentInSelectedPeriod(entry)).reduce((sum: number, entry: any) => sum + internalPrincipalPaid(entry), 0);
    const internalInterestRecovery = memberInternalLedger.filter((entry: any) => isRepaymentLedgerEntry(entry) && isInternalRepaymentInSelectedPeriod(entry)).reduce((sum: number, entry: any) => sum + internalInterestPaid(entry), 0);
    const bankPrincipalRecovery = memberBankLedger.filter((entry: any) => entry.type === "repayment" && isInPeriod(entry)).reduce((sum: number, entry: any) => sum + amount(entry.principalPaid), 0);
    const bankInterestRecovery = memberBankLedger.filter((entry: any) => entry.type === "repayment" && isInPeriod(entry)).reduce((sum: number, entry: any) => sum + amount(entry.interestPaid), 0);
    const loanDisbursementDate = (item: any) => new Date(item.startDate || item.approvedAt || item.createdAt);
    const isLoanGivenInPeriod = (item: any) => {
      const date = loanDisbursementDate(item).getTime();
      return !Number.isNaN(date) && (!reportStart || date >= reportStart.getTime()) && date <= reportEnd.getTime();
    };

    const internalLoanGiven = memberLoans.filter(isLoanGivenInPeriod).reduce((sum: number, loan: any) => sum + amount(loan.amount), 0);
    const bankLoanGiven = memberBankLedger.filter((entry: any) => entry.type === "disbursement" && isInPeriod(entry)).reduce((sum: number, entry: any) => sum + amount(entry.paymentReceived || entry.closingPrincipal), 0);

    // Extra savings, fixed deposits, other contributions, and member refunds are
    // not persisted in the current schema, so their official-register cells remain zero.
    const additionalSavings = 0;
    const fixedDeposit = 0;
    const otherContribution = 0;
    const savingsAndProfitReturned = 0;
    const fixedDepositAndInterestReturned = 0;
    const additionalSavingsAndInterestReturned = 0;
    const totalDeposits = monthlySavings + additionalSavings + fixedDeposit + internalPrincipalRecovery + internalInterestRecovery + bankPrincipalRecovery + bankInterestRecovery + lateFees + otherContribution;
    const totalPayments = internalLoanGiven + bankLoanGiven + savingsAndProfitReturned + fixedDepositAndInterestReturned + additionalSavingsAndInterestReturned;

    const internalExpectedAmount = memberLoans.reduce((sum: number, loan: any) => {
      if (loan.calculationMethod === "reducing_balance") {
        const rec = getCurrentLoanRecommendation(loan);
        return sum + ((rec?.outstandingPrincipal || 0) + (rec?.outstandingInterest || 0) + (rec?.currentMonthInterest || 0));
      } else {
        return sum + amount(loan.remainingBalance);
      }
    }, 0);
    const internalPrincipalOutstanding = memberLoans.reduce((sum: number, loan: any) => {
      const latest = ledgerBeforeEnd(memberInternalLedger, (entry) => internalLedgerLoanId(entry) === loan.id);
      if (latest) return sum + amount(latest.closingPrincipal);
      return isOnOrBeforeEnd(loan) ? sum + amount(loan.amount) : sum;
    }, 0);
    const bankClosing = memberAllocations.reduce((sum: number, allocation: any) => {
      const latest = ledgerBeforeEnd(memberBankLedger, (entry) => entry.allocationId === allocation.id);
      return sum + (latest ? amount(latest.closingPrincipal) + amount(latest.outstandingInterest) : amount(allocation.outstandingBalance) + amount(allocation.outstandingInterest));
    }, 0);
    const bankPrincipalOutstanding = memberAllocations.reduce((sum: number, allocation: any) => {
      const latest = ledgerBeforeEnd(memberBankLedger, (entry) => entry.allocationId === allocation.id);
      return sum + (latest ? amount(latest.closingPrincipal) : amount(allocation.outstandingBalance));
    }, 0);
    const closingSavings = memberPayments.filter(isPaymentOnOrBeforeEnd).reduce((sum: number, payment: any) => sum + amount(payment.amount), 0);

    return { index: index + 1, member, monthlySavings, additionalSavings, fixedDeposit, internalPrincipalRecovery, internalInterestRecovery, bankPrincipalRecovery, bankInterestRecovery, lateFees, otherContribution, totalDeposits, internalLoanGiven, bankLoanGiven, savingsAndProfitReturned, fixedDepositAndInterestReturned, additionalSavingsAndInterestReturned, totalPayments, internalExpectedLoan: internalExpectedAmount, bankExpectedLoan: bankClosing, closingSavings, internalPrincipalOutstanding, bankPrincipalOutstanding };
  });
  const columns = ["monthlySavings", "additionalSavings", "fixedDeposit", "internalPrincipalRecovery", "internalInterestRecovery", "bankPrincipalRecovery", "bankInterestRecovery", "lateFees", "otherContribution", "totalDeposits", "internalLoanGiven", "bankLoanGiven", "savingsAndProfitReturned", "fixedDepositAndInterestReturned", "additionalSavingsAndInterestReturned", "totalPayments", "internalExpectedLoan", "bankExpectedLoan", "closingSavings", "internalPrincipalOutstanding", "bankPrincipalOutstanding"];
  const totals = columns.reduce((result: any, column) => ({ ...result, [column]: memberRows.reduce((sum: number, row: any) => sum + row[column], 0) }), {});
  const rows = memberRows.map((row: any) => `<tr>
    <td class="c">${row.index}</td><td>${escapeHtml(row.member.name)}</td><td class="c">${escapeHtml(memberCode(row.member))}</td>
    ${columns.map((column) => `<td class="r">${displayAmount(row[column])}</td>`).join("")}
  </tr>`).join("") || `<tr><td colspan="24" class="c">सभासदांची नोंद उपलब्ध नाही.</td></tr>`;

  const tables = `
    <style>
      @page { size: A3 landscape; margin: 9mm; }
      .official-register { table-layout: fixed; font-size: 5.6px; }
      .official-register th, .official-register td { padding: 2px 1px; border: 1px solid #64748b; overflow-wrap: anywhere; }
      .official-register th { text-align: center; text-transform: none; line-height: 1.2; }
      .official-register th small { font-size: 6px; opacity: .9; }
      .official-register .column-number-row th { background: #fff; color: #0f172a; font-size: 6px; padding: 2px 1px; }
      .official-register td:nth-child(n+4) { white-space: nowrap; }
      .official-register td:nth-child(1) { width: 2%; }.official-register td:nth-child(2) { width: 10%; }.official-register td:nth-child(3) { width: 4%; }
    </style>
    <table class="official-register">
      <thead>
        <tr>
          <th rowspan="4">अ. क्र.</th>
          <th colspan="2">सभासदाचे संपूर्ण नाव</th>
          <th colspan="10">जमा रक्कम (रुपये)</th>
          <th colspan="6">नावे रक्कम (रुपये)</th>
          <th colspan="5">आज अखेरची स्थिती</th>
        </tr>
        <tr>
          <th rowspan="3">नाव</th><th rowspan="3">सभासद कोड क्रमांक</th>
          <th rowspan="3">गटाकडे जमा केलेली मासिक बचत</th>
          <th colspan="2">गटाकडे जमा केलेली अतिरिक्त रक्कम</th>
          <th colspan="4">सभासदाने गटाकडे परतफेड केलेली कर्ज रक्कम</th>
          <th rowspan="3">दंड</th><th rowspan="3">गटातील सामूहिक खर्चाकरिता केलेली इतर जमा</th><th rowspan="3">रकाना (3 ते 8) ची बेरीज</th>
          <th colspan="2">महिलेला दिलेल्या कर्जाचा तपशील</th><th colspan="3">महिलेला परत केलेली रक्कम</th><th rowspan="3">रकाना (10 ते 11) ची बेरीज</th>
          <th colspan="2">घटवले परतफेड करावयाची अपेक्षित कर्ज रक्कम व्याजासह</th><th rowspan="3">आज अखेरची बचत</th><th colspan="2">आज अखेर कर्ज बाकी</th>
        </tr>
        <tr>
          <th rowspan="2">जास्तीची बचत</th><th rowspan="2">मुदत ठेव</th>
          <th colspan="2">अंतर्गत</th><th colspan="2">बँक</th>
          <th rowspan="2">अंतर्गत रक्कम</th><th rowspan="2">बँक कर्ज रक्कम</th>
          <th rowspan="2">मासिक बचत + नफा</th><th rowspan="2">मुदत ठेव + व्याज</th><th rowspan="2">जास्तीची बचत + व्याज</th>
          <th rowspan="2">अंतर्गत</th><th rowspan="2">बँक</th><th rowspan="2">अंतर्गत</th><th rowspan="2">बँक</th>
        </tr>
        <tr><th>मुद्दल</th><th>व्याज</th><th>मुद्दल</th><th>व्याज</th></tr>
        <tr class="column-number-row">
          <th>१</th><th colspan="2">२</th><th>३</th><th colspan="2">४</th><th colspan="2">५</th><th colspan="2">६</th><th>७</th><th>८</th><th>९</th><th colspan="2">१०</th><th colspan="3">११</th><th>१२</th><th colspan="2">१३</th><th>१४</th><th colspan="2">१५</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row"><td colspan="3" class="r">एकूण</td>${columns.map((column) => `<td class="r">${displayAmount(totals[column])}</td>`).join("")}</tr>
      </tbody>
    </table>`;

  const html = buildStandardPdfTemplate({
    title: "जमारखर्च पुस्तक / Cash Book",
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "JamaKharch_Pustak.pdf");
}

// ─── 11. Bank Book (NEW) ──────────────────────────────────────────────────────

export async function generateBankBook({ group, groupMembers, payments, loanRepayments, bankLoanLedger, bankAllocations, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  
  let transactions: any[] = [];
  
  // 1. Savings (Mode === online)
  payments.filter((p:any) => p.status === "confirmed" && p.mode === "online").forEach((p:any) => {
    transactions.push({
      date: new Date(p.date || p.createdAt),
      particulars: `Online Savings - ${p.memberName} ${p.month?'('+p.month+')':''}`,
      receiptNo: p.id.toString().slice(-4),
      debit: p.amount + (p.lateFee||0), // Bank IN
      credit: 0
    });
  });
  
  // 2. Legacy Loan Repayments (Mode === online)
  loanRepayments.filter((r:any) => r.status === "confirmed" && r.mode === "online").forEach((r:any) => {
    transactions.push({
      date: new Date(r.paidAt || r.createdAt),
      particulars: `Online Loan Repayment - ${groupMembers.find((m:any)=>m.id===r.memberId)?.name||''}`,
      receiptNo: r.id.toString().slice(-4),
      debit: resolveRepaymentAmounts(r).shgAmount, // Bank IN
      credit: 0
    });
  });

  // 3. Group Bank Loans Ledger (Always Bank unless explicitly cash)
  (bankLoanLedger || []).forEach((l:any) => {
    let memberName = "Member";
    if (bankAllocations) {
      const alloc = bankAllocations.find((a:any)=>a.id===l.allocationId);
      if (alloc) memberName = groupMembers.find((m:any)=>m.id===alloc.memberId)?.name || '';
    }
    
    const isCash = (l.mode === "cash");
    if (!isCash) {
      if (l.type === "disbursement") {
        transactions.push({
          date: new Date(l.date),
          particulars: `Bank Loan Disbursed - ${memberName}`,
          receiptNo: l.receiptNo || l.id.toString().slice(-4),
          debit: 0,
          credit: l.closingPrincipal // Bank OUT (SHG -> Member)
        });
      } else if (l.type === "repayment") {
        transactions.push({
          date: new Date(l.date),
          particulars: `Bank Loan Repayment - ${memberName}`,
          receiptNo: l.receiptNo || l.id.toString().slice(-4),
          debit: l.paymentReceived, // Bank IN (Member -> SHG)
          credit: 0
        });
      }
    }
  });
  
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  if (timeRange !== "all") {
    transactions = filterByDateRange(transactions, timeRange, startDate, endDate, filterMonth, filterYear);
  }
  
  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  
  let rows = transactions.map((tr:any, i:number) => {
    runningBalance += tr.debit;
    runningBalance -= tr.credit;
    totalDebit += tr.debit;
    totalCredit += tr.credit;
    
    return `<tr>
      <td class="c">${formatDate(tr.date.toISOString())}</td>
      <td class="c">${tr.receiptNo}</td>
      <td>${tr.particulars}</td>
      <td class="r">${tr.debit > 0 ? formatCurrency(tr.debit) : '—'}</td>
      <td class="r">${tr.credit > 0 ? formatCurrency(tr.credit) : '—'}</td>
      <td class="r"><b>${formatCurrency(runningBalance)}</b></td>
    </tr>`;
  }).join("");

  if(!rows) rows = `<tr><td colspan="6" class="c">No bank transactions found.</td></tr>`;

  const tables = `
    <table>
      <thead>
        <tr>
          <th class="c">${t("pdf_date", {defaultValue:"Date"})}</th>
          <th class="c">${t("pdf_receipt_no", {defaultValue:"Ref No."})}</th>
          <th>${t("pdf_particulars", {defaultValue:"Particulars"})}</th>
          <th class="r">${t("pdf_bank_deposit", {defaultValue:"Deposit"})} (Debit)</th>
          <th class="r">${t("pdf_bank_withdrawal", {defaultValue:"Withdrawal"})} (Credit)</th>
          <th class="r">${t("pdf_balance", {defaultValue:"Balance"})}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" class="r">Totals for Period</td>
          <td class="r">${formatCurrency(totalDebit)}</td>
          <td class="r">${formatCurrency(totalCredit)}</td>
          <td class="r">${formatCurrency(runningBalance)}</td>
        </tr>
      </tbody>
    </table>
  `;

  const html = buildStandardPdfTemplate({
    title: t("reports.bank_book", {defaultValue: "Bank Book"}),
    group,
    presidentName: pres,
    treasurerName: treas,
    generatedBy: user.name,
    period: appliedFiltersText,
    reportId: generateReportId(),
    tablesHtml: tables,
    t
  });
  
  await openAsPdf(html, "Bank_Book.pdf");
}
