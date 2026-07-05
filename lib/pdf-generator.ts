// @ts-nocheck
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";

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
  if (timeRange === "custom" && startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    return items.filter((i) => {
      const d = new Date(i.date || i.paidAt || i.createdAt).getTime();
      return d >= start && d <= end;
    });
  } else if (timeRange === "month" && filterMonth && filterYear) {
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
  }
  return items;
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

function buildHeader(reportTitle: string, group: any, groupMembers: any[], generatedBy: string) {
  const village = group.village || "—";
  const taluka = group.taluka || "—";
  const district = group.district || "—";
  const code = group.uniqueGroupCode || group.groupCode || "—";
  const pres = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treas = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  const now = formatDateTime(new Date());
  return `
    <div class="page-header">
      <div class="shg-name">${group.name || "SHG"}</div>
      <div class="shg-address">${village}, ${taluka}, ${district}</div>
      <div class="meta-grid">
        <div class="meta-item"><div class="meta-label">Group Code</div><div class="meta-value">${code}</div></div>
        <div class="meta-item"><div class="meta-label">Village</div><div class="meta-value">${village}</div></div>
        <div class="meta-item"><div class="meta-label">Taluka / District</div><div class="meta-value">${taluka} / ${district}</div></div>
        <div class="meta-item"><div class="meta-label">President</div><div class="meta-value">${pres}</div></div>
        <div class="meta-item"><div class="meta-label">Treasurer</div><div class="meta-value">${treas}</div></div>
        <div class="meta-item"><div class="meta-label">Generated On</div><div class="meta-value">${now}</div></div>
      </div>
    </div>
    <div class="report-banner">
      <div class="report-banner-title">${reportTitle}</div>
      <div class="report-banner-sub">Generated by: ${generatedBy}</div>
    </div>
  `;
}

// ─── Filters Banner ───────────────────────────────────────────────────────────

