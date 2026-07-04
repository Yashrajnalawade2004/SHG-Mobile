// @ts-nocheck
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";
import { User, Group } from "@/contexts/AuthContext";
import { Meeting, Payment, Loan, LoanRepayment } from "@/contexts/DataContext";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const getStyles = () => `
  @page { margin: 40px 30px; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; padding: 0; }
  .header { background: linear-gradient(135deg, #1B6B4A 0%, #0d4a32 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
  .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; text-align: center; }
  .header-grid { display: flex; flex-wrap: wrap; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; gap: 15px; }
  .header-item { flex: 1; min-width: 30%; }
  .header-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-value { font-size: 12px; font-weight: 600; margin-top: 2px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; color: #1B6B4A; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; background: white; }
  th { background: #f4f6f8; color: #4a5568; font-weight: 600; text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #edf2f7; color: #2d3748; }
  tr:nth-child(even) td { background: #fafbfc; }
  .amount { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: 600; }
  th.amount { text-align: right; }
  .status { padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; display: inline-block; }
  .status-confirmed { background: #e6ffed; color: #136c2e; border: 1px solid #136c2e; }
  .status-rejected { background: #ffeef0; color: #cf222e; border: 1px solid #cf222e; }
  .status-pending { background: #fff8c5; color: #9a6700; border: 1px solid #d4a72c; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ccc; font-size: 10px; color: #777; display: flex; justify-content: space-between; align-items: flex-end; }
  .signatures { display: flex; justify-content: space-between; width: 60%; margin-left: auto; text-align: center; margin-top: 40px;}
  .sig-line { border-top: 1px solid #333; width: 150px; margin-top: 50px; padding-top: 5px; color: #333; font-weight: bold; }
  .summary-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;}
  .summary-card { flex: 1; min-width: 45%; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center;}
  .summary-val { font-size: 24px; font-weight: bold; color: #1B6B4A; margin-top: 10px; }
`;

function generateHeaderHTML(title: string, group: Group, members: User[], t: any) {
  const pres = members.find(m => m.role === "president")?.name || "-";
  const treas = members.find(m => m.role === "treasurer")?.name || "-";
  
  return `
    <div class="header">
      <h1>${group.name}</h1>
      <div style="text-align: center; margin-bottom: 10px;">${title}</div>
      <div class="header-grid">
        <div class="header-item">
          <div class="header-label">${t("pdf.group_code")}</div>
          <div class="header-value">${group.uniqueGroupCode || "-"}</div>
        </div>
        <div class="header-item">
          <div class="header-label">${t("village")}</div>
          <div class="header-value">${group.village || "-"}</div>
        </div>
        <div class="header-item">
          <div class="header-label">${t("taluka")}</div>
          <div class="header-value">${group.taluka || "-"}</div>
        </div>
        <div class="header-item">
          <div class="header-label">${t("district")}</div>
          <div class="header-value">${group.district || "-"}</div>
        </div>
        <div class="header-item">
          <div class="header-label">${t("superAdmin.president")}</div>
          <div class="header-value">${pres}</div>
        </div>
        <div class="header-item">
          <div class="header-label">${t("pdf.treasurer")}</div>
          <div class="header-value">${treas}</div>
        </div>
      </div>
    </div>
  `;
}

function generateFooterHTML(presidentName: string, treasurerName: string, t: any) {
  return `
    <div class="signatures">
      <div>
        <div class="sig-line">${t("pdf.president_signature")}</div>
        <div>${presidentName}</div>
      </div>
      <div>
        <div class="sig-line">${t("pdf.treasurer_signature")}</div>
        <div>${treasurerName}</div>
      </div>
    </div>
    <div class="footer">
      <div>${t("pdf.generated_by")} ${presidentName}</div>
      <div>${t("pdf.generated_on")} ${formatDate(new Date().toISOString())}</div>
    </div>
  `;
}

