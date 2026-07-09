import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { getDeviceTimestamp } from '@/lib/time';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/lib/api";
import { resolveRepaymentAmounts, calculateShgTotal } from "../shared/accounting";

export interface Meeting {
  id: string;
  groupId: string;
  scheduledDate: string;
  agenda: string;
  notes: string;
  attendance: string[];
  status: "scheduled" | "completed" | "cancelled";
  createdBy: string;
  createdAt: string;
}

export type PaymentMode = "cash" | "online";
export type PaymentStatus =
  | "pending"
  | "pending_verification"
  | "confirmed"
  | "payment_not_received"
  | "rejected";

export interface Payment {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  amount: number;
  expectedAmount?: number;
  date: string;
  mode: PaymentMode;
  status: PaymentStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  overriddenBy?: string;
  overrideReason?: string;
  overrideAt?: string;
}

export type LoanStatus =
  | "pending_treasurer"
  | "pending_president"
  | "treasurer_rejected"
  | "approved"
  | "rejected";

export interface Loan {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  resolutionNo: string;
  amount: number;
  interest: number;
  duration: number;
  remainingBalance: number;
  calculationMethod?: "legacy" | "reducing_balance";
  fixedPrincipalInstallment?: number;
  totalPrincipalPaid?: number;
  totalInterestPaid?: number;
  outstandingInterest?: number;
  status: LoanStatus;
  treasurerActionBy?: string;
  treasurerActionAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  meetingId?: string;
  createdAt: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  presidentOverride?: boolean;
  overrideReason?: string;
  overrideAt?: string;
  // Bank-Assisted Loan fields (optional — defaults to no bank involvement)
  hasBankLoan?: boolean;
  bankId?: string;
  bankName?: string;
  bankLoanAmount?: number;
  bankInterestRate?: number;
  bankDuration?: number;
  bankRemainingBalance?: number;
  bankLoanStartDate?: string;
  bankLoanRemarks?: string;
}

export interface LoanLedger {
  id: string;
  loanId: string;
  receiptNo?: string;
  date: string;
  type: string;
  openingPrincipal: number;
  interestRateApplied: number;
  interestCharged: number;
  interestPaid: number;
  principalPaid: number;
  paymentReceived: number;
  closingPrincipal: number;
  outstandingInterest: number;
  recordedBy: string;
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;      // total = shgAmount + bankAmount
  shgAmount: number;   // SHG portion
  bankAmount: number;  // Bank pass-through (never counted as SHG income)
  date: string;
  recordedBy: string;
  remarks?: string;
}

