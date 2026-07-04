import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import ConfirmDialog from "@/components/ConfirmDialog";

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
  const { isPresident, isTreasurer, user } = useAuth();
  const { t, language } = useLanguage();
  const {
    loans, loanRepayments,
    treasurerApproveLoan, treasurerRejectLoan,
    approveLoan, rejectLoan,
    addRepayment, deleteRepayment, deleteLoan,
  } = useData();
  const loan = loans.find((l) => l.id === id);

  const [resolutionNo, setResolutionNo] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [showRepay, setShowRepay] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [deleteRepaymentId, setDeleteRepaymentId] = useState<string | null>(null);
  const [resolutionError, setResolutionError] = useState(false);

  if (!loan) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.light.textMuted} />
        <Text style={styles.emptyText}>{t("auto.loan_not_found")}</Text>
      </View>
    );
  }

  const repayments = loanRepayments
    .filter((r) => r.loanId === loan.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);
  const color = loanStatusColor(loan.status);
  const progress = loan.amount > 0 ? ((loan.amount - loan.remainingBalance) / loan.amount) * 100 : 0;

  const handleTreasurerApprove = async () => {
    setDialog(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await treasurerApproveLoan(loan.id);
  };

  const handleTreasurerReject = async () => {
    setDialog(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await treasurerRejectLoan(loan.id);
  };

  const handleApprove = async () => {
    if (!resolutionNo.trim()) {
      setResolutionError(true);
      return;
    }
    setResolutionError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await approveLoan(loan.id, resolutionNo.trim());
  };

  const handleReject = async () => {
    setDialog(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await rejectLoan(loan.id);
  };

  const handleRepay = async () => {
    const num = parseInt(repayAmount);
    if (!num || num <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addRepayment(loan.id, num);
    setRepayAmount("");
    setShowRepay(false);
  };

  const handleDeleteRepayment = async () => {
    if (!deleteRepaymentId) return;
    setDeleteRepaymentId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deleteRepayment(deleteRepaymentId, loan.id);
  };

  const handleDeleteLoan = async () => {
    setDialog(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deleteLoan(loan.id);
    router.back();
  };

  const showTreasurerActions = isTreasurer && loan.status === "pending_treasurer";
  const showPresidentActions = isPresident && loan.status === "pending_president";
  const showRepayment = loan.status === "approved";
  const canDelete = isPresident && loan.status !== "approved";

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
          {loan.status === "approved" && <Ionicons name="checkmark-circle" size={16} color={color} />}
          {(loan.status === "rejected" || loan.status === "treasurer_rejected") && (
            <Ionicons name="close-circle" size={16} color={color} />
          )}
          <Text style={[styles.statusLabel, { color }]}>{t(loan.status)}</Text>
        </View>

        {loan.status === "pending_president" && loan.treasurerActionAt && (
          <View style={styles.workflowNote}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.light.success} />
            <Text style={styles.workflowNoteText}>
              {t("auto.treasurer_approved_forwarded_to_president")}
            </Text>
          </View>
        )}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t("loanAmount")}</Text>
          <Text style={styles.amountValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
          <View style={styles.amountRow}>
            <View style={styles.amountDetail}>
              <Text style={styles.amountDetailLabel}>{t("interest")}</Text>
              <Text style={styles.amountDetailValue}>{loan.interest}%</Text>
            </View>
            <View style={styles.amountDetail}>
              <Text style={styles.amountDetailLabel}>{t("duration")}</Text>
              <Text style={styles.amountDetailValue}>{loan.duration} {t("auto.mo")}</Text>
            </View>
            <View style={styles.amountDetail}>
              <Text style={styles.amountDetailLabel}>{t("remaining")}</Text>
              <Text style={[styles.amountDetailValue, { color: loan.remainingBalance > 0 ? Colors.light.danger : Colors.light.success }]}>
                Rs. {loan.remainingBalance.toLocaleString("en-IN")}
              </Text>
            </View>
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

        <View style={styles.infoCard}>
          <Text style={styles.infoRow}>{t("name")}: {loan.memberName}</Text>
          {loan.resolutionNo ? <Text style={styles.infoRow}>{t("resolutionNo")} {loan.resolutionNo}</Text> : null}
          <Text style={styles.infoRow}>{t("date")}: {new Date(loan.createdAt).toLocaleDateString("en-IN")}</Text>
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
                {t("auto.president_s_final_decision")}
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
                <Text style={styles.approveBtnText}>{t("approve")}</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => setDialog("rejectPresident")}>
                <Ionicons name="close" size={18} color={Colors.light.danger} />
                <Text style={styles.rejectBtnText}>{t("reject")}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showRepayment && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("repayment")}</Text>
              {isPresident && (
                <Pressable onPress={() => setShowRepay(!showRepay)}>
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
                  <Pressable style={styles.repayBtn} onPress={handleRepay}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}

            {repayments.length > 0 ? (
              repayments.map((r) => (
                <View key={r.id} style={styles.repaymentItem}>
                  <Ionicons name="return-down-forward" size={16} color={Colors.light.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.repaymentDate}>{new Date(r.date).toLocaleDateString("en-IN")}</Text>
                  </View>
                  <Text style={styles.repaymentAmount}>Rs. {r.amount.toLocaleString("en-IN")}</Text>
                  {isPresident && (
                    <Pressable
                      onPress={() => setDeleteRepaymentId(r.id)}
                      style={{ padding: 4, marginLeft: 4 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.light.danger} />
                    </Pressable>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noRepayments}>{t("auto.no_repayments_yet")}</Text>
            )}

            {repayments.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("auto.total_repaid")}</Text>
                <Text style={styles.totalValue}>Rs. {totalRepaid.toLocaleString("en-IN")}</Text>
              </View>
            )}
          </View>
        )}

        {canDelete && (
          <Pressable style={styles.deleteLoanBtn} onPress={() => setDialog("deleteLoan")}>
            <Ionicons name="trash-outline" size={20} color={Colors.light.danger} />
            <Text style={styles.deleteLoanBtnText}>
              {t("auto.delete_loan")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={dialog === "approveTreasurer"}
        title={t("auto.approve_loan_request")}
        message={t("auto.this_will_forward_the_request")}
        confirmText={t("approve")}
        cancelText={t("cancel")}
        onConfirm={handleTreasurerApprove}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        visible={dialog === "rejectTreasurer"}
        title={t("auto.reject_loan_request")}
        message={t("auto.the_member_will_be_notified")}
        confirmText={t("reject")}
        cancelText={t("cancel")}
        destructive
        onConfirm={handleTreasurerReject}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        visible={dialog === "rejectPresident"}
        title={t("auto.reject_this_loan")}
        message={t("auto.the_member_will_be_notified_1")}
        confirmText={t("reject")}
        cancelText={t("cancel")}
        destructive
        onConfirm={handleReject}
        onCancel={() => setDialog(null)}
      />

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
});
