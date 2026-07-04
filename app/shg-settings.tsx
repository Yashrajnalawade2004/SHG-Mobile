// @ts-nocheck
import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Switch
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData, GroupSettings, DEFAULT_SETTINGS } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function ShgSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { group, isPresident } = useAuth();
  const { groupSettings, updateGroupSettings, updateGroupInfo } = useData();

  const [groupName, setGroupName] = useState(group?.name || "");
  const [village, setVillage] = useState(group?.village || "");
  const [taluka, setTaluka] = useState(group?.taluka || "");
  const [district, setDistrict] = useState(group?.district || "");
  const [prefLang, setPrefLang] = useState(group?.preferredLanguage || "mr");

  const [monthlyAmount, setMonthlyAmount] = useState(String(groupSettings.monthlyContributionAmount || 100));
  const [dueDay, setDueDay] = useState(String(groupSettings.contributionDueDay || 5));
  const [lateFee, setLateFee] = useState(String(groupSettings.lateFeeAmount || 10));
  const [lateFeeType, setLateFeeType] = useState<"fixed" | "percentage">(groupSettings.lateFeeType || "fixed");
  const [gracePeriod, setGracePeriod] = useState(String(groupSettings.gracePeriodDays || 5));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amount = parseInt(monthlyAmount);
    const dDay = parseInt(dueDay);
    const fee = parseInt(lateFee);
    const grace = parseInt(gracePeriod);

    if (!amount || amount <= 0) {
      Alert.alert(t("error"), "Please enter a valid monthly contribution amount");
      return;
    }
    if (!dDay || dDay < 1 || dDay > 28) {
      Alert.alert(t("error"), "Due day must be between 1 and 28");
      return;
    }
    if (!fee || fee < 0) {
      Alert.alert(t("error"), "Late fee must be 0 or greater");
      return;
    }
    if (!grace || grace < 0) {
      Alert.alert(t("error"), "Grace period must be 0 or greater");
      return;
    }

    if (!groupName.trim()) {
      Alert.alert(t("error"), "Group name is required");
      return;
    }
    setSaving(true);
    try {
      await updateGroupInfo({
        name: groupName.trim(),
        village: village.trim(),
        taluka: taluka.trim(),
        district: district.trim(),
        preferredLanguage: prefLang,
      });
    } catch(e) {
      setSaving(false);
      Alert.alert(t("error"), "Failed to update group information");
      return;
    }

    const newSettings: GroupSettings = {
      ...groupSettings,
      monthlyContributionAmount: amount,
      contributionDueDay: dDay,
      lateFeeAmount: fee,
      lateFeeType: lateFeeType,
      gracePeriodDays: grace
    };
    await updateGroupSettings(newSettings);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t("success"), t("settingsSaved"), [{ text: "OK", onPress: () => router.back() }]);
  };

  const handleReset = () => {
    Alert.alert(
      t("resetDefaults"),
      "Reset all contribution settings to defaults?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setMonthlyAmount(String(DEFAULT_SETTINGS.monthlyContributionAmount || 100));
            setDueDay(String(DEFAULT_SETTINGS.contributionDueDay || 5));
            setLateFee(String(DEFAULT_SETTINGS.lateFeeAmount || 10));
            setLateFeeType(DEFAULT_SETTINGS.lateFeeType || "fixed");
            setGracePeriod(String(DEFAULT_SETTINGS.gracePeriodDays || 5));
          },
        },
      ]
    );
  };

  if (!isPresident) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={48} color={Colors.light.textMuted} />
        <Text style={styles.accessDeniedText}>{t("presidentOnly")}</Text>
      </View>
    );
  }

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
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("settings.contribution_settings")}</Text>
          <Pressable onPress={handleReset}>
            <Ionicons name="refresh" size={22} color={Colors.light.textMuted} />
          </Pressable>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("superAdmin.shg_name")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="people-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput style={styles.input} value={groupName} onChangeText={setGroupName} placeholderTextColor={Colors.light.textMuted} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("village")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput style={styles.input} value={village} onChangeText={setVillage} placeholderTextColor={Colors.light.textMuted} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("superAdmin.taluka")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="map-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput style={styles.input} value={taluka} onChangeText={setTaluka} placeholderTextColor={Colors.light.textMuted} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("superAdmin.district")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="map" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholderTextColor={Colors.light.textMuted} />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="language-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <Pressable onPress={() => setPrefLang("mr")} style={[styles.input, { flex: 1, backgroundColor: prefLang === 'mr' ? Colors.light.primary : 'transparent', padding: 10, borderRadius: 8 }]}>
              <Text style={{ color: prefLang === 'mr' ? '#fff' : Colors.light.text, textAlign: 'center' }}>{t("auto.mr")}</Text>
            </Pressable>
            <Pressable onPress={() => setPrefLang("en")} style={[styles.input, { flex: 1, backgroundColor: prefLang === 'en' ? Colors.light.primary : 'transparent', padding: 10, borderRadius: 8 }]}>
              <Text style={{ color: prefLang === 'en' ? '#fff' : Colors.light.text, textAlign: 'center' }}>{t("auto.en")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.monthly_contribution")}</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.rupee}>Rs.</Text>
            <TextInput
              style={styles.input}
              value={monthlyAmount}
              onChangeText={setMonthlyAmount}
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor={Colors.light.textMuted}
            />
          </View>
          <Text style={styles.fieldHint}>
            Amount expected from each active member every month
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.contribution_due_day")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor={Colors.light.textMuted}
            />
            <Text style={styles.suffix}>{t("settings.th_of_month")}</Text>
          </View>
          <Text style={styles.fieldHint}>
            Day of the month when contributions are due (1-28)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.grace_period_days")}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="time-outline" size={20} color={Colors.light.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={gracePeriod}
              onChangeText={setGracePeriod}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor={Colors.light.textMuted}
            />
            <Text style={styles.suffix}>{t("settings.days")}</Text>
          </View>
          <Text style={styles.fieldHint}>
            Days allowed after due date before late fee is applied
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.late_fee_setup")}</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>{t("settings.fixed_amount")}</Text>
            <Switch
              value={lateFeeType === "percentage"}
              onValueChange={(val) => setLateFeeType(val ? "percentage" : "fixed")}
              trackColor={{ false: Colors.light.primary, true: Colors.light.secondary }}
            />
            <Text style={styles.toggleText}>{t("settings.percentage")}</Text>
          </View>
          
          <View style={[styles.inputContainer, { marginTop: 12 }]}>
            {lateFeeType === "fixed" && <Text style={styles.rupee}>Rs.</Text>}
            <TextInput
              style={styles.input}
              value={lateFee}
              onChangeText={setLateFee}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor={Colors.light.textMuted}
            />
            {lateFeeType === "percentage" && <Text style={styles.suffix}>{t("settings.percent_of_expected")}</Text>}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, { opacity: pressed || saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? t("saving") : t("save")}</Text>
        </Pressable>
      </ScrollView>
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
    marginBottom: 24,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: Colors.light.text,
  },
  rupee: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginRight: 8,
  },
  inputIcon: {
    marginRight: 10,
  },
  suffix: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  fieldHint: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  toggleText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  saveBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  accessDenied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  accessDeniedText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 16,
    textAlign: "center",
  },
});
