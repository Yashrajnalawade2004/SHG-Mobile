// @ts-nocheck
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";
import { resolveRepaymentAmounts, calculateShgTotal, calculateShgEmi } from "../shared/accounting";

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

export async function generateGroupSavingsReport({ group, president, payments, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, paymentMethod, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = t("common.pdf_savings_report");
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
      rows += '<tr><td class="c">' + srNo++ + '</td><td>' + member.name + '</td><td>' + (member.phoneNumber || "—") + '</td><td>' + (p.month || "—") + '</td><td class="r">' + formatCurrency(p.amount) + '</td><td class="r">' + formatCurrency(p.lateFee || 0) + '</td><td class="c">' + (p.mode || p.paymentMethod || "—").toUpperCase() + '</td><td class="c">' + statusBadge("Confirmed", t) + '</td><td>' + formatDate(p.date || p.paidAt || p.createdAt) + '</td></tr>';
    });
  });

  if (!rows) rows = '<tr class="empty-row"><td colspan="9">' + t("common.pdf_no_records_filters") + '</td></tr>';
  const totalRow = '<tr class="total-row"><td colspan="4">' + t("common.pdf_grand_total") + '</td><td class="r">' + formatCurrency(grandTotal) + '</td><td class="r">' + formatCurrency(grandLateFees) + '</td><td colspan="3"></td></tr>';
  const membersWithData = members.filter(m => data.some((p: any) => p.memberId === m.id)).length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">' + t("common.pdf_members_with_payments") + '</div><div class="summary-value neutral">' + membersWithData + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_collected") + '</div><div class="summary-value">' + formatCurrency(grandTotal) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_late_fees") + '</div><div class="summary-value danger">' + formatCurrency(grandLateFees) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy, t, language) + buildFilters(appliedFiltersText, t) + '<hr class="divider"><div class="section"><div class="section-heading">' + t("common.pdf_summary") + '</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">' + t("common.pdf_detailed_transactions") + '</div><table><thead><tr><th class="c">' + t("common.pdf_sr") + '</th><th>' + t("common.pdf_member_name") + '</th><th>' + t("common.pdf_phone") + '</th><th>' + t("common.pdf_month") + '</th><th class="r">' + t("common.pdf_amount") + '</th><th class="r">' + t("common.pdf_late_fee") + '</th><th class="c">' + t("common.pdf_method") + '</th><th class="c">' + t("common.pdf_status") + '</th><th>' + t("common.pdf_date") + '</th></tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>' + buildFooter(presName, treasName, t) + '</body></html>';
  await openAsPdf(html, "Savings_Report");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOANS REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateGroupLoansReport({ group, president, loans, loanRepayments, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, loanFilter, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = t("common.pdf_loans_report") || "Loans Report";
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

  let activeRows = "";
  let completedRows = "";
  let otherRows = "";
  let totalDisbursed = 0, totalRepaid = 0, totalOutstanding = 0;
  let srNoAct = 1, srNoComp = 1, srNoOth = 1;

  data.forEach((loan: any) => {
    const member = groupMembers.find((m: any) => m.id === loan.memberId);
    const outstanding = Math.max(0, loan.remainingBalance || 0);
    const repaid = Math.max(0, (loan.amount || 0) - outstanding);

    totalDisbursed += loan.amount || 0;
    totalRepaid += repaid;
    totalOutstanding += outstanding;

    let ds = loan.status;
    let srNo = 1;
    if (loan.status === "approved" && outstanding <= 0) {
      ds = "Completed";
      srNo = srNoComp++;
    } else if (loan.status === "approved") {
      ds = "Active";
      srNo = srNoAct++;
    } else {
      srNo = srNoOth++;
    }

    const shgEmi = calculateShgEmi(loan);
    let emiStr = t("common.pdf_monthly_installment") + ': ' + formatCurrency(shgEmi);

    const row = '<tr><td class="c">' + srNo + '</td><td>' + (member?.name || "—") + '</td><td>' + (member?.phoneNumber || "—") + '</td><td>' + formatDate(loan.createdAt) + '</td><td class="r">' + formatCurrency(loan.amount) + '</td><td class="c">' + (loan.interest || 0) + '% <br/> ' + (loan.duration || "—") + ' mo<br/><span style="font-size: 8px;">' + emiStr + '</span></td><td class="r">' + formatCurrency(repaid) + '</td><td class="r">' + formatCurrency(outstanding) + '</td><td class="c">' + statusBadge(ds, t) + '</td></tr>';

    if (ds === "Completed") completedRows += row;
    else if (ds === "Active") activeRows += row;
    else otherRows += row;
  });

  const tableHeader = '<table><thead><tr><th class="c">' + t("common.pdf_sr") + '</th><th>' + t("common.pdf_member_name") + '</th><th>' + t("common.pdf_phone") + '</th><th>' + t("common.pdf_loan_date") + '</th><th class="r">' + t("common.pdf_amount") + '</th><th class="c">' + t("common.pdf_int_dur") + '</th><th class="r">' + t("common.pdf_repaid") + '</th><th class="r">' + t("common.pdf_remaining") + '</th><th class="c">' + t("common.pdf_status") + '</th></tr></thead><tbody>';

  let tablesHtml = "";
  if (activeRows || (loanFilter === "active" || loanFilter === "all")) {
    tablesHtml += '<h3 style="margin-top: 20px; color: #333; font-size: 16px;">' + (t("reports.active_loans") || "Active Loans") + '</h3>' + tableHeader + (activeRows || '<tr class="empty-row"><td colspan="12">' + t("common.pdf_no_records_filters") + '</td></tr>') + '</tbody></table>';
  }
  if (completedRows || (loanFilter === "completed" || loanFilter === "all" || loanFilter === "active")) {
    tablesHtml += '<h3 style="margin-top: 20px; color: #333; font-size: 16px;">' + (t("reports.completed_loans") || "Completed Loans") + '</h3>' + tableHeader + (completedRows || '<tr class="empty-row"><td colspan="12">' + t("common.pdf_no_records_filters") + '</td></tr>') + '</tbody></table>';
  }
  if (otherRows || (loanFilter !== "active" && loanFilter !== "completed" && loanFilter !== "all")) {
    tablesHtml += '<h3 style="margin-top: 20px; color: #333; font-size: 16px;">' + (t("common.pdf_other_loans") || "Other Loans") + '</h3>' + tableHeader + (otherRows || '<tr class="empty-row"><td colspan="12">' + t("common.pdf_no_records_filters") + '</td></tr>') + '</tbody></table>';
  }

  const activeCnt = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0).length;
  const completedCnt = data.filter((l: any) => l.status === "approved" && (l.remainingBalance || 0) <= 0).length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_loans") + '</div><div class="summary-value neutral">' + data.length + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_disbursed") + '</div><div class="summary-value">' + formatCurrency(totalDisbursed) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_repaid") + '</div><div class="summary-value">' + formatCurrency(totalRepaid) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_outstanding_balance") + '</div><div class="summary-value danger">' + formatCurrency(totalOutstanding) + '</div></div><div class="summary-card"><div class="summary-label">' + (t("reports.active_loans") || "Active Loans") + '</div><div class="summary-value neutral">' + activeCnt + '</div></div><div class="summary-card"><div class="summary-label">' + (t("reports.completed_loans") || "Completed Loans") + '</div><div class="summary-value">' + completedCnt + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy, t, language) + buildFilters(appliedFiltersText, t) + '<hr class="divider"><div class="section"><div class="section-heading">' + t("common.pdf_summary") + '</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">' + t("common.pdf_loan_details") + '</div>' + tablesHtml + '</div>' + buildFooter(presName, treasName, t) + '</body></html>';
  await openAsPdf(html, "Loans_Report");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FINANCIAL SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateFinancialSummaryReport({ group, president, payments, loans, loanRepayments, loanLedger, groupMembers, language, timeRange, startDate, endDate, filterMonth, filterYear, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = t("common.pdf_financial_summary");
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
  const totalRepayments = filteredRepayments.reduce((s: number, r: any) => s + resolveRepaymentAmounts(r).shgAmount, 0);

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
    periodMap[key].repayments += resolveRepaymentAmounts(r).shgAmount;
  });

  let monthRows = "";
  Object.keys(periodMap).sort().forEach((key) => {
    const d = periodMap[key];
    const net = d.savings + d.lateFees + d.repayments - d.loans;
    const color = net >= 0 ? "#15803d" : "#dc2626";
    monthRows += '<tr><td>' + key + '</td><td class="r">' + formatCurrency(d.savings) + '</td><td class="r">' + formatCurrency(d.lateFees) + '</td><td class="r">' + formatCurrency(d.loans) + '</td><td class="r">' + formatCurrency(d.repayments) + '</td><td class="r" style="font-weight:700;color:' + color + '">' + formatCurrency(net) + '</td></tr>';
  });
  if (!monthRows) monthRows = '<tr class="empty-row"><td colspan="6">' + t("common.pdf_no_transactions_period") + '</td></tr>';

  const balColor = currentBalance < 0 ? " danger" : "";
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">' + t("common.pdf_current_balance") + '</div><div class="summary-value' + balColor + '">' + formatCurrency(currentBalance) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_savings") + '</div><div class="summary-value">' + formatCurrency(totalSavings) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_late_fees") + '</div><div class="summary-value danger">' + formatCurrency(totalLateFees) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_loan_disbursed") + '</div><div class="summary-value neutral">' + formatCurrency(totalLoanDisbursed) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_loan_repayments") + '</div><div class="summary-value">' + formatCurrency(totalRepayments) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_outstanding_loans") + '</div><div class="summary-value danger">' + formatCurrency(outstandingLoans) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_active_members") + '</div><div class="summary-value neutral">' + activeMembers + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_members") + '</div><div class="summary-value neutral">' + groupMembers.length + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy, t, language) + buildFilters(appliedFiltersText, t) + '<hr class="divider"><div class="section"><div class="section-heading">' + t("common.pdf_overview") + '</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">' + t("common.pdf_period_breakdown") + '</div><table><thead><tr><th>' + t("common.pdf_period") + '</th><th class="r">' + t("common.pdf_savings") + '</th><th class="r">' + t("common.pdf_late_fees") + '</th><th class="r">' + t("common.pdf_loans_out") + '</th><th class="r">' + t("common.pdf_repayments") + '</th><th class="r">' + t("common.pdf_net") + '</th></tr></thead><tbody>' + monthRows + '</tbody></table></div>' + buildFooter(presName, treasName, t) + '</body></html>';
  await openAsPdf(html, "Financial_Summary");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MEMBER REGISTER
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateMemberRegisterReport({ group, president, groupMembers, payments, loans, language, memberFilter, appliedFiltersText, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = t("common.pdf_member_register");
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
    const loanBadge = activeLoan ? '<span class="badge badge-yellow">' + t("common.pdf_yes") + '</span>' : '<span class="badge badge-green">' + t("common.pdf_no") + '</span>';
    rows += '<tr><td class="c">' + srNo++ + '</td><td>' + member.name + '</td><td>' + (member.phoneNumber || "—") + '</td><td>' + (member.role || "member") + '</td><td class="c">' + statusBadge(member.status || "active", t) + '</td><td>' + formatDate(member.joinedAt || member.createdAt) + '</td><td class="r">' + formatCurrency(totalContribution) + '</td><td class="c">' + pendingBadge + '</td><td class="c">' + loanBadge + '</td><td class="c">' + completedLoanCount + '</td></tr>';
  });

  if (!rows) rows = '<tr class="empty-row"><td colspan="10">' + t("common.pdf_no_members_filter") + '</td></tr>';
  const totalRow = '<tr class="total-row"><td colspan="4">' + t("common.pdf_total") + '</td><td class="r">' + formatCurrency(totalContributionAll) + '</td><td colspan="3"></td></tr>';
  const activeCount = filteredMembers.filter((m: any) => m.status === "active").length;
  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">' + t("common.pdf_members_filtered") + '</div><div class="summary-value neutral">' + filteredMembers.length + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_active_members") + '</div><div class="summary-value">' + activeCount + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_contributions") + '</div><div class="summary-value">' + formatCurrency(totalContributionAll) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy, t, language) + buildFilters(appliedFiltersText, t) + '<hr class="divider"><div class="section"><div class="section-heading">' + t("common.pdf_summary") + '</div>' + summaryHtml + '</div><div class="section"><div class="section-heading">' + t("common.pdf_member_list") + '</div><table><thead><tr><th class="c">' + t("common.pdf_sr") + '</th><th>' + t("common.pdf_member_name") + '</th><th>' + t("common.pdf_phone") + '</th><th>' + t("common.pdf_role") + '</th><th class="c">' + t("common.pdf_status") + '</th><th>' + t("common.pdf_joined") + '</th><th class="r">' + t("common.pdf_total_contribution") + '</th><th class="c">' + t("common.pdf_pending_months") + '</th><th class="c">' + t("common.pdf_active_loan") + '</th><th class="c">' + t("common.pdf_loans_done") + '</th></tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>' + buildFooter(presName, treasName, t) + '</body></html>';
  await openAsPdf(html, "Member_Register");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INDIVIDUAL MEMBER STATEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateMemberStatement({ group, president, groupMembers, member, payments, loans, loanRepayments, meetings, language, t, user }: any) {
  const generatedBy = user?.name || president?.name || "Admin";
  const reportTitle = t("common.pdf_member_statement") + (member?.name || "");
  const presName = groupMembers.find((m: any) => m.role === "president")?.name || "—";
  const treasName = groupMembers.find((m: any) => m.role === "treasurer")?.name || "—";

  const memPayments = (payments || []).filter((p: any) => p.memberId === member.id).sort((a: any, b: any) => new Date(a.date || a.paidAt || a.createdAt).getTime() - new Date(b.date || b.paidAt || b.createdAt).getTime());
  const confirmedPayments = memPayments.filter((p: any) => p.status === "confirmed");
  const totalSavings = confirmedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalLateFees = confirmedPayments.reduce((s: number, p: any) => s + (p.lateFee || 0), 0);

  let paymentRows = "", srNo = 1;
  memPayments.forEach((p: any) => {
    const remark = p.rejectionReason ? '<span style="color:#dc2626;font-size:8px;">' + p.rejectionReason + '</span>' : "—";
    paymentRows += '<tr><td class="c">' + srNo++ + '</td><td>' + (p.month || "—") + '</td><td class="r">' + formatCurrency(p.amount) + '</td><td class="r">' + formatCurrency(p.lateFee || 0) + '</td><td class="c">' + (p.mode || p.paymentMethod || "—").toUpperCase() + '</td><td class="c">' + statusBadge(p.status, t) + '</td><td>' + formatDate(p.date || p.paidAt || p.createdAt) + '</td><td>' + remark + '</td></tr>';
  });
  if (!paymentRows) paymentRows = '<tr class="empty-row"><td colspan="8">' + t("common.pdf_empty_row") + '</td></tr>';

  const memLoans = (loans || []).filter((l: any) => l.memberId === member.id).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  let loanRows = ""; srNo = 1;
  memLoans.forEach((loan: any) => {
    const outstanding = Math.max(0, loan.remainingBalance || 0);
    const repaid = Math.max(0, (loan.amount || 0) - outstanding);
    let ds = loan.status;
    if (loan.status === "approved") ds = outstanding <= 0 ? "Completed" : "Active";
    const remark = loan.rejectionReason ? '<span style="color:#dc2626;font-size:8px;">' + loan.rejectionReason + '</span>' : "—";

    loanRows += '<tr><td class="c">' + srNo++ + '</td><td>' + formatDate(loan.createdAt) + '</td><td class="r">' + formatCurrency(loan.amount) + '</td><td class="c">' + (loan.interest || 0) + '%</td><td class="c">' + (loan.duration || "—") + ' mo</td><td class="r">' + formatCurrency(repaid) + '</td><td class="r">' + formatCurrency(outstanding) + '</td><td class="c">' + statusBadge(ds, t) + '</td><td>' + remark + '</td></tr>';
  });
  if (!loanRows) loanRows = '<tr class="empty-row"><td colspan="9">' + t("common.pdf_empty_row") + '</td></tr>';

  const completedMeetings = (meetings || []).filter((m: any) => m.status === "completed");
  const attendedCount = completedMeetings.filter((m: any) => (m.attendance || []).includes(member.id)).length;
  const attendancePercent = completedMeetings.length > 0 ? Math.round((attendedCount / completedMeetings.length) * 100) : 0;
  const activeLoan = memLoans.find((l: any) => l.status === "approved" && (l.remainingBalance || 0) > 0);

  const summaryHtml = '<div class="summary-grid"><div class="summary-card"><div class="summary-label">' + t("common.pdf_member_name") + '</div><div class="summary-value" style="font-size:14px">' + member.name + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_phone") + '</div><div class="summary-value neutral" style="font-size:14px">' + (member.phoneNumber || "—") + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_role") + '</div><div class="summary-value neutral" style="font-size:14px">' + (member.role || "Member") + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_total_savings") + '</div><div class="summary-value">' + formatCurrency(totalSavings) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_late_fees") + '</div><div class="summary-value danger">' + formatCurrency(totalLateFees) + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_active_loan_balance") + '</div><div class="summary-value' + (activeLoan ? " danger" : "") + '">' + (activeLoan ? formatCurrency(activeLoan.remainingBalance) : "—") + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_meetings_attended") + '</div><div class="summary-value neutral">' + attendedCount + ' / ' + completedMeetings.length + '</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_attendance") + '</div><div class="summary-value' + (attendancePercent >= 75 ? "" : " danger") + '">' + attendancePercent + '%</div></div><div class="summary-card"><div class="summary-label">' + t("common.pdf_member_since") + '</div><div class="summary-value neutral" style="font-size:12px">' + formatDate(member.joinedAt || member.createdAt) + '</div></div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + reportTitle + '</title><style>' + getStyles() + '</style></head><body>' + buildHeader(reportTitle, group, groupMembers, generatedBy, t, language) + '<hr class="divider"><div class="section"><div class="section-heading">' + t("common.pdf_member_information") + '</div>' + summaryHtml + '</div>' + loanSummaryHtml + '<div class="section"><div class="section-heading">' + t("common.pdf_payment_history") + '</div><table><thead><tr><th class="c">' + t("common.pdf_sr") + '</th><th>' + t("common.pdf_month") + '</th><th class="r">' + t("common.pdf_amount") + '</th><th class="r">' + t("common.pdf_late_fee") + '</th><th class="c">' + t("common.pdf_method") + '</th><th class="c">' + t("common.pdf_status") + '</th><th>' + t("common.pdf_date") + '</th><th>' + t("common.pdf_remarks") + '</th></tr></thead><tbody>' + paymentRows + '</tbody></table></div><div class="section"><div class="section-heading">' + t("common.pdf_loan_history") + '</div><table><thead><tr><th class="c">' + t("common.pdf_sr") + '</th><th>' + t("common.pdf_date") + '</th><th class="r">' + t("common.pdf_amount") + '</th><th class="c">' + t("common.pdf_interest") + '</th><th class="c">' + t("common.pdf_duration") + '</th><th class="r">' + t("common.pdf_repaid") + '</th><th class="r">' + t("common.pdf_outstanding") + '</th><th class="c">' + t("common.pdf_status") + '</th><th>' + t("common.pdf_remarks") + '</th></tr></thead><tbody>' + loanRows + '</tbody></table></div>' + buildFooter(presName, treasName, t) + '</body></html>';
  await openAsPdf(html, "Member_Statement_" + (member.name || "").replace(/\s+/g, "_"));
}
export async function generateBankLoanStatementReport(
  groupBankLoans: any[],
  bankLoanAllocations: any[],
  members: any[],
  group: any,
  t: any
) {
  let html = getHeaderHtml(group, t("bankLoans") + " " + t("auto.statement"), t);
  
  for (const loan of groupBankLoans) {
    const loanAllocs = bankLoanAllocations.filter(a => a.bankLoanId === loan.id);
    const totalAlloc = loanAllocs.reduce((s, a) => s + a.allocatedPrincipal, 0);
    const totalOut = loanAllocs.reduce((s, a) => s + a.outstandingBalance, 0);
    
    html += `<div style="margin-bottom:20px; border:1px solid #ddd; padding:15px; border-radius:8px;">
      <h3 style="margin-top:0;">${loan.bankName} - ${loan.amount.toLocaleString("en-IN")} (Sanctioned)</h3>
      <p style="margin:5px 0;"><strong>Status:</strong> ${loan.status} | <strong>Outstanding:</strong> Rs. ${totalOut.toLocaleString("en-IN")}</p>`;
      
    if (loanAllocs.length > 0) {
      html += `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:12px;">
        <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
          <th style="padding:8px; text-align:left;">Member</th>
          <th style="padding:8px; text-align:right;">Allocated</th>
          <th style="padding:8px; text-align:right;">Outstanding</th>
        </tr>`;
        
      for (const a of loanAllocs) {
        const member = members.find(m => m.id === a.memberId);
        html += `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px;">${member ? member.name : 'Unknown'}</td>
          <td style="padding:8px; text-align:right;">${a.allocatedPrincipal.toLocaleString("en-IN")}</td>
          <td style="padding:8px; text-align:right;">${a.outstandingBalance.toLocaleString("en-IN")}</td>
        </tr>`;
      }
      html += `</table>`;
    }
    html += `</div>`;
  }
  
  html += getFooterHtml(t);
  return printOrShareHtml(html, `Bank_Loan_Statement_${Date.now()}.pdf`, t);
}

