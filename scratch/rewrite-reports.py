import json

def build_new_reports_tsx():
    # Read the original file
    with open("app/reports.tsx", "r", encoding="utf-8") as f:
        original = f.read()

    # The new file content
    new_content = """// @ts-nocheck
import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Modal } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { apiGet } from "@/lib/api";
import SHGDatePicker from "@/components/SHGDatePicker";
import { 
  generateSavingsReport, 
  generateMemberPassbook, 
  generateFinancialReport, 
  generateInternalLoanRegister, 
  generateBankLoanRegister, 
  generateLoanRecoveryReport, 
  generateMemberRegister, 
  generateAnnualReport, 
  generateMeetingRegister, 
  generateCashBook, 
  generateBankBook 
} from "@/lib/pdf-generator";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const QUARTERS = ["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dec)"];
const HALF_YEARS = ["H1 (Jan-Jun)", "H2 (Jul-Dec)"];

const Dropdown = ({ label, value, options, onSelect, placeholder = "Select..." }: any) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o: any) => o.value === value);

  return (
    <View style={styles.dropdownWrapper}>
      {label && <Text style={styles.dropdownLabel}>{label}</Text>}
      <Pressable style={styles.dropdownTarget} onPress={() => setOpen(true)}>
        <Text style={selectedOption ? styles.dropdownText : styles.dropdownPlaceholder}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.light.textMuted} />
      </Pressable>
      
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdownMenu}>
            <ScrollView style={{ maxHeight: 300 }}>
              {options.map((opt: any) => (
                <Pressable
                  key={opt.value}
                  style={[styles.dropdownItem, value === opt.value && styles.dropdownItemSelected]}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, value === opt.value && styles.dropdownItemTextSelected]}>
                    {opt.label}
                  </Text>
                  {value === opt.value && <Ionicons name="checkmark" size={18} color={Colors.light.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const Accordion = ({ title, expanded, onToggle, children }: any) => {
  return (
    <View style={styles.accordionContainer}>
      <Pressable style={[styles.accordionHeader, expanded && styles.accordionHeaderExpanded]} onPress={onToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name={expanded ? "folder-open" : "folder"} size={24} color={Colors.light.primary} />
          <Text style={styles.accordionTitle}>{title}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.textSecondary} />
      </Pressable>
      {expanded && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
};

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { group, president, user, isPresident, isTreasurer } = useAuth();
  const { t, language } = useLanguage();
  const { payments, loans, loanRepayments, groupMembers, groupBankLoans, bankLoanAllocations } = useData();

  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>("standard");

  // Generic Filters
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "half-year" | "year" | "custom">("month");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterQuarter, setFilterQuarter] = useState("0");
  const [filterHalf, setFilterHalf] = useState("0");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Specific Filters
  const [paymentMethod, setPaymentMethod] = useState<"all" | "cash" | "online">("all");
  const [loanStatus, setLoanStatus] = useState<"all" | "active" | "completed" | "overdue">("all");
  const [selectedMember, setSelectedMember] = useState<string>("all");

  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (group && isPresident || isTreasurer) {
      setLoadingMeetings(true);
      apiGet(`/api/groups/${group.groupId}/meetings`)
        .then(res => setMeetings(res))
        .catch(console.error)
        .finally(() => setLoadingMeetings(false));
    }
  }, [group]);

  const getAppliedFiltersText = (reportType: string) => {
    const filters = [];

    // Time Range Text
    let timeText = t("reports.all_time", {defaultValue: "All Time"});
    if (timeRange === "month") timeText = `${filterMonth}-${filterYear}`;
    if (timeRange === "quarter") timeText = `${QUARTERS[parseInt(filterQuarter)]} ${filterYear}`;
    if (timeRange === "half-year") timeText = `${HALF_YEARS[parseInt(filterHalf)]} ${filterYear}`;
    if (timeRange === "year") timeText = filterYear;
    if (timeRange === "custom") timeText = `${startDate.split('T')[0]} to ${endDate.split('T')[0]}`;
    filters.push(`Period: ${timeText}`);

    if (reportType === "savings") {
      const pMethod = paymentMethod === "all" ? "All" : (paymentMethod === "cash" ? "Cash" : "Online");
      filters.push(`Method: ${pMethod}`);
    }

    if (reportType === "internal_loans" || reportType === "bank_loans") {
      filters.push(`Status: ${loanStatus.toUpperCase()}`);
    }

    if (reportType === "member_passbook" && selectedMember !== "all") {
      const member = groupMembers.find(m => m.id === selectedMember);
      filters.push(`Member: ${member?.name || 'Unknown'}`);
    }

    return filters.join(" | ");
  };

  const calculateDateRange = () => {
    let sDate = startDate;
    let eDate = endDate;
    const y = parseInt(filterYear);

    if (timeRange === "month") {
      const m = parseInt(filterMonth) - 1;
      sDate = new Date(y, m, 1).toISOString();
      eDate = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    } else if (timeRange === "quarter") {
      const q = parseInt(filterQuarter);
      sDate = new Date(y, q * 3, 1).toISOString();
      eDate = new Date(y, q * 3 + 3, 0, 23, 59, 59).toISOString();
    } else if (timeRange === "half-year") {
      const h = parseInt(filterHalf);
      sDate = new Date(y, h * 6, 1).toISOString();
      eDate = new Date(y, h * 6 + 6, 0, 23, 59, 59).toISOString();
    } else if (timeRange === "year") {
      sDate = new Date(y, 0, 1).toISOString();
      eDate = new Date(y, 11, 31, 23, 59, 59).toISOString();
    }

    return { calculatedStart: sDate, calculatedEnd: eDate };
  };

  const handleGenerate = async (type: string) => {
    if (!group) return;
    
    if (type === "member_passbook" && selectedMember === "all") {
      Alert.alert(t("error"), t("reports.select_member", {defaultValue: "Please select a member"}));
      return;
    }

    setGenerating(type);
    
    const { calculatedStart, calculatedEnd } = calculateDateRange();

    let loanLedger = [];
    let bankLoanLedger = [];
    
    try {
      if (["member_passbook", "cash_book", "bank_book", "financial", "internal_loans", "annual_report"].includes(type)) {
        loanLedger = await apiGet(`/api/groups/${group.id}/loan-ledger`);
      }
      if (["member_passbook", "cash_book", "bank_book", "financial", "bank_loans", "annual_report"].includes(type)) {
        bankLoanLedger = await apiGet(`/api/groups/${group.id}/bank-loan-ledger`);
      }
    } catch (e) {
      console.error("Failed to fetch ledgers", e);
    }

    const commonArgs = {
      group,
      president: president || undefined,
      user,
      payments,
      loans,
      loanRepayments,
      loanLedger,
      groupMembers,
      bankLoans: groupBankLoans,
      bankLoanAllocations,
      bankLoanLedger,
      meetings,
      language,
      t,
      appliedFiltersText: getAppliedFiltersText(type),
      timeRange: timeRange === "custom" ? "custom" : "range",
      startDate: calculatedStart,
      endDate: calculatedEnd,
      filterMonth,
      filterYear
    };

    try {
      if (type === "savings") await generateSavingsReport({ ...commonArgs, paymentMethod });
      else if (type === "member_passbook") await generateMemberPassbook({ ...commonArgs, member: groupMembers.find(m=>m.id===selectedMember) });
      else if (type === "financial") await generateFinancialReport(commonArgs);
      else if (type === "internal_loans") await generateInternalLoanRegister({ ...commonArgs, loanFilter: loanStatus });
      else if (type === "bank_loans") await generateBankLoanRegister({ ...commonArgs, loanFilter: loanStatus });
      else if (type === "recovery") await generateLoanRecoveryReport(commonArgs);
      else if (type === "members") await generateMemberRegister(commonArgs);
      else if (type === "annual") await generateAnnualReport(commonArgs);
      else if (type === "meetings") await generateMeetingRegister(commonArgs);
      else if (type === "cash_book") await generateCashBook(commonArgs);
      else if (type === "bank_book") await generateBankBook(commonArgs);
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
        <Text style={styles.accessDeniedText}>President or Treasurer access required</Text>
      </View>
    );
  }

  const timeRangeOptions = [
    { label: t("reports.monthly", {defaultValue: "Monthly"}), value: "month" },
    { label: t("reports.quarterly", {defaultValue: "Quarterly"}), value: "quarter" },
    { label: t("reports.half_yearly", {defaultValue: "Half-Yearly"}), value: "half-year" },
    { label: t("reports.annual", {defaultValue: "Annual"}), value: "year" },
    { label: t("reports.custom", {defaultValue: "Custom"}), value: "custom" },
  ];

  const yearOptions = YEARS.map(y => ({ label: y, value: y }));
  const monthOptions = MONTHS.map((m, i) => ({ label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }), value: m }));
  const quarterOptions = QUARTERS.map((q, i) => ({ label: q, value: String(i) }));
  const halfOptions = HALF_YEARS.map((h, i) => ({ label: h, value: String(i) }));

  const renderTimeFilters = () => (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{t("reports.time_range", {defaultValue: "Time Range"})}</Text>
      <Dropdown 
        value={timeRange} 
        options={timeRangeOptions} 
        onSelect={(val: any) => setTimeRange(val)} 
      />

      {["month", "quarter", "half-year", "year"].includes(timeRange) && (
        <View style={{ marginTop: 12 }}>
          <Dropdown 
            label={t("reports.select_year", {defaultValue: "Year"})} 
            value={filterYear} 
            options={yearOptions} 
            onSelect={(val: any) => setFilterYear(val)} 
          />
        </View>
      )}
      
      {timeRange === "month" && (
        <View style={{ marginTop: 12 }}>
          <Dropdown 
            label={t("reports.select_month", {defaultValue: "Month"})} 
            value={filterMonth} 
            options={monthOptions} 
            onSelect={(val: any) => setFilterMonth(val)} 
          />
        </View>
      )}

      {timeRange === "quarter" && (
        <View style={{ marginTop: 12 }}>
          <Dropdown 
            label={t("reports.select_quarter", {defaultValue: "Quarter"})} 
            value={filterQuarter} 
            options={quarterOptions} 
            onSelect={(val: any) => setFilterQuarter(val)} 
          />
        </View>
      )}

      {timeRange === "half-year" && (
        <View style={{ marginTop: 12 }}>
          <Dropdown 
            label={t("reports.select_half", {defaultValue: "Half"})} 
            value={filterHalf} 
            options={halfOptions} 
            onSelect={(val: any) => setFilterHalf(val)} 
          />
        </View>
      )}

      {timeRange === "custom" && (
        <View style={styles.dateInputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dropdownLabel}>{t("reports.from_date", {defaultValue: "From Date"})}</Text>
            <SHGDatePicker value={startDate} onChange={setStartDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dropdownLabel}>{t("reports.to_date", {defaultValue: "To Date"})}</Text>
            <SHGDatePicker value={endDate} onChange={setEndDate} />
          </View>
        </View>
      )}
    </View>
  );

  const ReportCard = ({ type, titleKey, defaultTitle, icon, descKey, defaultDesc, requiresMember = false }: any) => {
    const paymentMethodOptions = [
      { label: t("reports.all", {defaultValue: "All"}), value: "all" },
      { label: t("reports.cash", {defaultValue: "Cash"}), value: "cash" },
      { label: t("reports.online", {defaultValue: "Online"}), value: "online" }
    ];

    const loanStatusOptions = [
      { label: t("reports.all", {defaultValue: "All"}), value: "all" },
      { label: t("reports.active", {defaultValue: "Active"}), value: "active" },
      { label: t("reports.completed", {defaultValue: "Completed"}), value: "completed" }
    ];

    const memberOptions = [
      { label: t("reports.all_members", {defaultValue: "Select Member..."}), value: "all" },
      ...groupMembers.filter(m=>m.status==='active').map(m => ({ label: m.name, value: m.id }))
    ];

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportCardHeader}>
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.reportCardText}>
            <Text style={styles.reportTitle}>{t(titleKey, {defaultValue: defaultTitle})}</Text>
            <Text style={styles.reportDesc}>{t(descKey, {defaultValue: defaultDesc})}</Text>
          </View>
        </View>
        
        {requiresMember && (
          <View style={styles.specificFilter}>
            <Dropdown 
              label={t("reports.select_member", {defaultValue: "Select Member"})} 
              value={selectedMember} 
              options={memberOptions} 
              onSelect={(val: any) => setSelectedMember(val)} 
            />
          </View>
        )}

        {type === "savings" && (
          <View style={styles.specificFilter}>
            <Dropdown 
              label={t("reports.payment_method", {defaultValue: "Payment Method"})} 
              value={paymentMethod} 
              options={paymentMethodOptions} 
              onSelect={(val: any) => setPaymentMethod(val)} 
            />
          </View>
        )}
        
        {(type === "internal_loans" || type === "bank_loans") && (
          <View style={styles.specificFilter}>
            <Dropdown 
              label={t("reports.loan_status", {defaultValue: "Loan Status"})} 
              value={loanStatus} 
              options={loanStatusOptions} 
              onSelect={(val: any) => setLoanStatus(val)} 
            />
          </View>
        )}

        <Pressable
          style={[styles.generateBtn, generating === type && styles.generatingBtn]}
          onPress={() => handleGenerate(type)}
          disabled={generating !== null || (requiresMember && selectedMember === "all")}
        >
          {generating === type ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.generateBtnText}>{t("reports.generate_report", {defaultValue: "Generate PDF"})}</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

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
          <Text style={styles.title}>{t("reports.group_reports", {defaultValue: "SHG Reports"})}</Text>
        </View>

        {renderTimeFilters()}

        <View style={styles.reportsGrid}>
          
          {/* ACCORDION 1: Standard SHG Registers */}
          <Accordion 
            title="Standard SHG Registers" 
            expanded={expandedSection === "standard"} 
            onToggle={() => setExpandedSection(expandedSection === "standard" ? "" : "standard")}
          >
            <ReportCard 
              type="cash_book" 
              titleKey="reports.cash_book" 
              defaultTitle="Cash Book" 
              icon="cash" 
              descKey="reports.cash_book_desc" 
              defaultDesc="Running physical cash balance tracking all SHG cash movements." 
            />
            <ReportCard 
              type="bank_book" 
              titleKey="reports.bank_book" 
              defaultTitle="Bank Book" 
              icon="card" 
              descKey="reports.bank_book_desc" 
              defaultDesc="Running bank balance tracking all online/cheque movements." 
            />
            <ReportCard 
              type="financial" 
              titleKey="reports.shg_financial_report" 
              defaultTitle="SHG Financial Report" 
              icon="bar-chart" 
              descKey="reports.financial_desc" 
              defaultDesc="Overall financial position (Income, Expenses, Assets, Liabilities)." 
            />
          </Accordion>

          {/* ACCORDION 2: Operational Ledgers */}
          <Accordion 
            title="Operational Ledgers" 
            expanded={expandedSection === "operational"} 
            onToggle={() => setExpandedSection(expandedSection === "operational" ? "" : "operational")}
          >
            <ReportCard 
              type="savings" 
              titleKey="reports.monthly_savings_report" 
              defaultTitle="Monthly Savings Report" 
              icon="wallet" 
              descKey="reports.savings_desc" 
              defaultDesc="Detailed list of member savings contributions and late fees." 
            />
            <ReportCard 
              type="internal_loans" 
              titleKey="reports.internal_loan_register" 
              defaultTitle="Internal Loan Register" 
              icon="document-attach" 
              descKey="reports.internal_loan_desc" 
              defaultDesc="Record of all internal SHG loans, outstanding amounts, and recovery %." 
            />
            <ReportCard 
              type="bank_loans" 
              titleKey="reports.group_bank_loan_register" 
              defaultTitle="Group Bank Loan Register" 
              icon="business" 
              descKey="reports.bank_loan_desc" 
              defaultDesc="Record of external bank loans and member allocations." 
            />
            <ReportCard 
              type="recovery" 
              titleKey="reports.loan_recovery_report" 
              defaultTitle="Loan Recovery Report" 
              icon="trending-up" 
              descKey="reports.recovery_desc" 
              defaultDesc="Monthly monitoring of both internal and bank loan recoveries." 
            />
          </Accordion>

          {/* ACCORDION 3: Administrative Registers */}
          <Accordion 
            title="Administrative Registers" 
            expanded={expandedSection === "administrative"} 
            onToggle={() => setExpandedSection(expandedSection === "administrative" ? "" : "administrative")}
          >
            <ReportCard 
              type="member_passbook" 
              titleKey="reports.member_passbook" 
              defaultTitle="Member Passbook" 
              icon="book" 
              descKey="reports.member_passbook_desc" 
              defaultDesc="Individual member's combined savings and loan passbooks." 
              requiresMember={true}
            />
            <ReportCard 
              type="members" 
              titleKey="reports.member_register" 
              defaultTitle="Member Register" 
              icon="people" 
              descKey="reports.member_register_desc" 
              defaultDesc="Master roster of all active and former members." 
            />
            <ReportCard 
              type="meetings" 
              titleKey="reports.meeting_register" 
              defaultTitle="Meeting Register" 
              icon="calendar" 
              descKey="reports.meeting_register_desc" 
              defaultDesc="Log of all scheduled and completed SHG meetings." 
            />
            <ReportCard 
              type="annual" 
              titleKey="reports.annual_shg_report" 
              defaultTitle="Annual SHG Report" 
              icon="ribbon" 
              descKey="reports.annual_desc" 
              defaultDesc="Comprehensive year-end statistical report for auditing." 
            />
          </Accordion>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: Colors.light.text },
  accessDenied: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", padding: 20 },
  accessDeniedText: { marginTop: 16, fontSize: 16, color: Colors.light.textMuted, textAlign: "center" },
  
  filterGroup: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0" },
  filterLabel: { fontSize: 16, fontWeight: "700", color: Colors.light.text, marginBottom: 12 },
  
  dateInputRow: { flexDirection: "row", marginTop: 12, gap: 12 },
  
  reportsGrid: { gap: 12 },
  
  accordionContainer: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  accordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff" },
  accordionHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#f8fafc" },
  accordionTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.text },
  accordionBody: { padding: 16, gap: 16, backgroundColor: "#f8fafc" },

  reportCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  reportCardHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" },
  reportCardText: { flex: 1 },
  reportTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.text, marginBottom: 4 },
  reportDesc: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  
  specificFilter: { marginBottom: 16 },

  generateBtn: { flexDirection: "row", backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  generatingBtn: { opacity: 0.7 },
  generateBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Dropdown Styles
  dropdownWrapper: { width: "100%" },
  dropdownLabel: { fontSize: 12, fontWeight: "600", color: Colors.light.textSecondary, marginBottom: 6 },
  dropdownTarget: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, height: 44 },
  dropdownText: { fontSize: 14, color: Colors.light.text, fontFamily: "Poppins_500Medium" },
  dropdownPlaceholder: { fontSize: 14, color: Colors.light.textMuted, fontFamily: "Poppins_400Regular" },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  dropdownMenu: { width: "100%", backgroundColor: "#fff", borderRadius: 12, padding: 8, maxHeight: "80%", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  dropdownItemSelected: { backgroundColor: Colors.light.primary + "15" },
  dropdownItemText: { fontSize: 15, color: Colors.light.text, fontFamily: "Poppins_400Regular" },
  dropdownItemTextSelected: { color: Colors.light.primary, fontFamily: "Poppins_600SemiBold" },
});
"""

    with open("app/reports.tsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Rewrote app/reports.tsx")

build_new_reports_tsx()
