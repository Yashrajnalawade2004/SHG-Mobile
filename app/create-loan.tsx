import { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, getDurationRuleForAmount, validateLoanRequest } from "@/contexts/DataContext";
import { numberToMarathiWords } from "@/lib/numberToMarathiWords";
import Colors from "@/constants/colors";

export default function CreateLoanScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { verifyPassword } = useAuth();
  const { requestLoan, groupSettings } = useData();

  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [durationError, setDurationError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const numAmount = parseInt(amount) || 0;
  const numDuration = parseInt(duration) || 0;

  const applicableRule = useMemo(() => {
    if (numAmount <= 0) return null;
    return getDurationRuleForAmount(numAmount, groupSettings.durationRules);
  }, [numAmount, groupSettings.durationRules]);

  const durationHint = useMemo(() => {
    if (!applicableRule) return "";
    return language === "en"
      ? `${applicableRule.minDuration}–${applicableRule.maxDuration} months`
      : `${applicableRule.minDuration}–${applicableRule.maxDuration} महिने`;
  }, [applicableRule, language]);

  const validateFields = (): boolean => {
    let valid = true;
    setAmountError("");
    setDurationError("");

    if (!numAmount || numAmount <= 0) {
      setAmountError(t("invalidAmount"));
      valid = false;
    } else if (numAmount > groupSettings.maxLoanAmount) {
      setAmountError(t("exceedsMaxLoan") + ` (Max: Rs. ${groupSettings.maxLoanAmount.toLocaleString("en-IN")})`);
      valid = false;
    }

    if (!numDuration || numDuration <= 0) {
      setDurationError(t("auto.please_enter_a_valid_duration"));
      valid = false;
    } else if (applicableRule) {
      if (numDuration < applicableRule.minDuration) {
        setDurationError(t("durationTooShort") + ` (Min: ${applicableRule.minDuration})`);
        valid = false;
      } else if (numDuration > applicableRule.maxDuration) {
        setDurationError(t("durationTooLong") + ` (Max: ${applicableRule.maxDuration})`);
        valid = false;
      }
    }

    return valid;
  };

  const handleRequestPress = () => {
    if (!validateFields()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPassword("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setPasswordError(t("auto.please_enter_your_password"));
      return;
    }
    const isValid = await verifyPassword(password);
    if (!isValid) {
      setPasswordError(t("auto.incorrect_password"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setShowPasswordModal(false);
    setLoading(true);
    const error = await requestLoan({ amount: numAmount, duration: numDuration });
    setLoading(false);
    if (error) {
      Alert.alert(t("error"), t(error));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("requestLoan")}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.policyCard}>
          <View style={styles.policyRow}>
            <View style={styles.policyItem}>
              <Ionicons name="trending-up" size={18} color={Colors.light.secondary} />
              <Text style={styles.policyLabel}>{t("auto.interest")}</Text>
              <Text style={styles.policyValue}>{groupSettings.interestRate}%</Text>
            </View>
            <View style={styles.policyDivider} />
            <View style={styles.policyItem}>
              <Ionicons name="cash" size={18} color={Colors.light.primary} />
              <Text style={styles.policyLabel}>{t("auto.max_loan")}</Text>
              <Text style={styles.policyValue}>Rs. {groupSettings.maxLoanAmount.toLocaleString("en-IN")}</Text>
            </View>
          </View>
          <Text style={styles.policyNote}>
            <Ionicons name="information-circle" size={13} color={Colors.light.textMuted} />
            {" "}{t("autoInterest")}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t("loanAmount")} (Rs.) *</Text>
          <View style={[styles.inputContainer, !!amountError && styles.inputError]}>
            <Text style={styles.rupee}>Rs.</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.light.textMuted}
              value={amount}
              onChangeText={(v) => { setAmount(v); setAmountError(""); }}
              keyboardType="number-pad"
            />
          </View>
          {!!numberToMarathiWords(amount) && (
            <Text style={styles.amountInWords}>{numberToMarathiWords(amount)}</Text>
          )}
          {!!amountError && <Text style={styles.errorText}>{amountError}</Text>}

          <Text style={[styles.label, { marginTop: 12 }]}>{t("duration")} *</Text>
          <View style={[styles.inputContainer, !!durationError && styles.inputError]}>
            <Ionicons name="time-outline" size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.light.textMuted}
              value={duration}
              onChangeText={(v) => { setDuration(v); setDurationError(""); }}
              keyboardType="number-pad"
            />
            <Text style={styles.suffix}>{t("auto.months")}</Text>
          </View>
          {!!durationError && <Text style={styles.errorText}>{durationError}</Text>}

          {durationHint !== "" && !durationError && (
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.light.primary} />
              <Text style={styles.hintText}>
                {t("durationHint")}: {durationHint}
              </Text>
            </View>
          )}

          {groupSettings.durationRules.length > 0 && (
            <View style={styles.rulesCard}>
              <Text style={styles.rulesTitle}>{t("loanPolicy")}</Text>
              {[...groupSettings.durationRules]
                .sort((a, b) => a.maxAmount - b.maxAmount)
                .map((rule, i) => (
                  <View key={i} style={styles.ruleRow}>
                    <Ionicons name="ellipse" size={7} color={Colors.light.textMuted} style={{ marginTop: 5 }} />
                    <Text style={styles.ruleText}>
                      {language === "en"
                        ? `Up to Rs. ${rule.maxAmount.toLocaleString("en-IN")} → ${rule.minDuration}–${rule.maxDuration} months`
                        : `रु. ${rule.maxAmount.toLocaleString("en-IN")} पर्यंत → ${rule.minDuration}–${rule.maxDuration} महिने`}
                    </Text>
                  </View>
                ))}
            </View>
          )}

          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={16} color={Colors.light.secondary} />
            <Text style={styles.securityText}>
              {t("auto.password_verification_required_before_submitting")}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleRequestPress}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>{t("requestLoan")}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPasswordModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalIconWrapper}>
                <Ionicons name="shield-checkmark" size={32} color={Colors.light.secondary} />
              </View>
              <Text style={styles.modalTitle}>{t("auto.verify_identity")}</Text>
              <Text style={styles.modalSubtitle}>
                {t("auto.enter_your_password_to_confirm")}
              </Text>
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryText}>
                  {t("auto.amount")}: Rs. {numAmount.toLocaleString("en-IN")}
                  {"  ·  "}{t("auto.duration")}: {numDuration} {t("auto.mo")}
                  {"  ·  "}{t("auto.interest")}: {groupSettings.interestRate}%
                </Text>
              </View>
              <View style={styles.modalInputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("auto.enter_password")}
                  placeholderTextColor={Colors.light.textMuted}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(""); }}
                  secureTextEntry
                  autoFocus
                />
              </View>
              {!!passwordError && <Text style={styles.modalErrorText}>{passwordError}</Text>}
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setShowPasswordModal(false)}>
                  <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.modalConfirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={handlePasswordSubmit}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.modalConfirmText}>{t("confirm")}</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.light.text,
  },
  policyCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  policyItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  policyDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  policyLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  policyValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: Colors.light.text,
  },
  policyNote: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  form: { gap: 4 },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: Colors.light.danger,
  },
  inputIcon: { marginRight: 10 },
  rupee: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  suffix: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.danger,
    marginLeft: 4,
    marginTop: 4,
  },
  amountInWords: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.primary,
    marginLeft: 4,
    marginTop: 6,
    fontStyle: "italic",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4,
    marginTop: 4,
  },
  hintText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.primary,
  },
  rulesCard: {
    backgroundColor: Colors.light.primary + "08",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary + "20",
  },
  rulesTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: Colors.light.primary,
    marginBottom: 2,
  },
  ruleRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  ruleText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.text,
    flex: 1,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.secondary + "10",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  securityText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.secondary,
    flex: 1,
  },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  submitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.secondary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 12,
  },
  modalSummary: {
    backgroundColor: Colors.light.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    width: "100%",
  },
  modalSummaryText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.light.text,
    textAlign: "center",
  },
  modalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    width: "100%",
    gap: 10,
  },
  modalInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  modalErrorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.danger,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.light.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.light.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalConfirmText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
