import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  const { user, group, isPresident, isTreasurer } = useAuth();
  const { t, language } = useLanguage();
  const { meetings, payments, loans, loanRepayments, groupMembers, refreshData, groupSummary, groupSettings, groupBankLoans, bankLoanAllocations } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const [dismissedSavings, setDismissedSavings] = useState(false);
  const [dismissedLoan, setDismissedLoan] = useState(false);

  useEffect(() => {
    const checkDismissals = async () => {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${now.getMonth()}`;
      const currentDayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      try {
        const s = await AsyncStorage.getItem(`dismissed_savings_${currentMonthStr}`);
        if (s) setDismissedSavings(true);
        // We will check loan dismissal in a separate effect because it depends on loanReminder amount
      } catch (e) {}
    };
    checkDismissals();
  }, []);




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

  // Payment submission is President-only; members no longer receive a self-service payment prompt.
  const contributionReminder: any = null;

  // ── Loan Reminder (members only) ───────────
  const loanReminder = useMemo(() => {
    if (isPresident || isTreasurer || !user) return null;
    const active = loans.filter((l) => l.memberId === user.id && l.status === "approved" && l.remainingBalance > 0);
    if (active.length === 0) return null;

    if (active.length === 1) {
      const l = active[0];
      const outstandingInterest = l.outstandingInterest || 0;
      const principalPortion = l.fixedPrincipalInstallment || Math.floor(l.amount / l.duration);
      const interestPortion = Math.round((l.remainingBalance * l.interest) / 100);
      return {
        type: 'single' as const,
        loan: l,
        recommendedPayment: principalPortion + interestPortion + outstandingInterest,
        principalPortion,
        interestPortion,
        outstandingInterest,
        outstandingPrincipal: l.remainingBalance
      };
    } else {
      const totalRecommended = active.reduce((sum, l) => {
        const principal = l.fixedPrincipalInstallment || Math.floor(l.amount / l.duration);
        const interest = Math.round((l.remainingBalance * l.interest) / 100);
        return sum + principal + interest + (l.outstandingInterest || 0);
      }, 0);
      return {
        type: 'multiple' as const,
        count: active.length,
        totalRecommended
      };
    }
  }, [loans, user, isPresident, isTreasurer]);

  useEffect(() => {
    const checkLoanDismissal = async () => {
      if (!loanReminder) return;
      const now = new Date();
      const currentDayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      const recAmount = loanReminder.type === 'single' ? loanReminder.recommendedPayment : loanReminder.totalRecommended;
      try {
        const l = await AsyncStorage.getItem(`dismissed_loan_${currentDayStr}_${recAmount}`);
        setDismissedLoan(!!l);
      } catch (e) {}
    };
    checkLoanDismissal();
  }, [loanReminder]);

  const dismissSavingsCard = async () => {
    setDismissedSavings(true);
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${now.getMonth()}`;
    await AsyncStorage.setItem(`dismissed_savings_${currentMonthStr}`, "true").catch(()=>{});
  };

  const dismissLoanCard = async () => {
    if (!loanReminder) return;
    setDismissedLoan(true);
    const now = new Date();
    const currentDayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const recAmount = loanReminder.type === 'single' ? loanReminder.recommendedPayment : loanReminder.totalRecommended;
    await AsyncStorage.setItem(`dismissed_loan_${currentDayStr}_${recAmount}`, "true").catch(()=>{});
  };


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

  // The public activity feed displays group savings and meetings to ALL members for transparency.
  // Loan activity is intentionally excluded to maintain member privacy.
  const recentActivity: ActivityItem[] = [
    ...payments.map((p): ActivityItem => ({
      id: "p_" + p.id,
      type: "payment",
      date: p.date,
      title: p.memberName,
      subtitle: formatDate(p.date),
      amount: p.status === "payment_not_received" ? `${t("due")}: Rs. ${p.expectedAmount || 0}` : "Rs. " + p.amount,
      statusColor: p.status === "confirmed" ? Colors.light.success : p.status === "pending" ? Colors.light.pending : Colors.light.danger,
      statusLabel: t(p.status),
      icon: "wallet",
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

  // ─── Bank Loan Dashboard Data ──────────────────────────────────────────────
  const bankLoanDashData = useMemo(() => {
    const isAdmin = user?.role === "president" || user?.role === "treasurer";
    if (isAdmin) {
      const activeLoans = groupBankLoans.filter(l => l.status === "active");
      const totalOutstanding = bankLoanAllocations.reduce((s, a) => s + a.outstandingBalance, 0);
      const totalOutstandingInterest = bankLoanAllocations.reduce((s, a) => s + a.outstandingInterest, 0);
      const totalPrincipalCollected = bankLoanAllocations.reduce((s, a) => s + a.totalPrincipalPaid, 0);
      const totalInterestCollected = bankLoanAllocations.reduce((s, a) => s + a.totalInterestPaid, 0);
      const membersAllocated = bankLoanAllocations.length;
      const membersCompleted = bankLoanAllocations.filter(a => a.status === "completed").length;
      return {
        isAdmin: true,
        activeLoansCount: activeLoans.length,
        totalOutstanding,
        totalOutstandingInterest,
        totalPrincipalCollected,
        totalInterestCollected,
        membersAllocated,
        membersCompleted,
      };
    } else {
      // Member: find their own active allocations
      const myAllocs = bankLoanAllocations.filter(a => a.memberId === user?.id && a.status === "active");
      if (myAllocs.length === 0) return null;
      const primary = myAllocs[0];
      const loan = groupBankLoans.find(l => l.id === primary.bankLoanId);
      if (!loan) return null;
      // Simple recommendation
      const r = loan.annualInterestRate / 100 / 12;
      const interestThisMonth = Math.round(primary.outstandingBalance * r);
      const n = loan.durationMonths;
      const P = loan.amount;
      const emi = r > 0 ? Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : Math.round(P / n);
      const principalPortion = Math.max(0, emi - interestThisMonth);
      const recommendedPayment = principalPortion + interestThisMonth + primary.outstandingInterest;
      return {
        isAdmin: false,
        allocation: primary,
        loan,
        recommendedPayment,
      };
    }
  }, [user?.role, user?.id, groupBankLoans, bankLoanAllocations]);

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

        {/* ── Contribution Reminder Card — full lifecycle ── */}
        {contributionReminder !== null && (
          <View style={{ marginBottom: 20 }}>

            {/* ────── STATE: pending ────── */}
            {contributionReminder.state === "pending" && (() => {
              const r = contributionReminder;
              const isHot = r.isOverdue && !r.withinGrace;
              return (
                <>
                  <View style={[
                    styles.reminderCard,
                    isHot ? styles.reminderCardOverdue : styles.reminderCardPending,
                    { marginBottom: 0 },
                  ]}>
                    <View style={styles.reminderHeader}>
                      <View style={[styles.reminderIconWrap,
                      { backgroundColor: isHot ? Colors.light.danger + "20" : "#F59E0B20" }]}>
                        <Ionicons
                          name={isHot ? "alert-circle" : "time"}
                          size={20}
                          color={isHot ? Colors.light.danger : "#D97706"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reminderTitle, { color: isHot ? Colors.light.danger : "#92400E" }]}>
                          {t("reminder.contribution_pending_title")}
                        </Text>
                        <Text style={styles.reminderSubtitle}>
                          {r.isOverdue
                            ? r.withinGrace
                              ? t("reminder.within_grace")
                              : `${t("reminder.overdue_by")} ${r.overdueBy} ${t("reminder.days")}`
                            : `${r.diffDays} ${t("reminder.days_remaining")}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reminderDetails}>
                      <View style={styles.reminderDetailRow}>
                        <Text style={styles.reminderDetailLabel}>{t("reminder.contribution_amount")}</Text>
                        <Text style={styles.reminderDetailValue}>Rs. {r.monthlyAmount.toLocaleString("en-IN")}</Text>
                      </View>
                      <View style={styles.reminderDetailRow}>
                        <Text style={styles.reminderDetailLabel}>{t("reminder.due_date")}</Text>
                        <Text style={styles.reminderDetailValue}>
                          {r.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </Text>
                      </View>
                      {r.applicableLateFee > 0 && (
                        <View style={styles.reminderDetailRow}>
                          <Text style={styles.reminderDetailLabel}>{t("reminder.late_fee_applicable")}</Text>
                          <Text style={[styles.reminderDetailValue, { color: Colors.light.danger }]}>
                            Rs. {r.applicableLateFee.toLocaleString("en-IN")}
                          </Text>
                        </View>
                      )}
                      {r.applicableLateFee === 0 && r.isOverdue && (
                        <View style={styles.reminderDetailRow}>
                          <Text style={styles.reminderDetailLabel}>{t("reminder.late_fee_applicable")}</Text>
                          <Text style={[styles.reminderDetailValue, { color: Colors.light.success }]}>
                            {t("reminder.no_late_fee")}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.reminderDetailRow, styles.reminderTotalRow]}>
                        <Text style={styles.reminderTotalLabel}>{t("reminder.total_payable")}</Text>
                        <Text style={styles.reminderTotalValue}>Rs. {r.totalPayable.toLocaleString("en-IN")}</Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.reminderPayBtn}
                      onPress={() => router.push("/(main)/payments")}
                      accessibilityRole="button"
                    >
                      <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
                      <Text style={styles.reminderPayBtnText}>{t("reminder.pay_now")}</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}

            {/* ────── STATE: submitted ────── */}
            {contributionReminder.state === "submitted" && (() => {
              const p = contributionReminder.payment;
              return (
                <View style={[styles.reminderCard, styles.reminderCardSubmitted, { marginBottom: 0 }]}>
                  <View style={styles.reminderHeader}>
                    <View style={[styles.reminderIconWrap, { backgroundColor: Colors.light.primary + "18" }]}>
                      <Ionicons name="hourglass-outline" size={20} color={Colors.light.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderTitle, { color: Colors.light.primary }]}>
                        {t("reminder.submitted_title")}
                      </Text>
                      <Text style={styles.reminderSubtitle}>{t("reminder.submitted_subtitle")}</Text>
                    </View>
                  </View>

                  <View style={styles.reminderDetails}>
                    <View style={styles.reminderDetailRow}>
                      <Text style={styles.reminderDetailLabel}>{t("reminder.submitted_amount")}</Text>
                      <Text style={styles.reminderDetailValue}>Rs. {p.amount.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={styles.reminderDetailRow}>
                      <Text style={styles.reminderDetailLabel}>{t("reminder.submitted_on")}</Text>
                      <Text style={styles.reminderDetailValue}>
                        {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={styles.reminderDetailRow}>
                      <Text style={styles.reminderDetailLabel}>{t("reminder.payment_method")}</Text>
                      <Text style={styles.reminderDetailValue}>{t(p.mode)}</Text>
                    </View>
                  </View>

                  <Pressable
                    style={[styles.reminderPayBtn, { backgroundColor: Colors.light.primary }]}
                    onPress={() => router.push("/(main)/payments")}
                    accessibilityRole="button"
                  >
                    <Ionicons name="eye-outline" size={18} color="#fff" />
                    <Text style={styles.reminderPayBtnText}>{t("reminder.view_payment")}</Text>
                  </Pressable>
                </View>
              );
            })()}

            {/* ────── STATE: rejected ────── */}
            {contributionReminder.state === "rejected" && (() => {
              const p = contributionReminder.payment;
              return (
                <View style={[styles.reminderCard, styles.reminderCardOverdue, { marginBottom: 0 }]}>
                  <View style={styles.reminderHeader}>
                    <View style={[styles.reminderIconWrap, { backgroundColor: Colors.light.danger + "20" }]}>
                      <Ionicons name="close-circle" size={20} color={Colors.light.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderTitle, { color: Colors.light.danger }]}>
                        {t("reminder.rejected_title")}
                      </Text>
                      <Text style={styles.reminderSubtitle}>
                        {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                  </View>

                  {/* Rejection reason */}
                  <View style={styles.reminderRejectionBox}>
                    <Text style={styles.reminderRejectionLabel}>{t("reminder.rejection_reason_label")}</Text>
                    <Text style={styles.reminderRejectionText}>
                      {p.rejectionReason?.trim() || t("reminder.no_reason_given")}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.reminderPayBtn, { backgroundColor: Colors.light.danger }]}
                    onPress={() => router.push("/(main)/payments")}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.reminderPayBtnText}>{t("reminder.resubmit")}</Text>
                  </Pressable>
                </View>
              );
            })()}

          </View>
        )}



        
        {/* ────── LOAN REPAYMENT REMINDER ────── */}
        {loanReminder && !dismissedLoan && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>{t("dashboard.monthly_loan_reminder")}</Text>
              <Pressable onPress={dismissLoanCard} style={{ padding: 4 }}>
                <Text style={{ color: Colors.light.textMuted, fontSize: 13 }}>{t("dashboard.dismiss")}</Text>
              </Pressable>
            </View>

            {loanReminder.type === 'single' ? (
              <View style={[styles.reminderCard, { borderLeftColor: Colors.light.primary }]}>
                <View style={styles.reminderHeader}>
                  <View style={[styles.reminderIconWrap, { backgroundColor: Colors.light.primary + "20" }]}>
                    <Ionicons name="cash-outline" size={20} color={Colors.light.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>
                      {t("history.loan_repayment")}
                    </Text>
                    <Text style={styles.reminderSubtitle}>
                      {t("history.remaining_principal")}: Rs. {(loanReminder.outstandingPrincipal || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View style={styles.reminderDetails}>
                  <View style={styles.reminderDetailRow}>
                    <Text style={styles.reminderDetailLabel}>{t("recommended_monthly_payment")}</Text>
                    <Text style={[styles.reminderDetailValue, { color: Colors.light.primary, fontWeight: 'bold' }]}>
                      Rs. {(loanReminder.recommendedPayment || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={styles.reminderDetailRow}>
                    <Text style={styles.reminderDetailLabel}>{t("history.principal_portion")}</Text>
                    <Text style={styles.reminderDetailValue}>Rs. {(loanReminder.principalPortion || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={styles.reminderDetailRow}>
                    <Text style={styles.reminderDetailLabel}>{t("history.interest_portion")}</Text>
                    <Text style={styles.reminderDetailValue}>Rs. {(loanReminder.interestPortion || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  {loanReminder.outstandingInterest > 0 && (
                    <View style={styles.reminderDetailRow}>
                      <Text style={[styles.reminderDetailLabel, { color: Colors.light.danger }]}>{t("dashboard.outstanding_interest")}</Text>
                      <Text style={[styles.reminderDetailValue, { color: Colors.light.danger }]}>Rs. {(loanReminder.outstandingInterest).toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={[styles.reminderPayBtn, { backgroundColor: Colors.light.primary }]}
                  onPress={() => router.push(`/loan/${loanReminder.loan.id}`)}
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                  <Text style={styles.reminderPayBtnText}>{t("history.loan_repayment")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.reminderCard, { borderLeftColor: Colors.light.primary }]}>
                <View style={styles.reminderHeader}>
                  <View style={[styles.reminderIconWrap, { backgroundColor: Colors.light.primary + "20" }]}>
                    <Ionicons name="layers-outline" size={20} color={Colors.light.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>
                      {t("dashboard.multiple_active_loans")} ({loanReminder.count})
                    </Text>
                  </View>
                </View>
                <View style={styles.reminderDetails}>
                  <View style={styles.reminderDetailRow}>
                    <Text style={styles.reminderDetailLabel}>{t("recommended_monthly_payment")}</Text>
                    <Text style={[styles.reminderDetailValue, { color: Colors.light.primary, fontWeight: 'bold' }]}>
                      Rs. {(loanReminder.totalRecommended || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.reminderPayBtn, { backgroundColor: Colors.light.primary }]}
                  onPress={() => router.push("/loans")}
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                  <Text style={styles.reminderPayBtnText}>{t("dashboard.multiple_active_loans")}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {groupSummary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("dashboard.financial_summary")}</Text>
            </View>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.total_savings")}</Text>
                <Text style={styles.summaryValue}>Rs. {(groupSummary.totalSavings || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.current_cash_balance")}</Text>
                <Text style={[styles.summaryValue, { color: Colors.light.success, fontWeight: "bold" }]}>Rs. {(groupSummary.currentBalance || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.total_principal_disbursed")}</Text>
                <Text style={styles.summaryValue}>Rs. {(groupSummary.totalPrincipalDisbursed || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.principal_collected")}</Text>
                <Text style={[styles.summaryValue, { color: Colors.light.success }]}>Rs. {(groupSummary.principalCollected || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.interest_collected")}</Text>
                <Text style={[styles.summaryValue, { color: Colors.light.success }]}>Rs. {(groupSummary.interestCollected || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.outstanding_principal")}</Text>
                <Text style={[styles.summaryValue, { color: Colors.light.danger }]}>Rs. {(groupSummary.outstandingPrincipal || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.outstanding_interest")}</Text>
                <Text style={[styles.summaryValue, { color: Colors.light.danger }]}>Rs. {(groupSummary.outstandingInterest || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.active_loans")}</Text>
                <Text style={styles.summaryValue}>{groupSummary.activeLoansCount || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("dashboard.completed_loans")}</Text>
                <Text style={styles.summaryValue}>{groupSummary.completedLoansCount || 0}</Text>
              </View>
            </View>
          </View>
        )}


        {/* ────── GROUP BANK LOAN SECTION ────── */}
        {bankLoanDashData && (
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="business-outline" size={18} color="#2980B9" />
                <Text style={[styles.sectionTitle, { color: "#1B4F72" }]}>{t("bank_loan.dashboard_title")}</Text>
              </View>
              <Pressable onPress={() => router.push("/bank-loans" as any)}>
                <Text style={[styles.viewAllText, { color: "#2980B9" }]}>{t("bank_loan.view_details")}</Text>
              </Pressable>
            </View>

            {bankLoanDashData.isAdmin ? (
              <View style={{ backgroundColor: "#EBF5FB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#2980B9" + "40" }}>
                <Text style={{ fontSize: 12, color: "#2980B9", fontFamily: "Poppins_400Regular", marginBottom: 10 }}>{t("bank_loan.dashboard_subtitle_admin")}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.active_loans")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#1B4F72" }}>{bankLoanDashData.activeLoansCount}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.outstanding")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#C0392B" }}>Rs. {(bankLoanDashData.totalOutstanding || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.principal_collected")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#1B6B4A" }}>Rs. {(bankLoanDashData.totalPrincipalCollected || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.interest_collected")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#1B6B4A" }}>Rs. {(bankLoanDashData.totalInterestCollected || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.members_allocated")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#1B4F72" }}>{bankLoanDashData.membersAllocated}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.members_completed")}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#1B6B4A" }}>{bankLoanDashData.membersCompleted}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                style={{ backgroundColor: "#EBF5FB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#2980B9" + "40" }}
                onPress={() => router.push({ pathname: "/bank-loan/allocation/[id]" as any, params: { id: bankLoanDashData.allocation?.id } })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Ionicons name="business-outline" size={18} color="#2980B9" />
                  <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#1B4F72" }}>{bankLoanDashData.loan?.bankName}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                  <View style={{ flex: 1, minWidth: "44%" }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.allocated_principal")}</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#1B4F72" }}>Rs. {(bankLoanDashData.allocation?.allocatedPrincipal || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%" }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.outstanding")}</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#C0392B" }}>Rs. {(bankLoanDashData.allocation?.outstandingBalance || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: "44%" }}>
                    <Text style={{ fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" }}>{t("bank_loan.recommended_payment")}</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#2980B9" }}>Rs. {(bankLoanDashData.recommendedPayment || 0).toLocaleString("en-IN")}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                  <Ionicons name="book-outline" size={13} color="#2980B9" />
                  <Text style={{ fontSize: 12, color: "#2980B9", marginLeft: 4, fontFamily: "Poppins_500Medium" }}>{t("bank_loan.view_passbook")}</Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={14} color="#2980B9" />
                </View>
              </Pressable>
            )}
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
            <Text style={styles.overlayTranscript}>&quot;{transcript}&quot;</Text>
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
  // ── Reminder card styles ─────────────────────────────────────
  reminderCard: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.08)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    }),
  },
  reminderCardPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  reminderCardSubmitted: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  reminderCardOverdue: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  reminderTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    marginBottom: 2,
  },
  reminderSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  reminderDetails: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  reminderDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reminderDetailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  reminderDetailValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
  },
  reminderTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 8,
    marginTop: 4,
  },
  reminderTotalLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  reminderTotalValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: Colors.light.primary,
  },
  reminderPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  reminderPayBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  reminderRejectionBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
  },
  reminderRejectionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: Colors.light.danger,
    marginBottom: 4,
  },
  reminderRejectionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
  },
});
