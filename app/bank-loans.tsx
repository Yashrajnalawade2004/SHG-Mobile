import { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, GroupBankLoan, BankLoanAllocation } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

function statusColor(status: string): string {
  switch (status) {
    case "active": return Colors.light.success;
    case "completed": return Colors.light.primary;
    default: return Colors.light.pending;
  }
}

function BankLoanItem({ loan, allocations }: { loan: GroupBankLoan, allocations: BankLoanAllocation[] }) {
  const { t } = useLanguage();
  const color = statusColor(loan.status);
  
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
  const totalOutstanding = allocations.reduce((sum, a) => sum + a.outstandingBalance, 0);

  return (
    <Pressable
      style={styles.loanCard}
      onPress={() => router.push({ pathname: "/bank-loan/[id]" as any, params: { id: loan.id } })}
    >
      <View style={styles.loanHeader}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={styles.loanName}>{loan.bankName}</Text>
          {loan.accountNumber ? (
            <Text style={styles.resNo}>{t("accountNumber")}: {loan.accountNumber}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.statusText, { color }]}>{t(loan.status)}</Text>
        </View>
      </View>

      <View style={styles.loanDetails}>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("sanctionAmount")}</Text>
          <Text style={styles.detailValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("annualInterestRate")}</Text>
          <Text style={styles.detailValue}>{loan.annualInterestRate}%</Text>
        </View>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("totalAllocated")}</Text>
          <Text style={styles.detailValue}>Rs. {totalAllocated.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("bankOutstanding")}</Text>
          <Text style={styles.detailValue}>Rs. {totalOutstanding.toLocaleString("en-IN")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BankLoansScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { groupBankLoans, bankLoanAllocations } = useData();

  const isPresident = user?.role === "president";

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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

      <FlatList
        data={groupBankLoans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BankLoanItem 
            loan={item} 
            allocations={bankLoanAllocations.filter(a => a.bankLoanId === item.id)} 
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={Colors.light.text + "40"} />
            <Text style={styles.emptyText}>{t("no_records") || "No records"}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  addButton: {
    padding: 8,
    backgroundColor: Colors.light.primary + "15",
    borderRadius: 8,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  loanCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  loanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  loanName: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  resNo: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text + "99",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  loanDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  loanDetail: {
    flex: 1,
    minWidth: "45%",
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text + "99",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text + "99",
  },
});