export async function generateMemberStatementReport(
  memberId: string,
  members: any[],
  loans: any[],
  bankLoanAllocations: any[],
  groupBankLoans: any[],
  group: any,
  t: any
) {
  const member = members.find(m => m.id === memberId);
  if (!member) return;
  
  let html = getHeaderHtml(group, t("auto.member_statement") + " - " + member.name, t);
  
  const memberLoans = loans.filter(l => l.memberId === memberId);
  html += `<h3>${t("loans")}</h3>`;
  if (memberLoans.length === 0) {
    html += `<p>No SHG Loans</p>`;
  } else {
    html += `<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:12px;">
      <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
        <th style="padding:8px; text-align:left;">Amount</th>
        <th style="padding:8px; text-align:right;">Balance</th>
        <th style="padding:8px; text-align:center;">Status</th>
      </tr>`;
    for (const l of memberLoans) {
      html += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px;">${l.amount.toLocaleString("en-IN")}</td>
        <td style="padding:8px; text-align:right;">${l.remainingBalance.toLocaleString("en-IN")}</td>
        <td style="padding:8px; text-align:center;">${l.status}</td>
      </tr>`;
    }
    html += `</table>`;
  }
  
  const memberAllocs = bankLoanAllocations.filter(a => a.memberId === memberId);
  html += `<h3>${t("bankLoans")}</h3>`;
  if (memberAllocs.length === 0) {
    html += `<p>No Bank Loans</p>`;
  } else {
    html += `<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:12px;">
      <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
        <th style="padding:8px; text-align:left;">Bank</th>
        <th style="padding:8px; text-align:right;">Allocated</th>
        <th style="padding:8px; text-align:right;">Balance</th>
      </tr>`;
    for (const a of memberAllocs) {
      const bl = groupBankLoans.find(b => b.id === a.bankLoanId);
      html += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px;">${bl ? bl.bankName : 'Unknown'}</td>
        <td style="padding:8px; text-align:right;">${a.allocatedPrincipal.toLocaleString("en-IN")}</td>
        <td style="padding:8px; text-align:right;">${a.outstandingBalance.toLocaleString("en-IN")}</td>
      </tr>`;
    }
    html += `</table>`;
  }
  
  html += getFooterHtml(t);
  return printOrShareHtml(html, `Member_Statement_${member.name.replace(/\s+/g, "_")}.pdf`, t);
}