export interface AffiliatedBank {
  id: string;
  groupId: string;
  name: string;
  branch?: string;
  ifscCode?: string;
  contactPerson?: string;
  contactNumber?: string;
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface GroupBankLoan {
  id: string;
  groupId: string;
  bankName: string;
  branch?: string;
  accountNumber?: string;
  sanctionDate: string;
  amount: number;
  annualInterestRate: number;
  durationMonths: number;
  repaymentStartDate?: string;
  remarks?: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface BankLoanAllocation {
  id: string;
  bankLoanId: string;
  memberId: string;
  allocatedPrincipal: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  outstandingBalance: number;
  outstandingInterest: number;
  status: string;
}

export interface BankLoanRepayment {
  id: string;
  allocationId: string;
  receiptNo: string;
  amount: number;
  date: string;
  recordedBy: string;
  remarks?: string;
}

export interface BankLoanLedgerEntry {
  id: string;
  allocationId: string;
  receiptNo: string;
  type: string;
  date: string;
  openingPrincipal: number;
  interestRateApplied: number;
  interestCharged: number;
  interestPaid: number;
  principalPaid: number;
  paymentReceived: number;
  closingPrincipal: number;
  outstandingInterest: number;
  remarks?: string;
  recordedBy: string;
  createdAt: string;
}

export interface DurationRule {
  maxAmount: number;
  minDuration: number;
  maxDuration: number;
}

export interface GroupSettings {
  interestRate: number;
  maxLoanAmount: number;
  durationRules: DurationRule[];
  // Contribution settings
  monthlyContributionAmount?: number;
  contributionDueDay?: number;
  gracePeriodDays?: number;
  lateFeeAmount?: number;
  lateFeeType?: "fixed" | "percentage";
}

export const DEFAULT_SETTINGS: GroupSettings = {
  interestRate: 2,
  maxLoanAmount: 50000,
  durationRules: [
    { maxAmount: 5000, minDuration: 1, maxDuration: 6 },
    { maxAmount: 20000, minDuration: 3, maxDuration: 12 },
    { maxAmount: 50000, minDuration: 6, maxDuration: 24 },
  ],
  monthlyContributionAmount: 100,
  contributionDueDay: 5,
  gracePeriodDays: 5,
  lateFeeAmount: 10,
  lateFeeType: "fixed",
};


export function getDurationRuleForAmount(amount: number, rules: DurationRule[]): DurationRule {
  const sorted = [...rules].sort((a, b) => a.maxAmount - b.maxAmount);
  return sorted.find((r) => amount <= r.maxAmount) || sorted[sorted.length - 1];
}

export function validateLoanRequest(amount: number, duration: number, settings: GroupSettings): string | null {
  if (amount <= 0) return "invalidAmount";
  if (amount > settings.maxLoanAmount) return "exceedsMaxLoan";
  const rule = getDurationRuleForAmount(amount, settings.durationRules);
  if (duration < rule.minDuration) return "durationTooShort";
  if (duration > rule.maxDuration) return "durationTooLong";
  return null;
}

import { User } from "./AuthContext";

export interface GroupSummary {
  totalSavings: number;
  currentBalance: number;
  totalPrincipalDisbursed: number;
  principalCollected: number;
  interestCollected: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  activeLoansCount: number;
  completedLoansCount: number;
  activeMembers: number;
}

interface DataContextValue {
  meetings: Meeting[];
  payments: Payment[];
  loans: Loan[];
  loanRepayments: LoanRepayment[];
  loanLedgers: LoanLedger[];
  affiliatedBanks: AffiliatedBank[];
  groupBankLoans: GroupBankLoan[];
  groupMembers: User[];
  groupRules: string;
  groupSettings: GroupSettings;
  groupSummary: GroupSummary | null;
  createMeeting: (data: { scheduledDate: string; agenda: string; notes: string }) => Promise<void>;
  updateMeeting: (id: string, data: Partial<Meeting>) => Promise<void>;
  cancelMeeting: (id: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  declarePayment: (amount: number, mode: PaymentMode) => Promise<void>;
  verifyPayment: (id: string, status: PaymentStatus, reason?: string) => Promise<void>;
  reopenPayment: (id: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  uploadQrCode: (qrCode: string | null) => Promise<void>;
  requestLoan: (data: {
    amount: number;
    duration: number;
  }) => Promise<string | null>;
  treasurerApproveLoan: (id: string) => Promise<void>;
  treasurerRejectLoan: (id: string, reason?: string) => Promise<void>;
  approveLoan: (id: string, resolutionNo: string, meetingId?: string) => Promise<void>;
  rejectLoan: (id: string, reason?: string) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  addRepayment: (loanId: string, data: { shgAmount: number; bankAmount: number; remarks?: string }) => Promise<void>;
  deleteRepayment: (repaymentId: string) => Promise<void>;
  assignTreasurer: (userId: string | null) => Promise<void>;
  updateGroupRules: (rules: string) => Promise<void>;
  updateGroupSettings: (settings: GroupSettings) => Promise<void>;
  updateMember: (memberId: string, data: Partial<User>) => Promise<void>;
  // Bank management
  createBank: (data: Omit<AffiliatedBank, "id" | "createdAt" | "createdBy" | "isActive">) => Promise<AffiliatedBank>;
  updateBank: (id: string, data: Partial<AffiliatedBank>) => Promise<void>;
  deactivateBank: (id: string) => Promise<void>;
  bankLoanAllocations: BankLoanAllocation[];
  createGroupBankLoan: (data: Omit<GroupBankLoan, "id" | "createdAt" | "status" | "createdBy">) => Promise<GroupBankLoan>;
  updateGroupBankLoan: (id: string, data: Partial<GroupBankLoan>) => Promise<void>;
  deleteGroupBankLoan: (id: string) => Promise<void>;
  closeGroupBankLoan: (id: string) => Promise<void>;
  allocateBankLoanFunds: (bankLoanId: string, allocations: {memberId: string; allocatedPrincipal: number}[]) => Promise<void>;
  recordBankLoanRepayment: (allocationId: string, data: {amount: number; date?: string; remarks?: string}) => Promise<void>;
  getBankLoanAllocationLedger: (allocationId: string) => Promise<BankLoanLedgerEntry[]>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanRepayments, setLoanRepayments] = useState<LoanRepayment[]>([]);
  const [loanLedgers, setLoanLedgers] = useState<LoanLedger[]>([]);
  const [affiliatedBanks, setAffiliatedBanks] = useState<AffiliatedBank[]>([]);
  const [groupBankLoans, setGroupBankLoans] = useState<GroupBankLoan[]>([]);
  const [bankLoanAllocations, setBankLoanAllocations] = useState<BankLoanAllocation[]>([]);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupRules, setGroupRules] = useState("");
  const [groupSettings, setGroupSettings] = useState<GroupSettings>(DEFAULT_SETTINGS);
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.groupId) return;
    const gid = user.groupId;
    const results = await Promise.allSettled([
      apiGet<Meeting[]>(`/api/groups/${gid}/meetings`),           // 0
      apiGet<Payment[]>(`/api/groups/${gid}/payments`),           // 1
      apiGet<Loan[]>(`/api/groups/${gid}/loans`),                 // 2
      apiGet<LoanRepayment[]>(`/api/groups/${gid}/repayments`),   // 3
      apiGet<User[]>(`/api/groups/${gid}/members`),               // 4
      apiGet<{ rules: string }>(`/api/groups/${gid}/rules`),       // 5
      apiGet<GroupSettings>(`/api/groups/${gid}/settings`),        // 6
      apiGet<GroupSummary>(`/api/groups/${gid}/summary`),          // 7
      apiGet<AffiliatedBank[]>(`/api/groups/${gid}/banks`),        // 8
      apiGet<GroupBankLoan[]>(`/api/groups/${gid}/bank-loans`),    // 9
      apiGet<BankLoanAllocation[]>(`/api/groups/${gid}/bank-loan-allocations`), // 10
    ]);
    const [m, p, l, r, members, rules, settings, summary, banks, gbl, bla] = results;
    if (m.status === "fulfilled") setMeetings(m.value);
    if (p.status === "fulfilled") setPayments(p.value);
    if (l.status === "fulfilled") setLoans(l.value);
    if (r.status === "fulfilled") setLoanRepayments(r.value);
    if (members.status === "fulfilled") setGroupMembers(members.value);
    if (rules.status === "fulfilled") setGroupRules(rules.value.rules);
    if (settings.status === "fulfilled") setGroupSettings(settings.value);
    if (summary.status === "fulfilled") setGroupSummary(summary.value);
    if (banks.status === "fulfilled") setAffiliatedBanks(banks.value);
    if (gbl.status === "fulfilled") setGroupBankLoans(gbl.value);
    if (bla.status === "fulfilled") setBankLoanAllocations(bla.value);
    const failures = results.filter((res) => res.status === "rejected");
    if (failures.length > 0) {
      console.warn(`${failures.length} data endpoint(s) failed to load:`, failures.map((f) => (f as PromiseRejectedResult).reason?.message));
    }
  }, [user?.groupId]);

  useEffect(() => {
    if (user?.groupId) loadData();
  }, [loadData, user?.groupId]);

  const createMeeting = useCallback(async (data: { scheduledDate: string; agenda: string; notes: string }) => {
    if (!user?.groupId) return;
    const meeting = await apiPost<Meeting>("/api/meetings", { ...data, groupId: user.groupId });
    setMeetings((prev) => [...prev, meeting]);
  }, [user?.groupId]);

  const updateMeeting = useCallback(async (id: string, data: Partial<Meeting>) => {
    const updated = await apiPatch<Meeting>(`/api/meetings/${id}`, { ...data, deviceTime: getDeviceTimestamp() });
    setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }, []);

  const cancelMeeting = useCallback(async (id: string) => {
    await updateMeeting(id, { status: "cancelled" });
  }, [updateMeeting]);

  const deleteMeeting = useCallback(async (id: string) => {
    await apiDelete(`/api/meetings/${id}`);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    await apiDelete(`/api/payments/${id}`);
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const deleteLoan = useCallback(async (id: string) => {
    await apiDelete(`/api/loans/${id}`);
    setLoans((prev) => prev.filter((l) => l.id !== id));
    setLoanRepayments((prev) => prev.filter((r) => r.loanId !== id));
  }, []);

  const deleteRepayment = useCallback(async (repaymentId: string) => {
    const res = await apiDelete<{ ok: boolean; loan: Loan }>(`/api/repayments/${repaymentId}`);
    setLoanRepayments((prev) => prev.filter((r) => r.id !== repaymentId));
    if (res.loan) {
      setLoans((prev) => prev.map((l) => l.id === res.loan.id ? res.loan : l));
    }
  }, []);

  const declarePayment = useCallback(async (amount: number, mode: PaymentMode = "cash") => {
    if (!user?.groupId) return;
    const payment = await apiPost<Payment>(`/api/groups/${user.groupId}/payments`, { amount, mode });
    setPayments((prev) => [...prev, payment]);
  }, [user?.groupId]);

  const verifyPayment = useCallback(async (id: string, status: PaymentStatus, reason?: string) => {
    const updated = await apiPatch<Payment>(`/api/payments/${id}`, { status, reason });
    setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const reopenPayment = useCallback(async (id: string) => {
    const updated = await apiPatch<Payment>(`/api/payments/${id}/reopen`, {});
    setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const uploadQrCode = useCallback(async (qrCode: string | null) => {
    if (!user?.groupId) return;
    await apiPut(`/api/groups/${user.groupId}/qr-code`, { qrCode });
  }, [user?.groupId]);

  const requestLoan = useCallback(async (data: {
    amount: number;
    duration: number;
    hasBankLoan?: boolean;
    bankId?: string;
    bankLoanAmount?: number;
    bankInterestRate?: number;
    bankDuration?: number;
    bankLoanRemarks?: string;
  }): Promise<string | null> => {
    if (!user?.groupId) return "error";
    try {
      const loan = await apiPost<Loan>(`/api/groups/${user.groupId}/loans`, data);
      setLoans((prev) => [...prev, loan]);
      return null;
    } catch (e: any) {
      return e.message || "error";
    }
  }, [user?.groupId]);

  const treasurerApproveLoan = useCallback(async (id: string) => {
    const updated = await apiPatch<Loan>(`/api/loans/${id}/treasurer-approve`, {});
    setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  const treasurerRejectLoan = useCallback(async (id: string, reason?: string) => {
    const updated = await apiPatch<Loan>(`/api/loans/${id}/treasurer-reject`, { reason });
    setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  const approveLoan = useCallback(async (id: string, resolutionNo: string, meetingId?: string) => {
    const updated = await apiPatch<Loan>(`/api/loans/${id}/approve`, { resolutionNo, meetingId });
    setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  const rejectLoan = useCallback(async (id: string, reason?: string) => {
    const updated = await apiPatch<Loan>(`/api/loans/${id}/reject`, { reason });
    setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  const assignTreasurer = useCallback(async (userId: string | null) => {
    if (!user?.groupId) return;
    await apiPatch(`/api/groups/${user.groupId}/treasurer`, { userId });
  }, [user?.groupId]);

  const addRepayment = useCallback(async (loanId: string, data: { shgAmount: number; bankAmount: number; remarks?: string }) => {
    const total = data.shgAmount + data.bankAmount;
    const response = await apiPost<{ success: boolean; loan: Loan; repayment: LoanRepayment }>(`/api/loans/${loanId}/repayments`, {
      amount: total,
      shgAmount: data.shgAmount,
      bankAmount: data.bankAmount,
      remarks: data.remarks,
    });
    const repayment = response.repayment || (response as unknown as LoanRepayment);
    setLoanRepayments((prev) => [...prev, repayment]);
    
    // Also update the loan optimistically
    if (response.loan) {
      setLoans((prev) => prev.map(l => l.id === loanId ? response.loan : l));
    } else if (data.shgAmount > 0) {
      // Optimistically update SHG balance
      setLoans((prev) => prev.map((l) => {
        if (l.id !== loanId) return l;
        const shgTotal = calculateShgTotal(l);
        const allShgRepaid = [...loanRepayments.filter((r) => r.loanId === loanId), repayment]
          .reduce((s, r) => s + resolveRepaymentAmounts(r).shgAmount, 0);
        return { ...l, remainingBalance: Math.max(0, shgTotal - allShgRepaid) };
      }));
    }
    
    // Refresh group summary explicitly so dashboard updates
    if (user?.groupId) {
      apiGet<GroupSummary>(`/api/groups/${user.groupId}/summary`).then(summary => {
        setGroupSummary(summary);
      }).catch(err => console.error("Failed to refresh summary", err));
    }
  }, [loanRepayments, user?.groupId]);

  const updateGroupRules = useCallback(async (rules: string) => {
    if (!user?.groupId) return;
    await apiPut(`/api/groups/${user.groupId}/rules`, { rules });
    setGroupRules(rules);
  }, [user?.groupId]);

  const updateGroupSettings = useCallback(async (settings: GroupSettings) => {
    if (!user?.groupId) return;
    await apiPut(`/api/groups/${user.groupId}/settings`, settings);
    setGroupSettings(settings);
  }, [user?.groupId]);

  const updateMember = useCallback(async (memberId: string, data: Partial<User>) => {
    const updated = await apiPatch<User>(`/api/members/${memberId}`, data);
    setGroupMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...updated } : m)));
  }, []);

  const updateGroupInfo = async (data: any) => {
    if (!group) return;
    try {
      await apiPatch(`/api/groups/${group.groupId}`, data);
      await loadData();
    } catch(e) {}
  };
  const createBank = useCallback(async (data: Omit<AffiliatedBank, "id" | "createdAt" | "createdBy" | "isActive">) => {
    if (!user?.groupId) throw new Error("Not authenticated");
    const bank = await apiPost<AffiliatedBank>(`/api/groups/${user.groupId}/banks`, data);
    setAffiliatedBanks((prev) => [...prev, bank]);
    return bank;
  }, [user?.groupId]);

  const updateBank = useCallback(async (id: string, data: Partial<AffiliatedBank>) => {
    const updated = await apiPatch<AffiliatedBank>(`/api/banks/${id}`, data);
    setAffiliatedBanks((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  const deactivateBank = async (id: string) => {
    await apiPatch(`/api/banks/${id}`, { isActive: false });
    await loadData();
  };

  const createGroupBankLoan = async (data: any): Promise<GroupBankLoan> => {
    if (!user?.groupId) throw new Error("Not authenticated");
    const loan = await apiPost<GroupBankLoan>(`/api/groups/${user.groupId}/bank-loans`, data);
    setGroupBankLoans((prev) => [...prev, loan]);
    return loan;
  };
  
  const updateGroupBankLoan = async (id: string, data: any) => {
    await apiPatch(`/api/bank-loans/${id}`, data);
    await loadData();
  };
  
  const deleteGroupBankLoan = async (id: string) => {
    await apiDelete(`/api/bank-loans/${id}`);
    await loadData();
  };
  
  const closeGroupBankLoan = async (id: string) => {
    await apiPatch(`/api/bank-loans/${id}/close`, {});
    await loadData();
  };
  
  const allocateBankLoanFunds = async (bankLoanId: string, allocations: {memberId: string; allocatedPrincipal: number}[]) => {
    const result = await apiPost<BankLoanAllocation[]>(`/api/bank-loans/${bankLoanId}/allocations`, { allocations });
    setBankLoanAllocations((prev) => {
      const newIds = new Set(result.map(a => a.id));
      return [...prev.filter(a => !newIds.has(a.id)), ...result];
    });
    // Also refresh bank loans in case status changed
    if (user?.groupId) {
      apiGet<GroupBankLoan[]>(`/api/groups/${user.groupId}/bank-loans`).then(setGroupBankLoans).catch(() => {});
    }
  };
  
  const recordBankLoanRepayment = async (allocationId: string, data: {amount: number; date?: string; remarks?: string}) => {
    const response = await apiPost<{ repayment: any; allocation: BankLoanAllocation }>(`/api/bank-loan-allocations/${allocationId}/repayments`, { ...data, deviceTime: getDeviceTimestamp() });
    if (response.allocation) {
      setBankLoanAllocations((prev) => prev.map(a => a.id === allocationId ? response.allocation : a));
    }
    // Refresh bank loans to check if any became completed
    if (user?.groupId) {
      apiGet<GroupBankLoan[]>(`/api/groups/${user.groupId}/bank-loans`).then(setGroupBankLoans).catch(() => {});
    }
  };

  const getBankLoanAllocationLedger = async (allocationId: string): Promise<BankLoanLedgerEntry[]> => {
    return apiGet<BankLoanLedgerEntry[]>(`/api/bank-loan-allocations/${allocationId}/ledger`);
  };
  

  const value = useMemo(
    () => ({
      meetings, payments, loans, loanRepayments, loanLedgers, affiliatedBanks, groupBankLoans, bankLoanAllocations, groupMembers, groupRules, groupSettings, groupSummary,
      createMeeting, updateMeeting, cancelMeeting, deleteMeeting,
      declarePayment, verifyPayment, reopenPayment, deletePayment, uploadQrCode,
      requestLoan, treasurerApproveLoan, treasurerRejectLoan, approveLoan, rejectLoan, deleteLoan,
      addRepayment, deleteRepayment,
      assignTreasurer,
      createBank, updateBank, deactivateBank,
      createGroupBankLoan, updateGroupBankLoan, deleteGroupBankLoan, closeGroupBankLoan,
      allocateBankLoanFunds, recordBankLoanRepayment, getBankLoanAllocationLedger,
      updateGroupRules, updateGroupSettings, updateGroupInfo, updateMember, refreshData: loadData,
    }),
    [meetings, payments, loans, loanRepayments, loanLedgers, affiliatedBanks, groupBankLoans, bankLoanAllocations, groupMembers, groupRules, groupSettings, groupSummary,
      createMeeting, updateMeeting, cancelMeeting, deleteMeeting,
      declarePayment, verifyPayment, reopenPayment, deletePayment, uploadQrCode,
      requestLoan, treasurerApproveLoan, treasurerRejectLoan, approveLoan, rejectLoan, deleteLoan,
      addRepayment, deleteRepayment,
      assignTreasurer,
      createBank, updateBank, deactivateBank,
      createGroupBankLoan, updateGroupBankLoan, deleteGroupBankLoan, closeGroupBankLoan,
      allocateBankLoanFunds, recordBankLoanRepayment, getBankLoanAllocationLedger,
      updateGroupRules, updateGroupSettings, updateGroupInfo, updateMember, loadData],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
