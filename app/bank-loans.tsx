// @ts-nocheck
import { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, GroupBankLoan, BankLoanAllocation } from "@/contexts/DataContext";
import { getBankLoanRecommendation } from "@/shared/bankLoanAccounting";
import Colors from "@/constants/colors";

function statusColor(status: string): string {
  switch (status) {
    case "active": return Colors.light.success;
    case "completed": return Colors.light.primary;
    default: return Colors.light.pending;
  }
}

function BankLoanCard({ loan, allocations }: { loan: GroupBankLoan; allocations: BankLoanAllocation[] }) {
  const { t } = useLanguage();
  const color = statusColor(loan.status);
  const loanAllocs = allocations.filter(a => a.bankLoanId === loan.id);
  const totalOutstanding = loanAllocs.reduce((s, a) => s + a.outstandingBalance, 0);
  const totalCollected = loanAllocs.reduce((s, a) => s + a.totalPrincipalPaid, 0);
  const membersCompleted = loanAllocs.filter(a => a.status === "completed").length;

  return (
    <Pressable
      style={styles.loanCard}
      onPress={() => router.push({ pathname: "/bank-loan/[id]" as any, params: { id: loan.id } })}
    >
      <View style={styles.loanHeader}>
        <View style={styles.loanIconWrap}>
          <Ionicons name="business-outline" size={24} color={Colors.light.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loanName}>{loan.bankName}</Text>
          {loan.branch ? <Text style={styles.loanSub}>{loan.branch}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "18" }]}>
          <Text style={[styles.statusText, { color }]}>{t(loan.status)}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.loanMainAmount}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
        <Text style={styles.loanRate}>{loan.annualInterestRate}% p.a. · {loan.durationMonths} {t("bank_loan.months")}</Text>
      </View>

      <View style={styles.loanStats}>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.outstanding")}</Text>
          <Text style={[styles.statValue, { color: totalOutstanding > 0 ? Colors.light.danger : Colors.light.success }]}>
            Rs. {totalOutstanding.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.collected")}</Text>
          <Text style={[styles.statValue, { color: Colors.light.success }]}>Rs. {totalCollected.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.members_completed")}</Text>
          <Text style={styles.statValue}>{membersCompleted}/{loanAllocs.length}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
        <Ionicons name="calendar-outline" size={13} color={Colors.light.textMuted} />
        <Text style={{ fontSize: 12, color: Colors.light.textMuted, marginLeft: 4, fontFamily: "Poppins_400Regular" }}>
          {t("sanctionDate")}: {new Date(loan.sanctionDate).toLocaleDateString("en-IN")}
        </Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />
      </View>
    </Pressable>
  );
}

function MemberAllocationCard({ allocation, loan }: { allocation: BankLoanAllocation; loan?: GroupBankLoan }) {
  const { t } = useLanguage();
  if (!loan) return null;
  const rec = getBankLoanRecommendation(
    allocation.outstandingBalance,
    allocation.outstandingInterest,
    loan.annualInterestRate,
    allocation.allocatedPrincipal,
    loan.durationMonths
  );
  const pct = allocation.allocatedPrincipal > 0
    ? Math.min(100, Math.round((allocation.totalPrincipalPaid / allocation.allocatedPrincipal) * 100))
    : 0;
  const color = statusColor(allocation.status);

  return (
    <Pressable
      style={styles.loanCard}
      onPress={() => router.push({ pathname: "/bank-loan/allocation/[id]" as any, params: { id: allocation.id } })}
    >
      <View style={styles.loanHeader}>
        <View style={styles.loanIconWrap}>
          <Ionicons name="business-outline" size={24} color={Colors.light.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loanName}>{loan.bankName}</Text>
          {loan.branch ? <Text style={styles.loanSub}>{loan.branch}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "18" }]}>
          <Text style={[styles.statusText, { color }]}>{t(allocation.status)}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.loanMainAmount}>Rs. {allocation.allocatedPrincipal.toLocaleString("en-IN")}</Text>
        <Text style={styles.loanRate}>{loan.annualInterestRate}% p.a.</Text>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={styles.progressText}>{pct}% {t("bank_loan.repaid")}</Text>

      <View style={styles.loanStats}>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.outstanding")}</Text>
          <Text style={[styles.statValue, { color: allocation.outstandingBalance > 0 ? Colors.light.danger : Colors.light.success }]}>
            Rs. {allocation.outstandingBalance.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.recommended_payment")}</Text>
          <Text style={[styles.statValue, { color: Colors.light.primary }]}>Rs. {rec.recommendedPayment.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.loanStat}>
          <Text style={styles.statLabel}>{t("bank_loan.remaining_months")}</Text>
          <Text style={styles.statValue}>{rec.remainingMonths}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
        <Ionicons name="book-outline" size={13} color={Colors.light.textMuted} />
        <Text style={{ fontSize: 12, color: Colors.light.textMuted, marginLeft: 4, fontFamily: "Poppins_400Regular" }}>{t("bank_loan.view_passbook")}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />
      </View>
    </Pressable>
  );
}