function buildFilters(filters: { label: string; value: string }[]) {
  if (!filters || filters.length === 0) return "";
  const badges = filters.map((f) => `<span class="filter-badge"><strong>${f.label}:</strong> ${f.value}</span>`).join("");
  return `<div class="filters-banner"><div class="filters-title">Applied Filters</div><div class="filters-row">${badges}</div></div>`;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function buildFooter(presName: string, treasName: string) {
  return `
    <div class="signatures-section">
      <div class="sig-row">
        <div class="sig-block"><div class="sig-line">President Signature</div><div class="sig-name">${presName}</div></div>
        <div class="sig-block"><div class="sig-line">Treasurer Signature</div><div class="sig-name">${treasName}</div></div>
      </div>
    </div>
    <div class="page-footer">
      <span>SHG Records System — Official Report</span>
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

export async function generateGroupSavingsReport({ group, president, payments, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, paymentMethod, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = "Group Savings Report";
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";

  let data = (payments || []).filter((p: any) => p.status === "confirmed");
  if (paymentMethod && paymentMethod !== "all") {
    data = data.filter((p: any) => (p.mode || p.paymentMethod || "").toLowerCase() === paymentMethod);
  }
  data = filterByDateRange(data, timeRange, startDate, endDate, filterMonth, filterYear);

  const members = [...groupMembers].sort((a, b) => a.name.localeCompare(b.name));
  let rows = "";
  let grandTotal = 0;
  let grandLateFees = 0;
  let srNo = 1;

  members.forEach((member: any) => {
    const memPayments = data.filter((p: any) => p.memberId === member.id);
    if (memPayments.length === 0) return;
    const total = memPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const lateFees = memPayments.reduce((s: number, p: any) => s + (p.lateFee || 0), 0);
    grandTotal += total;
    grandLateFees += lateFees;
    memPayments.sort((a: any, b: any) => new Date(a.date || a.paidAt || a.createdAt).getTime() - new Date(b.date || b.paidAt || b.createdAt).getTime());
    memPayments.forEach((p: any) => {
      rows += '<tr><td class="c">' + srNo++ + '</td><td>' + member.name + '</td><td>' + (member.phoneNumber || "—") + '</td><td>' + (p.month || "—") + '</td><td class="r">' + formatCurrency(p.amount) + '</td><td class="r">' + formatCurrency(p.lateFee || 0) + '</td><td class="c">' + (p.mode || p.paymentMethod || "—").toUpperCase() + '</td><td class="c">' + statusBadge("Confirmed") + '</td><td>' + formatDate(p.date || p.paidAt || p.createdAt) + '</td></tr>';
    });
  });

  if (!rows) rows = '<tr class="empty-row"><td colspan="9">No records found for the selected filters.</td></tr>';
  const totalRow = '<tr class="total-row"><td colspan="4">Grand Total</td><td class="r">' + formatCurrency(grandTotal) + '</td><td class="r">' + formatCurrency(grandLateFees) + '</td><td colspan="3"></td></tr>';
  const membersWithData = members.filter(m => data.some((p: any) => p.memberId === m.id)).length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">Members with Payments</div><div class="summary-value neutral">' + membersWithData + '</div></div><div class="summary-card"><div class="summary-label">Total Collected</div><div class="summary-value">' + formatCurrency(grandTotal) + '</div></div><div class="summary-card"><div class="summary-label">Total Late Fees</div><div class="summary-value danger">' + formatCurrency(grandLateFees) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy) + buildFilters(appliedFiltersText) + '<hr class="divider"><div class="section"><div class="section-heading">Summary</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">Detailed Transactions</div><table><thead><tr><th class="c">Sr</th><th>Member Name</th><th>Phone</th><th>Month</th><th class="r">Amount</th><th class="r">Late Fee</th><th class="c">Method</th><th class="c">Status</th><th>Date</th></tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>' + buildFooter(presName, treasName) + '</body></html>';
  await openAsPdf(html, "Savings_Report");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOANS REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateGroupLoansReport({ group, president, loans, loanRepayments, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, loanFilter, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = "Loans Report";
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";

  let data = [...(loans || [])];
  if (loanFilter && loanFilter !== "all") {
    if (loanFilter === "active") data = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0);
    else if (loanFilter === "completed") data = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) <= 0);
    else data = data.filter((l: any) => l.status === loanFilter);
  }
  data = filterByDateRange(data, timeRange, startDate, endDate, filterMonth, filterYear);
  data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let rows = "";
  let totalDisbursed = 0, totalRepaid = 0, totalOutstanding = 0, srNo = 1;

  data.forEach((loan: any) => {
    const member = groupMembers.find((m: any) => m.id === loan.memberId);
    const outstanding = Math.max(0, loan.remainingBalance || 0);
    const repaid = Math.max(0, (loan.amount || 0) - outstanding);
    totalDisbursed += loan.amount || 0;
    totalRepaid += repaid;
    totalOutstanding += outstanding;
    let ds = loan.status;
    if (loan.status === "approved") ds = outstanding <= 0 ? "Completed" : "Active";
    rows += '<tr><td class="c">' + srNo++ + '</td><td>' + (member?.name || "—") + '</td><td>' + (member?.phoneNumber || "—") + '</td><td>' + formatDate(loan.createdAt) + '</td><td class="r">' + formatCurrency(loan.amount) + '</td><td class="c">' + (loan.interest || 0) + '%</td><td class="c">' + (loan.duration || "—") + ' mo</td><td class="r">' + formatCurrency(repaid) + '</td><td class="r">' + formatCurrency(outstanding) + '</td><td class="c">' + statusBadge(ds) + '</td></tr>';
  });

  if (!rows) rows = '<tr class="empty-row"><td colspan="10">No records found for the selected filters.</td></tr>';
  const totalRow = '<tr class="total-row"><td colspan="4">Grand Total</td><td class="r">' + formatCurrency(totalDisbursed) + '</td><td colspan="2"></td><td class="r">' + formatCurrency(totalRepaid) + '</td><td class="r">' + formatCurrency(totalOutstanding) + '</td><td></td></tr>';
  const activeCnt = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0).length;
  const completedCnt = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) <= 0).length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">Total Loans</div><div class="summary-value neutral">' + data.length + '</div></div><div class="summary-card"><div class="summary-label">Total Disbursed</div><div class="summary-value">' + formatCurrency(totalDisbursed) + '</div></div><div class="summary-card"><div class="summary-label">Total Repaid</div><div class="summary-value">' + formatCurrency(totalRepaid) + '</div></div><div class="summary-card"><div class="summary-label">Outstanding</div><div class="summary-value danger">' + formatCurrency(totalOutstanding) + '</div></div><div class="summary-card"><div class="summary-label">Active Loans</div><div class="summary-value neutral">' + activeCnt + '</div></div><div class="summary-card"><div class="summary-label">Completed Loans</div><div class="summary-value">' + completedCnt + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy) + buildFilters(appliedFiltersText) + '<hr class="divider"><div class="section"><div class="section-heading">Summary</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">Loan Details</div><table><thead><tr><th class="c">Sr</th><th>Member Name</th><th>Phone</th><th>Loan Date</th><th class="r">Amount</th><th class="c">Interest</th><th class="c">Duration</th><th class="r">Repaid</th><th class="r">Outstanding</th><th class="c">Status</th></tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>' + buildFooter(presName, treasName) + '</body></html>';
  await openAsPdf(html, "Loans_Report");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FINANCIAL SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateFinancialSummaryReport({ group, president, payments, loans, loanRepayments, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = "Financial Summary Report";
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";

  let confirmedPayments = (payments || []).filter((p: any) => p.status === "confirmed");
  confirmedPayments = filterByDateRange(confirmedPayments, timeRange, startDate, endDate, filterMonth, filterYear);
  const totalSavings = confirmedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalLateFees = confirmedPayments.reduce((s: number, p: any) => s + (p.lateFee || 0), 0);

  let approvedLoans = (loans || []).filter((l: any) => l.status === "approved");
  approvedLoans = filterByDateRange(approvedLoans, timeRange, startDate, endDate, filterMonth, filterYear);
  const totalLoanDisbursed = approvedLoans.reduce((s: number, l: any) => s + (l.amount || 0), 0);

  let filteredRepayments = filterByDateRange(loanRepayments || [], timeRange, startDate, endDate, filterMonth, filterYear);
  const totalRepayments = filteredRepayments.reduce((s: number, r: any) => s + (r.amount || 0), 0);

  const currentBalance = totalSavings + totalLateFees + totalRepayments - totalLoanDisbursed;
  const outstandingLoans = (loans || []).filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0).reduce((s: number, l: any) => s + (l.remainingBalance || 0), 0);
  const activeMembers = groupMembers.filter((m: any) => m.status === "active").length;

  // Period-wise breakdown
  const periodMap: Record<string, { savings: number; lateFees: number; loans: number; repayments: number }> = {};
  confirmedPayments.forEach((p: any) => {
    const key = p.month || formatDate(p.date || p.paidAt || p.createdAt).substring(3);
    if (!periodMap[key]) periodMap[key] = { savings: 0, lateFees: 0, loans: 0, repayments: 0 };
    periodMap[key].savings += p.amount || 0;
    periodMap[key].lateFees += p.lateFee || 0;
  });
  approvedLoans.forEach((l: any) => {
    const key = formatDate(l.createdAt).substring(3);
    if (!periodMap[key]) periodMap[key] = { savings: 0, lateFees: 0, loans: 0, repayments: 0 };
    periodMap[key].loans += l.amount || 0;
  });
  filteredRepayments.forEach((r: any) => {
    const key = formatDate(r.date || r.createdAt).substring(3);
    if (!periodMap[key]) periodMap[key] = { savings: 0, lateFees: 0, loans: 0, repayments: 0 };
    periodMap[key].repayments += r.amount || 0;
  });

  let monthRows = "";
  Object.keys(periodMap).sort().forEach((key) => {
    const d = periodMap[key];
    const net = d.savings + d.lateFees + d.repayments - d.loans;
    const color = net >= 0 ? "#15803d" : "#dc2626";
    monthRows += '<tr><td>' + key + '</td><td class="r">' + formatCurrency(d.savings) + '</td><td class="r">' + formatCurrency(d.lateFees) + '</td><td class="r">' + formatCurrency(d.loans) + '</td><td class="r">' + formatCurrency(d.repayments) + '</td><td class="r" style="font-weight:700;color:' + color + '">' + formatCurrency(net) + '</td></tr>';
  });
  if (!monthRows) monthRows = '<tr class="empty-row"><td colspan="6">No transactions for selected period.</td></tr>';

  const balColor = currentBalance < 0 ? " danger" : "";
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">Current Balance</div><div class="summary-value' + balColor + '">' + formatCurrency(currentBalance) + '</div></div><div class="summary-card"><div class="summary-label">Total Savings</div><div class="summary-value">' + formatCurrency(totalSavings) + '</div></div><div class="summary-card"><div class="summary-label">Total Late Fees</div><div class="summary-value danger">' + formatCurrency(totalLateFees) + '</div></div><div class="summary-card"><div class="summary-label">Loan Disbursed</div><div class="summary-value neutral">' + formatCurrency(totalLoanDisbursed) + '</div></div><div class="summary-card"><div class="summary-label">Loan Repayments</div><div class="summary-value">' + formatCurrency(totalRepayments) + '</div></div><div class="summary-card"><div class="summary-label">Outstanding Loans</div><div class="summary-value danger">' + formatCurrency(outstandingLoans) + '</div></div><div class="summary-card"><div class="summary-label">Active Members</div><div class="summary-value neutral">' + activeMembers + '</div></div><div class="summary-card"><div class="summary-label">Total Members</div><div class="summary-value neutral">' + groupMembers.length + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy) + buildFilters(appliedFiltersText) + '<hr class="divider"><div class="section"><div class="section-heading">Overview</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">Period-wise Breakdown</div><table><thead><tr><th>Period</th><th class="r">Savings</th><th class="r">Late Fees</th><th class="r">Loans Out</th><th class="r">Repayments</th><th class="r">Net</th></tr></thead><tbody>' + monthRows + '</tbody></table></div>' + buildFooter(presName, treasName) + '</body></html>';
  await openAsPdf(html, "Financial_Summary");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MEMBER REGISTER
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateMemberRegisterReport({ group, president, groupMembers, payments, loans, language, memberFilter, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = "Member Register";
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";
  const now = new Date();

  let filteredMembers = [...(groupMembers || [])];
  if (memberFilter === "active") filteredMembers = filteredMembers.filter((m: any) => m.status === "active");
  else if (memberFilter === "inactive") filteredMembers = filteredMembers.filter((m: any) => m.status !== "active");
  else if (memberFilter === "active_loans") filteredMembers = filteredMembers.filter((m: any) => (loans || []).some((l: any) => l.memberId === m.id && l.status === "approved" && (l.remainingBalance || 0) > 0));
  else if (memberFilter === "completed_loans") filteredMembers = filteredMembers.filter((m: any) => (loans || []).some((l: any) => l.memberId === m.id && l.status === "approved" && (l.remainingBalance || 0) <= 0));
  else if (memberFilter === "pending_payments") filteredMembers = filteredMembers.filter((m: any) => (payments || []).some((p: any) => p.memberId === m.id && (p.status === "pending" || p.status === "declared")));
  else if (memberFilter === "overdue_payments") filteredMembers = filteredMembers.filter((m: any) => (payments || []).some((p: any) => p.memberId === m.id && p.status === "confirmed" && (p.lateFee || 0) > 0));
  filteredMembers.sort((a: any, b: any) => a.name.localeCompare(b.name));

  let rows = "", srNo = 1, totalContributionAll = 0;
  filteredMembers.forEach((member: any) => {
    const memLoans = (loans || []).filter((l: any) => l.memberId === member.id && l.status === "approved");
    const activeLoan = memLoans.some((l: any) => (l.remainingBalance || 0) > 0);
    const completedLoanCount = memLoans.filter((l: any) => (l.remainingBalance || 0) <= 0).length;
    const memPayments = (payments || []).filter((p: any) => p.memberId === member.id && p.status === "confirmed");
    const totalContribution = memPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    totalContributionAll += totalContribution;
    let pendingMonths = 0;
    const startStr = member.contributionStartMonth;
    if (startStr && startStr.includes("-")) {
      const [y, m] = startStr.split("-");
      const startD = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthsSince = (now.getFullYear() - startD.getFullYear()) * 12 + (now.getMonth() - startD.getMonth()) + 1;
      pendingMonths = Math.max(0, monthsSince - memPayments.length);
    }
    const pendingBadge = pendingMonths > 0 ? '<span class="badge badge-red">' + pendingMonths + '</span>' : "0";
    const loanBadge = activeLoan ? '<span class="badge badge-yellow">Yes</span>' : '<span class="badge badge-green">No</span>';
    rows += '<tr><td class="c">' + srNo++ + '</td><td>' + member.name + '</td><td>' + (member.phoneNumber || "—") + '</td><td>' + (member.role || "member") + '</td><td class="c">' + statusBadge(member.status || "active") + '</td><td>' + formatDate(member.joinedAt || member.createdAt) + '</td><td class="r">' + formatCurrency(totalContribution) + '</td><td class="c">' + pendingBadge + '</td><td class="c">' + loanBadge + '</td><td class="c">' + completedLoanCount + '</td></tr>';
  });

  if (!rows) rows = '<tr class="empty-row"><td colspan="10">No members found for the selected filter.</td></tr>';
  const totalRow = '<tr class="total-row"><td colspan="6">Total</td><td class="r">' + formatCurrency(totalContributionAll) + '</td><td colspan="3"></td></tr>';
  const activeCount = filteredMembers.filter((m: any) => m.status === "active").length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">Members (filtered)</div><div class="summary-value neutral">' + filteredMembers.length + '</div></div><div class="summary-card"><div class="summary-label">Active Members</div><div class="summary-value">' + activeCount + '</div></div><div class="summary-card"><div class="summary-label">Total Contributions</div><div class="summary-value">' + formatCurrency(totalContributionAll) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy) + buildFilters(appliedFiltersText) + '<hr class="divider"><div class="section"><div class="section-heading">Summary</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">Member List</div><table><thead><tr><th class="c">Sr</th><th>Name</th><th>Phone</th><th>Role</th><th class="c">Status</th><th>Joined</th><th class="r">Total Contribution</th><th class="c">Pending Months</th><th class="c">Active Loan</th><th class="c">Loans Done</th></tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>' + buildFooter(presName, treasName) + '</body></html>';
  await openAsPdf(html, "Member_Register");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INDIVIDUAL MEMBER STATEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateMemberStatement({ group, president, groupMembers, member, payments, loans, loanRepayments, meetings, language, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = "Member Statement — " + (member?.name || "");
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";

  const memPayments = (payments || []).filter((p: any) => p.memberId === member.id).sort((a: any, b: any) => new Date(a.date || a.paidAt || a.createdAt).getTime() - new Date(b.date || b.paidAt || b.createdAt).getTime());
  const confirmedPayments = memPayments.filter((p: any) => p.status === "confirmed");
  const totalSavings = confirmedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalLateFees = confirmedPayments.reduce((s: number, p: any) => s + (p.lateFee || 0), 0);

  let paymentRows = "", srNo = 1;
  memPayments.forEach((p: any) => {
    const remark = p.rejectionReason ? '<span style="color:#dc2626;font-size:8px;">' + p.rejectionReason + '</span>' : "—";
    paymentRows += '<tr><td class="c">' + srNo++ + '</td><td>' + (p.month || "—") + '</td><td class="r">' + formatCurrency(p.amount) + '</td><td class="r">' + formatCurrency(p.lateFee || 0) + '</td><td class="c">' + (p.mode || p.paymentMethod || "—").toUpperCase() + '</td><td class="c">' + statusBadge(p.status) + '</td><td>' + formatDate(p.date || p.paidAt || p.createdAt) + '</td><td>' + remark + '</td></tr>';
  });
  if (!paymentRows) paymentRows = '<tr class="empty-row"><td colspan="8">No payment records found.</td></tr>';

  const memLoans = (loans || []).filter((l: any) => l.memberId === member.id).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  let loanRows = ""; srNo = 1;
  memLoans.forEach((loan: any) => {
    const outstanding = Math.max(0, loan.remainingBalance || 0);
    const repaid = Math.max(0, (loan.amount || 0) - outstanding);
    let ds = loan.status;
    if (loan.status === "approved") ds = outstanding <= 0 ? "Completed" : "Active";
    const remark = loan.rejectionReason ? '<span style="color:#dc2626;font-size:8px;">' + loan.rejectionReason + '</span>' : "—";
    loanRows += '<tr><td class="c">' + srNo++ + '</td><td>' + formatDate(loan.createdAt) + '</td><td class="r">' + formatCurrency(loan.amount) + '</td><td class="c">' + (loan.interest || 0) + '%</td><td class="c">' + (loan.duration || "—") + ' mo</td><td class="r">' + formatCurrency(repaid) + '</td><td class="r">' + formatCurrency(outstanding) + '</td><td class="c">' + statusBadge(ds) + '</td><td>' + remark + '</td></tr>';
  });
  if (!loanRows) loanRows = '<tr class="empty-row"><td colspan="9">No loan records found.</td></tr>';

  const completedMeetings = (meetings || []).filter((m: any) => m.status === "completed");
  const attendedCount = completedMeetings.filter((m: any) => (m.attendance || []).includes(member.id)).length;
  const attendancePercent = completedMeetings.length > 0 ? Math.round((attendedCount / completedMeetings.length) * 100) : 0;
  const activeLoan = memLoans.find((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0);

  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">Name</div><div class="summary-value" style="font-size:14px">' + member.name + '</div></div><div class="summary-card"><div class="summary-label">Phone</div><div class="summary-value neutral" style="font-size:14px">' + (member.phoneNumber || "—") + '</div></div><div class="summary-card"><div class="summary-label">Role</div><div class="summary-value neutral" style="font-size:14px">' + (member.role || "Member") + '</div></div><div class="summary-card"><div class="summary-label">Total Savings</div><div class="summary-value">' + formatCurrency(totalSavings) + '</div></div><div class="summary-card"><div class="summary-label">Total Late Fees</div><div class="summary-value danger">' + formatCurrency(totalLateFees) + '</div></div><div class="summary-card"><div class="summary-label">Active Loan Balance</div><div class="summary-value' + (activeLoan ? " danger" : "") + '">' + (activeLoan ? formatCurrency(activeLoan.remainingBalance) : "—") + '</div></div><div class="summary-card"><div class="summary-label">Meetings Attended</div><div class="summary-value neutral">' + attendedCount + ' / ' + completedMeetings.length + '</div></div><div class="summary-card"><div class="summary-label">Attendance</div><div class="summary-value' + (attendancePercent >= 75 ? "" : " danger") + '">' + attendancePercent + '%</div></div><div class="summary-card"><div class="summary-label">Member Since</div><div class="summary-value neutral" style="font-size:12px">' + formatDate(member.joinedAt || member.createdAt) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy) + '<hr class="divider"><div class="section"><div class="section-heading">Member Information</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">Payment History</div><table><thead><tr><th class="c">Sr</th><th>Month</th><th class="r">Amount</th><th class="r">Late Fee</th><th class="c">Method</th><th class="c">Status</th><th>Date</th><th>Remarks</th></tr></thead><tbody>' + paymentRows + '</tbody></table></div><div class="section"><div class="section-heading">Loan History</div><table><thead><tr><th class="c">Sr</th><th>Date</th><th class="r">Amount</th><th class="c">Interest</th><th class="c">Duration</th><th class="r">Repaid</th><th class="r">Outstanding</th><th class="c">Status</th><th>Remarks</th></tr></thead><tbody>' + loanRows + '</tbody></table></div>' + buildFooter(presName, treasName) + '</body></html>';
  await openAsPdf(html, "Member_Statement_" + (member.name || "").replace(/\s+/g, "_"));
}