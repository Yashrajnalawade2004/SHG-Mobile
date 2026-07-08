import { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, Alert } from "react-native";
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
  const { user } = useAuth();
  const { t } = useLanguage();
  const { createGroupBankLoan } = useData();

  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [sanctionDate, setSanctionDate] = useState("");

  const handleSubmit = async () => {
    if (!bankName || !amount || !annualInterestRate || !durationMonths) {
      Alert.alert(t("error"), "Please fill all required fields");
      return;
    }

    try {
      await createGroupBankLoan({
        groupId: user!.groupId,
        bankName,
        branch,
        accountNumber,
        sanctionDate,
        amount: Number(amount),
        annualInterestRate: Number(annualInterestRate),
        durationMonths: Number(durationMonths)
      });
      
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert(t("error"), e.message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{t("createBankLoan")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("bankName")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. State Bank of India"
            value={bankName}
            onChangeText={setBankName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("branch")}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Main Branch"
            value={branch}
            onChangeText={setBranch}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("accountNumber")}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1234567890"
            keyboardType="number-pad"
            value={accountNumber}
            onChangeText={setAccountNumber}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("sanctionAmount")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500000"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("annualInterestRate")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 12"
            keyboardType="numeric"
            value={annualInterestRate}
            onChangeText={setAnnualInterestRate}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("durationMonths")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 24"
            keyboardType="number-pad"
            value={durationMonths}
            onChangeText={setDurationMonths}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("sanctionDate")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={sanctionDate}
            onChangeText={setSanctionDate}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>{t("confirm")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  backButton: { marginRight: 16, padding: 4 },
  title: { flex: 1, fontSize: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  content: { padding: 20, gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  input: {
    backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 12, padding: 16, fontFamily: "Poppins_400Regular", fontSize: 16, color: Colors.light.text
  },
  datePickerBtn: {
    backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },
  dateText: { fontFamily: "Poppins_400Regular", fontSize: 16, color: Colors.light.text },
  footer: {
    padding: 20, backgroundColor: Colors.light.card, borderTopWidth: 1, borderTopColor: Colors.light.border
  },
  submitButton: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: "center" },
  submitText: { color: Colors.light.background, fontFamily: "Poppins_600SemiBold", fontSize: 16 },
});
