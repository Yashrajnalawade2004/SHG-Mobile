// @ts-nocheck
import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Alert, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import { generateMemberStatement } from "@/lib/pdf-generator";
import Colors from "@/constants/colors";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, group, isPresident } = useAuth();
  const { t, language } = useLanguage();
  const { payments, loans, loanRepayments, meetings, groupMembers, updateMember } = useData();
  const [generating, setGenerating] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const member = groupMembers.find((m) => m.id === id);

  if (!member) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="person-outline" size={48} color={Colors.light.textMuted} />
        <Text style={styles.emptyText}>{t("members.memberNotFound")}</Text>
      </View>
    );
  }


  const isAuthorized = isPresident || user?.role === "treasurer" || user?.id === member.id;
  
  if (!isAuthorized) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.light.danger} />
        <Text style={[styles.emptyText, { marginTop: 16, color: Colors.light.danger, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }]}>{t("access_denied")}</Text>
        <Text style={{ marginTop: 8, color: Colors.light.textSecondary, textAlign: 'center' }}>{t("loan_privacy_notice")}</Text>
      </View>
    );
  }

  const canDownload = isPresident || user?.id === member.id;

  const memberPayments = payments.filter((p) => p.memberId === member.id);
  const confirmedPayments = memberPayments.filter((p) => p.status === "confirmed");
  const totalSavings = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = memberPayments.filter((p) => p.status === "pending").length;

  const memberLoans = loans.filter((l) => l.memberId === member.id);
  const approvedLoans = memberLoans.filter((l) => l.status === "approved");
  const totalLoanAmount = approvedLoans.reduce((sum, l) => sum + l.amount, 0);
  const outstandingLoan = approvedLoans.reduce((sum, l) => sum + l.remainingBalance, 0);

  const completedMeetings = meetings.filter((m) => m.status === "completed");
  const attendedCount = completedMeetings.filter((m) => m.attendance.includes(member.id)).length;
  const attendancePercent = completedMeetings.length > 0
    ? Math.round((attendedCount / completedMeetings.length) * 100) : 0;

  const isActive = member.status === "active";

  const handleDownloadPDF = async () => {
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    const president = groupMembers.find((m) => m.role === "president");
    await generateMemberStatement({
      member,
      group,
      president,
      payments,
      loans,
      loanRepayments,
      meetings,
      groupMembers,
      language,
      t,
      user,
    });
    setGenerating(false);
  };


  const handleChangeStartMonth = (month) => {
    updateMember(member.id, { contributionStartMonth: month });
    setShowMonthPicker(false);
  };
  
  const handleToggleStatus = () => {
    const newStatus = isActive ? "left" : "active";
    const msg = newStatus === "left"
      ? (t("members.confirmMarkLeft"))
      : (t("members.confirmMarkActive"));

    Alert.alert(t("confirm"), msg, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => updateMember(member.id, { status: newStatus }),
      },
    ]);
  };


  // ── Unified History Timeline ─────────────
  const timelineItems: Array<{
    id: string;
    type: 'payment' | 'loan_request' | 'loan_repayment' | 'meeting';
    date: Date;
    sortDate: number;
    title: string;
    subtitle: string;
    amount?: string;
    amountBreakdown?: { p: string; i: string; remain: string };
    receiptNo?: string;
    recordedBy?: string;
    statusColor: string;
    statusLabel: string;
    routeTo?: { pathname: string; params?: any };
  }> = [];

  // Add savings
  memberPayments.forEach(p => {
    timelineItems.push({
      id: p.id,
      type: 'payment',
      date: new Date(p.date),
      sortDate: new Date(p.date).getTime(),
      title: t("dashboard.totalSavings"),
      subtitle: p.status === "confirmed" ? t("confirmed") : t("pending"),
      amount: p.amount.toString(),
      statusColor: p.status === "confirmed" ? Colors.light.success : p.status === "pending" ? Colors.light.pending : Colors.light.danger,
      statusLabel: t(p.status)
    });
  });

  // Add loan requests/approvals
  memberLoans.forEach(l => {
    timelineItems.push({
      id: l.id,
      type: 'loan_request',
      date: new Date(l.createdAt),
      sortDate: new Date(l.createdAt).getTime(),
      title: t("loans.loanHistory"),
      subtitle: l.resolutionNumber ? `${t("history.resolution_number")}: ${l.resolutionNumber}` : `${l.interest}% / ${l.duration} ${t("loans.mo")}`,
      amount: l.amount.toString(),
      statusColor: l.status === "approved" ? Colors.light.success : l.status === "requested" ? Colors.light.pending : Colors.light.danger,
      statusLabel: t(l.status),
      routeTo: { pathname: "/loan/[id]", params: { id: l.id } }
    });
    
    // Add repayments for this loan
    if (l.calculationMethod === "reducing_balance") {
      const ledgers = loanLedgers.filter(ledger => ledger.loanId === l.id && ledger.type === "repayment");
      ledgers.forEach(ledger => {
        timelineItems.push({
          id: ledger.id,
          type: 'loan_repayment',
          date: new Date(ledger.date),
          sortDate: new Date(ledger.date).getTime(),
          title: t("history.loan_repayment"),
          subtitle: `${l.resolutionNumber ? l.resolutionNumber : l.id.slice(0,6)}`,
          amount: ledger.paymentReceived.toString(),
          amountBreakdown: {
            p: ledger.principalPaid.toString(),
            i: ledger.interestPaid.toString(),
            remain: ledger.closingPrincipal.toString()
          },
          receiptNo: ledger.receiptNo,
          recordedBy: groupMembers.find(m => m.id === ledger.recordedBy)?.name || t("history.recorded_by"),
          statusColor: Colors.light.primary,
          statusLabel: t("confirmed"),
          routeTo: { pathname: "/loan/[id]", params: { id: l.id } }
        });
      });
    } else {
      const reps = loanRepayments.filter(r => r.loanId === l.id);
      reps.forEach(rep => {
        timelineItems.push({
          id: rep.id,
          type: 'loan_repayment',
          date: new Date(rep.date),
          sortDate: new Date(rep.date).getTime(),
          title: t("history.loan_repayment"),
          subtitle: `${l.resolutionNumber ? l.resolutionNumber : l.id.slice(0,6)}`,
          amount: rep.amount.toString(),
          amountBreakdown: {
             p: rep.shgAmount.toString(),
             i: '0',
             remain: l.remainingBalance.toString()
          },
          receiptNo: `REP-${rep.id.slice(0,6)}`,
          recordedBy: groupMembers.find(m => m.id === rep.recordedBy)?.name || t("history.recorded_by"),
          statusColor: Colors.light.primary,
          statusLabel: t("confirmed"),
          routeTo: { pathname: "/loan/[id]", params: { id: l.id } }
        });
      });
    }
  });

  timelineItems.sort((a, b) => b.sortDate - a.sortDate);

  return (
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
        <Text style={styles.headerTitle}>{t("memberDetails")}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: member.role === "president" ? Colors.light.primary : Colors.light.secondary }]}>
          <Ionicons name={member.role === "president" ? "shield" : "person"} size={32} color="#fff" />
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, { backgroundColor: member.role === "president" ? Colors.light.primary + "20" : Colors.light.secondary + "20" }]}>
            <Text style={[styles.roleBadgeText, { color: member.role === "president" ? Colors.light.primary : Colors.light.secondary }]}>
              {member.role === "president" ? t("president") : t("member")}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? Colors.light.success + "20" : Colors.light.textMuted + "20" }]}>
            <Text style={[styles.statusBadgeText, { color: isActive ? Colors.light.success : Colors.light.textMuted }]}>
              {isActive ? t("active") : t("left")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="call-outline" label={t("phone")} value={member.phone} />
        <InfoRow icon="location-outline" label={t("village")} value={member.village} />
        <InfoRow icon="calendar-outline" label={t("joinDate")} value={formatDisplayDate(member.joinDate)} />
        {member.contributionStartMonth && <InfoRow icon="calendar-number-outline" label={t("members.contributionStartMonth")} value={member.contributionStartMonth} />}

        {member.exitDate && <InfoRow icon="exit-outline" label={t("exitDate")} value={formatDisplayDate(member.exitDate)} />}
      </View>


      {showMonthPicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t("members.setStartMonth")}</Text>
              <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                {Array.from({ length: 24 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 12 + i);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const val = `${yyyy}-${mm}`;
                  const isSelected = member.contributionStartMonth === val;
                  return (
                    <Pressable
                      key={val}
                      style={[styles.monthOption, isSelected && styles.monthOptionSelected]}
                      onPress={() => handleChangeStartMonth(val)}
                    >
                      <Text style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}>
                        {val}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="wallet" size={20} color={Colors.light.success} />
          <Text style={styles.statValue}>Rs. {totalSavings}</Text>
          <Text style={styles.statLabel}>{t("dashboard.totalSavings")}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={20} color={Colors.light.primary} />
          <Text style={styles.statValue}>Rs. {totalLoanAmount}</Text>
          <Text style={styles.statLabel}>{t("loans.totalLoan")}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={20} color={outstandingLoan > 0 ? Colors.light.danger : Colors.light.success} />
          <Text style={[styles.statValue, { color: outstandingLoan > 0 ? Colors.light.danger : Colors.light.success }]}>
            Rs. {outstandingLoan}
          </Text>
          <Text style={styles.statLabel}>{t("loans.outstanding")}</Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>{memberPayments.length}</Text>
          <Text style={styles.quickStatLabel}>{t("payments")}</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>{pendingPayments}</Text>
          <Text style={styles.quickStatLabel}>{t("pending")}</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>{memberLoans.length}</Text>
          <Text style={styles.quickStatLabel}>{t("loans")}</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>{attendancePercent}%</Text>
          <Text style={styles.quickStatLabel}>{t("attendance")}</Text>
        </View>
      </View>

      <View style={styles.historySection}>
        <Text style={styles.historySectionTitle}>{t("pdf_detailed_transactions")}</Text>
        {timelineItems.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>{t("noPayments")}</Text>
          </View>
        ) : (
          timelineItems.slice(0, 20).map((item) => (
            <Pressable
              key={item.id}
              style={[styles.historyRow, { flexDirection: 'column', alignItems: 'stretch' }]}
              onPress={() => item.routeTo && router.push(item.routeTo as any)}
              disabled={!item.routeTo}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.historyDot, { backgroundColor: item.statusColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyRowDate}>{formatDisplayDate(item.date.toISOString())} - {item.title}</Text>
                  <Text style={[styles.historyRowStatus, { color: item.statusColor }]}>{item.statusLabel}</Text>
                  {item.subtitle && <Text style={styles.historyRowMeta}>{item.subtitle}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.historyRowAmount}>Rs. {item.amount}</Text>
                  {item.routeTo && <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />}
                </View>
              </View>
              {item.type === 'loan_repayment' && item.amountBreakdown && (
                <View style={{ marginTop: 8, paddingLeft: 20 }}>
                   <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{t("history.principal_portion")}: Rs. {item.amountBreakdown.p}</Text>
                      <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{t("history.interest_portion")}: Rs. {item.amountBreakdown.i}</Text>
                   </View>
                   <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{t("history.remaining_principal")}: Rs. {item.amountBreakdown.remain}</Text>
                      {item.receiptNo && <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{t("history.receipt_number")}: {item.receiptNo}</Text>}
                   </View>
                   <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      {item.recordedBy && <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{t("history.recorded_by")}: {item.recordedBy}</Text>}
                   </View>
                </View>
              )}
            </Pressable>
          ))
        )}
        {timelineItems.length > 20 && (
          <Text style={styles.showMoreText}>
            {`${t("common.more_plus")} ${timelineItems.length - 20}`}
          </Text>
        )}
      </View>

      {canDownload && (
        <Pressable
          style={({ pressed }) => [styles.downloadBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleDownloadPDF}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="download-outline" size={22} color="#fff" />
          )}
          <Text style={styles.downloadBtnText}>
            {generating
              ? (t("reports.generatingPdf"))
              : (t("reports.downloadStatement"))}
          </Text>
        </Pressable>
      )}

      {isPresident && member.role !== "president" && (
        <Pressable
          style={[styles.toggleStatusBtn, { borderColor: isActive ? Colors.light.danger + "40" : Colors.light.success + "40" }]}
          onPress={handleToggleStatus}
        >
          <Ionicons
            name={isActive ? "person-remove-outline" : "person-add-outline"}
            size={20}
            color={isActive ? Colors.light.danger : Colors.light.success}
          />
          <Text style={[styles.toggleStatusText, { color: isActive ? Colors.light.danger : Colors.light.success }]}>
            {isActive ? t("markAsLeft") : t("markAsActive")}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={Colors.light.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const styles = StyleSheet.create({

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: Colors.light.text,
    marginBottom: 16,
  },
  monthOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  monthOptionSelected: {
    backgroundColor: Colors.light.primary + "20",
  },
  monthOptionText: {
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    color: Colors.light.text,
  },
  monthOptionTextSelected: {
    color: Colors.light.primary,
    fontFamily: "Poppins-Bold",
  },

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
  profileCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  memberName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: Colors.light.text,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.text,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: Colors.light.text,
  },
  statLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
  },
  quickStatValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: Colors.light.text,
  },
  quickStatLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  downloadBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  toggleStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  toggleStatusText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
    marginTop: 12,
  },
  historySection: {
    marginBottom: 16,
  },
  historySectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 10,
    paddingLeft: 2,
  },
  emptySection: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 20,
    alignItems: "center" as const,
  },
  emptySectionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
  },
  historyRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.light.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyRowDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.text,
  },
  historyRowStatus: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
  },
  historyRowAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  historyRowMeta: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  showMoreText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.primary,
    textAlign: "center" as const,
    paddingVertical: 8,
  },
});
