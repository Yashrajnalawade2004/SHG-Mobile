// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, Modal, Alert, ActivityIndicator, FlatList
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import { apiGet } from "@/lib/api";
import { calculateBankLoanEMI, getBankLoanRecommendation, calculateEqualDistribution } from "@/shared/bankLoanAccounting";
import Colors from "@/constants/colors";

/** ─── Bank Loan Detail Screen (President / Treasurer View) ─── */
export default function BankLoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, isPresident, isTreasurer } = useAuth();
  const { t } = useLanguage();
  const { groupBankLoans, bankLoanAllocations, groupMembers, allocateBankLoanFunds, closeGroupBankLoan, deleteGroupBankLoan, refreshData } = useData();

  const loan = groupBankLoans.find((l) => l.id === id);
  const allocations = bankLoanAllocations.filter((a) => a.bankLoanId === id);

  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Allocation modal state
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocMethod, setAllocMethod] = useState<"equal" | "custom">("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [allocating, setAllocating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeMembers = useMemo(() => groupMembers.filter(m => m.status === "active"), [groupMembers]);

  const fetchSummary = useCallback(async () => {
    if (!id || (!isPresident && !isTreasurer)) return;
    setLoadingSummary(true);
    try {
      const data = await apiGet<any>(`/api/bank-loans/${id}/summary`);
      setSummary(data);
    } catch (e) {
      console.error("Failed to load summary", e);
    } finally {
      setLoadingSummary(false);
    }
  }, [id, isPresident, isTreasurer]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (!isPresident && !isTreasurer) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.light.danger} />
        <Text style={{ marginTop: 16, color: Colors.light.danger, fontSize: 18, fontWeight: "bold", textAlign: "center" }}>{t("bank_loan.unauthorized")}</Text>
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.light.textMuted} />
        <Text style={{ marginTop: 12, color: Colors.light.textMuted }}>{t("bank_loan.not_found")}</Text>
      </View>
    );
  }

  const s = summary?.summary;
  const totalAllocated = s?.totalAllocated ?? allocations.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
  const remaining = loan.amount - totalAllocated;
  const totalPrincipalCollected = s?.totalPrincipalCollected ?? allocations.reduce((sum, a) => sum + a.totalPrincipalPaid, 0);
  const totalInterestCollected = s?.totalInterestCollected ?? allocations.reduce((sum, a) => sum + a.totalInterestPaid, 0);
  const totalOutstanding = s?.totalOutstandingPrincipal ?? allocations.reduce((sum, a) => sum + a.outstandingBalance, 0);
  const totalOutstandingInterest = s?.totalOutstandingInterest ?? allocations.reduce((sum, a) => sum + a.outstandingInterest, 0);
  const membersCompleted = s?.membersCompleted ?? allocations.filter(a => a.status === "completed").length;
  const monthlyRate = (loan.annualInterestRate / 12).toFixed(2);

  // ─── Compute live allocation total for modal ───────────────────────────────
  const computedTotal = useMemo(() => {
    if (allocMethod === "equal") {
      return selectedMembers.length > 0 ? loan.amount : 0;
    }
    return selectedMembers.reduce((sum, id) => sum + (Number(customAmounts[id]) || 0), 0);
  }, [allocMethod, selectedMembers, customAmounts, loan.amount]);

  const handleToggleMember = (memberId: string) => {
    setSelectedMembers(prev => prev.includes(memberId) ? prev.filter(x => x !== memberId) : [...prev, memberId]);
  };

  const handleAllocate = async () => {
    if (selectedMembers.length === 0) {
      Alert.alert(t("error"), t("bank_loan.error_select_members"));
      return;
    }
    let allocs: {memberId: string; allocatedPrincipal: number}[];
    if (allocMethod === "equal") {
      allocs = calculateEqualDistribution(selectedMembers, loan.amount);
    } else {
      allocs = selectedMembers.map(id => ({
        memberId: id,
        allocatedPrincipal: Number(customAmounts[id]) || 0,
      }));
      const total = allocs.reduce((s, a) => s + a.allocatedPrincipal, 0);
      if (total !== loan.amount) {
        Alert.alert(t("error"), t("bank_loan.error_not_fully_allocated") + ` (${total.toLocaleString("en-IN")} / ${loan.amount.toLocaleString("en-IN")})`);
        return;
      }
    }
    setAllocating(true);
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await allocateBankLoanFunds(loan.id, allocs);
      await fetchSummary();
      setShowAllocModal(false);
      setSelectedMembers([]);
      setCustomAmounts({});
    } catch (e: any) {
      Alert.alert(t("error"), e.message);
    } finally {
      setAllocating(false);
    }
  };

  const handleClose = async () => {
    Alert.alert(t("confirm"), t("bank_loan.confirm_close"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: async () => {
          try {
            await closeGroupBankLoan(loan.id);
            await refreshData();
            router.back();
          } catch (e: any) {
            Alert.alert(t("error"), e.message);
          }
        },
      },
    ]);
  };

  const executeDelete = async () => {
    console.log("Delete button confirmed, initiating deletion...");
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      console.log("Calling deleteGroupBankLoan for", loan.id);
      await deleteGroupBankLoan(loan.id);
      console.log("Deletion successful, refreshing data");
      await refreshData();
      console.log("Data refreshed, routing to main");
      router.replace("/(main)");
    } catch (err: any) {
      console.error("Deletion failed:", err);
      Alert.alert(t("error"), err.message || t("error_occurred"));
    }
  };

  const statusColor = loan.status === "active" ? Colors.light.success : Colors.light.primary;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{loan.bankName}</Text>
          {loan.branch ? <Text style={styles.headerSub}>{loan.branch}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{t(loan.status)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: 0 }}>
        {/* Loan Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("bank_loan.ifsc")}</Text>
            <Text style={styles.infoValue}>{loan.ifscCode || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("accountNumber")}</Text>
            <Text style={styles.infoValue}>{loan.accountNumber || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("sanctionDate")}</Text>
            <Text style={styles.infoValue}>{new Date(loan.sanctionDate).toLocaleDateString("en-IN")}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("annualInterestRate")}</Text>
            <Text style={styles.infoValue}>{loan.annualInterestRate}% {t("bank_loan.per_annum")} ({monthlyRate}% {t("bank_loan.monthly_rate")})</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("durationMonths")}</Text>
            <Text style={styles.infoValue}>{loan.durationMonths} {t("bank_loan.months")}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>{t("sanctionAmount")}</Text>
            <Text style={[styles.infoValue, { color: Colors.light.primary, fontWeight: "bold" }]}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
          </View>
        </View>

        {/* Master Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("bank_loan.summary")}</Text>
          <View style={styles.summaryGrid}>
            <SummaryTile label={t("bank_loan.total_allocated")} value={`Rs. ${totalAllocated.toLocaleString("en-IN")}`} color={Colors.light.primary} />
            <SummaryTile label={t("bank_loan.unallocated")} value={`Rs. ${remaining.toLocaleString("en-IN")}`} color={remaining > 0 ? Colors.light.pending : Colors.light.success} />
            <SummaryTile label={t("bank_loan.principal_collected")} value={`Rs. ${totalPrincipalCollected.toLocaleString("en-IN")}`} color={Colors.light.success} />
            <SummaryTile label={t("bank_loan.interest_collected")} value={`Rs. ${totalInterestCollected.toLocaleString("en-IN")}`} color={Colors.light.success} />
            <SummaryTile label={t("bank_loan.outstanding")} value={`Rs. ${totalOutstanding.toLocaleString("en-IN")}`} color={Colors.light.danger} />
            <SummaryTile label={t("bank_loan.outstanding_interest")} value={`Rs. ${totalOutstandingInterest.toLocaleString("en-IN")}`} color={Colors.light.danger} />
            <SummaryTile label={t("bank_loan.members_allocated")} value={`${allocations.length}`} color={Colors.light.secondary} />
            <SummaryTile label={t("bank_loan.members_completed")} value={`${membersCompleted}`} color={Colors.light.success} />
          </View>
        </View>

        {/* Allocate Button (President only, if not yet fully allocated) */}
        {isPresident && remaining > 0 && loan.status === "active" && (
          <View style={styles.section}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowAllocModal(true)}
            >
              <Ionicons name="people-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("bank_loan.allocate_funds")}</Text>
            </Pressable>
          </View>
        )}

        {/* Member Allocations List */}
        {allocations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("bank_loan.member_allocations")}</Text>
            {allocations.map(alloc => {
              const member = groupMembers.find(m => m.id === alloc.memberId);
              const pctPaid = alloc.allocatedPrincipal > 0
                ? Math.min(100, Math.round((alloc.totalPrincipalPaid / alloc.allocatedPrincipal) * 100))
                : 0;
              const rec = getBankLoanRecommendation(
                alloc.outstandingBalance,
                alloc.outstandingInterest,
                loan.annualInterestRate,
                alloc.allocatedPrincipal,
                loan.durationMonths
              );
              return (
                <Pressable
                  key={alloc.id}
                  style={styles.allocCard}
                  onPress={() => router.push({ pathname: "/bank-loan/allocation/[id]" as any, params: { id: alloc.id } })}
                >
                  <View style={styles.allocHeader}>
                    <View style={styles.allocAvatar}>
                      <Text style={styles.allocAvatarText}>{member?.name?.[0] || "?"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.allocName}>{member?.name || t("unknown")}</Text>
                      <Text style={styles.allocAmount}>Rs. {alloc.allocatedPrincipal.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <View style={[styles.statusBadge, { backgroundColor: alloc.status === "completed" ? Colors.light.success + "18" : Colors.light.primary + "18" }]}>
                        <Text style={[styles.statusText, { color: alloc.status === "completed" ? Colors.light.success : Colors.light.primary }]}>{t(alloc.status)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${pctPaid}%` as any }]} />
                  </View>
                  <Text style={styles.progressText}>{pctPaid}% {t("bank_loan.repaid")}</Text>

                  <View style={styles.allocStats}>
                    <View style={styles.allocStat}>
                      <Text style={styles.allocStatLabel}>{t("bank_loan.outstanding")}</Text>
                      <Text style={[styles.allocStatValue, { color: alloc.outstandingBalance > 0 ? Colors.light.danger : Colors.light.success }]}>
                        Rs. {alloc.outstandingBalance.toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={styles.allocStat}>
                      <Text style={styles.allocStatLabel}>{t("bank_loan.this_month")}</Text>
                      <Text style={styles.allocStatValue}>Rs. {rec.recommendedPayment.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={styles.allocStat}>
                      <Text style={styles.allocStatLabel}>{t("bank_loan.remaining_months")}</Text>
                      <Text style={styles.allocStatValue}>{rec.remainingMonths}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />
                    <Text style={{ color: Colors.light.textMuted, fontSize: 12 }}>{t("bank_loan.view_passbook")}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Close Loan Button (President only when all done) */}
        {isPresident && loan.status === "active" && allocations.length > 0 && totalOutstanding === 0 && totalOutstandingInterest === 0 && (
          <View style={styles.section}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.light.success }]} onPress={handleClose}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("bank_loan.mark_completed")}</Text>
            </Pressable>
          </View>
        )}

        {/* Delete Loan Button (President only) */}
        {isPresident && (
          <View style={styles.section}>
            {!confirmDelete ? (
              <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.light.danger }]} onPress={() => setConfirmDelete(true)}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{t("bank_loan.delete")}</Text>
              </Pressable>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ color: Colors.light.danger, textAlign: "center", marginBottom: 5 }}>
                  {t("bank_loan.delete_message")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border }]} onPress={() => setConfirmDelete(false)}>
                    <Text style={[styles.primaryBtnText, { color: Colors.light.text }]}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: Colors.light.danger }]} onPress={executeDelete}>
                    <Ionicons name="warning-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>{t("bank_loan.delete")}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Allocation Modal */}
      <Modal visible={showAllocModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAllocModal(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("bank_loan.allocate_funds")}</Text>
            <Pressable onPress={() => setShowAllocModal(false)}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </Pressable>
          </View>

          {/* Live summary */}
          <View style={styles.allocSummaryBox}>
            <View style={styles.allocSummaryRow}>
              <Text style={styles.allocSummaryLabel}>{t("bank_loan.sanctioned")}</Text>
              <Text style={styles.allocSummaryValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.allocSummaryRow}>
              <Text style={styles.allocSummaryLabel}>{t("bank_loan.allocated_amount")}</Text>
              <Text style={[styles.allocSummaryValue, { color: computedTotal === loan.amount ? Colors.light.success : Colors.light.pending }]}>Rs. {computedTotal.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.allocSummaryRow}>
              <Text style={styles.allocSummaryLabel}>{t("bank_loan.remaining_to_allocate")}</Text>
              <Text style={[styles.allocSummaryValue, { color: loan.amount - computedTotal === 0 ? Colors.light.success : Colors.light.danger }]}>
                Rs. {(loan.amount - computedTotal).toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.allocSummaryRow}>
              <Text style={styles.allocSummaryLabel}>{t("bank_loan.members_selected")}</Text>
              <Text style={styles.allocSummaryValue}>{selectedMembers.length}</Text>
            </View>
          </View>

          {/* Method selector */}
          <View style={styles.methodRow}>
            <Pressable style={[styles.methodBtn, allocMethod === "equal" && styles.methodBtnActive]} onPress={() => setAllocMethod("equal")}>
              <Text style={[styles.methodBtnText, allocMethod === "equal" && styles.methodBtnTextActive]}>{t("bank_loan.equal_distribution")}</Text>
            </Pressable>
            <Pressable style={[styles.methodBtn, allocMethod === "custom" && styles.methodBtnActive]} onPress={() => setAllocMethod("custom")}>
              <Text style={[styles.methodBtnText, allocMethod === "custom" && styles.methodBtnTextActive]}>{t("bank_loan.custom_distribution")}</Text>
            </Pressable>
          </View>

          {/* Per-member equal preview */}
          {allocMethod === "equal" && selectedMembers.length > 0 && (
            <Text style={styles.equalPreviewText}>
              {t("bank_loan.per_member")}: Rs. {Math.floor(loan.amount / selectedMembers.length).toLocaleString("en-IN")}
            </Text>
          )}

          <FlatList
            data={activeMembers}
            keyExtractor={(m) => m.id}
            renderItem={({ item: member }) => {
              const hasActiveAlloc = bankLoanAllocations.some(a => a.memberId === member.id && a.status === "active");
              const isSelected = selectedMembers.includes(member.id);
              const equalAmount = allocMethod === "equal" && selectedMembers.length > 0
                ? Math.floor(loan.amount / selectedMembers.length)
                : 0;
              return (
                <View style={[styles.memberRow, isSelected && styles.memberRowSelected]}>
                  <Pressable 
                    style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingVertical: 4 }} 
                    onPress={() => handleToggleMember(member.id)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {hasActiveAlloc && (
                        <Text style={{ fontSize: 11, color: Colors.light.pending }}>{t("bank_loan.warn_active_alloc")}</Text>
                      )}
                    </View>
                  </Pressable>

                  {allocMethod === "equal" && isSelected && (
                    <Text style={styles.memberAmountText}>Rs. {equalAmount.toLocaleString("en-IN")}</Text>
                  )}
                  {allocMethod === "custom" && isSelected && (
                    <TextInput
                      style={styles.customAmtInput}
                      keyboardType="numeric"
                      placeholder="0"
                      value={customAmounts[member.id] || ""}
                      onChangeText={(v) => setCustomAmounts(prev => ({ ...prev, [member.id]: v }))}
                    />
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 100 }}
          />

          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.primaryBtn, { opacity: computedTotal !== loan.amount || selectedMembers.length === 0 ? 0.5 : 1 }]}
              onPress={handleAllocate}
              disabled={allocating || computedTotal !== loan.amount}
            >
              {allocating
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="people-outline" size={18} color="#fff" /><Text style={styles.primaryBtnText}>{t("bank_loan.confirm_allocation")}</Text></>
              }
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.summaryTileLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  headerSub: { fontSize: 12, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  infoCard: { backgroundColor: Colors.light.card, marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.border, padding: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.border + "60" },
  infoLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "right" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, marginBottom: 12 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryTile: { flex: 1, minWidth: "44%", backgroundColor: Colors.light.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, padding: 12 },
  summaryTileValue: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  summaryTileLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted, marginTop: 2 },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  allocCard: { backgroundColor: Colors.light.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.border, padding: 16, marginBottom: 12 },
  allocHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  allocAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primary + "18", alignItems: "center", justifyContent: "center" },
  allocAvatarText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.primary },
  allocName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  allocAmount: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  progressBarTrack: { height: 6, backgroundColor: Colors.light.border, borderRadius: 3, marginBottom: 4 },
  progressBarFill: { height: 6, backgroundColor: Colors.light.success, borderRadius: 3 },
  progressText: { fontSize: 11, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular", marginBottom: 10 },
  allocStats: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  allocStat: { flex: 1, minWidth: "28%" },
  allocStatLabel: { fontSize: 11, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  allocStatValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  modalContainer: { flex: 1, backgroundColor: Colors.light.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  modalTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  allocSummaryBox: { margin: 16, backgroundColor: Colors.light.primary + "10", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.light.primary + "30" },
  allocSummaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  allocSummaryLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  allocSummaryValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  methodRow: { flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 8 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center" },
  methodBtnActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  methodBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  methodBtnTextActive: { color: "#fff" },
  equalPreviewText: { textAlign: "center", fontSize: 13, color: Colors.light.success, fontFamily: "Poppins_500Medium", marginBottom: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", padding: 14, marginHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, gap: 12 },
  memberRowSelected: { borderColor: Colors.light.primary, backgroundColor: Colors.light.primary + "08" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.light.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  memberName: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  memberAmountText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.success },
  customAmtInput: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, padding: 8, width: 100, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, textAlign: "right" },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.card },
});
