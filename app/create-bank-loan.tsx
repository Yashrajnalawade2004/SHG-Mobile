// @ts-nocheck
import { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

export default function CreateBankLoanScreen() {
  const insets = useSafeAreaInsets();
  const { user, isPresident } = useAuth();
  const { t } = useLanguage();
  const { createGroupBankLoan } = useData();

  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [amount, setAmount] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [sanctionDate, setSanctionDate] = useState(new Date().toISOString().split("T")[0]);
  const [repaymentStartDate, setRepaymentStartDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  // President-only guard
  if (!isPresident) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.light.danger} />
        <Text style={{ color: Colors.light.danger, marginTop: 12, fontSize: 16, fontFamily: "Poppins_600SemiBold", textAlign: "center" }}>{t("bank_loan.unauthorized")}</Text>
      </View>
    );
  }

  // Live monthly rate preview
  const monthlyRate = annualInterestRate ? (Number(annualInterestRate) / 12).toFixed(2) : null;
  const monthlyEMI = (() => {
    const P = Number(amount);
    const r = Number(annualInterestRate) / 100 / 12;
    const n = Number(durationMonths);
    if (!P || !r || !n) return null;
    return Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  })();

  const handleSubmit = async () => {
    if (!bankName.trim()) { Alert.alert(t("error"), t("bank_loan.error_bank_name_required")); return; }
    if (!amount || Number(amount) <= 0) { Alert.alert(t("error"), t("bank_loan.error_amount_required")); return; }
    if (!annualInterestRate || Number(annualInterestRate) <= 0) { Alert.alert(t("error"), t("bank_loan.error_rate_required")); return; }
    if (!durationMonths || Number(durationMonths) <= 0) { Alert.alert(t("error"), t("bank_loan.error_duration_required")); return; }
    if (!sanctionDate) { Alert.alert(t("error"), t("bank_loan.error_date_required")); return; }

    setLoading(true);
    try {
      const loan = await createGroupBankLoan({
        groupId: user!.groupId,
        bankName: bankName.trim(),
        branch: branch.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        sanctionDate,
        repaymentStartDate: repaymentStartDate || undefined,
        amount: Number(amount),
        annualInterestRate: Number(annualInterestRate),
        durationMonths: Number(durationMonths),
        remarks: remarks.trim() || undefined,
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to the new loan detail for allocation
      router.replace({ pathname: "/bank-loan/[id]" as any, params: { id: loan.id } });
    } catch (e: any) {
      Alert.alert(t("error"), e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{t("bank_loan.create")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Bank Information */}
        <Text style={styles.sectionLabel}>{t("bank_loan.bank_information")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("bankName")} *</Text>
          <TextInput style={styles.input} placeholder="e.g. State Bank of India" value={bankName} onChangeText={setBankName} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("branch")}</Text>
          <TextInput style={styles.input} placeholder="e.g. Main Branch, Mumbai" value={branch} onChangeText={setBranch} />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("accountNumber")}</Text>
            <TextInput style={styles.input} placeholder="e.g. 1234567890" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("bank_loan.ifsc")}</Text>
            <TextInput style={styles.input} placeholder="e.g. SBIN0001234" autoCapitalize="characters" value={ifscCode} onChangeText={setIfscCode} />
          </View>
        </View>

        {/* Loan Details */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>{t("bank_loan.loan_details")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("sanctionAmount")} *</Text>
          <TextInput style={styles.input} placeholder="e.g. 500000" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("annualInterestRate")} *</Text>
            <TextInput style={styles.input} placeholder="e.g. 12" keyboardType="numeric" value={annualInterestRate} onChangeText={setAnnualInterestRate} />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("durationMonths")} *</Text>
            <TextInput style={styles.input} placeholder="e.g. 24" keyboardType="number-pad" value={durationMonths} onChangeText={setDurationMonths} />
          </View>
        </View>

        {/* Live preview */}
        {(monthlyRate || monthlyEMI) && (
          <View style={styles.previewBox}>
            {monthlyRate && <Text style={styles.previewText}>{t("bank_loan.monthly_rate")}: {monthlyRate}% {t("bank_loan.per_month")}</Text>}
            {monthlyEMI && <Text style={styles.previewText}>{t("bank_loan.estimated_emi")}: Rs. {monthlyEMI.toLocaleString("en-IN")}</Text>}
          </View>
        )}

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("sanctionDate")} *</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={sanctionDate} onChangeText={setSanctionDate} />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("bank_loan.repayment_start")}</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={repaymentStartDate} onChangeText={setRepaymentStartDate} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("bank_loan.remarks")}</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline placeholder={t("bank_loan.remarks_optional")} value={remarks} onChangeText={setRemarks} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.submitButton, { opacity: loading ? 0.6 : 1 }]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="save-outline" size={20} color="#fff" /><Text style={styles.submitText}>{t("bank_loan.save_and_allocate")}</Text></>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  backButton: { marginRight: 16, padding: 4 },
  title: { flex: 1, fontSize: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  content: { padding: 20, gap: 14 },
  sectionLabel: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputGroup: { gap: 6 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  input: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.light.text },
  previewBox: { backgroundColor: Colors.light.primary + "12", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.light.primary + "30", gap: 4 },
  previewText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.primary },
  footer: { padding: 20, backgroundColor: Colors.light.card, borderTopWidth: 1, borderTopColor: Colors.light.border },
  submitButton: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  submitText: { color: Colors.light.background, fontFamily: "Poppins_600SemiBold", fontSize: 16 },
});
