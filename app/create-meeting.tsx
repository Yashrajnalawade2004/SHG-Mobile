import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

function WebDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      style={{
        flex: 1,
        fontFamily: "Poppins_400Regular, sans-serif",
        fontSize: 15,
        border: "none",
        outline: "none",
        backgroundColor: "transparent",
        color: Colors.light.text,
        paddingTop: 14,
        paddingBottom: 14,
        width: "100%",
        cursor: "pointer",
      } as React.CSSProperties}
    />
  );
}

export default function CreateMeetingScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { createMeeting } = useData();
  const [scheduledDate, setScheduledDate] = useState("");
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!scheduledDate.trim() || !agenda.trim()) {
      Alert.alert(t("error"), t("validation.fill_date_agenda"));
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduledDate.trim())) {
      Alert.alert(t("error"), t("validation.select_valid_date"));
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      await createMeeting({ scheduledDate: scheduledDate.trim(), agenda: agenda.trim(), notes: notes.trim() });
      router.back();
    } catch (e: any) {
      Alert.alert(
        t("error"),
        language === "en"
          ? (e?.message || "Failed to create meeting. Please try again.")
          : (e?.message || "बैठक तयार करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा."),
      );
    } finally {
      setLoading(false);
    }
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
            <Ionicons name="close" size={26} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("createMeeting")}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t("scheduledDate")} *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
            {Platform.OS === "web" ? (
              <WebDateInput value={scheduledDate} onChange={setScheduledDate} />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.textMuted}
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />
            )}
          </View>

          <Text style={styles.label}>{t("agenda")} *</Text>
          <View style={[styles.inputContainer, { alignItems: "flex-start" }]}>
            <Ionicons name="document-text-outline" size={20} color={Colors.light.textSecondary} style={[styles.inputIcon, { marginTop: 14 }]} />
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder={t("auto.meeting_agenda")}
              placeholderTextColor={Colors.light.textMuted}
              value={agenda}
              onChangeText={setAgenda}
              multiline
            />
          </View>

          <Text style={styles.label}>{t("notes")}</Text>
          <View style={[styles.inputContainer, { alignItems: "flex-start" }]}>
            <Ionicons name="create-outline" size={20} color={Colors.light.textSecondary} style={[styles.inputIcon, { marginTop: 14 }]} />
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder={t("auto.additional_notes")}
              placeholderTextColor={Colors.light.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.createBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>{t("createMeeting")}</Text>
            )}
          </Pressable>
        </View>
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
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.light.text,
  },
  form: { gap: 8 },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 8,
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
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  createBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  createBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
});
