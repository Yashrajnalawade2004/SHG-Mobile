// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, Modal, Alert, ActivityIndicator, Image
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import { getBankLoanRecommendation } from "@/shared/bankLoanAccounting";
import { generateBankLoanPassbookPDF } from "@/lib/pdf-generator";
import Colors from "@/constants/colors";

/** ─── Member Bank Loan Allocation Passbook Screen ─── */
export default function BankLoanAllocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, isPresident, isTreasurer, group } = useAuth();
  const { t, language } = useLanguage();
  const { groupBankLoans, bankLoanAllocations, groupMembers, recordBankLoanRepayment, getBankLoanAllocationLedger } = useData();

  const allocation = bankLoanAllocations.find((a) => a.id === id);
  const bankLoan = allocation ? groupBankLoans.find((l) => l.id === allocation.bankLoanId) : null;
  const member = allocation ? groupMembers.find((m) => m.id === allocation.memberId) : null;

  const [ledger, setLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split("T")[0]);
  const [repayRemarks, setRepayRemarks] = useState("");
  const [recording, setRecording] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const isOwner = user?.id === allocation?.memberId;
  const canRecord = isPresident || isTreasurer;
  const canView = isOwner || canRecord;

  const fetchLedger = useCallback(async () => {
    if (!id || !canView) return;
    setLoadingLedger(true);
    try {
      const data = await getBankLoanAllocationLedger(id);
      const sorted = [...(data || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setLedger(sorted);
    } catch (e) {
      console.error("Failed to load ledger", e);
    } finally {
      setLoadingLedger(false);
    }
  }, [id, canView, getBankLoanAllocationLedger]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // Authorization gate
  if (!allocation) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.light.danger} />
        <Text style={{ marginTop: 16, color: Colors.light.danger, fontSize: 18, fontWeight: "bold", textAlign: "center" }}>
          {t("bank_loan.unauthorized")}
        </Text>
        <Text style={{ marginTop: 8, color: Colors.light.textSecondary, textAlign: "center" }}>
          {t("loan_privacy_notice")}
        </Text>
      </View>
    );
  }

  if (!canView) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.light.danger} />
        <Text style={{ marginTop: 16, color: Colors.light.danger, fontSize: 18, fontWeight: "bold", textAlign: "center" }}>
          {t("bank_loan.unauthorized")}
        </Text>
      </View>
    );
  }

  if (!bankLoan || !member) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  const recommendation = getBankLoanRecommendation(
    allocation.outstandingBalance,
    allocation.outstandingInterest,
    bankLoan.annualInterestRate,
    allocation.allocatedPrincipal,
    bankLoan.durationMonths
  );

  const statusColor = allocation.status === "completed" ? Colors.light.success :
    allocation.outstandingBalance > 0 ? Colors.light.primary : Colors.light.success;

  // ─── Record Repayment ──────────────────────────────────────────────────────
  const handleRecordRepayment = async () => {
    const amt = Number(repayAmount);
    if (!amt || amt <= 0) {
      Alert.alert(t("error"), t("bank_loan.error_invalid_amount"));
      return;
    }
    setRecording(true);
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await recordBankLoanRepayment(allocation.id, {
        amount: amt,
        date: repayDate,
        remarks: repayRemarks,
      });
      setShowRepayModal(false);
      setRepayAmount("");
      setRepayRemarks("");
      await fetchLedger();
    } catch (e: any) {
      Alert.alert(t("error"), e.message);
    } finally {
      setRecording(false);
    }
  };

  // ─── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateBankLoanPassbookPDF({
        allocation,
        bankLoan,
        member,
        ledger,
        group,
        t,
        language,
      });
    } catch (e: any) {
      Alert.alert(t("error"), e.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.headerSub}>{bankLoan.bankName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={handleExportPDF} style={styles.iconBtn} disabled={generatingPDF}>
            {generatingPDF ? <ActivityIndicator size="small" color={Colors.light.primary} /> : <Ionicons name="download-outline" size={22} color={Colors.light.primary} />}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Passbook Header Card — bank style */}
        <View style={styles.passbookHeader}>
          <View style={styles.passbookBankName}>
            <Ionicons name="business-outline" size={20} color={Colors.light.primary} />
            <Text style={styles.passbookBankNameText}>{bankLoan.bankName}</Text>
          </View>
          {bankLoan.branch ? <Text style={styles.passbookBankSub}>{bankLoan.branch}</Text> : null}
          {bankLoan.accountNumber ? <Text style={styles.passbookBankSub}>{t("accountNumber")}: {bankLoan.accountNumber}</Text> : null}
          {bankLoan.ifscCode ? <Text style={styles.passbookBankSub}>{t("bank_loan.ifsc")}: {bankLoan.ifscCode}</Text> : null}
          <View style={styles.passbookDivider} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={styles.passbookMemberLabel}>{t("bank_loan.account_holder")}</Text>
              <Text style={styles.passbookMemberName}>{member.name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "18", alignSelf: "center" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{t(allocation.status)}</Text>
            </View>
          </View>
          <View style={styles.passbookMetaRow}>
            <View style={styles.passbookMeta}>
              <Text style={styles.passbookMetaLabel}>{t("bank_loan.allocated_principal")}</Text>
              <Text style={styles.passbookMetaValue}>Rs. {allocation.allocatedPrincipal.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.passbookMeta}>
              <Text style={styles.passbookMetaLabel}>{t("annualInterestRate")}</Text>
              <Text style={styles.passbookMetaValue}>{bankLoan.annualInterestRate}%</Text>
            </View>
            <View style={styles.passbookMeta}>
              <Text style={styles.passbookMetaLabel}>{t("durationMonths")}</Text>
              <Text style={styles.passbookMetaValue}>{bankLoan.durationMonths} {t("bank_loan.months")}</Text>
            </View>
          </View>
          <View style={styles.passbookMetaRow}>
            <View style={styles.passbookMeta}>
              <Text style={styles.passbookMetaLabel}>{t("sanctionDate")}</Text>
              <Text style={styles.passbookMetaValue}>{new Date(bankLoan.sanctionDate).toLocaleDateString("en-IN")}</Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("bank_loan.account_summary")}</Text>
          <View style={styles.summaryBox}>
            <SummaryRow label={t("bank_loan.allocated_principal")} value={`Rs. ${allocation.allocatedPrincipal.toLocaleString("en-IN")}`} />
            <SummaryRow label={t("bank_loan.principal_paid")} value={`Rs. ${allocation.totalPrincipalPaid.toLocaleString("en-IN")}`} color={Colors.light.success} />
            <SummaryRow label={t("bank_loan.interest_paid")} value={`Rs. ${allocation.totalInterestPaid.toLocaleString("en-IN")}`} color={Colors.light.success} />
            <SummaryRow label={t("bank_loan.outstanding_principal")} value={`Rs. ${allocation.outstandingBalance.toLocaleString("en-IN")}`} color={allocation.outstandingBalance > 0 ? Colors.light.danger : Colors.light.success} />
            <SummaryRow label={t("bank_loan.outstanding_interest")} value={`Rs. ${allocation.outstandingInterest.toLocaleString("en-IN")}`} color={allocation.outstandingInterest > 0 ? Colors.light.danger : Colors.light.success} />
            <SummaryRow label={t("bank_loan.remaining_months")} value={String(recommendation.remainingMonths)} />
          </View>
        </View>

        {/* Recommendation Card */}
        {allocation.status !== "completed" && (
          <View style={styles.section}>
            <View style={styles.recCard}>
              <View style={styles.recHeader}>
                <Ionicons name="calculator-outline" size={20} color={Colors.light.primary} />
                <Text style={styles.recTitle}>{t("bank_loan.recommended_payment")}</Text>
              </View>
              <View style={styles.recAmtRow}>
                <Text style={styles.recBigAmt}>Rs. {recommendation.recommendedPayment.toLocaleString("en-IN")}</Text>
                <Text style={styles.recSubLabel}>{t("bank_loan.this_month")}</Text>
              </View>
              <View style={styles.recBreakdown}>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>{t("bank_loan.principal_portion")}</Text>
                  <Text style={styles.recValue}>Rs. {recommendation.principalPortion.toLocaleString("en-IN")}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>{t("bank_loan.interest_portion")}</Text>
                  <Text style={styles.recValue}>Rs. {recommendation.interestPortion.toLocaleString("en-IN")}</Text>
                </View>
                {recommendation.outstandingInterest > 0 && (
                  <View style={styles.recRow}>
                    <Text style={[styles.recLabel, { color: Colors.light.danger }]}>{t("bank_loan.outstanding_interest")}</Text>
                    <Text style={[styles.recValue, { color: Colors.light.danger }]}>Rs. {recommendation.outstandingInterest.toLocaleString("en-IN")}</Text>
                  </View>
                )}
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>{t("bank_loan.remaining_months")}</Text>
                  <Text style={styles.recValue}>{recommendation.remainingMonths}</Text>
                </View>
              </View>

              {/* QR Pay Section */}
              {group?.qrCode && (
                <Pressable style={styles.qrBtn} onPress={() => setShowQrModal(true)}>
                  <Ionicons name="qr-code-outline" size={18} color={Colors.light.secondary} />
                  <Text style={styles.qrBtnText}>{t("pay_via_qr")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Record Repayment Button (President/Treasurer only) */}
        {canRecord && allocation.status !== "completed" && (
          <View style={styles.section}>
            <Pressable style={styles.primaryBtn} onPress={() => setShowRepayModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("bank_loan.record_repayment")}</Text>
            </Pressable>
          </View>
        )}

        {/* Passbook Ledger */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("bank_loan.passbook")}</Text>
          {loadingLedger ? (
            <ActivityIndicator color={Colors.light.primary} style={{ marginTop: 20 }} />
          ) : ledger.length === 0 ? (
            <View style={styles.emptyLedger}>
              <Ionicons name="document-outline" size={32} color={Colors.light.textMuted} />
              <Text style={{ color: Colors.light.textMuted, marginTop: 8 }}>{t("bank_loan.no_transactions")}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>{t("bank_loan.date")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("bank_loan.receipt_no")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 100 }]}>{t("bank_loan.particulars")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>{t("bank_loan.opening_principal")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 80 }]}>{t("bank_loan.interest_charged")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 80 }]}>{t("bank_loan.col_principal")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 80 }]}>{t("bank_loan.total_payment")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>{t("bank_loan.closing_principal")}</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText, { width: 80 }]}>{t("bank_loan.outstanding_interest")}</Text>
                </View>

                {/* Table Rows */}
                {ledger.map((entry, idx) => {
                  const isDisbursement = entry.type === "disbursement";
                  return (
                    <View key={entry.id || idx} style={[styles.tableRow, isDisbursement && styles.disbursementRow, idx % 2 === 1 && !isDisbursement && styles.altRow]}>
                      <Text style={[styles.tableCell, { width: 90 }]}>{new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</Text>
                      <Text style={[styles.tableCell, { width: 110, color: Colors.light.primary }]}>{entry.receiptNo}</Text>
                      <Text style={[styles.tableCell, { width: 100, fontFamily: "Poppins_500Medium" }]}>
                        {isDisbursement ? t("bank_loan.disbursement") : t("bank_loan.repayment")}
                      </Text>
                      <Text style={[styles.tableCell, { width: 90 }]}>{entry.openingPrincipal.toLocaleString("en-IN")}</Text>
                      <Text style={[styles.tableCell, { width: 80 }]}>{entry.interestCharged.toLocaleString("en-IN")}</Text>
                      <Text style={[styles.tableCell, { width: 80 }]}>{entry.principalPaid.toLocaleString("en-IN")}</Text>
                      <Text style={[styles.tableCell, { width: 80, fontFamily: "Poppins_600SemiBold" }]}>{entry.paymentReceived.toLocaleString("en-IN")}</Text>
                      <Text style={[styles.tableCell, { width: 90, color: entry.closingPrincipal > 0 ? Colors.light.danger : Colors.light.success, fontFamily: "Poppins_600SemiBold" }]}>{entry.closingPrincipal.toLocaleString("en-IN")}</Text>
                      <Text style={[styles.tableCell, { width: 80, color: entry.outstandingInterest > 0 ? Colors.light.danger : Colors.light.success }]}>{entry.outstandingInterest.toLocaleString("en-IN")}</Text>
                    </View>
                  );
                })}

                {/* Footer Totals */}
                <View style={[styles.tableRow, styles.tableFooter]}>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 90 + 110 + 100 }]}>{t("bank_loan.total")}</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 90 }]}>—</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 80 }]}>{ledger.filter(e => e.type !== "disbursement").reduce((s, e) => s + e.interestCharged, 0).toLocaleString("en-IN")}</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 80 }]}>{allocation.totalPrincipalPaid.toLocaleString("en-IN")}</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 80 }]}>{(allocation.totalPrincipalPaid + allocation.totalInterestPaid).toLocaleString("en-IN")}</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 90 }]}>{allocation.outstandingBalance.toLocaleString("en-IN")}</Text>
                  <Text style={[styles.tableCell, styles.tableFooterText, { width: 80 }]}>{allocation.outstandingInterest.toLocaleString("en-IN")}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Record Repayment Modal */}
      <Modal visible={showRepayModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRepayModal(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("bank_loan.record_repayment")}</Text>
            <Pressable onPress={() => setShowRepayModal(false)}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalMemberName}>{member.name}</Text>
            <Text style={styles.modalSubtitle}>{t("bank_loan.outstanding")}: Rs. {allocation.outstandingBalance.toLocaleString("en-IN")}</Text>
            <Text style={styles.modalSubtitle}>{t("bank_loan.recommended_payment")}: Rs. {recommendation.recommendedPayment.toLocaleString("en-IN")}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t("bank_loan.payment_amount")} *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder={`e.g. ${recommendation.recommendedPayment}`}
                value={repayAmount}
                onChangeText={setRepayAmount}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t("bank_loan.payment_date")}</Text>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY-MM-DD"
                value={repayDate}
                onChangeText={setRepayDate}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t("bank_loan.remarks")}</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: "top" }]}
                multiline
                placeholder={t("bank_loan.remarks_optional")}
                value={repayRemarks}
                onChangeText={setRepayRemarks}
              />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable style={[styles.primaryBtn, { opacity: recording ? 0.6 : 1 }]} onPress={handleRecordRepayment} disabled={recording}>
              {recording ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.primaryBtnText}>{t("bank_loan.save_repayment")}</Text></>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal visible={showQrModal} animationType="fade" transparent onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <Pressable onPress={() => setShowQrModal(false)} style={{ alignSelf: "flex-end" }}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </Pressable>
            <Text style={styles.qrTitle}>{t("qr_modal_title")}</Text>
            {group?.qrCode ? (
              <Image source={{ uri: group.qrCode }} style={styles.qrImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.qrNotice}>{t("bank_loan.qr_notice")}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  headerSub: { fontSize: 12, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  iconBtn: { padding: 8, backgroundColor: Colors.light.primary + "15", borderRadius: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, marginBottom: 10 },
  passbookHeader: { margin: 16, backgroundColor: Colors.light.card, borderRadius: 16, borderWidth: 2, borderColor: Colors.light.primary + "40", padding: 18 },
  passbookBankName: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  passbookBankNameText: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.light.primary },
  passbookBankSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginBottom: 2 },
  passbookDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 12 },
  passbookMemberLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted },
  passbookMemberName: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  passbookMetaRow: { flexDirection: "row", gap: 16, marginTop: 12 },
  passbookMeta: { flex: 1 },
  passbookMetaLabel: { fontSize: 11, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  passbookMetaValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  summaryBox: { backgroundColor: Colors.light.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border, overflow: "hidden" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.border + "60" },
  summaryLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  summaryValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  recCard: { backgroundColor: Colors.light.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.primary + "40", padding: 16 },
  recHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  recTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.primary },
  recAmtRow: { alignItems: "center", marginBottom: 12 },
  recBigAmt: { fontSize: 28, fontFamily: "Poppins_700Bold", color: Colors.light.primary },
  recSubLabel: { fontSize: 12, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  recBreakdown: { backgroundColor: Colors.light.background, borderRadius: 10, padding: 12, gap: 6, marginBottom: 12 },
  recRow: { flexDirection: "row", justifyContent: "space-between" },
  recLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  recValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  qrBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.secondary + "50" },
  qrBtnText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.secondary },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  emptyLedger: { alignItems: "center", paddingVertical: 32 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.light.border + "80", paddingVertical: 8 },
  tableHeader: { backgroundColor: Colors.light.primary + "15" },
  altRow: { backgroundColor: Colors.light.inputBg },
  disbursementRow: { backgroundColor: Colors.light.success + "12" },
  tableFooter: { backgroundColor: Colors.light.primary + "20", borderTopWidth: 2, borderTopColor: Colors.light.primary },
  tableCell: { paddingHorizontal: 8, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  tableHeaderText: { fontFamily: "Poppins_600SemiBold", color: Colors.light.primary, fontSize: 11 },
  tableFooterText: { fontFamily: "Poppins_700Bold", color: Colors.light.text },
  modalContainer: { flex: 1, backgroundColor: Colors.light.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  modalTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  modalContent: { padding: 20, gap: 16 },
  modalMemberName: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  modalSubtitle: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  formInput: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 16, color: Colors.light.text },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.card },
  qrOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 },
  qrCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 },
  qrTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text, marginBottom: 16, textAlign: "center" },
  qrImage: { width: 220, height: 220, alignSelf: "center", marginBottom: 16 },
  qrNotice: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted, textAlign: "center" },
});
