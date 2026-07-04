// @ts-nocheck
import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Colors from "@/constants/colors";

type Role = "president" | "member";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { registerPresident, registerMember } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [role, setRole] = useState<Role>("member");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [village, setVillage] = useState("");
  const [taluka, setTaluka] = useState("");
  const [district, setDistrict] = useState("");

  const [uniqueGroupCode, setUniqueGroupCode] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !password.trim() || !village.trim()) {
      Keyboard.dismiss();
      Alert.alert(t("error"), t("validation.fill_all_fields"));
      return;
    }
    if (role === "president" && !uniqueGroupCode.trim()) {
      Keyboard.dismiss();
      Alert.alert(t("error"), t("validation.enter_group_code"));
      return;
    }
    if (role === "member" && !invitationCode.trim()) {
      Keyboard.dismiss();
      Alert.alert(t("error"), t("validation.enter_invite_code"));
      return;
    }
    if (phone.trim().length !== 10) {
      Keyboard.dismiss();
      Alert.alert(t("error"), t("validation.phone_10_digits"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    const baseData = {
      name: name.trim(),
      phone: phone.trim(),
      password,
      village: village.trim(),
      taluka: taluka.trim(),
      district: district.trim(),
      joinDate: new Date().toISOString().split("T")[0],
      exitDate: exitDate.trim() || undefined,
    };

    let result;
    if (role === "president") {
      result = await registerPresident({ ...baseData, uniqueGroupCode: uniqueGroupCode.trim() });
    } else {
      result = await registerMember({ ...baseData, uniqueGroupCode: uniqueGroupCode.trim() });
    }

    setLoading(false);
    if (result.success) {
      router.replace("/(main)");
    } else {
      Keyboard.dismiss();
      Alert.alert(t("error"), t(result.error || "error"));
    }
  };

  const InputField = ({ icon, placeholder, value, onChangeText, keyboardType, secure, maxLength }: any) => (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || "default"}
        secureTextEntry={secure}
        autoCapitalize={secure ? "none" : "words"}
        maxLength={maxLength}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Pressable
            style={styles.langToggle}
            onPress={() => setLanguage(t("auto.mr"))}
          >
            <Ionicons name="language" size={16} color={Colors.light.primary} />
            <Text style={styles.langText}>{t("auto.empty")}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t("register")}</Text>
        <Text style={styles.subtitle}>{t("registerAs")}</Text>

        <View style={styles.roleSelector}>
          <Pressable
            style={[styles.roleBtn, role === "member" && styles.roleBtnActive]}
            onPress={() => { setRole("member"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="person" size={20} color={role === "member" ? "#fff" : Colors.light.textSecondary} />
            <Text style={[styles.roleText, role === "member" && styles.roleTextActive]}>{t("member")}</Text>
          </Pressable>
          <Pressable
            style={[styles.roleBtn, role === "president" && styles.roleBtnActive]}
            onPress={() => { setRole("president"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="shield" size={20} color={role === "president" ? "#fff" : Colors.light.textSecondary} />
            <Text style={[styles.roleText, role === "president" && styles.roleTextActive]}>{t("president")}</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <InputField icon="person-outline" placeholder={t("name")} value={name} onChangeText={setName} />
          <InputField icon="call-outline" placeholder={t("phone")} value={phone} onChangeText={(text: string) => setPhone(text.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" maxLength={10} />
          <InputField icon="lock-closed-outline" placeholder={t("password")} value={password} onChangeText={setPassword} secure />
          <InputField icon="location-outline" placeholder={t("village")} value={village} onChangeText={setVillage} />
          {role === "president" && (
            <>
              <InputField icon="map-outline" placeholder={t("taluka")} value={taluka} onChangeText={setTaluka} />
              <InputField icon="map" placeholder={t("district")} value={district} onChangeText={setDistrict} />
            </>
          )}

          <InputField icon="key-outline" placeholder={t("auto.group_code_e_g_shg")} value={uniqueGroupCode} onChangeText={setUniqueGroupCode} autoCapitalize="characters" />

          <InputField
            icon="calendar-outline"
            placeholder={t("exitDate") + " (YYYY-MM-DD)"}
            value={exitDate}
            onChangeText={setExitDate}
          />

          <Pressable
            style={({ pressed }) => [styles.registerBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>{t("register")}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("alreadyHaveAccount")}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}>{t("login")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: { padding: 4 },
  langToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  langText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.light.primary,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 26,
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roleBtnActive: {
    backgroundColor: Colors.light.secondary,
    borderColor: Colors.light.secondary,
  },
  roleText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  roleTextActive: {
    color: "#fff",
  },
  form: { gap: 12 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  registerBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  registerBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  footerLink: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.primary,
  },
});