export async function generateLoanPassbookReport(
  loan: any,
  member: any,
  entries: any[],
  group: any,
  t: any
) {
  let html = getHeaderHtml(group, t("passbook") + " - " + (member ? member.name : "Unknown"), t);
  const isReducingBalance = loan.calculationMethod === 'reducing_balance';

  html += `
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
    html += `
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

  html += `<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:10px;">
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
    const dateStr = formatDate(isRowRB ? (r.transactionDate || r.date) : r.date);
    
    html += `<tr style="border-bottom:1px solid #e2e8f0; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'};">
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

  html += `</table>`;
  html += getFooterHtml(t);
  
  return printOrShareHtml(html, `Loan_Passbook_${member?.name?.replace(/\s+/g, "_") || 'Unknown'}.pdf`, t);
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

  const totalInterestCharged = sortedLedger.filter(e => e.type !== "disbursement").reduce((s, e) => s + (e.interestCharged || 0), 0);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bank Loan Passbook</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 12px; }
    .page { padding: 24px; max-width: 900px; margin: 0 auto; }
    .bank-header { background: linear-gradient(135deg, #1B4F72 0%, #2980B9 100%); color: white; padding: 20px 24px; border-radius: 8px 8px 0 0; margin-bottom: 0; }
    .bank-header h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .bank-header h2 { font-size: 15px; font-weight: normal; opacity: 0.85; }
    .account-section { background: #F0F8FF; border: 2px solid #2980B9; border-top: none; border-radius: 0 0 8px 8px; padding: 16px 24px; margin-bottom: 20px; }
    .account-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .account-field label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .account-field span { display: block; font-size: 14px; font-weight: bold; color: #1B4F72; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .summary-table th { background: #1B4F72; color: white; padding: 10px; text-align: left; font-size: 11px; }
    .summary-table td { padding: 10px; border-bottom: 1px solid #E0E0E0; }
    .summary-table tr:nth-child(even) td { background: #F5F5F5; }
    .ledger-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    .ledger-table th { background: #1B4F72; color: white; padding: 8px 6px; text-align: right; font-weight: bold; }
    .ledger-table th:first-child { text-align: left; }
    .ledger-table td { padding: 7px 6px; border-bottom: 1px solid #E8E8E8; text-align: right; }
    .ledger-table td:first-child, .ledger-table td:nth-child(2), .ledger-table td:nth-child(3) { text-align: left; }
    .ledger-table tr:nth-child(even) td { background: #FAFAFA; }
    .ledger-table .disbursement td { background: #E8F5E9 !important; font-weight: bold; color: #1B6B4A; }
    .ledger-table .footer-row td { background: #EBF5FB; font-weight: bold; border-top: 2px solid #1B4F72; }
    .danger { color: #C0392B; }
    .success { color: #1B6B4A; }
    .generated { font-size: 10px; color: #999; text-align: right; margin-top: 16px; }
    h3 { font-size: 14px; color: #1B4F72; margin-bottom: 10px; border-bottom: 2px solid #1B4F72; padding-bottom: 4px; }
  </style>
</head>
<body>
<div class="page">

  <!-- Bank Header -->
  <div class="bank-header">
    <h1>${bankLoan.bankName}</h1>
    <h2>${bankLoan.branch || ""} ${bankLoan.accountNumber ? "| A/C: " + bankLoan.accountNumber : ""} ${bankLoan.ifscCode ? "| IFSC: " + bankLoan.ifscCode : ""}</h2>
  </div>

  <!-- Account Details -->
  <div class="account-section">
    <div class="account-grid">
      <div class="account-field">
        <label>${t("bank_loan.account_holder")}</label>
        <span>${member.name}</span>
      </div>
      <div class="account-field">
        <label>${t("bank_loan.allocated_principal")}</label>
        <span>${RUPEE} ${allocation.allocatedPrincipal.toLocaleString("en-IN")}</span>
      </div>
      <div class="account-field">
        <label>${t("annualInterestRate")}</label>
        <span>${bankLoan.annualInterestRate}% p.a. (${(bankLoan.annualInterestRate / 12).toFixed(2)}% monthly)</span>
      </div>
      <div class="account-field">
        <label>${t("durationMonths")}</label>
        <span>${bankLoan.durationMonths} months</span>
      </div>
      <div class="account-field">
        <label>${t("sanctionDate")}</label>
        <span>${formatDate(bankLoan.sanctionDate)}</span>
      </div>
      <div class="account-field">
        <label>SHG / Group</label>
        <span>${group?.name || ""}</span>
      </div>
    </div>
  </div>

  <!-- Account Summary -->
  <h3>${t("bank_loan.account_summary")}</h3>
  <table class="summary-table">
    <thead><tr><th>${t("bank_loan.detail")}</th><th>${t("bank_loan.amount")}</th></tr></thead>
    <tbody>
      <tr><td>${t("bank_loan.allocated_principal")}</td><td>${RUPEE} ${allocation.allocatedPrincipal.toLocaleString("en-IN")}</td></tr>
      <tr><td>${t("bank_loan.principal_paid")}</td><td class="success">${RUPEE} ${allocation.totalPrincipalPaid.toLocaleString("en-IN")}</td></tr>
      <tr><td>${t("bank_loan.interest_paid")}</td><td class="success">${RUPEE} ${allocation.totalInterestPaid.toLocaleString("en-IN")}</td></tr>
      <tr><td>${t("bank_loan.outstanding_principal")}</td><td class="${allocation.outstandingBalance > 0 ? 'danger' : 'success'}">${RUPEE} ${allocation.outstandingBalance.toLocaleString("en-IN")}</td></tr>
      <tr><td>${t("bank_loan.outstanding_interest")}</td><td class="${allocation.outstandingInterest > 0 ? 'danger' : 'success'}">${RUPEE} ${allocation.outstandingInterest.toLocaleString("en-IN")}</td></tr>
      <tr><td><strong>${t("bank_loan.total_outstanding")}</strong></td><td class="danger"><strong>${RUPEE} ${(allocation.outstandingBalance + allocation.outstandingInterest).toLocaleString("en-IN")}</strong></td></tr>
    </tbody>
  </table>

  <!-- Passbook Ledger -->
  <h3>${t("bank_loan.passbook")}</h3>
  <table class="ledger-table">
    <thead>
      <tr>
        <th style="text-align:left">${t("bank_loan.date")}</th>
        <th style="text-align:left">${t("bank_loan.receipt_no")}</th>
        <th style="text-align:left">${t("bank_loan.particulars")}</th>
        <th>${t("bank_loan.opening_principal")}</th>
        <th>${t("bank_loan.interest_charged")}</th>
        <th>${t("bank_loan.principal_paid")}</th>
        <th>${t("bank_loan.total_payment")}</th>
        <th>${t("bank_loan.closing_principal")}</th>
        <th>${t("bank_loan.outstanding_interest")}</th>
      </tr>
    </thead>
    <tbody>`;

  sortedLedger.forEach(entry => {
    const isDisbursement = entry.type === "disbursement";
    html += `
      <tr class="${isDisbursement ? 'disbursement' : ''}">
        <td>${formatDate(entry.date)}</td>
        <td>${entry.receiptNo || "—"}</td>
        <td>${isDisbursement ? t("bank_loan.disbursement") : t("bank_loan.repayment")}</td>
        <td>${(entry.openingPrincipal || 0).toLocaleString("en-IN")}</td>
        <td>${(entry.interestCharged || 0).toLocaleString("en-IN")}</td>
        <td>${(entry.principalPaid || 0).toLocaleString("en-IN")}</td>
        <td><strong>${(entry.paymentReceived || 0).toLocaleString("en-IN")}</strong></td>
        <td style="color:${(entry.closingPrincipal || 0) > 0 ? '#C0392B' : '#1B6B4A'}">${(entry.closingPrincipal || 0).toLocaleString("en-IN")}</td>
        <td style="color:${(entry.outstandingInterest || 0) > 0 ? '#C0392B' : '#1B6B4A'}">${(entry.outstandingInterest || 0).toLocaleString("en-IN")}</td>
      </tr>`;
  });

  html += `
      <tr class="footer-row">
        <td colspan="3"><strong>${t("bank_loan.total")}</strong></td>
        <td>—</td>
        <td>${totalInterestCharged.toLocaleString("en-IN")}</td>
        <td>${allocation.totalPrincipalPaid.toLocaleString("en-IN")}</td>
        <td><strong>${(allocation.totalPrincipalPaid + allocation.totalInterestPaid).toLocaleString("en-IN")}</strong></td>
        <td class="danger">${allocation.outstandingBalance.toLocaleString("en-IN")}</td>
        <td class="danger">${allocation.outstandingInterest.toLocaleString("en-IN")}</td>
      </tr>
    </tbody>
  </table>

  <div class="generated">${t("bank_loan.generated_on")}: ${today} | ${group?.name || ""}</div>
</div>
</body>
</html>`;

  return printOrShareHtml(
    html,
    `BankLoan_Passbook_${member?.name?.replace(/\s+/g, "_") || "Unknown"}.pdf`,
    t
  );
}

/**
 * Generate a Group Bank Loan Statement PDF (President/Treasurer view).
 * Shows sanctioned amount, all member allocations, recovery summary.
 */
export async function generateGroupBankLoanStatementPDF({
  bankLoan,
  allocations,
  members,
  group,
  t,
  language,
}: {
  bankLoan: any;
  allocations: any[];
  members: any[];
  group: any;
  t: (key: string) => string;
  language: string;
}) {
  const RUPEE = "\u20B9";
  const today = formatDateTime(new Date());

  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedPrincipal, 0);
  const totalPrincipalCollected = allocations.reduce((s, a) => s + a.totalPrincipalPaid, 0);
  const totalInterestCollected = allocations.reduce((s, a) => s + a.totalInterestPaid, 0);
  const totalOutstandingPrincipal = allocations.reduce((s, a) => s + a.outstandingBalance, 0);
  const totalOutstandingInterest = allocations.reduce((s, a) => s + a.outstandingInterest, 0);
  const membersCompleted = allocations.filter(a => a.status === "completed").length;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1a1a1a; font-size: 12px; }
    .page { padding: 24px; }
    .header { background: linear-gradient(135deg, #1B4F72 0%, #2980B9 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header h2 { font-size: 13px; opacity: 0.85; }
    h3 { font-size: 14px; color: #1B4F72; margin: 16px 0 8px; border-bottom: 2px solid #2980B9; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .info-box { background: #F0F8FF; border: 1px solid #2980B9; border-radius: 8px; padding: 12px; }
    .info-box label { font-size: 10px; color: #555; font-weight: bold; text-transform: uppercase; }
    .info-box span { display: block; font-size: 16px; font-weight: bold; color: #1B4F72; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #1B4F72; color: white; padding: 8px 6px; text-align: right; }
    th:first-child, th:nth-child(2) { text-align: left; }
    td { padding: 7px 6px; border-bottom: 1px solid #E0E0E0; text-align: right; }
    td:first-child, td:nth-child(2) { text-align: left; }
    tr:nth-child(even) td { background: #F5F5F5; }
    .footer-row td { background: #EBF5FB !important; font-weight: bold; border-top: 2px solid #1B4F72; }
    .danger { color: #C0392B; }
    .success { color: #1B6B4A; }
    .completed-badge { background: #1B6B4A; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
    .active-badge { background: #2980B9; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
    .progress-bar { background: #E0E0E0; border-radius: 4px; height: 8px; width: 100px; display: inline-block; }
    .generated { font-size: 10px; color: #999; text-align: right; margin-top: 16px; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1>${t("bank_loan.group_statement")} — ${bankLoan.bankName}</h1>
    <h2>${group?.name || ""} | ${t("bank_loan.sanction_date")}: ${formatDate(bankLoan.sanctionDate)} | ${t("bank_loan.account_no")}: ${bankLoan.accountNumber || "—"}</h2>
  </div>

  <!-- Master Summary -->
  <h3>${t("bank_loan.master_summary")}</h3>
  <div class="info-grid">
    <div class="info-box"><label>${t("sanctionAmount")}</label><span>${RUPEE} ${bankLoan.amount.toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.total_allocated")}</label><span>${RUPEE} ${totalAllocated.toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.unallocated")}</label><span>${RUPEE} ${(bankLoan.amount - totalAllocated).toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.principal_collected")}</label><span class="success">${RUPEE} ${totalPrincipalCollected.toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.interest_collected")}</label><span class="success">${RUPEE} ${totalInterestCollected.toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.total_outstanding")}</label><span class="danger">${RUPEE} ${(totalOutstandingPrincipal + totalOutstandingInterest).toLocaleString("en-IN")}</span></div>
    <div class="info-box"><label>${t("bank_loan.members_allocated")}</label><span>${allocations.length}</span></div>
    <div class="info-box"><label>${t("bank_loan.members_completed")}</label><span>${membersCompleted}</span></div>
    <div class="info-box"><label>${t("annualInterestRate")}</label><span>${bankLoan.annualInterestRate}%</span></div>
  </div>

  <!-- Recovery Report -->
  <h3>${t("bank_loan.recovery_report")}</h3>
  <table>
    <thead>
      <tr>
        <th>Sr.</th>
        <th>${t("bank_loan.member_name")}</th>
        <th>${t("bank_loan.allocated_principal")}</th>
        <th>${t("bank_loan.principal_paid")}</th>
        <th>${t("bank_loan.interest_paid")}</th>
        <th>${t("bank_loan.outstanding_principal")}</th>
        <th>${t("bank_loan.outstanding_interest")}</th>
        <th>${t("bank_loan.recovery_pct")}</th>
        <th>${t("bank_loan.status")}</th>
      </tr>
    </thead>
    <tbody>`;

  allocations.forEach((alloc, idx) => {
    const member = members.find(m => m.id === alloc.memberId);
    const pct = alloc.allocatedPrincipal > 0
      ? Math.min(100, Math.round((alloc.totalPrincipalPaid / alloc.allocatedPrincipal) * 100))
      : 0;
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${member?.name || "—"}</td>
        <td>${RUPEE} ${alloc.allocatedPrincipal.toLocaleString("en-IN")}</td>
        <td class="success">${RUPEE} ${alloc.totalPrincipalPaid.toLocaleString("en-IN")}</td>
        <td class="success">${RUPEE} ${alloc.totalInterestPaid.toLocaleString("en-IN")}</td>
        <td class="${alloc.outstandingBalance > 0 ? 'danger' : 'success'}">${RUPEE} ${alloc.outstandingBalance.toLocaleString("en-IN")}</td>
        <td class="${alloc.outstandingInterest > 0 ? 'danger' : 'success'}">${RUPEE} ${alloc.outstandingInterest.toLocaleString("en-IN")}</td>
        <td>${pct}%</td>
        <td><span class="${alloc.status === 'completed' ? 'completed-badge' : 'active-badge'}">${alloc.status}</span></td>
      </tr>`;
  });

  html += `
      <tr class="footer-row">
        <td colspan="2"><strong>${t("bank_loan.total")}</strong></td>
        <td><strong>${RUPEE} ${totalAllocated.toLocaleString("en-IN")}</strong></td>
        <td class="success"><strong>${RUPEE} ${totalPrincipalCollected.toLocaleString("en-IN")}</strong></td>
        <td class="success"><strong>${RUPEE} ${totalInterestCollected.toLocaleString("en-IN")}</strong></td>
        <td class="danger"><strong>${RUPEE} ${totalOutstandingPrincipal.toLocaleString("en-IN")}</strong></td>
        <td class="danger"><strong>${RUPEE} ${totalOutstandingInterest.toLocaleString("en-IN")}</strong></td>
        <td><strong>${totalAllocated > 0 ? Math.round((totalPrincipalCollected / totalAllocated) * 100) : 0}%</strong></td>
        <td>${membersCompleted}/${allocations.length}</td>
      </tr>
    </tbody>
  </table>

  <div class="generated">${t("bank_loan.generated_on")}: ${today}</div>
</div>
</body>
</html>`;

  return printOrShareHtml(
    html,
    `BankLoan_Statement_${bankLoan.bankName.replace(/\s+/g, "_")}.pdf`,
    t
  );
}
