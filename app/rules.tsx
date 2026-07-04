import { useState, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  const { isPresident } = useAuth();
  const { t, language } = useLanguage();
  const { groupRules, updateGroupRules } = useData();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(groupRules);

  useEffect(() => {
    setEditText(groupRules);
  }, [groupRules]);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateGroupRules(editText);
    setEditing(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
          <Text style={styles.title}>{t("groupRules")}</Text>
          {isPresident && !editing && (
            <Pressable onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={22} color={Colors.light.primary} />
            </Pressable>
          )}
          {editing && (
            <Pressable onPress={() => { setEditing(false); setEditText(groupRules); }}>
              <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
            </Pressable>
          )}
          {!isPresident && <View style={{ width: 22 }} />}
        </View>

        {editing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              placeholder={t("settings.enter_group_rules")}
              placeholderTextColor={Colors.light.textMuted}
              textAlignVertical="top"
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleSave}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{t("save")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.rulesCard}>
            {groupRules ? (
              <Text style={styles.rulesText}>{groupRules}</Text>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={Colors.light.textMuted} />
                <Text style={styles.emptyText}>{t("noRulesSet")}</Text>
                {isPresident && (
                  <Pressable
                    style={styles.addRulesBtn}
                    onPress={() => setEditing(true)}
                  >
                    <Ionicons name="add" size={18} color={Colors.light.primary} />
                    <Text style={styles.addRulesText}>{t("editRules")}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {!isPresident && !groupRules && (
          <Text style={styles.presidentNote}>{t("presidentOnly")}</Text>
        )}
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
    marginBottom: 20,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  rulesCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 20,
    minHeight: 200,
  },
  rulesText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 24,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
  },
  addRulesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + "15",
    marginTop: 8,
  },
  addRulesText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.primary,
  },
  editContainer: { gap: 16 },
  editInput: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 20,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 24,
    minHeight: 300,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  saveBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  presidentNote: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
    textAlign: "center",
    marginTop: 16,
  },
});
