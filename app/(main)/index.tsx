import { View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useState, useCallback, useRef, useEffect } from "react";
import { processVoiceCommand, isSpeechRecognitionSupported, classifyIntent, type NLPResult } from "@/lib/nlpHandler";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

function StatCard({ icon, label, value, color, onPress }: { icon: string; label: string; value: string | number; color: string; onPress?: () => void }) {
  return (
    <Pressable style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.statCardHeader}>
        <Ionicons name={icon as any} size={22} color={color} />
        {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

type MicState = "idle" | "listening" | "processing" | "result" | "error";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, group, isPresident } = useAuth();
  const { t, language } = useLanguage();
  const { meetings, payments, loans, groupMembers, refreshData, groupSummary } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const [micState, setMicState] = useState<MicState>("idle");
  const [transcript, setTranscript] = useState("");
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStateRef = useRef<MicState>("idle");

  useEffect(() => {
    micStateRef.current = micState;
  }, [micState]);

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  useEffect(() => {
    if (micState === "listening") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        ])
      ).start();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      if (micState === "result" || micState === "error") {
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      } else if (micState === "idle") {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      }
    }
  }, [micState]);

  const finishWithResult = useCallback(async (text: string) => {
    setTranscript(text);
    setNlpResult(null);
    setErrorMsg("");
    setMicState("processing");
    try {
      const result = await classifyIntent(text);
      setNlpResult(result);
      setMicState("result");
      if (result.route) {
        resultTimer.current = setTimeout(() => {
          setMicState("idle");
          router.push(result.route as any);
        }, 2200);
      } else {
        resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || (t("dashboard.something_went_wrong")));
      setMicState("error");
      resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
    }
  }, [language]);

  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "web") return;
    const text = event.results?.[0]?.transcript ?? "";
    if (text) {
      micStateRef.current = "processing";
      finishWithResult(text);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (Platform.OS === "web") return;
    const msg = event.message || event.error || (t("dashboard.something_went_wrong"));
    setErrorMsg(
      event.error === "no-speech"
        ? (t("dashboard.no_speech_detected"))
        : event.error === "not-allowed"
        ? (t("dashboard.mic_denied"))
        : msg
    );
    setMicState("error");
    resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
  });

  useSpeechRecognitionEvent("end", () => {
    if (Platform.OS === "web") return;
    if (micStateRef.current === "listening") {
      setErrorMsg(t("dashboard.no_speech_detected"));
      setMicState("error");
      resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
    }
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const handleMicPress = async () => {
    if (micState === "listening" || micState === "processing") return;

    if (Platform.OS !== "web") {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setErrorMsg(t("dashboard.mic_denied"));
        setMicState("error");
        resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
        return;
      }
      if (resultTimer.current) clearTimeout(resultTimer.current);
      setTranscript("");
      setNlpResult(null);
      setErrorMsg("");
      setMicState("listening");
      const speechLang = language === "mr" ? "mr-IN" : "en-IN";
      console.log("[SpeechRecognition] start called with lang:", speechLang);
      ExpoSpeechRecognitionModule.start({
        lang: speechLang,
        interimResults: false,
        continuous: false,
      });
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setErrorMsg(language === "mr"
        ? "हे फीचर Chrome browser मध्येच काम करते."
        : "Voice input only works in Chrome browser.");
      setMicState("error");
      resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
      return;
    }

    if (resultTimer.current) clearTimeout(resultTimer.current);
    setTranscript("");
    setNlpResult(null);
    setErrorMsg("");
    setMicState("listening");

    try {
      const { transcript: t, result } = await processVoiceCommand(language);
      setTranscript(t);
      setNlpResult(result);
      setMicState("result");
      if (result.route) {
        resultTimer.current = setTimeout(() => {
          setMicState("idle");
          router.push(result.route as any);
        }, 2200);
      } else {
        resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || (t("dashboard.something_went_wrong")));
      setMicState("error");
      resultTimer.current = setTimeout(() => setMicState("idle"), 4000);
    }
  };

  const upcomingMeetings = meetings
    .filter((m) => m.status === "scheduled" && new Date(m.scheduledDate) >= new Date())
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const pendingPayments = payments.filter((p) => p.status === "pending");
  const activeLoans = loans.filter((l) => l.status === "approved" && l.remainingBalance > 0);
  const activeMembers = groupMembers.filter((m) => m.status === "active");

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  type ActivityItem = {
    id: string;
    type: "payment" | "loan" | "meeting";
    date: string;
    title: string;
    subtitle: string;
    amount?: string;
    statusColor: string;
    statusLabel: string;
    icon: string;
    routeTo?: { pathname: string; params?: Record<string, string> };
  };

  const myPayments = isPresident ? payments : payments.filter((p) => p.memberId === user?.id);
  const myLoans = isPresident ? loans : loans.filter((l) => l.memberId === user?.id);

  const recentActivity: ActivityItem[] = [
    ...myPayments.map((p): ActivityItem => ({
      id: "p_" + p.id,
      type: "payment",
      date: p.date,
      title: p.memberName,
      subtitle: formatDate(p.date),
      amount: "Rs. " + p.amount,
      statusColor: p.status === "confirmed" ? Colors.light.success : p.status === "pending" ? Colors.light.pending : Colors.light.danger,
      statusLabel: t(p.status),
      icon: "wallet",
    })),
    ...myLoans.map((l): ActivityItem => ({
      id: "l_" + l.id,
      type: "loan",
      date: l.createdAt,
      title: l.memberName,
      subtitle: formatDate(l.createdAt),
      amount: "Rs. " + l.amount,
      statusColor: l.status === "approved" ? Colors.light.success : (l.status === "rejected" || l.status === "treasurer_rejected") ? Colors.light.danger : l.status === "pending_treasurer" ? "#D97706" : Colors.light.pending,
      statusLabel: t(l.status),
      icon: "cash",
      routeTo: { pathname: "/loan/[id]", params: { id: l.id } },
    })),
    ...meetings.slice().reverse().map((m): ActivityItem => ({
      id: "m_" + m.id,
      type: "meeting",
      date: m.scheduledDate,
      title: m.agenda || (t("meetings")),
      subtitle: formatDate(m.scheduledDate),
      statusColor: m.status === "completed" ? Colors.light.success : m.status === "scheduled" ? Colors.light.primary : Colors.light.textMuted,
      statusLabel: m.status === "completed" ? t("completed") : m.status === "scheduled" ? t("scheduled") : t("meetingCancelled"),
      icon: "calendar",
      routeTo: { pathname: "/meeting/[id]", params: { id: m.id } },
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const micColors: Record<MicState, string> = {
    idle: Colors.light.primary,
    listening: "#E53935",
    processing: Colors.light.secondary,
    result: Colors.light.success,
    error: Colors.light.danger,
  };

  const micIcons: Record<MicState, string> = {
    idle: "mic",
    listening: "mic",
    processing: "sync",
    result: "checkmark",
    error: "close",
  };

  const overlayReply = nlpResult
    ? (language === "mr" ? nlpResult.replyMr : nlpResult.replyEn)
    : errorMsg;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 16,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t("welcome")},</Text>
            <Text style={styles.userName}>{user?.name}</Text>
            {group && <Text style={styles.groupName}>{group.name}</Text>}
          </View>
          <View style={styles.headerActions}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                style={[styles.headerMicBtn, { backgroundColor: micColors[micState] }]}
                onPress={handleMicPress}
                disabled={micState === "processing"}
                accessibilityLabel={t("dashboard.voice_command")}
                accessibilityRole="button"
              >
                <Ionicons name={micIcons[micState] as any} size={20} color="#fff" />
              </Pressable>
            </Animated.View>
            <View style={styles.roleBadge}>
              <Ionicons name={isPresident ? "shield" : "person"} size={14} color="#fff" />
              <Text style={styles.roleText}>{isPresident ? t("president") : t("member")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="people" label={t("totalMembers")} value={activeMembers.length} color={Colors.light.secondary} onPress={() => router.push("/members")} />
          <StatCard icon="calendar" label={t("upcomingMeeting")} value={upcomingMeetings.length} color={Colors.light.primary} onPress={() => router.push("/(main)/meetings")} />
          <StatCard icon="time" label={t("pendingPayments")} value={pendingPayments.length} color={Colors.light.pending} onPress={() => router.push("/(main)/payments")} />
          <StatCard icon="cash" label={t("activeLoans")} value={activeLoans.length} color={Colors.light.danger} onPress={() => router.push("/loans")} />
        </View>

        {groupSummary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("dashboard.financial_summary")}</Text>
            </View>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.totalSavings")}</Text>
                <Text style={styles.summaryValue}>Rs. {groupSummary.totalSavings}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.total_penalties")}</Text>
                <Text style={styles.summaryValue}>Rs. {groupSummary.totalPenalties}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.loan_disbursed")}</Text>
                <Text style={styles.summaryValue}>Rs. {groupSummary.totalLoanDisbursed}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.loan_repayments")}</Text>
                <Text style={styles.summaryValue}>Rs. {groupSummary.totalRepayments}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontFamily: "Poppins_600SemiBold", color: Colors.light.primary }]}>{t("dashboard.current_balance")}</Text>
                <Text style={[styles.summaryValue, { fontFamily: "Poppins_700Bold", color: Colors.light.primary, fontSize: 18 }]}>Rs. {groupSummary.currentBalance}</Text>
              </View>
            </View>
          </View>
        )}

        {upcomingMeetings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("upcomingMeeting")}</Text>
            </View>
            {upcomingMeetings.slice(0, 2).map((meeting) => (
              <Pressable
                key={meeting.id}
                style={styles.meetingCard}
                onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: meeting.id } })}
              >
                <View style={styles.meetingDateBadge}>
                  <Text style={styles.meetingDateDay}>{new Date(meeting.scheduledDate).getDate()}</Text>
                  <Text style={styles.meetingDateMonth}>
                    {new Date(meeting.scheduledDate).toLocaleDateString("en-IN", { month: "short" })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.meetingAgenda} numberOfLines={1}>{meeting.agenda}</Text>
                  <Text style={styles.meetingTime}>{t("scheduled")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
              </Pressable>
            ))}
          </View>
        )}

        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("recentActivity")}</Text>
              <Pressable onPress={() => router.push("/history")}>
                <Text style={styles.viewAllText}>{t("viewAll")}</Text>
              </Pressable>
            </View>
            {recentActivity.map((item) => (
              <Pressable
                key={item.id}
                style={styles.activityItem}
                onPress={item.routeTo ? () => router.push(item.routeTo as any) : undefined}
              >
                <View style={[styles.activityIconWrap, { backgroundColor: item.statusColor + "15" }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.statusColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityDate}>{item.subtitle}</Text>
                    <View style={[styles.activityTypeBadge, {
                      backgroundColor: item.type === "payment" ? Colors.light.success + "12"
                        : item.type === "loan" ? Colors.light.primary + "12" : Colors.light.secondary + "12",
                    }]}>
                      <Text style={[styles.activityTypeText, {
                        color: item.type === "payment" ? Colors.light.success
                          : item.type === "loan" ? Colors.light.primary : Colors.light.secondary,
                      }]}>
                        {item.type === "payment" ? t("payments") : item.type === "loan" ? t("loans") : t("meetings")}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {item.amount && <Text style={styles.activityAmount}>{item.amount}</Text>}
                  <Text style={[styles.activityStatus, { color: item.statusColor }]}>
                    {item.statusLabel}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {meetings.length === 0 && payments.length === 0 && loans.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="leaf" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>
              {isPresident
                ? (t("language") === "Language" ? "Get started by creating a meeting" : "बैठक तयार करून सुरुवात करा")
                : (t("language") === "Language" ? "Welcome to your group!" : "आपल्या गटात स्वागत!")}
            </Text>
          </View>
        )}
      </ScrollView>

      {(micState !== "idle") && (
        <Animated.View style={[styles.voiceOverlay, { opacity: fadeAnim }]}>
          {micState === "listening" && (
            <Text style={styles.overlayListeningText}>
              {t("dashboard.listening")}
            </Text>
          )}
          {micState === "processing" && (
            <Text style={styles.overlayListeningText}>
              {t("dashboard.processing")}
            </Text>
          )}
          {(micState === "result" || micState === "error") && transcript ? (
            <Text style={styles.overlayTranscript}>"{transcript}"</Text>
          ) : null}
          {(micState === "result" || micState === "error") && overlayReply ? (
            <Text style={[styles.overlayReply, { color: micState === "error" ? Colors.light.danger : Colors.light.success }]}>
              {overlayReply}
            </Text>
          ) : null}
        </Animated.View>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.light.background },
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: "0px 2px 4px rgba(0,0,0,0.15)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },
  greeting: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  userName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  groupName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.secondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#fff",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: "47%",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    gap: 4,
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: Colors.light.text,
    marginTop: 4,
  },
  statLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.light.text,
  },
  viewAllText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.primary,
  },
  meetingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    marginBottom: 8,
  },
  meetingDateBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  meetingDateDay: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: Colors.light.primary,
    lineHeight: 22,
  },
  meetingDateMonth: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.light.primary,
    lineHeight: 12,
  },
  meetingAgenda: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  meetingTime: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 6,
  },
  activityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  activityTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activityTypeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 9,
  },
  activityName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  activityDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  activityAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  activityStatus: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  voiceOverlay: {
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: "rgba(30,30,40,0.92)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
    elevation: 12,
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.25)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
    }),
  },
  overlayListeningText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: "#fff",
    opacity: 0.85,
  },
  overlayTranscript: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#ddd",
    textAlign: "center",
    fontStyle: "italic",
  },
  overlayReply: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    textAlign: "center",
  },
  fabWrapper: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: "0px 4px 8px rgba(0,0,0,0.3)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  fabLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  summaryBox: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
});
