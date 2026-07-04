// @ts-nocheck
import { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Platform, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth, User } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { apiGet, apiPost } from "@/lib/api";

function RoleBadge({ role }: { role: "president" | "treasurer" | "member" }) {
  const { t } = useLanguage();
  if (role === "president") {
    return (
      <View style={[styles.roleBadge, { backgroundColor: Colors.light.primary + "20" }]}>
        <Ionicons name="shield" size={10} color={Colors.light.primary} />
        <Text style={[styles.roleBadgeText, { color: Colors.light.primary }]}>{t("president")}</Text>
      </View>
    );
  }
  if (role === "treasurer") {
    return (
      <View style={[styles.roleBadge, { backgroundColor: "#F59E0B25" }]}>
        <Ionicons name="wallet" size={10} color="#D97706" />
        <Text style={[styles.roleBadgeText, { color: "#D97706" }]}>{t("treasurer")}</Text>
      </View>
    );
  }
  return null;
}

function MemberItem({
  member, isPresident, treasurerId, onToggleStatus, onAssignTreasurer,
}: {
  member: User;
  isPresident: boolean;
  treasurerId?: string;
  onToggleStatus: (id: string, status: "active" | "left") => void;
  onAssignTreasurer: (member: User) => void;
}) {
  const { t, language } = useLanguage();
  const isActive = member.status === "active";
  const isCurrentTreasurer = member.id === treasurerId;
  const canManage = isPresident && member.role !== "president";

  const avatarBg = member.role === "president"
    ? Colors.light.primary
    : member.role === "treasurer"
    ? "#D97706"
    : Colors.light.secondary;

  const avatarIcon = member.role === "president" ? "shield" : member.role === "treasurer" ? "wallet" : "person";

  return (
    <Pressable
      style={[styles.memberCard, isCurrentTreasurer && styles.treasurerCard]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/member/${member.id}`);
      }}
    >
      {isCurrentTreasurer && <View style={styles.treasurerStripe} />}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Ionicons name={avatarIcon as any} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.memberName}>{member.name}</Text>
          <RoleBadge role={member.role} />
        </View>
        <Text style={styles.memberInfo}>{member.village}</Text>
        <Text style={styles.memberInfo}>{member.phone}</Text>
        <Text style={styles.memberInfo}>{t("joinDate")}: {member.joinDate}</Text>
        {canManage && (
          <View style={styles.memberActions}>
            <Pressable onPress={() => onAssignTreasurer(member)} style={styles.assignBtn}>
              <Ionicons
                name={isCurrentTreasurer ? "wallet" : "wallet-outline"}
                size={13}
                color={isCurrentTreasurer ? "#D97706" : Colors.light.textSecondary}
              />
              <Text style={[styles.assignBtnText, isCurrentTreasurer && { color: "#D97706" }]}>
                {isCurrentTreasurer ? t("removeTreasurer") : t("assignTreasurer")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleStatus(member.id, isActive ? "left" : "active");
              }}
              style={[styles.removeBtn, { backgroundColor: isActive ? Colors.light.danger + "12" : Colors.light.success + "12" }]}
            >
              <Ionicons
                name={isActive ? "person-remove-outline" : "person-add-outline"}
                size={13}
                color={isActive ? Colors.light.danger : Colors.light.success}
              />
              <Text style={[styles.removeBtnText, { color: isActive ? Colors.light.danger : Colors.light.success }]}>
                {isActive
                  ? (t("members.remove_from_group"))
                  : (t("members.reactivate"))}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? Colors.light.success + "20" : Colors.light.textMuted + "20" }]}>
          <Text style={[styles.statusText, { color: isActive ? Colors.light.success : Colors.light.textMuted }]}>
            {isActive ? t("active") : t("left")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.light.textMuted} />
      </View>
    </Pressable>
  );
}

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const { isPresident, group, refreshSession } = useAuth();
  const { t, language } = useLanguage();
  const { groupMembers, updateMemberStatus, assignTreasurer } = useData();
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const handleToggleStatus = (memberId: string, newStatus: "active" | "left") => {
    const msg = newStatus === "left"
      ? (t("members.confirmMarkLeft"))
      : (t("members.confirmMarkActive"));
    Alert.alert(t("confirm"), msg, [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), onPress: () => updateMemberStatus(memberId, newStatus) },
    ]);
  };

  const handleAssignTreasurer = (member: User) => {
    setSelectedMember(member);
    setShowModal(true);
  };

  const confirmAssign = async () => {
    if (!selectedMember) return;
    const isAlreadyTreasurer = selectedMember.id === group?.treasurerId;
    try {
      await assignTreasurer(isAlreadyTreasurer ? null : selectedMember.id);
      await refreshSession();
    } catch {}
    setShowModal(false);
  };

  const handleGenerateInvite = async () => {
    if (!group) return;
    setGeneratingInvite(true);
    try {
      const res = await apiPost<{ code: string }>(`/api/groups/${group.groupId}/invitations`, { maxUses: 1 });
      setInvitationCode(res.code);
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Failed to generate invite");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const activeMembers = groupMembers.filter((m) => m.status === "active");
  const leftMembers = groupMembers.filter((m) => m.status === "left");
  const currentTreasurer = groupMembers.find((m) => m.id === group?.treasurerId);

  const isRemoving = selectedMember?.id === group?.treasurerId;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("members")}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={styles.countText}>{activeMembers.length} {t("active")}</Text>
          {isPresident && (
            <Pressable style={styles.inviteBtn} onPress={() => { setInvitationCode(null); setShowInviteModal(true); }}>
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text style={styles.inviteBtnText}>{t("members.invite")}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {currentTreasurer && (
        <View style={styles.treasurerBanner}>
          <Ionicons name="wallet" size={16} color="#D97706" />
          <Text style={styles.treasurerBannerText}>
            {t("currentTreasurer")}: <Text style={{ fontFamily: "Poppins_600SemiBold" }}>{currentTreasurer.name}</Text>
          </Text>
        </View>
      )}

      <FlatList
        data={[...activeMembers, ...leftMembers]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MemberItem
            member={item}
            isPresident={isPresident}
            treasurerId={group?.treasurerId}
            onToggleStatus={handleToggleStatus}
            onAssignTreasurer={handleAssignTreasurer}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyText}>{t("noMembers")}</Text>
          </View>
        }
        scrollEnabled={groupMembers.length > 0}
      />

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIconWrap, { backgroundColor: isRemoving ? Colors.light.danger + "15" : "#FEF3C7" }]}>
              <Ionicons name="wallet" size={32} color={isRemoving ? Colors.light.danger : "#D97706"} />
            </View>
            <Text style={styles.modalTitle}>
              {isRemoving ? t("removeTreasurer") : t("assignTreasurer")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {isRemoving
                ? t("members.remove_treasurer_confirm").replace("{name}", selectedMember?.name || "")
                : t("members.assign_treasurer_confirm").replace("{name}", selectedMember?.name || "")}
            </Text>
            {!isRemoving && (
              <View style={styles.modalNote}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.light.textMuted} />
                <Text style={styles.modalNoteText}>
                  {t("auto.future_loan_requests_will_require")}
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: isRemoving ? Colors.light.danger : "#D97706" }]}
                onPress={confirmAssign}
              >
                <Ionicons name={isRemoving ? "close" : "checkmark"} size={18} color="#fff" />
                <Text style={styles.modalConfirmText}>{t("confirm")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIconWrap, { backgroundColor: Colors.light.primary + "15" }]}>
              <Ionicons name="person-add" size={32} color={Colors.light.primary} />
            </View>
            <Text style={styles.modalTitle}>
              {t("members.invite_member")}
            </Text>
            
            {invitationCode ? (
              <>
                <Text style={styles.modalSubtitle}>
                  {t("members.share_code")}
                </Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText} selectable>{invitationCode}</Text>
                </View>
                <Text style={{ fontSize: 12, color: Colors.light.textMuted, textAlign: "center", marginTop: 10 }}>
                  {t("members.code_valid_1")}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>
                  {t("auto.generate_a_unique_invitation_code")}
                </Text>
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancelBtn} onPress={() => setShowInviteModal(false)}>
                    <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalConfirmBtn, { backgroundColor: Colors.light.primary }]}
                    onPress={handleGenerateInvite}
                    disabled={generatingInvite}
                  >
                    {generatingInvite ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={18} color="#fff" />
                        <Text style={styles.modalConfirmText}>{t("members.generate")}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </>
            )}
            
            {invitationCode && (
              <Pressable style={[styles.modalConfirmBtn, { backgroundColor: Colors.light.primary, marginTop: 20, width: "100%" }]} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalConfirmText}>{t("common.done")}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: { fontSize: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  countText: { fontSize: 14, color: Colors.light.primary, fontFamily: "Poppins_500Medium" },
  inviteBtn: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  treasurerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "#FEF3C740",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F59E0B40",
  },
  treasurerBannerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#92400E",
  },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  memberCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  treasurerCard: {
    borderWidth: 1.5,
    borderColor: "#F59E0B50",
    backgroundColor: "#FFFBEB",
  },
  treasurerStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#F59E0B",
    borderTopLeftRadius: 13,
    borderBottomLeftRadius: 13,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  memberName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
  },
  memberInfo: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  memberActions: {
    gap: 6,
    marginTop: 6,
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  assignBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  removeBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 8,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  modalNote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: Colors.light.inputBg,
    borderRadius: 10,
    padding: 10,
    width: "100%",
    marginTop: 4,
  },
  modalNoteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    width: "100%",
  },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10, backgroundColor: "#F3F4F6" },
  modalCancelText: { color: Colors.light.textSecondary, fontFamily: "Poppins_500Medium" },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10, flexDirection: "row", justifyContent: "center", gap: 6 },
  modalConfirmText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
  codeBox: { backgroundColor: "#F3F4F6", padding: 15, borderRadius: 8, marginTop: 10, alignItems: "center" },
  codeText: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.primary, letterSpacing: 2 },
});
