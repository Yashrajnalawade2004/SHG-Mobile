import { useState } from "react";
import {
  View, Text, StyleSheet, SectionList, Pressable, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";

type TabKey = "payments" | "loans" | "meetings";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatMonthYear(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function groupByMonth<T>(items: T[], dateKey: string): { title: string; data: T[] }[] {
  const groups: Record<string, T[]> = {};
  items.forEach((item) => {
    const key = formatMonthYear((item as any)[dateKey]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function contributionPeriod(payment: { month?: string | null; date: string }): string {
  if (payment.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(payment.month)) {
    // A local midday avoids UTC month-boundary shifts when section headings
    // are formatted on devices in a different timezone.
    return `${payment.month}-01T12:00:00`;
  }
  return payment.date;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, isPresident, isTreasurer } = useAuth();
  const { t, language } = useLanguage();
  const { payments, loans, loanRepayments, meetings, groupMembers } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>("payments");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    (isPresident || isTreasurer) ? null : (user?.id || null)
  );

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "payments", label: t("payments"), icon: "wallet" },
    { key: "loans", label: t("loans"), icon: "cash" },
    { key: "meetings", label: t("meetings"), icon: "calendar" },
  ];

  const filteredPayments = payments
    .filter((p) => selectedMemberId ? p.memberId === selectedMemberId : true)
    .sort((a, b) => contributionPeriod(b).localeCompare(contributionPeriod(a)) || new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLoans = loans
    .filter((l) => selectedMemberId ? l.memberId === selectedMemberId : true)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sortedMeetings = [...meetings]
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const paymentSections = groupByMonth(filteredPayments.map((payment) => ({ ...payment, contributionPeriod: contributionPeriod(payment) })), "contributionPeriod");
  const loanSections = groupByMonth(filteredLoans, "createdAt");
  const meetingSections = groupByMonth(sortedMeetings, "scheduledDate");

  const renderPaymentItem = ({ item }: { item: typeof payments[0] }) => {
    const verifier = item.verifiedBy
      ? groupMembers.find((m) => m.id === item.verifiedBy)?.name || "-"
      : "-";
    const statusColor = item.status === "confirmed" ? Colors.light.success
      : item.status === "pending" ? Colors.light.pending : Colors.light.danger;
    return (
      <View style={styles.historyCard}>
        <View style={[styles.historyIcon, { backgroundColor: statusColor + "15" }]}>
          <Ionicons name="wallet" size={18} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyTitle}>{item.memberName}</Text>
          <Text style={styles.historyDate}>
            {item.month ? `Contribution: ${item.month} · ` : ""}Recorded: {formatDate(item.date)}
          </Text>
          {item.status === "confirmed" && (
            <Text style={styles.historyMeta}>{t("auto.verified_by")}: {verifier}</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.historyAmount}>
            {item.status === "payment_not_received"
              ? `${t("due")}: Rs. ${item.expectedAmount || 0}`
              : `Rs. ${item.amount}`}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{t(item.status)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderLoanItem = ({ item }: { item: typeof loans[0] }) => {
    const statusColor = (item.status === "approved" || item.status === "completed") ? Colors.light.success
      : (item.status === "rejected" || item.status === "treasurer_rejected") ? Colors.light.danger
      : item.status === "pending_treasurer" ? "#D97706"
      : Colors.light.pending;
    const repaymentCount = loanRepayments.filter((r) => r.loanId === item.id).length;
    return (
      <Pressable
        style={styles.historyCard}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: item.id } })}
      >
        <View style={[styles.historyIcon, { backgroundColor: statusColor + "15" }]}>
          <Ionicons name="cash" size={18} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyTitle}>{item.memberName}</Text>
          <Text style={styles.historyDate}>
            {item.approvedAt ? formatDate(item.approvedAt) : formatDate(item.createdAt)}
          </Text>
          {item.resolutionNo ? (
            <Text style={styles.historyMeta}>{t("resolutionNo")} {item.resolutionNo}</Text>
          ) : null}
          <Text style={styles.historyMeta}>
            {repaymentCount} {t("auto.repayments")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.historyAmount}>Rs. {item.amount}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{t(item.status)}</Text>
          </View>
          {item.status === "approved" && item.remainingBalance > 0 && (
            <Text style={styles.remainingText}>
              {t("remaining")}: Rs. {item.remainingBalance}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />
      </Pressable>
    );
  };

  const renderMeetingItem = ({ item }: { item: typeof meetings[0] }) => {
    const statusColor = item.status === "completed" ? Colors.light.success
      : item.status === "scheduled" ? Colors.light.primary : Colors.light.textMuted;
    const attended = selectedMemberId ? item.attendance.includes(selectedMemberId) : null;
    return (
      <Pressable
        style={styles.historyCard}
        onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: item.id } })}
      >
        <View style={[styles.historyIcon, { backgroundColor: statusColor + "15" }]}>
          <Ionicons name="calendar" size={18} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyTitle} numberOfLines={1}>{item.agenda || (t("auto.meeting"))}</Text>
          <Text style={styles.historyDate}>{formatDate(item.scheduledDate)}</Text>
          <Text style={styles.historyMeta}>
            {item.attendance.length} {t("auto.attended")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {item.status === "completed" ? t("completed") : item.status === "scheduled" ? t("scheduled") : t("meetingCancelled")}
            </Text>
          </View>
          {attended !== null && item.status === "completed" && (
            <Text style={[styles.attendanceStatus, { color: attended ? Colors.light.success : Colors.light.danger }]}>
              {attended ? (t("auto.present")) : (t("auto.absent"))}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.light.textMuted} />
      </Pressable>
    );
  };

  const currentSections: { title: string; data: any[] }[] = activeTab === "payments" ? paymentSections
    : activeTab === "loans" ? loanSections : meetingSections;

  const renderItem = activeTab === "payments" ? renderPaymentItem
    : activeTab === "loans" ? renderLoanItem : renderMeetingItem;

  const emptyLabel = activeTab === "payments" ? t("noPayments")
    : activeTab === "loans" ? t("noLoans") : t("noMeetings");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("auto.history")}</Text>
        <View style={{ width: 24 }} />
      </View>

      {(isPresident || isTreasurer) && (
        <View style={styles.memberFilterWrap}>
          <Pressable
            style={[styles.memberChip, !selectedMemberId && styles.memberChipActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedMemberId(null); }}
          >
            <Text style={[styles.memberChipText, !selectedMemberId && styles.memberChipTextActive]}>
              {t("auto.all")}
            </Text>
          </Pressable>
          {groupMembers.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.memberChip, selectedMemberId === m.id && styles.memberChipActive]}
              onPress={() => { Haptics.selectionAsync(); setSelectedMemberId(m.id); }}
            >
              <Text style={[styles.memberChipText, selectedMemberId === m.id && styles.memberChipTextActive]} numberOfLines={1}>
                {m.name.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Colors.light.primary : Colors.light.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={currentSections}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem as any}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyText}>{emptyLabel}</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  memberFilterWrap: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
    flexWrap: "wrap",
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  memberChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  memberChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  memberChipTextActive: {
    color: "#fff",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.light.primary + "15",
  },
  tabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.light.textMuted,
  },
  tabTextActive: {
    color: Colors.light.primary,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  historyTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  historyDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  historyMeta: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  historyAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  statusPillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
  },
  remainingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.light.danger,
    marginTop: 2,
  },
  attendanceStatus: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.light.textMuted,
  },
});