export default function BankLoansScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { groupBankLoans, bankLoanAllocations, groupMembers } = useData();

  const isPresident = user?.role === "president";
  const isTreasurer = user?.role === "treasurer";
  const isAdminView = isPresident || isTreasurer;

  // For members, show only their allocations
  const myAllocations = useMemo(() =>
    bankLoanAllocations.filter(a => a.memberId === user?.id),
    [bankLoanAllocations, user?.id]
  );

  // President/Treasurer aggregate stats
  const totalOutstanding = useMemo(() =>
    bankLoanAllocations.reduce((s, a) => s + a.outstandingBalance, 0),
    [bankLoanAllocations]
  );
  const totalInterestCollected = useMemo(() =>
    bankLoanAllocations.reduce((s, a) => s + a.totalInterestPaid, 0),
    [bankLoanAllocations]
  );
  const activeLoans = groupBankLoans.filter(l => l.status === "active").length;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{t("bankLoans")}</Text>
        {isPresident && (
          <Pressable
            style={styles.addButton}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/create-bank-loan" as any);
            }}
          >
            <Ionicons name="add" size={24} color={Colors.light.primary} />
          </Pressable>
        )}
      </View>

      {/* Admin Quick Stats */}
      {isAdminView && groupBankLoans.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.quickStat}>
            <Ionicons name="business-outline" size={18} color={Colors.light.primary} />
            <Text style={styles.quickStatValue}>{activeLoans}</Text>
            <Text style={styles.quickStatLabel}>{t("bank_loan.active_loans")}</Text>
          </View>
          <View style={[styles.quickStat, { borderLeftWidth: 1, borderLeftColor: Colors.light.border }]}>
            <Ionicons name="trending-down-outline" size={18} color={Colors.light.danger} />
            <Text style={[styles.quickStatValue, { color: Colors.light.danger }]}>Rs. {totalOutstanding.toLocaleString("en-IN")}</Text>
            <Text style={styles.quickStatLabel}>{t("bank_loan.total_outstanding")}</Text>
          </View>
          <View style={[styles.quickStat, { borderLeftWidth: 1, borderLeftColor: Colors.light.border }]}>
            <Ionicons name="trending-up-outline" size={18} color={Colors.light.success} />
            <Text style={[styles.quickStatValue, { color: Colors.light.success }]}>Rs. {totalInterestCollected.toLocaleString("en-IN")}</Text>
            <Text style={styles.quickStatLabel}>{t("bank_loan.interest_collected")}</Text>
          </View>
        </View>
      )}

      {isAdminView ? (
        <FlatList
          data={groupBankLoans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BankLoanCard loan={item} allocations={bankLoanAllocations} />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={Colors.light.text + "40"} />
              <Text style={styles.emptyText}>{t("bank_loan.no_loans")}</Text>
              {isPresident && (
                <Pressable style={[styles.addButton, { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => router.push("/create-bank-loan" as any)}>
                  <Text style={{ color: Colors.light.primary, fontFamily: "Poppins_600SemiBold" }}>{t("bank_loan.create")}</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : (
        <FlatList
          data={myAllocations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const loan = groupBankLoans.find(l => l.id === item.bankLoanId);
            return <MemberAllocationCard allocation={item} loan={loan} />;
          }}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={Colors.light.text + "40"} />
              <Text style={styles.emptyText}>{t("bank_loan.no_allocations")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  backButton: { marginRight: 16, padding: 4 },
  title: { flex: 1, fontSize: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  addButton: { padding: 8, backgroundColor: Colors.light.primary + "15", borderRadius: 8 },
  statsRow: { flexDirection: "row", backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  quickStat: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  quickStatValue: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  quickStatLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted, textAlign: "center" },
  listContainer: { padding: 16, gap: 14 },
  loanCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.light.border },
  loanHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  loanIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.light.primary + "15", alignItems: "center", justifyContent: "center" },
  loanName: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  loanSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  amountRow: { marginBottom: 10 },
  loanMainAmount: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  loanRate: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  loanStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  loanStat: { flex: 1, minWidth: "30%" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textMuted },
  statValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  progressBarTrack: { height: 6, backgroundColor: Colors.light.border, borderRadius: 3, marginBottom: 4 },
  progressBarFill: { height: 6, backgroundColor: Colors.light.success, borderRadius: 3 },
  progressText: { fontSize: 11, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular", marginBottom: 8 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 16, fontFamily: "Poppins_500Medium", color: Colors.light.text + "99" },
});