function filterByDateRange(items: any[], timeRange: string, startDate?: string, endDate?: string) {
  if (timeRange === "custom" && startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return items.filter(i => {
      const d = new Date(i.date || i.createdAt).getTime();
      return d >= start && d <= end;
    });
  } else if (timeRange === "monthly") {
    const now = new Date();
    return items.filter(i => {
      const d = new Date(i.date || i.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (timeRange === "yearly") {
    const now = new Date();
    return items.filter(i => new Date(i.date || i.createdAt).getFullYear() === now.getFullYear());
  }
  return items;
}

export async function generateGroupSavingsReport({ group, president, payments, groupMembers, language, timeRange, startDate, endDate, t }: any) {
  const title = t("reports.monthly_savings_report");
  let filteredPayments = payments.filter((p: any) => p.status === "confirmed");
  filteredPayments = filterByDateRange(filteredPayments, timeRange, startDate, endDate);

  let rows = "";
  let grandTotal = 0;
  
  groupMembers.forEach((member: any) => {
    const memPayments = filteredPayments.filter((p: any) => p.memberId === member.id);
    const total = memPayments.reduce((s: number, p: any) => s + p.amount, 0);
    if (total > 0) {
      grandTotal += total;
      rows += `<tr>
        <td>${member.name}</td>
        <td>${memPayments.length}</td>
        <td class="amount">${formatCurrency(total)}</td>
      </tr>`;
    }
  });

  const rangeTitle = timeRange === 'all' ? t("reports.allTime") : timeRange === 'yearly' ? t("reports.yearly") : timeRange === 'custom' ? t("reports.custom") : t("reports.monthly");
  
  const html = `<!DOCTYPE html><html><head><style>${getStyles()}</style></head><body>
    ${generateHeaderHTML(title, group, groupMembers, t)}
    <div class="section">
      <h2 class="section-title">${title} - ${rangeTitle}</h2>
      <table>
        <thead><tr>
          <th>${t("pdf.member_name")}</th>
          <th>${t("pdf.transactions")}</th>
          <th class="amount">${t("pdf.total_amount")}</th>
        </tr></thead>
        <tbody>${rows}
          <tr style="font-weight:bold; background:#f4f6f8;">
            <td colspan="2">${t("pdf.grand_total")}</td>
            <td class="amount">${formatCurrency(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${generateFooterHTML(president?.name || "-", groupMembers.find((m: any) => m.role === "treasurer")?.name || "-", t)}
  </body></html>`;
  
  await Print.printAsync({ html });
}

export async function generateGroupLoansReport({ group, president, loans, loanRepayments, groupMembers, language, loanFilter, t }: any) {
  const title = t("reports.active_loans_report");
  let filteredLoans = loans.filter((l: any) => l.status === "approved");
  if (loanFilter === "active") {
    filteredLoans = filteredLoans.filter((l: any) => l.remainingBalance > 0);
  } else if (loanFilter === "completed") {
    filteredLoans = filteredLoans.filter((l: any) => l.remainingBalance <= 0);
  }

  let rows = "";
  filteredLoans.forEach((loan: any) => {
    const member = groupMembers.find((m: any) => m.id === loan.memberId);
    
    // Calculate total repayable to find out how much was actually repaid
    const totalInterest = Math.round(loan.amount * (loan.interest / 100) * loan.duration);
    const totalRepayable = loan.amount + totalInterest;
    // For older loans not backfilled, prevent negative repaid amount
    const repaid = Math.max(0, (loan.remainingBalance > loan.amount ? totalRepayable : loan.amount) - loan.remainingBalance);
    
    rows += `<tr>
      <td>${member?.name || "-"}</td>
      <td>${formatDate(loan.createdAt)}</td>
      <td class="amount">${formatCurrency(loan.amount)}</td>
      <td class="amount">${formatCurrency(repaid)}</td>
      <td class="amount">${formatCurrency(loan.remainingBalance)}</td>
      <td>${loan.remainingBalance <= 0 ? t("reports.completed") : t("reports.active")}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><style>${getStyles()}</style></head><body>
    ${generateHeaderHTML(title, group, groupMembers, t)}
    <div class="section">
      <h2 class="section-title">${title}</h2>
      <table>
        <thead><tr>
          <th>${t("pdf.member_name")}</th>
          <th>${t("pdf.date")}</th>
          <th class="amount">${t("pdf.amount")}</th>
          <th class="amount">${t("pdf.repaid")}</th>
          <th class="amount">${t("pdf.balance")}</th>
          <th>${t("superAdmin.status")}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${generateFooterHTML(president?.name || "-", groupMembers.find((m: any) => m.role === "treasurer")?.name || "-", t)}
  </body></html>`;
  
  await Print.printAsync({ html });
}

export async function generateFinancialSummaryReport({ group, president, payments, loans, loanRepayments, groupMembers, language, timeRange, startDate, endDate, t }: any) {
  const title = t("reports.financial_summary");
  
  let confirmedPayments = payments.filter((p: any) => p.status === "confirmed");
  confirmedPayments = filterByDateRange(confirmedPayments, timeRange, startDate, endDate);
  
  const totalSavings = confirmedPayments.filter((p: any) => p.amount >= 100).reduce((s: number, p: any) => s + p.amount, 0);
  const totalPenalties = confirmedPayments.filter((p: any) => p.amount < 100).reduce((s: number, p: any) => s + p.amount, 0);
  
  let approvedLoans = loans.filter((l: any) => l.status === "approved");
  approvedLoans = filterByDateRange(approvedLoans, timeRange, startDate, endDate);
  const totalLoanIssued = approvedLoans.reduce((s: number, l: any) => s + l.amount, 0);
  
  let confirmedRepayments = loanRepayments;
  confirmedRepayments = filterByDateRange(confirmedRepayments, timeRange, startDate, endDate);
  const totalRepayments = confirmedRepayments.reduce((s: number, r: any) => s + r.amount, 0);

  const currentBalance = totalSavings + totalPenalties + totalRepayments - totalLoanIssued;
  const activeMembers = groupMembers.filter((m: any) => m.status === "active").length;
  const rangeTitle = timeRange === 'all' ? t("reports.allTime") : timeRange === 'yearly' ? t("reports.yearly") : timeRange === 'custom' ? t("reports.custom") : t("reports.monthly");

  const html = `<!DOCTYPE html><html><head><style>${getStyles()}</style></head><body>
    ${generateHeaderHTML(title, group, groupMembers, t)}
    <div class="section">
      <h2 class="section-title">${title} - ${rangeTitle}</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div>${t("pdf.current_balance")}</div>
          <div class="summary-val">${formatCurrency(currentBalance)}</div>
        </div>
        <div class="summary-card">
          <div>${t("pdf.total_savings")}</div>
          <div class="summary-val">${formatCurrency(totalSavings)}</div>
        </div>
        <div class="summary-card">
          <div>${t("pdf.total_penalties")}</div>
          <div class="summary-val">${formatCurrency(totalPenalties)}</div>
        </div>
        <div class="summary-card">
          <div>${t("pdf.loan_disbursed")}</div>
          <div class="summary-val">${formatCurrency(totalLoanIssued)}</div>
        </div>
        <div class="summary-card">
          <div>${t("pdf.loan_repayments")}</div>
          <div class="summary-val">${formatCurrency(totalRepayments)}</div>
        </div>
        <div class="summary-card">
          <div>${t("pdf.active_members")}</div>
          <div class="summary-val">${activeMembers}</div>
        </div>
      </div>
    </div>
    ${generateFooterHTML(president?.name || "-", groupMembers.find((m: any) => m.role === "treasurer")?.name || "-", t)}
  </body></html>`;
  
  await Print.printAsync({ html });
}

export async function generateMemberRegisterReport({ group, president, groupMembers, payments, loans, language, t }: any) {
  const title = t("reports.member_register");
  
  const now = new Date();
  
  let rows = "";
  groupMembers.forEach((member: any) => {
    const memLoans = loans.filter((l: any) => l.memberId === member.id && l.status === "approved");
    const activeLoan = memLoans.some((l: any) => l.remainingBalance > 0);
    const completedLoanCount = memLoans.filter((l: any) => l.remainingBalance <= 0).length;
    
    const memPayments = payments.filter((p: any) => p.memberId === member.id && p.status === "confirmed" && p.amount >= 100);
    const totalContribution = memPayments.reduce((s: number, p: any) => s + p.amount, 0);
    const totalMonthsPaid = memPayments.length;
    
    let pendingMonths = 0;
    const startStr = member.contributionStartMonth;
    if (startStr && startStr.includes("-")) {
      const [y, m] = startStr.split("-");
      const startD = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthsSinceStart = (now.getFullYear() - startD.getFullYear()) * 12 + (now.getMonth() - startD.getMonth()) + 1;
      pendingMonths = Math.max(0, monthsSinceStart - totalMonthsPaid);
    }
    
    rows += `<tr>
      <td>${member.name}</td>
      <td>${member.status === 'active' ? t("active") : t("left")}</td>
      <td>${pendingMonths}</td>
      <td>${activeLoan ? t("pdf.yes") : t("pdf.no")}</td>
      <td>${completedLoanCount}</td>
      <td class="amount">${formatCurrency(totalContribution)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><style>${getStyles()}</style></head><body>
    ${generateHeaderHTML(title, group, groupMembers, t)}
    <div class="section">
      <h2 class="section-title">${title}</h2>
      <table>
        <thead><tr>
          <th>${t("pdf.member_name")}</th>
          <th>${t("superAdmin.status")}</th>
          <th>${t("pdf.pending_months")}</th>
          <th>${t("pdf.active_loan")}</th>
          <th>${t("pdf.completed_loans")}</th>
          <th class="amount">${t("pdf.total_contribution")}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${generateFooterHTML(president?.name || "-", groupMembers.find((m: any) => m.role === "treasurer")?.name || "-", t)}
  </body></html>`;
  
  await Print.printAsync({ html });
}

export async function generateMemberStatement({ group, president, groupMembers, member, language, t }: any) {
  const title = t("pdf.member_statement");
  const html = `<!DOCTYPE html><html><head><style>${getStyles()}</style></head><body>
    ${generateHeaderHTML(title, group, groupMembers, t)}
    <div class="section">
      <h2 class="section-title">${member.name} - ${title}</h2>
      <p>${t("pdf.detailed_statement")}</p>
    </div>
    ${generateFooterHTML(president?.name || "-", groupMembers.find((m: any) => m.role === "treasurer")?.name || "-", t)}
  </body></html>`;
  await Print.printAsync({ html });
}
