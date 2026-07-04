import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  TextInput, Alert, RefreshControl, Modal, Image, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, Payment, PaymentStatus } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import ConfirmDialog from "@/components/ConfirmDialog";

function paymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case "confirmed": return Colors.light.success;
    case "rejected": return Colors.light.danger;
    case "payment_not_received": return Colors.light.danger;
    case "pending_verification": return "#D97706";
    case "pending": return Colors.light.pending;
    default: return Colors.light.pending;
  }
}

function ModeBadge({ mode }: { mode: "cash" | "online" }) {
  const { t } = useLanguage();
  const isOnline = mode === "online";
  return (
    <View style={[styles.modeBadge, { backgroundColor: isOnline ? "#3B82F620" : Colors.light.success + "20" }]}>
      <Ionicons
        name={isOnline ? "phone-portrait-outline" : "cash-outline"}
        size={10}
        color={isOnline ? "#2563EB" : Colors.light.success}
      />
      <Text style={[styles.modeBadgeText, { color: isOnline ? "#2563EB" : Colors.light.success }]}>
        {t(mode)}
      </Text>
    </View>
  );
}

function PaymentItem({
  payment, canVerifyCash, canVerifyOnline, canDelete, onVerify, onDelete,
}: {
  payment: Payment;
  canVerifyCash: boolean;
  canVerifyOnline: boolean;
  canDelete: boolean;
  onVerify: (id: string, status: PaymentStatus) => void;
  onDelete: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const statusColor = paymentStatusColor(payment.status);
  const canAct =
    (payment.mode === "cash" && canVerifyCash && payment.status === "pending") ||
    (payment.mode === "online" && canVerifyOnline && payment.status === "pending_verification");

  return (
    <View style={[styles.paymentCard, payment.mode === "online" && styles.onlineCard]}>
      <View style={styles.paymentHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentName}>{payment.memberName}</Text>
          <Text style={styles.paymentDate}>
            {new Date(payment.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={styles.paymentAmount}>Rs. {payment.amount.toLocaleString("en-IN")}</Text>
          <ModeBadge mode={payment.mode} />
          <Text style={[styles.paymentStatus, { color: statusColor }]}>
            {t(payment.status)}
          </Text>
        </View>
      </View>
      {canAct && (
        <View style={styles.actionRow}>
          {payment.mode === "cash" ? (
            <>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.light.success + "15" }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVerify(payment.id, "confirmed"); }}
              >
                <Ionicons name="checkmark" size={18} color={Colors.light.success} />
                <Text style={[styles.actionText, { color: Colors.light.success }]}>{t("verify")}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.light.danger + "15" }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVerify(payment.id, "rejected"); }}
              >
                <Ionicons name="close" size={18} color={Colors.light.danger} />
                <Text style={[styles.actionText, { color: Colors.light.danger }]}>{t("reject")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.light.success + "15" }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVerify(payment.id, "confirmed"); }}
              >
                <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
                <Text style={[styles.actionText, { color: Colors.light.success }]}>{t("paymentReceived")}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.light.danger + "15" }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVerify(payment.id, "payment_not_received"); }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.light.danger} />
                <Text style={[styles.actionText, { color: Colors.light.danger }]}>{t("paymentNotReceived")}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      {canDelete && (
        <Pressable
          style={styles.deletePaymentBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete(payment.id); }}
        >
          <Ionicons name="trash-outline" size={14} color={Colors.light.danger} />
          <Text style={styles.deletePaymentText}>{t("auto.delete")}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const { isPresident, isTreasurer, group } = useAuth();
  const { t, language } = useLanguage();
  const { payments, declarePayment, verifyPayment, deletePayment, refreshData } = useData();
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const [showInput, setShowInput] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "mode" | "qr">("amount");
  const [refreshing, setRefreshing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const handleAmountNext = () => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert(t("error"), t("validation.enter_valid_amount"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("mode");
  };

  const handleSelectMode = async (mode: "cash" | "online") => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount <= 0) return;
    if (mode === "online") {
      if (!group?.qrCode) {
        Alert.alert(
          t("error"),
          t("auto.no_qr_code_available_contact"),
        );
        return;
      }
      setStep("qr");
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await declarePayment(numAmount, "cash");
      resetForm();
    }
  };

  const handleConfirmOnlinePayment = async () => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await declarePayment(numAmount, "online");
    resetForm();
  };

  const resetForm = () => {
    setAmount("");
    setStep("amount");
    setShowInput(false);
  };

  const handleVerify = async (id: string, status: PaymentStatus) => {
    await verifyPayment(id, status);
  };

  const handleConfirmDelete = async () => {
    if (!deletePaymentId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deletePayment(deletePaymentId);
    setDeletePaymentId(null);
  };

  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const pendingCashCount = payments.filter((p) => p.status === "pending" && p.mode === "cash").length;
  const pendingOnlineCount = payments.filter((p) => p.status === "pending_verification" && p.mode === "online").length;
  const canVerifyCash = isPresident || isTreasurer;
  const canVerifyOnline = isTreasurer || isPresident;
  const canDeclare = !isTreasurer;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12 }]}>
        <View>
          <Text style={styles.title}>{t("payments")}</Text>
          {pendingCashCount + pendingOnlineCount > 0 && (
            <Text style={styles.pendingText}>
              {pendingCashCount + pendingOnlineCount} {t("pending")}
              {pendingOnlineCount > 0 ? ` (${pendingOnlineCount} online)` : ""}
            </Text>
          )}
        </View>
        {canDeclare && (
          <Pressable
            style={styles.declareBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (showInput) { resetForm(); } else { setShowInput(true); }
            }}
          >
            <Ionicons name={showInput ? "close" : "add"} size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      {showInput && step === "amount" && (
        <View style={styles.inputBar}>
          <View style={styles.inputContainer}>
            <Text style={styles.rupeeSign}>Rs.</Text>
            <TextInput
              style={styles.amountInput}
              placeholder={t("amount")}
              placeholderTextColor={Colors.light.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              autoFocus
            />
          </View>
          <Pressable style={styles.submitBtn} onPress={handleAmountNext}>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </Pressable>
        </View>
      )}

      {showInput && step === "mode" && (
        <View style={styles.modeBar}>
          <Text style={styles.modeTitle}>{t("selectPaymentMode")} — Rs. {parseInt(amount).toLocaleString("en-IN")}</Text>
          <View style={styles.modeButtons}>
            <Pressable style={[styles.modeBtn, styles.modeBtnCash]} onPress={() => handleSelectMode("cash")}>
              <Ionicons name="cash-outline" size={22} color={Colors.light.success} />
              <Text style={[styles.modeBtnText, { color: Colors.light.success }]}>{t("cash")}</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn, styles.modeBtnOnline]} onPress={() => handleSelectMode("online")}>
              <Ionicons name="qr-code-outline" size={22} color="#2563EB" />
              <Text style={[styles.modeBtnText, { color: "#2563EB" }]}>{t("online")}</Text>
            </Pressable>
          </View>
          <Pressable onPress={resetForm} style={styles.cancelModeBtn}>
            <Text style={styles.cancelModeText}>{t("cancel")}</Text>
          </Pressable>
        </View>
      )}

      {showInput && step === "qr" && (
        <View style={styles.qrBar}>
          <View style={styles.qrBarHeader}>
            <Ionicons name="qr-code" size={20} color="#2563EB" />
            <Text style={styles.qrBarTitle}>{t("scanAndPay")} — Rs. {parseInt(amount).toLocaleString("en-IN")}</Text>
          </View>
          {group?.qrCode ? (
            <Pressable onPress={() => setShowQrModal(true)}>
              <Image
                source={{ uri: group.qrCode }}
                style={styles.qrPreview}
                resizeMode="contain"
              />
              <Text style={styles.qrTapHint}>{t("auto.tap_to_enlarge")}</Text>
            </Pressable>
          ) : null}
          <View style={styles.qrActions}>
            <Pressable style={styles.qrCancelBtn} onPress={() => setStep("mode")}>
              <Text style={styles.qrCancelText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable style={styles.qrConfirmBtn} onPress={handleConfirmOnlinePayment}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.qrConfirmText}>
                {t("auto.i_have_paid")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={sortedPayments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PaymentItem
            payment={item}
            canVerifyCash={canVerifyCash}
            canVerifyOnline={canVerifyOnline}
            canDelete={isPresident}
            onVerify={handleVerify}
            onDelete={setDeletePaymentId}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyText}>{t("noPayments")}</Text>
          </View>
        }
        scrollEnabled={sortedPayments.length > 0}
      />

      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <Pressable style={styles.qrModalOverlay} onPress={() => setShowQrModal(false)}>
          <View style={styles.qrModalContent}>
            {group?.qrCode && (
              <Image source={{ uri: group.qrCode }} style={styles.qrModalImage} resizeMode="contain" />
            )}
            <Text style={styles.qrModalClose}>{t("auto.tap_anywhere_to_close")}</Text>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={deletePaymentId !== null}
        title={t("auto.delete_payment")}
        message={t("auto.this_payment_record_will_be")}
        confirmText={t("auto.delete")}
        cancelText={t("cancel")}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletePaymentId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.light.text },
  pendingText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.light.pending },
  declareBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: "center", alignItems: "center",
  },
  inputBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12, gap: 10,
  },
  inputContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 14,
  },
  rupeeSign: {
    fontFamily: "Poppins_600SemiBold", fontSize: 16,
    color: Colors.light.textSecondary, marginRight: 6,
  },
  amountInput: {
    flex: 1, fontFamily: "Poppins_500Medium", fontSize: 16,
    color: Colors.light.text, paddingVertical: 14,
  },
  submitBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: "center", alignItems: "center",
  },
  modeBar: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.light.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.light.border, gap: 12,
  },
  modeTitle: {
    fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.light.text,
  },
  modeButtons: { flexDirection: "row", gap: 10 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5,
  },
  modeBtnCash: {
    borderColor: Colors.light.success + "50",
    backgroundColor: Colors.light.success + "10",
  },
  modeBtnOnline: {
    borderColor: "#3B82F650",
    backgroundColor: "#3B82F610",
  },
  modeBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  cancelModeBtn: { alignItems: "center", paddingVertical: 4 },
  cancelModeText: {
    fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.light.textMuted,
  },
  qrBar: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.light.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: "#3B82F630", gap: 12,
    alignItems: "center",
  },
  qrBarHeader: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  qrBarTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.light.text },
  qrPreview: { width: 180, height: 180, borderRadius: 12 },
  qrTapHint: {
    fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.light.textMuted,
    textAlign: "center", marginTop: 4,
  },
  qrActions: { flexDirection: "row", gap: 10, width: "100%" },
  qrCancelBtn: {
    flex: 1, backgroundColor: Colors.light.inputBg,
    borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  qrCancelText: {
    fontFamily: "Poppins_500Medium", fontSize: 14, color: Colors.light.textSecondary,
  },
  qrConfirmBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 13,
  },
  qrConfirmText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#fff" },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  paymentCard: {
    backgroundColor: Colors.light.card, borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.light.border,
  },
  onlineCard: { borderColor: "#3B82F630", backgroundColor: "#EFF6FF" },
  paymentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  paymentName: { fontFamily: "Poppins_500Medium", fontSize: 14, color: Colors.light.text },
  paymentDate: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  paymentAmount: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.light.text },
  modeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  modeBadgeText: { fontFamily: "Poppins_500Medium", fontSize: 10 },
  paymentStatus: { fontFamily: "Poppins_500Medium", fontSize: 11 },
  actionRow: {
    flexDirection: "row", gap: 10, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  actionText: { fontFamily: "Poppins_500Medium", fontSize: 12 },
  deletePaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  deletePaymentText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.danger,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
  emptyText: { fontFamily: "Poppins_500Medium", fontSize: 15, color: Colors.light.textMuted },
  qrModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center", alignItems: "center",
  },
  qrModalContent: { alignItems: "center", gap: 16 },
  qrModalImage: { width: 280, height: 280, borderRadius: 16, backgroundColor: "#fff" },
  qrModalClose: {
    fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.6)",
  },
});
