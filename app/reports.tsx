// @ts-nocheck
import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { generateGroupSavingsReport, generateGroupLoansReport } from "@/lib/pdf-generator";

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { group, president, isPresident, isTreasurer } = useAuth();
  const { t, language } = useLanguage();
  const { payments, loans, loanRepayments, groupMembers } = useData();
  
  const [generatingSavings, setGeneratingSavings] = useState(false);
  const [generatingLoans, setGeneratingLoans] = useState(false);

  const handleSavingsReport = async () => {
    if (!group) return;
    setGeneratingSavings(true);
    try {
      await generateGroupSavingsReport({
        group,
        president: president || undefined,
        payments,
        loans,
        loanRepayments,
        groupMembers,
        language
      });
    } catch (error) {
      console.error(error);
      Alert.alert(t("error"), "Failed to generate savings report");
    } finally {
      setGeneratingSavings(false);
    }
  };

  const handleLoansReport = async () => {
    if (!group) return;
    setGeneratingLoans(true);
    try {
      await generateGroupLoansReport({
        group,
        president: president || undefined,
        payments,
        loans,
        loanRepayments,
        groupMembers,
        language
      });
    } catch (error) {
      console.error(error);
      Alert.alert(t("error"), "Failed to generate loans report");
    } finally {
      setGeneratingLoans(false);
    }
  };

  if (!isPresident && !isTreasurer) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={48} color={Colors.light.textMuted} />
        <Text style={styles.accessDeniedText}>{t("presidentOnly")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top) + 16,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
          <Text style={styles.title}>{t("reports.group_reports")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.subtitle}>
          {t("reports.download_desc")}
        </Text>

        <View style={styles.reportCard}>
          <View style={[styles.iconBox, { backgroundColor: Colors.light.success + "15" }]}>
            <Ionicons name="wallet-outline" size={32} color={Colors.light.success} />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>{t("reports.monthly_savings_report")}</Text>
            <Text style={styles.reportDesc}>
              {t("auto.detailed_view_of_all_members")}
            </Text>
          </View>
          <Pressable 
            style={[styles.downloadBtn, generatingSavings && { opacity: 0.7 }]} 
            onPress={handleSavingsReport}
            disabled={generatingSavings}
          >
            {generatingSavings ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.downloadText}>{t("common.download")}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.reportCard}>
          <View style={[styles.iconBox, { backgroundColor: Colors.light.primary + "15" }]}>
            <Ionicons name="cash-outline" size={32} color={Colors.light.primary} />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>{t("reports.active_loans_report")}</Text>
            <Text style={styles.reportDesc}>
              {t("auto.overview_of_all_active_loans")}
            </Text>
          </View>
          <Pressable 
            style={[styles.downloadBtn, generatingLoans && { opacity: 0.7 }]} 
            onPress={handleLoansReport}
            disabled={generatingLoans}
          >
            {generatingLoans ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.downloadText}>{t("common.download")}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.light.background },
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 30,
  },
  reportCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    gap: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  reportInfo: {
    alignItems: "center",
    gap: 8,
  },
  reportTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
  },
  reportDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    marginTop: 8,
  },
  downloadText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  accessDenied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  accessDeniedText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 16,
    textAlign: "center",
  },
});
