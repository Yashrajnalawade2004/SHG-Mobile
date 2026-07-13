import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, Modal, Alert, Image, ActivityIndicator
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import { apiGet } from "@/lib/api";
import { calculateShgTotal, calculateNextLedgerEntry, getCurrentLoanRecommendation } from "@/shared/accounting";
import Colors from "@/constants/colors";
import ConfirmDialog from "@/components/ConfirmDialog";
import SHGDatePicker from "@/components/SHGDatePicker";

function loanStatusColor(status: string): string {
  switch (status) {
    case "approved": return Colors.light.success;
    case "rejected": return Colors.light.danger;
    case "treasurer_rejected": return Colors.light.danger;
    case "pending_treasurer": return "#D97706";
    case "pending_president": return Colors.light.pending;
    default: return Colors.light.pending;
  }
}

type DialogType = "approveTreasurer" | "rejectTreasurer" | "rejectPresident" | "deleteLoan" | null;

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { group, isPresident, isTreasurer } = useAuth();
  const { t } = useLanguage();
  const [showQrModal, setShowQrModal] = useState(false);
  const {
    loans, loanRepayments, groupMembers, groupSummary,
    treasurerApproveLoan, treasurerRejectLoan,
    approveLoan, rejectLoan,
    addRepayment, deleteRepayment, deleteLoan,
  } = useData();
  const loan = loans.find((l) => l.id === id);

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  useEffect(() => {
    if (loan?.calculationMethod === 'reducing_balance') {
      apiGet(`/api/loans/${loan.id}/ledger`)
        .then((data: any) => setLedgerEntries(data || []))
        .catch(console.error);
    }
  }, [loan?.id, loan?.calculationMethod, loan?.remainingBalance]);

  const [resolutionNo, setResolutionNo] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showRepay, setShowRepay] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteRepaymentId, setDeleteRepaymentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resolutionError, setResolutionError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const repaymentSubmittingRef = useRef(false);

  if (!loan) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.light.danger} />
        <Text style={[styles.emptyText, { marginTop: 16, color: Colors.light.danger, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }]}>{t("unauthorized_loan_view")}</Text>
        <Text style={{ marginTop: 8, color: Colors.light.textSecondary, textAlign: 'center' }}>{t("loan_privacy_notice")}</Text>
      </View>
    );
  }

  const repayments = loanRepayments
    .filter((r) => r.loanId === loan.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let currentRem = loan.amount;
  const passbookEntries = [...repayments].reverse().map(r => {
    currentRem = Math.max(0, currentRem - r.amount);
    return {
      ...r,
      runRem: currentRem,
    };
  }).reverse();

  const isReducingBalance = loan.calculationMethod === 'reducing_balance';
  const displayEntries = isReducingBalance ? ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : passbookEntries;

  const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);
  const color = loanStatusColor(loan.status);

  const totalInterest = Math.round(loan.amount * (loan.interest / 100) * loan.duration);
  const totalRepayable = loan.amount + totalInterest;
  const rawProgress = totalRepayable > 0 ? (totalRepaid / totalRepayable) * 100 : 0;
  const progress = Math.min(100, Math.max(0, rawProgress));

  const shgEmi = loan.duration > 0 ? Math.round((loan.amount + totalInterest) / loan.duration) : 0;

  // Reducing Balance Logic
  const fixedPrincipalInstallment = loan.fixedPrincipalInstallment || Math.floor(loan.amount / loan.duration);
  const remainingMonths = fixedPrincipalInstallment > 0 ? Math.ceil(loan.remainingBalance / fixedPrincipalInstallment) : 0;
  const displayEntriesLast = [...displayEntries].filter(e => e.type !== "disbursement" || !isReducingBalance).sort((a,b) => new Date(b.date || b.date).getTime() - new Date(a.date || a.date).getTime());
  const lastPayment = displayEntriesLast[0];

  const recommendation = loan.calculationMethod === "reducing_balance" 
    ? getCurrentLoanRecommendation(loan)
    : null;

  const handleTreasurerApprove = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await treasurerApproveLoan(loan.id);
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const handleTreasurerReject = async () => {
    try {
      setDialog(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await treasurerRejectLoan(loan.id, rejectReason.trim() || undefined);
      setRejectReason("");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const handleApprove = async () => {
    try {
      if (!resolutionNo.trim()) {
        setResolutionError(true);
        return;
      }
      setResolutionError(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await approveLoan(loan.id, resolutionNo.trim());
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const handleReject = async () => {
    try {
      setDialog(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await rejectLoan(loan.id, rejectReason.trim() || undefined);
      setRejectReason("");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const handleExportPassbook = async () => {
    try {
      // We will implement generateLoanPassbookReport in pdf-generator.ts
      const { generateLoanPassbookReport } = require('../../lib/pdf-generator');
      const mem = groupMembers.find(m => m.id === loan.memberId);
      await generateLoanPassbookReport(loan, mem, displayEntries, groupSummary, t);
    } catch (err) {
      console.error(err);
      alert("Failed to export passbook");
    }
  };


  const handleRepay = async () => {
    try {
      if (isSubmitting || repaymentSubmittingRef.current) return;
      const num = parseInt(repayAmount);
      if (!num || num <= 0) return;
      repaymentSubmittingRef.current = true;
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addRepayment(loan.id, { shgAmount: num, bankAmount: 0, date: repayDate });
      setRepayAmount("");
      setShowRepay(false);
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    } finally {
      repaymentSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteRepayment = async () => {
    try {
      if (!deleteRepaymentId) return;
      setDeleteRepaymentId(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await deleteRepayment(deleteRepaymentId);
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const handleDeleteLoan = async () => {
    try {
      setDialog(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await deleteLoan(loan.id);
      router.back();
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    }
  };

  const showTreasurerActions = isTreasurer && loan.status === "pending_treasurer";
  const showPresidentActions = isPresident && (loan.status === "pending_president" || loan.status === "pending_treasurer");
  const isDirectOverride = loan.presidentOverride === true;
  const isFinal = loan.status === "approved" || loan.status === "completed" || loan.status === "rejected" || loan.status === "treasurer_rejected";

  const previewRepayAmount = parseInt(repayAmount) || 0;
  const repaymentPreview = loan.calculationMethod === "reducing_balance" 
    ? calculateNextLedgerEntry(
        { remainingBalance: loan.remainingBalance, outstandingInterest: loan.outstandingInterest || 0 },
        previewRepayAmount,
        loan.interest,
        fixedPrincipalInstallment,
        "due"
      )
    : null;
  const showRepayment = loan.status === "approved" || loan.status === "completed";
  const canDelete = isPresident;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("loanDetails")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.statusBanner, { backgroundColor: color + "18" }]}>
          {loan.status === "pending_treasurer" && <Ionicons name="wallet" size={16} color={color} />}
          {loan.status === "pending_president" && <Ionicons name="shield" size={16} color={color} />}
          {(loan.status === "approved" || loan.status === "completed") && <Ionicons name="checkmark-circle" size={16} color={color} />}
          {(loan.status === "rejected" || loan.status === "treasurer_rejected") && (
            <Ionicons name="close-circle" size={16} color={color} />
          )}
          <Text style={[styles.statusLabel, { color }]}>{t(loan.status)}</Text>
        </View>

        {loan.status === "pending_president" && loan.treasurerActionAt && !isDirectOverride && (
          <View style={styles.workflowNote}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.light.success} />
            <Text style={styles.workflowNoteText}>
              {t("auto.treasurer_approved_forwarded_to_president")}
            </Text>
          </View>
        )}

        {isDirectOverride && (
          <View style={[styles.workflowNote, { backgroundColor: "#F59E0B15", borderColor: "#FDE68A" }]}>
            <Ionicons name="shield-checkmark" size={14} color="#D97706" />
            <Text style={[styles.workflowNoteText, { color: "#D97706" }]}>
              {(loan.status === "approved" || loan.status === "completed") ? t("approved_directly") : t("rejected_directly")}
            </Text>
          </View>
        )}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t("pdf_financial_summary")}</Text>
          <View style={[styles.amountRow, { flexWrap: "wrap", marginTop: 10 }]}>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}> 
              <Text style={styles.amountDetailLabel}>{t("name")}</Text>
              <Text style={styles.amountDetailValue}>{loan.memberName}</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("loanAmount")}</Text>
              <Text style={styles.amountDetailValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("interest")}</Text>
              <Text style={styles.amountDetailValue}>{loan.interest}%</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("duration")}</Text>
              <Text style={styles.amountDetailValue}>{loan.duration} {t("auto.mo")}</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("remaining_months")}</Text>
              <Text style={[styles.amountDetailValue, loan.remainingBalance <= 0 ? { color: Colors.light.success } : {}]}>
                {loan.remainingBalance <= 0 ? (t("completed") || "Completed") : `${remainingMonths} ${t("auto.mo")}`}
              </Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("remaining")}</Text>
              <Text style={[styles.amountDetailValue, { color: loan.remainingBalance > 0 ? Colors.light.danger : Colors.light.success }]}>
                Rs. {loan.remainingBalance.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("outstanding_interest")}</Text>
              <Text style={[styles.amountDetailValue, { color: (loan.outstandingInterest || 0) > 0 ? Colors.light.danger : Colors.light.text }]}>
                Rs. {(loan.outstandingInterest || 0).toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("total_principal_paid")}</Text>
              <Text style={styles.amountDetailValue}>Rs. {(loan.totalPrincipalPaid || 0).toLocaleString("en-IN")}</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("total_interest_paid")}</Text>
              <Text style={styles.amountDetailValue}>Rs. {(loan.totalInterestPaid || 0).toLocaleString("en-IN")}</Text>
            </View>
            <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
              <Text style={styles.amountDetailLabel}>{t("loan_start_date")}</Text>
              <Text style={styles.amountDetailValue}>{new Date(loan.createdAt).toLocaleDateString()}</Text>
            </View>
            {loan.approvedAt && (
              <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
                <Text style={styles.amountDetailLabel}>{t("loan_approval_date")}</Text>
                <Text style={styles.amountDetailValue}>{new Date(loan.approvedAt).toLocaleDateString()}</Text>
              </View>
            )}
            {loan.resolutionNo && (
              <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
                <Text style={styles.amountDetailLabel}>{t("resolution_number")}</Text>
                <Text style={styles.amountDetailValue}>{loan.resolutionNo}</Text>
              </View>
            )}
            {loan.meetingId && (
              <View style={[styles.amountDetail, { width: '48%', marginBottom: 12 }]}>
                <Text style={styles.amountDetailLabel}>{t("meeting_reference")}</Text>
                <Text style={styles.amountDetailValue}>{loan.meetingId}</Text>
              </View>
            )}
            
          </View>
          {showRepayment && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` as any }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}% {t("auto.repaid")}</Text>
            </View>
          )}
        </View>

        {loan.calculationMethod === "reducing_balance" && showRepayment && recommendation && loan.remainingBalance > 0 && (
          <View style={[styles.amountCard, styles.recommendationCard]}>
            <View style={styles.recommendationHeader}>
              <View style={styles.recommendationHeaderLeft}>
                <Ionicons name="calculator" size={18} color={Colors.light.primary} />
                <Text style={styles.recommendationTitle}>{t("month")}</Text>
              </View>
              <View style={styles.recommendationBadge}>
                <Text style={styles.recommendationBadgeText}>{t("suggested_installment")}</Text>
              </View>
            </View>

            <View style={styles.recommendationTable}>
              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>{t("outstanding_principal")}</Text>
                <Text style={styles.recommendationValue}>Rs. {recommendation.outstandingPrincipal.toLocaleString("en-IN")}</Text>
              </View>

              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>{t("monthly_interest_rate")}</Text>
                <Text style={styles.recommendationValue}>{loan.interest}%</Text>
              </View>

              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>{t("current_month_interest")}</Text>
                <Text style={styles.recommendationValue}>Rs. {recommendation.currentMonthInterest.toLocaleString("en-IN")}</Text>
              </View>

              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>{t("suggested_principal")}</Text>
                <Text style={styles.recommendationValue}>Rs. {(recommendation?.recommendedPrincipal || 0).toLocaleString("en-IN")}</Text>
              </View>

              {(loan.outstandingInterest || 0) > 0 && (
                <View style={[styles.recommendationRow, styles.recommendationDangerRow]}>
                  <Text style={styles.recommendationLabel}>{t("outstanding_interest_remaining")}</Text>
                  <Text style={styles.recommendationValueDanger}>Rs. {(loan.outstandingInterest || 0).toLocaleString("en-IN")}</Text>
                </View>
              )}

              <View style={[styles.recommendationRow, styles.recommendationHighlightRow]}>
                <Text style={styles.recommendationLabelHighlight}>{t("total_suggested_payment")}</Text>
                <Text style={styles.recommendationValueHighlight}>Rs. {(recommendation?.recommendedMonthlyPayment || 0).toLocaleString("en-IN")}</Text>
              </View>
            </View>
          </View>
        )}


        {(loan.status === "rejected" || loan.status === "treasurer_rejected") && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionLabel}>{t("rejection_reason")}:</Text>
            <Text style={styles.rejectionText}>{loan.rejectionReason || t("no_remarks_provided")}</Text>
            {loan.rejectedAt && (
              <Text style={styles.rejectionMeta}>
                {t("rejected_on")} {new Date(loan.rejectedAt).toLocaleDateString("en-IN")}
              </Text>
            )}
          </View>
        )}

        {loan.overrideReason && (
          <View style={[styles.rejectionBox, { backgroundColor: "#F59E0B15", borderColor: "#FDE68A" }]}>
            <Text style={[styles.rejectionLabel, { color: "#D97706" }]}>{t("override_history")}</Text>
            <Text style={[styles.rejectionText, { color: "#92400E" }]}>{loan.overrideReason}</Text>
            {loan.overrideAt && (
              <Text style={[styles.rejectionMeta, { color: "#92400E" }]}>
                {new Date(loan.overrideAt).toLocaleDateString("en-IN")}
              </Text>
            )}
          </View>
        )}

        {/* NEW LIFECYCLE TIMELINE */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>{t("approval_timeline")}</Text>
          
          {/* 5. Completed */}
          {(loan.status === "completed" || loan.status === "approved") && (
            <View style={[styles.timelineStep, { opacity: loan.status === "completed" ? 1 : 0.4 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {loan.status === "completed" ? (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={16} color={Colors.light.textMuted} />
                )}
                <Text style={[styles.timelineStepTitle, loan.status === "completed" && { color: Colors.light.success }]}>
                  {t("loan_completed") || "Loan Completed"}
                </Text>
              </View>
              <Text style={styles.timelineMeta}>
                {loan.status === "completed" ? (t("completed") || "Completed") : (t("pending") || "Pending")}
              </Text>
            </View>
          )}

          {/* 4. Repayments */}
          {(loan.status === "completed" || loan.status === "approved") && (
            <View style={[styles.timelineStep, { opacity: loan.status === "approved" || loan.status === "completed" ? 1 : 0.4 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {loan.status === "completed" ? (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} />
                ) : loan.status === "approved" ? (
                  <Ionicons name="sync-circle" size={16} color={Colors.light.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={16} color={Colors.light.textMuted} />
                )}
                <Text style={[styles.timelineStepTitle, loan.status === "approved" && { color: Colors.light.primary }]}>
                  {t("repayment") || "Monthly Repayments"} {loan.status === "approved" ? "(In Progress)" : ""}
                </Text>
              </View>
              <Text style={styles.timelineMeta}>
                {loan.status === "completed" ? (t("completed") || "Completed") : loan.status === "approved" ? (t("active") || "Active") : (t("pending") || "Pending")}
              </Text>
            </View>
          )}

          {/* 3. Loan Disbursed */}
          {(loan.status === "completed" || loan.status === "approved") && (
            <View style={styles.timelineStep}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} />
                <Text style={styles.timelineStepTitle}>{t("ledger_loan_disbursed") || "Loan Disbursed"}</Text>
              </View>
              <Text style={styles.timelineMeta}>
                {loan.approvedAt ? new Date(loan.approvedAt).toLocaleDateString("en-IN") : (t("completed") || "Completed")}
              </Text>
            </View>
          )}

          {/* 2. President Decision (Approved / Rejected) */}
          {(loan.status === "approved" || loan.status === "completed" || loan.status === "rejected" || loan.status === "treasurer_rejected") ? (
            <View style={styles.timelineStep}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={(loan.status === "approved" || loan.status === "completed") ? "checkmark-circle" : "close-circle"} size={16} color={(loan.status === "approved" || loan.status === "completed") ? Colors.light.success : Colors.light.danger} />
                <Text style={[styles.timelineStepTitle, (loan.status === "rejected" || loan.status === "treasurer_rejected") && { color: Colors.light.danger }]}>
                  {(loan.status === "approved" || loan.status === "completed") ? (t("president_approved") || "President Approved") : (t("loan_rejected") || "Loan Rejected")}
                </Text>
              </View>
              <Text style={styles.timelineMeta}>
                {loan.approvedAt ? new Date(loan.approvedAt).toLocaleDateString("en-IN") : loan.rejectedAt ? new Date(loan.rejectedAt).toLocaleDateString("en-IN") : (t("completed") || "Completed")}
              </Text>
            </View>
          ) : (
            <View style={styles.timelineStep}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time" size={16} color="#D97706" />
                <Text style={[styles.timelineStepTitle, { color: "#D97706" }]}>{t("president_review") || "President Review"} (Pending)</Text>
              </View>
              <Text style={styles.timelineMeta}>{t("pending") || "Pending"}</Text>
            </View>
          )}

          {/* 1. Loan Requested (Always first/bottom) */}
          <View style={styles.timelineStep}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} />
              <Text style={styles.timelineStepTitle}>{t("loan_requested") || "Loan Requested"}</Text>
            </View>
            <Text style={styles.timelineMeta}>{new Date(loan.createdAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        {showTreasurerActions && (
          <View style={styles.approvalCard}>
            <View style={styles.approvalCardHeader}>
              <Ionicons name="wallet" size={18} color="#D97706" />
              <Text style={[styles.approvalCardTitle, { color: "#D97706" }]}>
                {t("auto.treasurer_decision")}
              </Text>
            </View>
            <Text style={styles.approvalCardSub}>
              {t("auto.your_decision_will_be_forwarded")}
            </Text>
            <View style={styles.approvalButtons}>
              <Pressable style={[styles.approveBtn, { backgroundColor: Colors.light.success }]} onPress={() => setDialog("approveTreasurer")}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.approveBtnText}>{t("approve")}</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => setDialog("rejectTreasurer")}>
                <Ionicons name="close" size={18} color={Colors.light.danger} />
                <Text style={styles.rejectBtnText}>{t("reject")}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showPresidentActions && (
          <View style={styles.approvalCard}>
            <View style={styles.approvalCardHeader}>
              <Ionicons name="shield" size={18} color={Colors.light.primary} />
              <Text style={[styles.approvalCardTitle, { color: Colors.light.primary }]}>
                {loan.status === "pending_treasurer" ? t("president_override_decision") : t("auto.president_s_final_decision")}
              </Text>
            </View>
            <Text style={styles.fieldLabel}>{t("resolutionNo")} *</Text>
            <TextInput
              style={[styles.editInput, resolutionError && { borderColor: Colors.light.danger }]}
              value={resolutionNo}
              onChangeText={(v) => { setResolutionNo(v); setResolutionError(false); }}
              placeholder={t("auto.enter_resolution_number")}
              placeholderTextColor={Colors.light.textMuted}
            />
            {resolutionError && (
              <Text style={{ color: Colors.light.danger, fontSize: 12, fontFamily: "Poppins_400Regular" }}>
                {t("auto.resolution_number_is_required")}
              </Text>
            )}
            <View style={styles.approvalButtons}>
              <Pressable style={[styles.approveBtn, { backgroundColor: Colors.light.primary }]} onPress={handleApprove}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.approveBtnText}>
                  {loan.status === "pending_treasurer" ? t("direct_approve") : t("approve")}
                </Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => setDialog("rejectPresident")}>
                <Ionicons name="close" size={18} color={Colors.light.danger} />
                <Text style={styles.rejectBtnText}>
                  {loan.status === "pending_treasurer" ? t("direct_reject") : t("reject")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {showRepayment && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("repayment")}</Text>
              {isPresident && (loan.status === "approved" || loan.status === "completed") && (
                <Pressable onPress={() => {
                  if (!showRepay) setRepayDate(new Date().toISOString().split("T")[0]);
                  setShowRepay(!showRepay);
                }}>
                  <Ionicons name={showRepay ? "close" : "add-circle"} size={24} color={Colors.light.primary} />
                </Pressable>
              )}
            </View>

            {showRepay && (
              <View style={styles.repayInput}>
                <View style={styles.inputRow}>
                  <Text style={styles.rupee}>Rs.</Text>
                  <TextInput
                    style={styles.repayField}
                    value={repayAmount}
                    onChangeText={setRepayAmount}
                    placeholder="0"
                    placeholderTextColor={Colors.light.textMuted}
                    keyboardType="number-pad"
                    autoFocus
                  />
                  <Pressable
                    style={[styles.repayBtn, isSubmitting && styles.repayBtnDisabled]}
                    onPress={handleRepay}
                    disabled={isSubmitting}
                    accessibilityLabel={isSubmitting ? "Saving repayment" : "Save repayment"}
                  >
                    {isSubmitting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="checkmark" size={20} color="#fff" />}
                  </Pressable>
                </View>
                <View style={styles.repaymentDateField}>
                  <Text style={styles.repaymentDateLabel}>{t("date")}</Text>
                  <SHGDatePicker mode="date" value={repayDate} onSelect={setRepayDate} />
                </View>
                {loan.calculationMethod === "reducing_balance" && repaymentPreview && previewRepayAmount > 0 && (
                  <View style={[styles.amountCard, { marginTop: 12, backgroundColor: Colors.light.card, borderColor: Colors.light.primary, borderWidth: 1 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Ionicons name="eye" size={18} color={Colors.light.primary} />
                      <Text style={[styles.amountLabel, { marginBottom: 0, fontSize: 13 }]}>{t("repayment_summary")}</Text>
                    </View>
                    
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaLabel}>{t("payment_entered")}</Text>
                      <Text style={styles.formulaValue}>Rs. {previewRepayAmount.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}><Ionicons name="arrow-down" size={16} color={Colors.light.textMuted} /></View>
                    
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaLabel}>{t("interest_paid_label")}</Text>
                      <Text style={styles.formulaValue}>Rs. {repaymentPreview.interestPaid.toLocaleString("en-IN")}</Text>
                    </View>
                    {(repaymentPreview.outstandingInterest > 0) && (
                      <>
                        <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}><Ionicons name="arrow-down" size={16} color={Colors.light.textMuted} /></View>
                        <View style={[styles.formulaBox, { backgroundColor: '#FEF2F2' }]}>
                          <Text style={[styles.formulaLabel, { color: Colors.light.danger }]}>{t("outstanding_interest_remaining")}</Text>
                          <Text style={[styles.formulaValue, { color: Colors.light.danger }]}>Rs. {repaymentPreview.outstandingInterest.toLocaleString("en-IN")}</Text>
                        </View>
                      </>
                    )}
                    <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}><Ionicons name="arrow-down" size={16} color={Colors.light.textMuted} /></View>
                    
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaLabel}>{t("principal_paid_label")}</Text>
                      <Text style={styles.formulaValue}>Rs. {repaymentPreview.principalPaid.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}><Ionicons name="arrow-down" size={16} color={Colors.light.textMuted} /></View>
                    
                    <View style={[styles.formulaHighlight, { backgroundColor: Colors.light.primary + '10' }]}>
                      <Text style={[styles.formulaLabelHighlight, { color: Colors.light.primary }]}>{t("new_remaining_principal")}</Text>
                      <Text style={[styles.formulaResult, { color: Colors.light.primary }]}>Rs. {repaymentPreview.closingPrincipal.toLocaleString("en-IN")}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {displayEntries.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Ionicons name="document-outline" size={32} color={Colors.light.textMuted} />
                <Text style={{ color: Colors.light.textMuted, marginTop: 8 }}>{t("auto.no_repayments_yet")}</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Table Header */}
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>{t("date") || "Date"}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("receipt_no") || "Receipt No."}</Text>}
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("particulars") || "Particulars"}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("opening_principal") || "Opening Prin."}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("interest_charged") || "Int. Charged"}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("interest_paid_label") || "Int. Paid"}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("principal_paid_label") || "Prin. Paid"}</Text>}
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("total_payment") || "Total Payment"}</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("closing_principal") || "Closing Prin."}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 130 }]}>{t("outstanding_interest") || "Outs. Int."}</Text>}
                  </View>

                  {/* Table Rows */}
                  {displayEntries.map((r, idx) => {
                    const isDisb = isReducingBalance && r.type === "disbursement";
                    return (
                      <View key={r.id || idx} style={[styles.tableRow, isDisb && { backgroundColor: Colors.light.success + "12" }, idx % 2 === 1 && !isDisb && { backgroundColor: Colors.light.inputBg }]}>
                        <Text style={[styles.tableCell, { width: 90 }]}>{new Date(isReducingBalance ? r.date : r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</Text>
                        
                        {isReducingBalance && (
                          <Text style={[styles.tableCell, { width: 110, color: Colors.light.primary }]}>{isDisb ? "-" : r.receiptNo || "-"}</Text>
                        )}
                        
                        <Text style={[styles.tableCell, { width: 120, fontFamily: "Poppins_500Medium" }]}>
                          {isReducingBalance ? (isDisb ? t("ledger_loan_disbursed") || "Loan Disbursed" : t("ledger_repayment") || "Repayment") : "Repayment"}
                        </Text>
                        
                        {isReducingBalance && (
                          <>
                            <Text style={[styles.tableCell, { width: 120 }]}>{r.openingPrincipal?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.interestCharged?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.interestPaid?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.principalPaid?.toLocaleString("en-IN") || "-"}</Text>
                          </>
                        )}

                        <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_600SemiBold" }]}>
                          {isReducingBalance ? (r.paymentReceived?.toLocaleString("en-IN") || "-") : r.amount?.toLocaleString("en-IN")}
                        </Text>
                        
                        <Text style={[styles.tableCell, { width: 120, color: (isReducingBalance ? r.closingPrincipal : r.runRem) > 0 ? Colors.light.danger : Colors.light.success, fontFamily: "Poppins_600SemiBold" }]}>
                          {isReducingBalance ? r.closingPrincipal?.toLocaleString("en-IN") : r.runRem?.toLocaleString("en-IN")}
                        </Text>

                        {isReducingBalance && (
                          <Text style={[styles.tableCell, { width: 130, color: r.outstandingInterest > 0 ? Colors.light.danger : Colors.light.success }]}>
                            {r.outstandingInterest?.toLocaleString("en-IN") || "0"}
                          </Text>
                        )}
                      </View>
                    );
                  })}

                  {/* Settlement Summary Footer */}
                  {loan.status === "completed" && (
                    <View style={[styles.tableRow, { backgroundColor: Colors.light.primary + "20", borderTopWidth: 2, borderTopColor: Colors.light.primary }]}>
                       <Text style={[styles.tableCell, { width: isReducingBalance ? 90 + 110 + 120 + 120 + 110 : 90 + 120, fontFamily: "Poppins_700Bold" }]}>{t("bank_loan.total") || "Total"}</Text>
                       {isReducingBalance && (
                         <>
                           <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>{(loan.totalInterestPaid || 0).toLocaleString("en-IN")}</Text>
                           <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>{(loan.totalPrincipalPaid || 0).toLocaleString("en-IN")}</Text>
                         </>
                       )}
                       <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>
                         {isReducingBalance ? ((loan.totalPrincipalPaid || 0) + (loan.totalInterestPaid || 0)).toLocaleString("en-IN") : totalRepaid.toLocaleString("en-IN")}
                       </Text>
                       <Text style={[styles.tableCell, { width: 120, fontFamily: "Poppins_700Bold" }]}>0</Text>
                       {isReducingBalance && <Text style={[styles.tableCell, { width: 130, fontFamily: "Poppins_700Bold" }]}>0</Text>}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Final Settlement Display if Completed */}
            {loan.status === "completed" && (
              <View style={{ marginTop: 24, backgroundColor: Colors.light.success + "15", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.success + "50" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Ionicons name="checkmark-done-circle" size={24} color={Colors.light.success} />
                  <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.light.success }}>{t("fully_repaid") || "Fully Repaid & Settled"}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("loanAmount") || "Loan Amount"}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {loan.amount.toLocaleString("en-IN")}</Text></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("total_principal_paid") || "Total Principal Paid"}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {(loan.totalPrincipalPaid || loan.amount).toLocaleString("en-IN")}</Text></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("total_interest_paid") || "Total Interest Paid"}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {(loan.totalInterestPaid || 0).toLocaleString("en-IN")}</Text></View>
                  <View style={{ borderTopWidth: 1, borderTopColor: Colors.light.border, marginVertical: 4 }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_700Bold", color: Colors.light.text }}>{t("total_amount_repaid") || "Total Amount Repaid"}</Text><Text style={{ fontFamily: "Poppins_700Bold", color: Colors.light.primary }}>Rs. {isReducingBalance ? ((loan.totalPrincipalPaid || 0) + (loan.totalInterestPaid || 0)).toLocaleString("en-IN") : totalRepaid.toLocaleString("en-IN")}</Text></View>
                </View>
              </View>
            )}
          </View>
        )}

        {canDelete && (
          <View style={{ marginTop: 24, paddingBottom: 24 }}>
            {!confirmDelete ? (
              <Pressable style={styles.deleteLoanBtn} onPress={() => setConfirmDelete(true)}>
                <Ionicons name="trash-outline" size={20} color={Colors.light.danger} />
                <Text style={styles.deleteLoanBtnText}>
                  {t("auto.delete_loan")}
                </Text>
              </Pressable>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ color: Colors.light.danger, textAlign: "center", marginBottom: 5 }}>
                  {t("auto.this_loan_record_will_be")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.deleteLoanBtn, { flex: 1, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, marginTop: 0 }]} onPress={() => setConfirmDelete(false)}>
                    <Text style={[styles.deleteLoanBtnText, { color: Colors.light.text }]}>{t("auto.keep")}</Text>
                  </Pressable>
                  <Pressable style={[styles.deleteLoanBtn, { flex: 1, backgroundColor: Colors.light.danger, marginTop: 0 }]} onPress={handleDeleteLoan}>
                    <Ionicons name="warning-outline" size={20} color="#fff" />
                    <Text style={[styles.deleteLoanBtnText, { color: '#fff' }]}>{t("auto.delete")}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("pay_via_qr")}</Text>
            <View style={{ backgroundColor: Colors.light.card, padding: 16, borderRadius: 8, marginBottom: 16, width: '100%', alignItems: 'center' }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.light.primary, marginBottom: 8 }}>{t("monthly_installment")}</Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.light.textSecondary }}>{t("principal_portion")}</Text>
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.light.text }}>Rs. {recommendation?.recommendedPrincipal?.toLocaleString("en-IN") || 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.light.textSecondary }}>{t("interest_portion")}</Text>
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.light.text }}>Rs. {((recommendation?.currentMonthInterest || 0) + (loan?.outstandingInterest || 0)).toLocaleString("en-IN")}</Text>
              </View>
              
              <View style={{ borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.light.primary }}>{t("total_amount_to_pay")}</Text>
                <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.light.primary }}>Rs. {recommendation?.recommendedMonthlyPayment?.toLocaleString("en-IN") || Math.round((loan.amount + Math.round(loan.amount * (loan.interest / 100) * loan.duration)) / loan.duration).toLocaleString("en-IN")}</Text>
              </View>
            </View>

            {group?.qrCode ? (
              <Image source={{ uri: group.qrCode }} style={{ width: 200, height: 200, marginBottom: 16 }} />
            ) : (
              <Text style={{ fontFamily: "Poppins_400Regular", color: Colors.light.textMuted, marginBottom: 16 }}>{t("noqrcode")}</Text>
            )}

            <View style={{ backgroundColor: '#FFFBEB', padding: 12, borderRadius: 8, borderColor: '#FDE68A', borderWidth: 1, marginBottom: 16 }}>
              <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: '#D97706', textAlign: 'center' }}>
                {t("qr_payment_warning")}
              </Text>
            </View>

            <Pressable style={styles.modalCancelBtn} onPress={() => setShowQrModal(false)}>
              <Text style={styles.modalCancelText}>{t("done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      <ConfirmDialog
        visible={dialog === "approveTreasurer"}
        title={t("auto.approve_loan_request")}
        message={t("auto.this_will_forward_the_request")}
        confirmText={t("approve")}
        cancelText={t("cancel")}
        onConfirm={handleTreasurerApprove}
        onCancel={() => setDialog(null)}
      />

      <Modal visible={dialog === "rejectTreasurer" || dialog === "rejectPresident"} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("reject")}</Text>
            <Text style={styles.modalSubtitle}>{t("enter_remarks")}</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder={t("remarks") + "..."}
              placeholderTextColor={Colors.light.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setDialog(null)}>
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={dialog === "rejectTreasurer" ? handleTreasurerReject : handleReject}>
                <Text style={styles.modalConfirmText}>{t("reject")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteRepaymentId !== null}
        title={t("auto.delete_repayment")}
        message={t("auto.this_repayment_record_will_be")}
        confirmText={t("auto.delete")}
        cancelText={t("cancel")}
        destructive
        onConfirm={handleDeleteRepayment}
        onCancel={() => setDeleteRepaymentId(null)}
      />

      <ConfirmDialog
        visible={dialog === "deleteLoan"}
        title={t("auto.delete_loan_1")}
        message={t("auto.this_loan_record_will_be")}
        confirmText={t("auto.delete")}
        cancelText={t("auto.keep")}
        destructive
        onConfirm={handleDeleteLoan}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.light.border + "80", paddingVertical: 8 },
  tableHeader: { backgroundColor: Colors.light.primary + "15" },
  tableCell: { paddingHorizontal: 8, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  tableHeaderText: { fontFamily: "Poppins_600SemiBold", color: Colors.light.primary, fontSize: 11 },
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: Colors.light.text,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  workflowNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.success + "12",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  workflowNoteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.success,
    flex: 1,
  },
  amountCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  amountLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  amountValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    color: Colors.light.text,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  amountDetail: { alignItems: "center" },
  amountDetailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  amountDetailValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 14,
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.light.success,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: "right",
  },
  infoCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoRow: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  approvalCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  timelineCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  timelineTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  timelineStep: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  timelineStepTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.text,
  },
  timelineMeta: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  approvalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  approvalCardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  approvalCardSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  editInput: {
    backgroundColor: Colors.light.inputBg,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  approvalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  approveBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.danger + "15",
    borderWidth: 1,
    borderColor: Colors.light.danger + "40",
  },
  rejectBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.danger,
  },
  section: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  repayInput: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rupee: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  repayField: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 12,
  },
  repayBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    padding: 8,
  },
  repayBtnDisabled: {
    opacity: 0.65,
  },
  repaymentDateField: {
    marginTop: 10,
  },
  repaymentDateLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  repaymentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBg,
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 6,
  },
  repaymentDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  repaymentAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.success,
  },
  noRepayments: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
    textAlign: "center",
    paddingVertical: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: 6,
  },
  totalLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  totalValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: Colors.light.success,
  },
  deleteLoanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.danger + "10",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.danger + "30",
    marginTop: 4,
    marginBottom: 8,
  },
  deleteLoanBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.danger,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
    marginTop: 12,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: Colors.light.background, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.light.text, marginBottom: 8 },
  modalSubtitle: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginBottom: 16 },
  remarksInput: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { fontFamily: "Poppins_500Medium", fontSize: 15, color: Colors.light.textSecondary },
  modalConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.light.danger, borderRadius: 10 },
  modalConfirmText: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff" },
  rejectionBox: {
    backgroundColor: Colors.light.danger + "10",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.danger + "20",
  },
  rejectionLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.light.danger },
  rejectionText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.text, marginTop: 2 },
  rejectionMeta: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 4 },
  bankFormCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 12,
  },
  rupeeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
    marginRight: 8,
  },
  suffix: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.textMuted,
    marginLeft: 8,
  },
  recommendationCard: {
    marginTop: 16,
    backgroundColor: Colors.light.card,
    borderColor: Colors.light.primary,
    borderWidth: 1,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.light.text,
  },
  recommendationBadge: {
    backgroundColor: Colors.light.primary + '12',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recommendationBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: Colors.light.primary,
  },
  recommendationTable: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.light.background,
  },
  recommendationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  recommendationDangerRow: {
    backgroundColor: '#FEF2F2',
  },
  recommendationHighlightRow: {
    backgroundColor: Colors.light.primary + '10',
  },
  recommendationLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
    paddingRight: 8,
  },
  recommendationLabelHighlight: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: Colors.light.primary,
    flex: 1,
    paddingRight: 8,
  },
  recommendationValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: Colors.light.text,
    textAlign: 'right',
  },
  recommendationValueDanger: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: Colors.light.danger,
    textAlign: 'right',
  },
  recommendationValueHighlight: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: Colors.light.primary,
    textAlign: 'right',
  },
  formulaBox: {
    backgroundColor: Colors.light.inputBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  formulaHighlight: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  formulaLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  formulaLabelHighlight: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
    marginBottom: 4
  },
  formulaValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  formulaDetail: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  formulaResult: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginTop: 4
  },
});
