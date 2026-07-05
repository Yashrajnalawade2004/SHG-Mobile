// @ts-nocheck
import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { generateGroupSavingsReport, generateGroupLoansReport, generateFinancialSummaryReport, generateMemberRegisterReport } from "@/lib/pdf-generator";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

const Chip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
  <Pressable
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={onPress}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </Pressable>
);

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { group, president, user, isPresident, isTreasurer } = useAuth();
  const { t, language } = useLanguage();
  const { payments, loans, loanRepayments, groupMembers } = useData();
  
  const [activeReport, setActiveReport] = useState<string | null>(null);
  
  // Generic Filters
  const [timeRange, setTimeRange] = useState<"all" | "month" | "year" | "custom">("month");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Specific Filters
  const [paymentMethod, setPaymentMethod] = useState<"all" | "cash" | "online">("all");
  const [loanStatus, setLoanStatus] = useState<string>("all");
  const [memberStatus, setMemberStatus] = useState<string>("all");

  const [generating, setGenerating] = useState<string | null>(null);

  const getAppliedFiltersText = (reportType: string) => {
    const filters = [];
    
    // Time Range Text
    if (reportType !== "members") {
      let timeText = t("reports.all_time") || "All Time";
      if (timeRange === "month") timeText = `${filterMonth}-${filterYear}`;
      if (timeRange === "year") timeText = filterYear;
      if (timeRange === "custom") timeText = `${startDate} to ${endDate}`;
      filters.push({ label: t("reports.time_range") || "Time Range", value: timeText });
    }

    if (reportType === "savings") {
      const pMethod = paymentMethod === "all" ? t("all") : (paymentMethod === "cash" ? t("cash") : t("auto.online"));
      filters.push({ label: t("reports.payment_method") || "Payment Method", value: pMethod });
    }
    
    if (reportType === "loans") {
      let lStatus = t("all");
      if (loanStatus !== "all") lStatus = t(`reports.${loanStatus}`) || loanStatus;
      filters.push({ label: t("reports.loan_status") || "Loan Status", value: lStatus });
    }
    
    if (reportType === "members") {
      let mStatus = t("all");
      if (memberStatus !== "all") mStatus = t(`reports.${memberStatus}`) || memberStatus;
      filters.push({ label: t("reports.member_status") || "Member Status", value: mStatus });
    }
    
    return filters;
  };

  const validateDates = () => {
    if (timeRange === "custom") {
      if (!startDate || !endDate) return false;
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(startDate) || !regex.test(endDate)) return false;
    }
    return true;
  };

  const handleGenerate = async (type: string) => {
    if (!group) return;
    if (timeRange === "custom" && !validateDates()) {
      Alert.alert(t("error"), t("validation.invalid_date_format") || "Invalid date format. Use YYYY-MM-DD.");
      return;
    }

    setGenerating(type);
    try {
      const commonArgs = {
        group,
        president: president || undefined,
        user,
        payments,
        loans,
        loanRepayments,
        groupMembers,
        language,
        t,
        appliedFiltersText: getAppliedFiltersText(type)
      };

      if (type === "savings") {
        await generateGroupSavingsReport({ ...commonArgs, timeRange, filterMonth, filterYear, startDate, endDate, paymentMethod });
      } else if (type === "loans") {
        await generateGroupLoansReport({ ...commonArgs, timeRange, filterMonth, filterYear, startDate, endDate, loanFilter: loanStatus });
      } else if (type === "summary") {
        await generateFinancialSummaryReport({ ...commonArgs, timeRange, filterMonth, filterYear, startDate, endDate });
      } else if (type === "members") {
        await generateMemberRegisterReport({ ...commonArgs, memberFilter: memberStatus });
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("error"), "Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  };

  if (!isPresident && !isTreasurer) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={48} color={Colors.light.textMuted} />
        <Text style={styles.accessDeniedText}>{t("presidentOnly")}</Text>
      </View>
    );
  }

  const renderTimeFilters = () => (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{t("reports.time_range") || "Time Range"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <Chip label={t("reports.all_time") || "All Time"} selected={timeRange === "all"} onPress={() => setTimeRange("all")} />
        <Chip label={t("month")} selected={timeRange === "month"} onPress={() => setTimeRange("month")} />
        <Chip label={t("year")} selected={timeRange === "year"} onPress={() => setTimeRange("year")} />
        <Chip label={t("reports.custom_date_range") || "Custom"} selected={timeRange === "custom"} onPress={() => setTimeRange("custom")} />
      </ScrollView>

      {timeRange === "month" && (
        <View style={styles.subFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {MONTHS.map(m => (
              <Chip key={m} label={m} selected={filterMonth === m} onPress={() => setFilterMonth(m)} />
            ))}
          </ScrollView>
          <View style={{ width: 1, backgroundColor: Colors.light.border, marginHorizontal: 8 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {YEARS.map(y => (
              <Chip key={y} label={y} selected={filterYear === y} onPress={() => setFilterYear(y)} />
            ))}
          </ScrollView>
        </View>
      )}

      {timeRange === "year" && (
        <View style={styles.subFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {YEARS.map(y => (
              <Chip key={y} label={y} selected={filterYear === y} onPress={() => setFilterYear(y)} />
            ))}
          </ScrollView>
        </View>
      )}

      {timeRange === "custom" && (
        <View style={styles.dateInputRow}>
          <TextInput 
            style={styles.dateInput} 
            placeholder="YYYY-MM-DD" 
            value={startDate} 
            onChangeText={setStartDate} 
            maxLength={10} 
          />
          <Text style={{ color: Colors.light.textSecondary }}>to</Text>
          <TextInput 
            style={styles.dateInput} 
            placeholder="YYYY-MM-DD" 
            value={endDate} 
            onChangeText={setEndDate} 
            maxLength={10} 
          />
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 16,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("reports.group_reports") || "Group Reports"}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.subtitle}>
          {t("reports.download_desc")}
        </Text>

        {/* Savings Report */}
        <Pressable 
          style={[styles.reportCard, activeReport === "savings" && styles.reportCardActive]} 
          onPress={() => setActiveReport(activeReport === "savings" ? null : "savings")}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: Colors.light.success + "15" }]}>
              <Ionicons name="wallet-outline" size={24} color={Colors.light.success} />
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{t("reports.monthly_savings_report")}</Text>
              <Text style={styles.reportDesc}>{t("auto.detailed_view_of_all_members")}</Text>
            </View>
            <Ionicons name={activeReport === "savings" ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.textSecondary} />
          </View>
          
          {activeReport === "savings" && (
            <View style={styles.cardBody}>
              {renderTimeFilters()}
              
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>{t("reports.payment_method") || "Payment Method"}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  <Chip label={t("all")} selected={paymentMethod === "all"} onPress={() => setPaymentMethod("all")} />
                  <Chip label={t("cash")} selected={paymentMethod === "cash"} onPress={() => setPaymentMethod("cash")} />
                  <Chip label={t("auto.online")} selected={paymentMethod === "online"} onPress={() => setPaymentMethod("online")} />
                </ScrollView>
              </View>

              <Pressable style={styles.downloadBtn} onPress={() => handleGenerate("savings")} disabled={generating !== null}>
                {generating === "savings" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={styles.downloadText}>{t("common.download")}</Text></>}
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Loans Report */}
        <Pressable 
          style={[styles.reportCard, activeReport === "loans" && styles.reportCardActive]} 
          onPress={() => setActiveReport(activeReport === "loans" ? null : "loans")}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: Colors.light.primary + "15" }]}>
              <Ionicons name="cash-outline" size={24} color={Colors.light.primary} />
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{t("reports.active_loans_report")}</Text>
              <Text style={styles.reportDesc}>{t("auto.overview_of_all_active_loans")}</Text>
            </View>
            <Ionicons name={activeReport === "loans" ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.textSecondary} />
          </View>
          
          {activeReport === "loans" && (
            <View style={styles.cardBody}>
              {renderTimeFilters()}
              
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>{t("reports.loan_status") || "Loan Status"}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  <Chip label={t("all")} selected={loanStatus === "all"} onPress={() => setLoanStatus("all")} />
                  <Chip label={t("reports.pending_loans") || "Pending"} selected={loanStatus === "pending"} onPress={() => setLoanStatus("pending")} />
                  <Chip label={t("reports.treasurer_approved") || "Treas. Appr"} selected={loanStatus === "treasurer_approved"} onPress={() => setLoanStatus("treasurer_approved")} />
                  <Chip label={t("reports.president_approved") || "Pres. Appr"} selected={loanStatus === "president_approved"} onPress={() => setLoanStatus("president_approved")} />
                  <Chip label={t("reports.active") || "Active"} selected={loanStatus === "active"} onPress={() => setLoanStatus("active")} />
                  <Chip label={t("reports.completed") || "Completed"} selected={loanStatus === "completed"} onPress={() => setLoanStatus("completed")} />
                  <Chip label={t("reports.rejected_loans") || "Rejected"} selected={loanStatus === "rejected"} onPress={() => setLoanStatus("rejected")} />
                </ScrollView>
              </View>

              <Pressable style={styles.downloadBtn} onPress={() => handleGenerate("loans")} disabled={generating !== null}>
                {generating === "loans" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={styles.downloadText}>{t("common.download")}</Text></>}
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Financial Summary */}
        <Pressable 
          style={[styles.reportCard, activeReport === "summary" && styles.reportCardActive]} 
          onPress={() => setActiveReport(activeReport === "summary" ? null : "summary")}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#8b5cf615" }]}>
              <Ionicons name="pie-chart-outline" size={24} color="#8b5cf6" />
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{t("reports.financial_summary") || "Financial Summary"}</Text>
              <Text style={styles.reportDesc}>{t("auto.view_summary_of_all_transactions") || "Overview of total finances"}</Text>
            </View>
            <Ionicons name={activeReport === "summary" ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.textSecondary} />
          </View>
          
          {activeReport === "summary" && (
            <View style={styles.cardBody}>
              {renderTimeFilters()}
              
              <Pressable style={[styles.downloadBtn, { backgroundColor: "#8b5cf6" }]} onPress={() => handleGenerate("summary")} disabled={generating !== null}>
                {generating === "summary" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={styles.downloadText}>{t("common.download")}</Text></>}
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Member Register */}
        <Pressable 
          style={[styles.reportCard, activeReport === "members" && styles.reportCardActive]} 
          onPress={() => setActiveReport(activeReport === "members" ? null : "members")}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#f59e0b15" }]}>
              <Ionicons name="people-outline" size={24} color="#f59e0b" />
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{t("reports.member_register") || "Member Register"}</Text>
              <Text style={styles.reportDesc}>{t("auto.view_summary_of_all_members") || "Detailed member status list"}</Text>
            </View>
            <Ionicons name={activeReport === "members" ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.textSecondary} />
          </View>
          
          {activeReport === "members" && (
            <View style={styles.cardBody}>
              
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>{t("reports.member_status") || "Member Status"}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  <Chip label={t("all")} selected={memberStatus === "all"} onPress={() => setMemberStatus("all")} />
                  <Chip label={t("reports.active_members") || "Active"} selected={memberStatus === "active"} onPress={() => setMemberStatus("active")} />
                  <Chip label={t("reports.inactive_members") || "Inactive"} selected={memberStatus === "inactive"} onPress={() => setMemberStatus("inactive")} />
                  <Chip label={t("reports.members_active_loans") || "w/ Active Loans"} selected={memberStatus === "active_loans"} onPress={() => setMemberStatus("active_loans")} />
                  <Chip label={t("reports.members_completed_loans") || "w/ Comp. Loans"} selected={memberStatus === "completed_loans"} onPress={() => setMemberStatus("completed_loans")} />
                  <Chip label={t("reports.members_pending_payments") || "w/ Pending Pay"} selected={memberStatus === "pending_payments"} onPress={() => setMemberStatus("pending_payments")} />
                  <Chip label={t("reports.members_overdue_payments") || "w/ Overdue"} selected={memberStatus === "overdue_payments"} onPress={() => setMemberStatus("overdue_payments")} />
                </ScrollView>
              </View>

              <Pressable style={[styles.downloadBtn, { backgroundColor: "#f59e0b" }]} onPress={() => handleGenerate("members")} disabled={generating !== null}>
                {generating === "members" ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={styles.downloadText}>{t("common.download")}</Text></>}
              </Pressable>
            </View>
          )}
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.light.background },
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.light.text },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginBottom: 30 },
  
  reportCard: { backgroundColor: Colors.light.card, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.light.border, overflow: "hidden" },
  reportCardActive: { borderColor: Colors.light.primary },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  reportInfo: { flex: 1 },
  reportTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.light.text },
  reportDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  
  cardBody: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.light.border, gap: 20 },
  
  filterGroup: { gap: 8 },
  filterLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.light.textSecondary, textTransform: "uppercase" },
  chipScroll: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipSelected: { backgroundColor: Colors.light.primary + "15", borderColor: Colors.light.primary },
  chipText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: "#64748b" },
  chipTextSelected: { color: Colors.light.primary, fontFamily: "Poppins_600SemiBold" },
  
  subFilterRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  dateInputRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  dateInput: { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, paddingHorizontal: 12, fontFamily: "Poppins_400Regular", backgroundColor: "#fff" },

  downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  downloadText: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff" },
  
  accessDenied: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.background, padding: 20 },
  accessDeniedText: { fontFamily: "Poppins_500Medium", fontSize: 16, color: Colors.light.textSecondary, marginTop: 16, textAlign: "center" },
});
