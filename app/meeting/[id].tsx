import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isPresident } = useAuth();
  const { t, language } = useLanguage();
  const { meetings, updateMeeting, cancelMeeting, deleteMeeting, groupMembers } = useData();
  const meeting = meetings.find((m) => m.id === id);

  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(meeting?.scheduledDate || "");
  const [editAgenda, setEditAgenda] = useState(meeting?.agenda || "");
  const [editNotes, setEditNotes] = useState(meeting?.notes || "");
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!meeting) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.light.textMuted} />
        <Text style={styles.emptyText}>{t("auto.meeting_not_found")}</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!editDate.trim() || !editAgenda.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSaving(true);
      await updateMeeting(meeting.id, {
        scheduledDate: editDate.trim(),
        agenda: editAgenda.trim(),
        notes: editNotes.trim(),
      });
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMeeting = async () => {
    setDialog(null);
    setActionLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await cancelMeeting(meeting.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMeeting = async () => {
    setDialog(null);
    setActionLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await deleteMeeting(meeting.id);
      router.back();
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateMeeting(meeting.id, { status: "completed" });
  };

  const toggleAttendance = async (memberId: string) => {
    if (!isPresident) return;
    Haptics.selectionAsync();
    const current = meeting.attendance || [];
    const updated = current.includes(memberId)
      ? current.filter((a) => a !== memberId)
      : [...current, memberId];
    await updateMeeting(meeting.id, { attendance: updated });
  };

  const statusColor = meeting.status === "scheduled" ? Colors.light.primary :
    meeting.status === "completed" ? Colors.light.success : Colors.light.textMuted;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("meetingDetails")}</Text>
          {isPresident && meeting.status === "scheduled" && !editing ? (
            <Pressable onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={22} color={Colors.light.primary} />
            </Pressable>
          ) : editing ? (
            <Pressable onPress={() => setEditing(false)}>
              <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <View style={[styles.statusBanner, { backgroundColor: statusColor + "15" }]}>
          <Ionicons
            name={meeting.status === "scheduled" ? "time" : meeting.status === "completed" ? "checkmark-circle" : "close-circle"}
            size={20}
            color={statusColor}
          />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {meeting.status === "scheduled" ? t("scheduled") :
              meeting.status === "completed" ? t("completed") : t("meetingCancelled")}
          </Text>
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.fieldLabel}>{t("scheduledDate")}</Text>
            {Platform.OS === "web" ? (
              <View style={[styles.editInput, { paddingVertical: 0 }]}>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate((e.target as HTMLInputElement).value)}
                  style={{
                    width: "100%",
                    fontFamily: "Poppins_400Regular, sans-serif",
                    fontSize: 15,
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    color: Colors.light.text,
                    paddingTop: 14,
                    paddingBottom: 14,
                    cursor: "pointer",
                  } as React.CSSProperties}
                />
              </View>
            ) : (
              <TextInput
                style={styles.editInput}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.textMuted}
              />
            )}
            <Text style={styles.fieldLabel}>{t("agenda")}</Text>
            <TextInput
              style={[styles.editInput, { minHeight: 80 }]}
              value={editAgenda}
              onChangeText={setEditAgenda}
              multiline
            />
            <Text style={styles.fieldLabel}>{t("notes")}</Text>
            <TextInput
              style={[styles.editInput, { minHeight: 80 }]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
            />
            <Pressable style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t("save")}</Text>}
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={18} color={Colors.light.primary} />
                <Text style={styles.detailLabel}>{t("scheduledDate")}</Text>
                <Text style={styles.detailValue}>
                  {new Date(meeting.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.fieldLabel}>{t("agenda")}</Text>
              <Text style={styles.detailText}>{meeting.agenda}</Text>
            </View>

            {meeting.notes ? (
              <View style={styles.detailCard}>
                <Text style={styles.fieldLabel}>{t("notes")}</Text>
                <Text style={styles.detailText}>{meeting.notes}</Text>
              </View>
            ) : null}

            <View style={styles.detailCard}>
              <Text style={styles.fieldLabel}>{t("attendance")}</Text>
              {groupMembers.filter((m) => m.status === "active").map((member) => {
                const isPresent = meeting.attendance.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    style={styles.attendanceRow}
                    onPress={() => toggleAttendance(member.id)}
                    disabled={!isPresident}
                  >
                    <Ionicons
                      name={isPresent ? "checkbox" : "square-outline"}
                      size={22}
                      color={isPresent ? Colors.light.success : Colors.light.textMuted}
                    />
                    <Text style={styles.attendanceName}>{member.name}</Text>
                    {isPresent && <Ionicons name="checkmark" size={16} color={Colors.light.success} />}
                  </Pressable>
                );
              })}
            </View>

            {isPresident && (
              <View style={styles.actionRow}>
                {meeting.status === "scheduled" && (
                  <Pressable
                    style={styles.completeBtn}
                    onPress={handleComplete}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.completeBtnText}>{t("completed")}</Text>
                  </Pressable>
                )}
                {meeting.status === "scheduled" && (
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => setDialog("cancel")}
                    disabled={actionLoading}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.light.pending} />
                    <Text style={[styles.cancelBtnText, { color: Colors.light.pending }]}>
                      {t("cancelMeeting")}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => setDialog("delete")}
                  disabled={actionLoading}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.light.danger} />
                  <Text style={styles.deleteBtnText}>
                    {t("auto.delete_meeting")}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={dialog === "cancel"}
        title={t("auto.cancel_meeting")}
        message={t("auto.the_meeting_will_be_marked")}
        confirmText={t("auto.yes_cancel")}
        cancelText={t("auto.keep")}
        destructive={false}
        onConfirm={handleCancelMeeting}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        visible={dialog === "delete"}
        title={t("auto.delete_meeting_1")}
        message={t("auto.this_meeting_will_be_permanently")}
        confirmText={t("auto.delete")}
        cancelText={t("auto.keep")}
        destructive
        onConfirm={handleDeleteMeeting}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.light.text,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  detailCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  detailValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: "auto",
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  detailText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 22,
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  attendanceName: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.text,
  },
  editForm: { gap: 8 },
  editInput: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  actionRow: {
    gap: 10,
    marginTop: 8,
  },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.success,
    borderRadius: 14,
    paddingVertical: 14,
  },
  completeBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.pending + "12",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.pending + "40",
  },
  cancelBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.danger + "10",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.danger + "30",
  },
  deleteBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.danger,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
    marginTop: 12,
  },
});
