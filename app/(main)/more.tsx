// @ts-nocheck
import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, Image } from "react-native";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

function MenuItem({ icon, label, onPress, color, showArrow = true }: {
  icon: string; label: string; onPress: () => void; color?: string; showArrow?: boolean;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: (color || Colors.light.secondary) + "15" }]}>
        <Ionicons name={icon as any} size={20} color={color || Colors.light.secondary} />
      </View>
      <Text style={[styles.menuLabel, color ? { color } : {}]}>{label}</Text>
      {showArrow && <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />}
    </Pressable>
  );
}

function QrSection() {
  const { group, refreshSession } = useAuth();
  const { t, language } = useLanguage();
  const { uploadQrCode } = useData();
  const [uploading, setUploading] = useState(false);

  const handlePickQr = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("error"),
          t("auto.permission_to_access_photos_is"),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert(t("error"), t("common.could_not_read_image"));
        return;
      }
      setUploading(true);
      const mimeType = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mimeType};base64,${asset.base64}`;
      await uploadQrCode(dataUri);
      await refreshSession();
      Alert.alert(t("success"), t("qrCodeUploaded"));
    } catch (e) {
      Alert.alert(t("error"), t("common.failed_upload_qr"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveQr = () => {
    Alert.alert(
      t("confirm"),
      t("auto.remove_the_qr_code"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("removeQrCode"),
          style: "destructive",
          onPress: async () => {
            await uploadQrCode(null);
            await refreshSession();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("auto.qr_payment_code")}</Text>
      <View style={[styles.menuGroup, { padding: 16, gap: 12 }]}>
        <View style={styles.qrInfo}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.light.textMuted} />
          <Text style={styles.qrInfoText}>{t("qrCodeInfo")}</Text>
        </View>
        {group?.qrCode ? (
          <View style={styles.qrPreviewWrap}>
            <Image source={{ uri: group.qrCode }} style={styles.qrPreview} resizeMode="contain" />
            <View style={styles.qrPreviewActions}>
              <Pressable style={[styles.qrBtn, { backgroundColor: "#2563EB15" }]} onPress={handlePickQr} disabled={uploading}>
                <Ionicons name="refresh" size={16} color="#2563EB" />
                <Text style={[styles.qrBtnText, { color: "#2563EB" }]}>
                  {t("auto.replace")}
                </Text>
              </Pressable>
              <Pressable style={[styles.qrBtn, { backgroundColor: Colors.light.danger + "15" }]} onPress={handleRemoveQr}>
                <Ionicons name="trash-outline" size={16} color={Colors.light.danger} />
                <Text style={[styles.qrBtnText, { color: Colors.light.danger }]}>{t("removeQrCode")}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={[styles.uploadQrBtn, uploading && { opacity: 0.6 }]}
            onPress={handlePickQr}
            disabled={uploading}
          >
            <Ionicons name="qr-code-outline" size={24} color="#2563EB" />
            <Text style={styles.uploadQrBtnText}>
              {uploading
                ? (t("auto.uploading"))
                : t("uploadQrCode")}
            </Text>
            <Text style={styles.noQrText}>{t("noQrCode")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, group, logout, isPresident, isTreasurer } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const roleLabel = isPresident ? t("president") : isTreasurer ? t("treasurer") : t("member");
  const roleIcon = isPresident ? "shield" : isTreasurer ? "wallet" : "person";
  const roleColor = isPresident ? Colors.light.primary : isTreasurer ? "#D97706" : Colors.light.secondary;

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <Text style={styles.title}>{t("more")}</Text>

      <View style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: roleColor }]}>
          <Ionicons name={roleIcon as any} size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={styles.roleRow}>
            <View style={[styles.rolePill, { backgroundColor: roleColor + "20" }]}>
              <Ionicons name={roleIcon as any} size={11} color={roleColor} />
              <Text style={[styles.profileRole, { color: roleColor }]}>{roleLabel}</Text>
            </View>
          </View>
          {group && <Text style={styles.profileGroup}>{group.name}</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("auto.group")}</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="people" label={t("members")} onPress={() => router.push("/members")} />
          <MenuItem icon="document-text" label={t("groupRules")} onPress={() => router.push("/rules")} />
          <MenuItem icon="cash" label={t("loans")} onPress={() => router.push("/loans")} />
          <MenuItem
            icon="time"
            label={t("auto.history")}
            onPress={() => router.push("/history")}
            color={Colors.light.primary}
          />
          {isPresident && (
            <>
              <MenuItem
                icon="options"
                label={t("auto.shg_settings")}
                onPress={() => router.push("/shg-settings")}
                color={Colors.light.secondary}
              />
              <MenuItem
                icon="settings"
                label={t("auto.loan_settings")}
                onPress={() => router.push("/loan-settings")}
                color={Colors.light.secondary}
              />
              <MenuItem
                icon="document-text"
                label={t("auto.group_reports")}
                onPress={() => router.push("/reports")}
                color={Colors.light.success}
              />
            </>
          )}
        </View>
      </View>

      {(isTreasurer || isPresident) && <QrSection />}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("language")}</Text>
        <View style={styles.menuGroup}>
          <Pressable
            style={styles.langRow}
            onPress={() => { Haptics.selectionAsync(); setLanguage(t("auto.mr")); }}
          >
            <View style={[styles.menuIcon, { backgroundColor: Colors.light.primary + "15" }]}>
              <Ionicons name="language" size={20} color={Colors.light.primary} />
            </View>
            <Text style={styles.menuLabel}>{t("auto.english")}</Text>
            <View style={styles.langSwitch}>
              <View style={[styles.langOption, language === "en" && styles.langOptionActive]}>
                <Text style={[styles.langOptionText, language === "en" && styles.langOptionTextActive]}>EN</Text>
              </View>
              <View style={[styles.langOption, language === "mr" && styles.langOptionActive]}>
                <Text style={[styles.langOptionText, language === "mr" && styles.langOptionTextActive]}>MR</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="log-out-outline"
            label={t("logout")}
            onPress={handleLogout}
            color={Colors.light.danger}
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Group ID: {user?.groupId}</Text>
        <Text style={styles.infoLabel}>{t("common.app_version")}</Text>
      </View>

      <ConfirmDialog
        visible={showLogoutDialog}
        title={t("logout")}
        message={t("auto.are_you_sure_you_want")}
        confirmText={t("logout")}
        cancelText={t("cancel")}
        destructive
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 20, gap: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 26, color: Colors.light.text },
  profileCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.card, borderRadius: 16,
    padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.light.border,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
  },
  profileName: { fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.light.text },
  roleRow: { flexDirection: "row", alignItems: "center", marginTop: 2, marginBottom: 2 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  profileRole: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  profileGroup: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  section: { gap: 6 },
  sectionLabel: {
    fontFamily: "Poppins_600SemiBold", fontSize: 12,
    color: Colors.light.textMuted, textTransform: "uppercase",
    letterSpacing: 0.8, paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: Colors.light.card, borderRadius: 14,
    overflow: "hidden", borderWidth: 1, borderColor: Colors.light.border,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.border,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  menuLabel: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 15, color: Colors.light.text },
  qrInfo: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  qrInfoText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textMuted, flex: 1 },
  qrPreviewWrap: { alignItems: "center", gap: 10 },
  qrPreview: { width: 160, height: 160, borderRadius: 12, backgroundColor: "#f5f5f5" },
  qrPreviewActions: { flexDirection: "row", gap: 10, width: "100%" },
  qrBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  qrBtnText: { fontFamily: "Poppins_500Medium", fontSize: 13 },
  uploadQrBtn: {
    alignItems: "center", gap: 8, paddingVertical: 20,
    borderWidth: 1.5, borderColor: "#3B82F640",
    borderStyle: "dashed", borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  uploadQrBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#2563EB" },
  noQrText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textMuted },
  langRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  langSwitch: { flexDirection: "row", backgroundColor: Colors.light.inputBg, borderRadius: 8, overflow: "hidden" },
  langOption: { paddingHorizontal: 14, paddingVertical: 6 },
  langOptionActive: { backgroundColor: Colors.light.primary, borderRadius: 8 },
  langOptionText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.light.textSecondary },
  langOptionTextActive: { color: "#fff" },
  infoSection: { paddingTop: 4, gap: 4, alignItems: "center" },
  infoLabel: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.light.textMuted, textAlign: "center" },
});
