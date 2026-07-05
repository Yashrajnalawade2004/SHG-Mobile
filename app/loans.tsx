import { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Platform, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, Loan } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import FilterPicker from "@/components/FilterPicker";

function statusColor(status: Loan["status"]): string {
  switch (status) {
    case "approved": return Colors.light.success;
    case "rejected": return Colors.light.danger;
    case "treasurer_rejected": return Colors.light.danger;
    case "pending_treasurer": return "#D97706";
    case "pending_president": return Colors.light.pending;
    default: return Colors.light.pending;
  }
}

function LoanItem({ loan }: { loan: Loan }) {
  const { t } = useLanguage();
  const color = statusColor(loan.status);

  return (
    <Pressable
      style={styles.loanCard}
      onPress={() => router.push({ pathname: "/loan/[id]", params: { id: loan.id } })}
    >
      <View style={styles.loanHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.loanName}>{loan.memberName}</Text>
          {loan.resolutionNo ? (
            <Text style={styles.resNo}>{t("resolutionNo")} {loan.resolutionNo}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.statusText, { color }]}>{t(loan.status)}</Text>
        </View>
      </View>

      <View style={styles.loanDetails}>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("loanAmount")}</Text>
          <Text style={styles.detailValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("interest")}</Text>
          <Text style={styles.detailValue}>{loan.interest}%</Text>
        </View>
        <View style={styles.loanDetail}>
          <Text style={styles.detailLabel}>{t("remaining")}</Text>
          <Text style={[styles.detailValue, { color: loan.remainingBalance > 0 ? Colors.light.danger : Colors.light.success }]}>
            Rs. {loan.remainingBalance.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.light.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { loans } = useData();
  const { isPresident, isTreasurer } = useAuth();
  
  // Filters State
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      if (filterStatus !== "all") {
        if (filterStatus === "pending") {
           if (l.status !== "pending_treasurer" && l.status !== "pending_president") return false;
        } else if (filterStatus === "treasurer_approved") {
           if (l.status !== "pending_president") return false;
        } else if (filterStatus === "president_approved") {
           if (l.status !== "approved") return false;
        } else if (filterStatus === "rejected") {
           if (l.status !== "rejected" && l.status !== "treasurer_rejected") return false;
        } else if (filterStatus === "active_status") {
           if (l.status !== "approved" || l.remainingBalance <= 0) return false;
        } else if (filterStatus === "completed") {
           if (l.status !== "approved" || l.remainingBalance > 0) return false;
        }
      }

      if (filterMonth !== "all" || filterYear !== "all") {
         const date = new Date(l.createdAt);
         if (filterMonth !== "all" && (date.getMonth() + 1).toString() !== filterMonth) return false;
         if (filterYear !== "all" && date.getFullYear().toString() !== filterYear) return false;
      }

      if (searchQuery.trim() !== "") {
         const q = searchQuery.toLowerCase();
         if ((isPresident || isTreasurer) && l.memberName.toLowerCase().includes(q)) {
            // matches
         } else {
            return false;
         }
      }

      return true;
    });
  }, [loans, filterStatus, filterMonth, filterYear, searchQuery, isPresident, isTreasurer]);

  const sortedLoans = [...filteredLoans].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{t("loans")}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            style={[styles.addBtn, { backgroundColor: showFilters ? Colors.light.primary : Colors.light.card, borderWidth: showFilters ? 0 : 1, borderColor: Colors.light.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilters(!showFilters);
            }}
          >
            <Ionicons name="filter" size={20} color={showFilters ? "#fff" : Colors.light.text} />
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/create-loan"); }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          {(isPresident || isTreasurer) && (
            <TextInput
              style={styles.searchInput}
              placeholder={t("search") + "..."}
              placeholderTextColor={Colors.light.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          )}
          <View style={styles.filterRow}>
            <FilterPicker
              label={t("status")}
              value={filterStatus}
              onChange={setFilterStatus}
              icon="ellipse-outline"
              options={[
                { value: "all", label: t("status") },
                { value: "pending", label: t("pending") },
                { value: "treasurer_approved", label: t("treasurer_approved") },
                { value: "president_approved", label: t("president_approved") },
                { value: "rejected", label: t("rejected") },
                { value: "active_status", label: t("active_status") },
                { value: "completed", label: t("completed") },
              ]}
            />
            <FilterPicker
              label={t("month")}
              value={filterMonth}
              onChange={setFilterMonth}
              icon="calendar-outline"
              options={[
                { value: "all", label: t("month") },
                { value: "1", label: "jan" }, { value: "2", label: "feb" },
                { value: "3", label: "mar" }, { value: "4", label: "apr" },
                { value: "5", label: "may" }, { value: "6", label: "jun" },
                { value: "7", label: "jul" }, { value: "8", label: "aug" },
                { value: "9", label: "sep" }, { value: "10", label: "oct" },
                { value: "11", label: "nov" }, { value: "12", label: "dec" },
              ]}
            />
            <FilterPicker
              label={t("year")}
              value={filterYear}
              onChange={setFilterYear}
              icon="time-outline"
              options={[
                { value: "all", label: t("year") },
                ...Array.from({ length: 7 }, (_, i) => {
                  const y = (new Date().getFullYear() - i).toString();
                  return { value: y, label: y };
                }),
              ]}
            />
          </View>
        </View>
      )}

      <FlatList
        data={sortedLoans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LoanItem loan={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cash-outline" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyText}>{t("noLoans")}</Text>
          </View>
        }
        scrollEnabled={sortedLoans.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  addBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  loanCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  loanHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loanName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  resNo: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 180,
  },
  statusText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    textAlign: "center",
  },
  loanDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loanDetail: { alignItems: "center" },
  detailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  detailValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
    marginTop: 2,
  },
  chevron: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
  },
  filtersContainer: { paddingHorizontal: 20, paddingBottom: 10, gap: 10 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  searchInput: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, padding: 10, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text },
});
