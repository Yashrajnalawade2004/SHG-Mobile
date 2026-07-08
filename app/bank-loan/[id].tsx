import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, TextInput, Modal } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

export default function BankLoanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { groupBankLoans, bankLoanAllocations, groupMembers, allocateBankLoanFunds, closeGroupBankLoan, recordBankLoanRepayment } = useData();

  const loan = groupBankLoans.find((l) => l.id === id);
  const allocations = bankLoanAllocations.filter((a) => a.bankLoanId === id);
  
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [allocateAmount, setAllocateAmount] = useState("");
  
  const [showRepayModal, setShowRepayModal] = useState<{ id: string, name: string, due: number } | null>(null);
  const [repayAmount, setRepayAmount] = useState("");

  if (!loan) return null;

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
  const totalOutstanding = allocations.reduce((sum, a) => sum + a.outstandingBalance, 0);
  const totalOutstandingInterest = allocations.reduce((sum, a) => sum + a.outstandingInterest, 0);
  const availableToAllocate = loan.amount - totalAllocated;

  const isPresident = user?.role === "president";
  const isTreasurer = user?.role === "treasurer";

  const handleAllocate = async () => {
    if (!selectedMember || !allocateAmount) return;
    const amount = Number(allocateAmount);
    if (amount <= 0 || amount > availableToAllocate) {
      Alert.alert(t("error"), "Invalid amount");
      return;
    }
    await allocateBankLoanFunds(loan.id, [{ memberId: selectedMember, allocatedPrincipal: amount }]);
    setShowAllocateModal(false);
    setSelectedMember("");
    setAllocateAmount("");
  };

  const handleRepay = async () => {
    if (!showRepayModal || !repayAmount) return;
    const amount = Number(repayAmount);
    if (amount <= 0) {
      Alert.alert(t("error"), "Invalid amount");
      return;
    }
    await recordBankLoanRepayment(showRepayModal.id, { amount, remarks: "Repayment" });
    setShowRepayModal(null);
    setRepayAmount("");
  };

  const handleCloseLoan = async () => {
    if (totalOutstanding > 0 || totalOutstandingInterest > 0) {
      Alert.alert(t("error"), "Cannot close loan with outstanding balance.");
      return;
    }
    Alert.alert(
      t("confirm"),
      "Are you sure you want to close this bank loan?",
      [
        { text: t("cancel"), style: "cancel" },
        { text: "Close Loan", style: "destructive", onPress: async () => {
          await closeGroupBankLoan(loan.id);
          router.back();
        }}
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{t("bankLoanDetails")}</Text>
        {isPresident && loan.status === "active" && totalOutstanding === 0 && totalOutstandingInterest === 0 && (
          <Pressable onPress={handleCloseLoan} style={{ padding: 4 }}>
            <Ionicons name="checkmark-done" size={24} color={Colors.light.success} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.bankName}>{loan.bankName}</Text>
          <Text style={styles.subtext}>{loan.branch} {loan.accountNumber ? `• ${loan.accountNumber}` : ""}</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t("sanctionAmount")}</Text>
              <Text style={styles.statValue}>Rs. {loan.amount.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t("annualInterestRate")}</Text>
              <Text style={styles.statValue}>{loan.annualInterestRate}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t("totalAllocated")}</Text>
              <Text style={styles.statValue}>Rs. {totalAllocated.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t("availableToAllocate")}</Text>
              <Text style={[styles.statValue, { color: availableToAllocate > 0 ? Colors.light.success : Colors.light.text }]}>
                Rs. {availableToAllocate.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t("bankOutstanding")}</Text>
              <Text style={[styles.statValue, { color: Colors.light.danger }]}>
                Rs. {totalOutstanding.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("allocations") || "Allocations"}</Text>
          {isPresident && availableToAllocate > 0 && (
            <Pressable style={styles.actionButton} onPress={() => setShowAllocateModal(true)}>
              <Ionicons name="add" size={16} color={Colors.light.background} />
              <Text style={styles.actionText}>{t("allocateFunds")}</Text>
            </Pressable>
          )}
        </View>

        {allocations.length === 0 ? (
          <Text style={{ textAlign: "center", marginTop: 20, color: Colors.light.text + "80", fontFamily: "Poppins_400Regular" }}>
            {t("no_records") || "No records"}
          </Text>
        ) : (
          allocations.map((alloc) => {
            const member = groupMembers.find(m => m.id === alloc.memberId);
            const name = member ? member.name : "Unknown Member";
            return (
              <View key={alloc.id} style={styles.allocCard}>
                <View style={styles.allocHeader}>
                  <Text style={styles.allocName}>{name}</Text>
                  <Text style={styles.allocStatus}>{alloc.status}</Text>
                </View>
                <View style={styles.allocDetails}>
                  <View style={styles.allocDetail}>
                    <Text style={styles.allocLabel}>{t("allocatedAmount")}</Text>
                    <Text style={styles.allocVal}>Rs. {alloc.allocatedPrincipal.toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={styles.allocDetail}>
                    <Text style={styles.allocLabel}>{t("ledger_balance")}</Text>
                    <Text style={[styles.allocVal, { color: Colors.light.danger }]}>Rs. {alloc.outstandingBalance.toLocaleString("en-IN")}</Text>
                  </View>
                </View>
                
                {isTreasurer && alloc.status === "active" && (
                  <Pressable 
                    style={styles.repayButton}
                    onPress={() => setShowRepayModal({ id: alloc.id, name, due: alloc.outstandingBalance + alloc.outstandingInterest })}
                  >
                    <Text style={styles.repayText}>{t("bankRepayment")}</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Allocate Modal */}
      <Modal visible={showAllocateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("allocateFunds")}</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", marginBottom: 16 }}>Available: Rs. {availableToAllocate}</Text>
            
            <View style={{ marginBottom: 16 }}>
              {groupMembers.map(m => (
                <Pressable 
                  key={m.id} 
                  style={[styles.memberSelect, selectedMember === m.id && styles.memberSelected]}
                  onPress={() => setSelectedMember(m.id)}
                >
                  <Text style={{ fontFamily: "Poppins_500Medium", color: selectedMember === m.id ? Colors.light.primary : Colors.light.text }}>{m.name}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={allocateAmount}
              onChangeText={setAllocateAmount}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowAllocateModal(false)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={handleAllocate}>
                <Text style={styles.submitText}>{t("confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Repay Modal */}
      <Modal visible={!!showRepayModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("bankRepayment")}</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", marginBottom: 16, color: Colors.light.text }}>
              Member: {showRepayModal?.name}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Amount to repay"
              keyboardType="numeric"
              value={repayAmount}
              onChangeText={setRepayAmount}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowRepayModal(null)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={handleRepay}>
                <Text style={styles.submitText}>{t("confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  summaryCard: {
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  bankName: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  subtext: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text + "99", marginBottom: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  statBox: { width: "45%" },
  statLabel: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text + "99", marginBottom: 4 },
  statValue: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  actionButton: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4,
  },
  actionText: { color: Colors.light.background, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  allocCard: {
    backgroundColor: Colors.light.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.light.border, gap: 12
  },
  allocHeader: { flexDirection: "row", justifyContent: "space-between" },
  allocName: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  allocStatus: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.success },
  allocDetails: { flexDirection: "row", justifyContent: "space-between" },
  allocDetail: { flex: 1 },
  allocLabel: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text + "99" },
  allocVal: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  repayButton: {
    backgroundColor: Colors.light.primary + "15", padding: 10, borderRadius: 8, alignItems: "center", marginTop: 4
  },
  repayText: { color: Colors.light.primary, fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 24, width: "100%", maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", marginBottom: 8, color: Colors.light.text },
  input: {
    backgroundColor: Colors.light.background, borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 8, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 16, marginBottom: 16
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: { color: Colors.light.text + "99", fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  submitButton: { backgroundColor: Colors.light.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  submitText: { color: Colors.light.background, fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  memberSelect: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  memberSelected: { backgroundColor: Colors.light.primary + "15" },
});
