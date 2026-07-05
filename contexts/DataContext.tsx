import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/lib/api";

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
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  recordedBy: string;
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
  totalLoanDisbursed: number;
  totalOutstanding: number;
  totalRepayments: number;
  totalPenalties: number;
  currentBalance: number;
  activeMembers: number;
  monthlyExpected: number;
  monthlyCollected: number;
}

interface DataContextValue {
  meetings: Meeting[];
  payments: Payment[];
  loans: Loan[];
  loanRepayments: LoanRepayment[];
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
  requestLoan: (data: { amount: number; duration: number }) => Promise<string | null>;
  treasurerApproveLoan: (id: string) => Promise<void>;
  treasurerRejectLoan: (id: string, reason?: string) => Promise<void>;
  approveLoan: (id: string, resolutionNo: string, meetingId?: string) => Promise<void>;
  rejectLoan: (id: string, reason?: string) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  addRepayment: (loanId: string, amount: number) => Promise<void>;
  deleteRepayment: (repaymentId: string, loanId: string) => Promise<void>;
  assignTreasurer: (userId: string | null) => Promise<void>;
  updateGroupRules: (rules: string) => Promise<void>;
  updateGroupSettings: (settings: GroupSettings) => Promise<void>;
  updateMember: (memberId: string, data: Partial<User>) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanRepayments, setLoanRepayments] = useState<LoanRepayment[]>([]);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupRules, setGroupRules] = useState("");
  const [groupSettings, setGroupSettings] = useState<GroupSettings>(DEFAULT_SETTINGS);
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.groupId) return;
    const gid = user.groupId;
    const [m, p, l, r, members, rules, settings, summary] = await Promise.allSettled([
      apiGet<Meeting[]>(`/api/groups/${gid}/meetings`),
      apiGet<Payment[]>(`/api/groups/${gid}/payments`),
      apiGet<Loan[]>(`/api/groups/${gid}/loans`),
      apiGet<LoanRepayment[]>(`/api/groups/${gid}/repayments`),
      apiGet<User[]>(`/api/groups/${gid}/members`),
      apiGet<{ rules: string }>(`/api/groups/${gid}/rules`),
      apiGet<GroupSettings>(`/api/groups/${gid}/settings`),
      apiGet<GroupSummary>(`/api/groups/${gid}/summary`),
    ]);
    if (m.status === "fulfilled") setMeetings(m.value);
    if (p.status === "fulfilled") setPayments(p.value);
    if (l.status === "fulfilled") setLoans(l.value);
    if (r.status === "fulfilled") setLoanRepayments(r.value);
    if (members.status === "fulfilled") setGroupMembers(members.value);
    if (rules.status === "fulfilled") setGroupRules(rules.value.rules);
    if (settings.status === "fulfilled") setGroupSettings(settings.value);
    if (summary.status === "fulfilled") setGroupSummary(summary.value);
    const failures = [m, p, l, r, members, rules, settings, summary].filter((res) => res.status === "rejected");
    if (failures.length > 0) {
      console.warn(`${failures.length} data endpoint(s) failed to load:`, failures.map((f) => (f as PromiseRejectedResult).reason?.message));
    }
  }, [user?.groupId]);

  useEffect(() => {
    if (user?.groupId) loadData();
  }, [loadData, user?.groupId]);

  const createMeeting = useCallback(async (data: { scheduledDate: string; agenda: string; notes: string }) => {
    if (!user?.groupId) return;
    const meeting = await apiPost<Meeting>(`/api/groups/${user.groupId}/meetings`, data);
    setMeetings((prev) => [...prev, meeting]);
  }, [user?.groupId]);

  const updateMeeting = useCallback(async (id: string, data: Partial<Meeting>) => {
    const updated = await apiPatch<Meeting>(`/api/meetings/${id}`, data);
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

  const deleteRepayment = useCallback(async (repaymentId: string, loanId: string) => {
    await apiDelete(`/api/repayments/${repaymentId}`);
    setLoanRepayments((prev) => prev.filter((r) => r.id !== repaymentId));
    // recalculate remaining balance
    setLoans((prev) => prev.map((l) => {
      if (l.id !== loanId) return l;
      const remaining = loanRepayments.filter((r) => r.id !== repaymentId && r.loanId === loanId).reduce((s, r) => s + r.amount, 0);
      return { ...l, remainingBalance: Math.max(0, l.amount - remaining) };
    }));
  }, [loanRepayments]);

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

  const requestLoan = useCallback(async (data: { amount: number; duration: number }): Promise<string | null> => {
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

  const addRepayment = useCallback(async (loanId: string, amount: number) => {
    const repayment = await apiPost<LoanRepayment>(`/api/loans/${loanId}/repayments`, { amount });
    setLoanRepayments((prev) => [...prev, repayment]);
    const allForLoan = [...loanRepayments.filter((r) => r.loanId === loanId), repayment];
    const totalRepaid = allForLoan.reduce((sum, r) => sum + r.amount, 0);
    setLoans((prev) => prev.map((l) => l.id === loanId ? { ...l, remainingBalance: Math.max(0, l.amount - totalRepaid) } : l));
  }, [loanRepayments]);

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
  const value = useMemo(
    () => ({
      meetings, payments, loans, loanRepayments, groupMembers, groupRules, groupSettings, groupSummary,
      createMeeting, updateMeeting, cancelMeeting, deleteMeeting,
      declarePayment, verifyPayment, reopenPayment, deletePayment, uploadQrCode,
      requestLoan, treasurerApproveLoan, treasurerRejectLoan, approveLoan, rejectLoan, deleteLoan,
      addRepayment, deleteRepayment,
      assignTreasurer,
      updateGroupRules, updateGroupSettings, updateGroupInfo, updateMember, refreshData: loadData,
    }),
    [meetings, payments, loans, loanRepayments, groupMembers, groupRules, groupSettings, groupSummary,
      createMeeting, updateMeeting, cancelMeeting, deleteMeeting,
      declarePayment, verifyPayment, reopenPayment, deletePayment, uploadQrCode,
      requestLoan, treasurerApproveLoan, treasurerRejectLoan, approveLoan, rejectLoan, deleteLoan,
      addRepayment, deleteRepayment,
      assignTreasurer,
      updateGroupRules, updateGroupSettings, updateGroupInfo, updateMember, loadData],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
