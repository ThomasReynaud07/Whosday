import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import axios from "axios";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
import { api, BACKEND_URL, authHeader } from "../api";
import { useTheme, useThemePref, RADIUS, SHADOWS } from "../theme";
import Avatar from "../components/Avatar";
import ScreenHeader from "../components/ScreenHeader";
import PaywallModal from "../components/PaywallModal";
import LegalModal from "../components/LegalModal";
import LinkWhatsAppScreen from "./LinkWhatsAppScreen";
import { useI18n, t, LANGUAGES } from "../i18n";
import { pickImage, uploadImage } from "../media";
import { TERMS_TEXT, PRIVACY_TEXT } from "../legal";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { pref: themePref, setPref: setThemePref } = useThemePref();
  const [wahaStatus, setWahaStatus] = useState("checking");
  const [relinkVisible, setRelinkVisible] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null); // "terms" | "privacy" | null
  const [deleting, setDeleting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const headers = await authHeader();
      const { data } = await axios.get(`${BACKEND_URL}/waha-status`, { headers });
      setWahaStatus(data.status);
    } catch (err) {
      setWahaStatus("ERROR");
    }
  }, []);

  const loadPro = useCallback(async () => {
    try {
      const { isPro, avatarUrl } = await api.getProfile();
      setIsPro(isPro);
      setAvatarUrl(avatarUrl);
    } catch {
      // ignore - stays free
    }
  }, []);

  async function changeAvatar() {
    try {
      const asset = await pickImage({ square: true });
      if (!asset) return;
      setAvatarBusy(true);
      const uid = await api.currentUserId();
      const url = await uploadImage(asset, `${uid}/avatar_${Date.now()}.jpg`);
      await api.updateAvatar(url);
      setAvatarUrl(url);
    } catch {
      Alert.alert(t("common.error"), t("media.uploadError"));
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, [checkStatus, relinkVisible]);

  useEffect(() => {
    loadPro();
  }, [loadPro, paywallVisible]);

  function handleSignOut() {
    Alert.alert(t("prof.signOutTitle"), t("prof.signOutMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("prof.signOut"), style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(t("prof.deleteTitle"), t("prof.deleteMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("prof.deleteAccount"),
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await api.deleteAccount();
            // signOut inside deleteAccount flips auth state -> back to login
          } catch {
            setDeleting(false);
            Alert.alert(t("common.error"), t("prof.deleteError"));
          }
        },
      },
    ]);
  }

  function chooseLanguage() {
    Alert.alert(
      t("prof.language"),
      undefined,
      [
        ...LANGUAGES.map((l) => ({ text: l.label + (l.code === lang ? "  ✓" : ""), onPress: () => setLang(l.code) })),
        { text: t("common.cancel"), style: "cancel" },
      ],
    );
  }

  const THEME_OPTIONS = [
    { key: "system", label: t("prof.themeSystem") },
    { key: "light", label: t("prof.themeLight") },
    { key: "dark", label: t("prof.themeDark") },
  ];

  function chooseTheme() {
    Alert.alert(
      t("prof.appearance"),
      undefined,
      [
        ...THEME_OPTIONS.map((o) => ({
          text: o.label + (o.key === themePref ? "  ✓" : ""),
          onPress: () => setThemePref(o.key),
        })),
        { text: t("common.cancel"), style: "cancel" },
      ],
    );
  }

  const currentThemeLabel = THEME_OPTIONS.find((o) => o.key === themePref)?.label || "";

  const isWorking = wahaStatus === "WORKING";
  const currentLangLabel = LANGUAGES.find((l) => l.code === lang)?.label || lang;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("prof.title")} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identityCard}>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
            <Avatar name={user?.email || "?"} size={72} uri={avatarUrl} />
            <View style={styles.cameraBadge}>
              {avatarBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={13} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={[styles.planPill, isPro && styles.planPillPro]}>
            <Feather name="star" size={12} color={isPro ? "#fff" : COLORS.accent} />
            <Text style={[styles.planPillText, isPro && styles.planPillTextPro]}>
              {isPro ? t("prof.pro") : t("prof.free")}
            </Text>
          </View>
        </View>

        {/* Upgrade / Pro status */}
        {isPro ? (
          <View style={[styles.row, { marginTop: 20 }]}>
            <View style={[styles.rowIcon, { backgroundColor: COLORS.accentSoft }]}>
              <Feather name="star" size={17} color={COLORS.accent} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>WhosDay Pro</Text>
              <Text style={styles.rowSub}>{t("prof.proActiveSub")}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.upgradeCard}
            activeOpacity={0.85}
            onPress={() => setPaywallVisible(true)}
          >
            <View style={styles.upgradeIcon}>
              <Feather name="star" size={20} color="#fff" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.upgradeTitle}>{t("prof.goProTitle")}</Text>
              <Text style={styles.upgradeSub}>{t("prof.goProSub")}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.accent} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>{t("prof.account")}</Text>

        {/* WhatsApp status */}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setRelinkVisible(true)}>
          <View style={[styles.rowIcon, { backgroundColor: isWorking ? COLORS.successSoft : COLORS.segmentBg }]}>
            <Feather name="message-circle" size={17} color={isWorking ? COLORS.success : COLORS.faintText} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t("prof.whatsapp")}</Text>
            {wahaStatus === "checking" ? (
              <ActivityIndicator size="small" color={COLORS.faintText} style={{ alignSelf: "flex-start" }} />
            ) : (
              <Text style={[styles.rowSub, { color: isWorking ? COLORS.success : COLORS.subtext }]}>
                {isWorking ? t("prof.connected") : t("prof.notLinked")}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.faintText} />
        </TouchableOpacity>

        {/* Language */}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={chooseLanguage}>
          <View style={[styles.rowIcon, { backgroundColor: COLORS.accentSoft }]}>
            <Feather name="globe" size={17} color={COLORS.accent} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t("prof.language")}</Text>
            <Text style={styles.rowSub}>{currentLangLabel}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.faintText} />
        </TouchableOpacity>

        {/* Appearance (light / dark / system) */}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={chooseTheme}>
          <View style={[styles.rowIcon, { backgroundColor: COLORS.accentSoft }]}>
            <Feather name={COLORS.isDark ? "moon" : "sun"} size={17} color={COLORS.accent} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t("prof.appearance")}</Text>
            <Text style={styles.rowSub}>{currentThemeLabel}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.faintText} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t("prof.legal")}</Text>

        {/* Terms of use */}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setLegalDoc("terms")}>
          <View style={[styles.rowIcon, { backgroundColor: COLORS.segmentBg }]}>
            <Feather name="file-text" size={17} color={COLORS.subtext} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t("prof.terms")}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.faintText} />
        </TouchableOpacity>

        {/* Privacy policy */}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setLegalDoc("privacy")}>
          <View style={[styles.rowIcon, { backgroundColor: COLORS.segmentBg }]}>
            <Feather name="shield" size={17} color={COLORS.subtext} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t("prof.privacy")}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.faintText} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} activeOpacity={0.7} onPress={handleSignOut}>
          <Feather name="log-out" size={17} color={COLORS.danger} />
          <Text style={styles.signOutText}>{t("prof.signOut")}</Text>
        </TouchableOpacity>

        {/* Permanent account deletion (Apple requirement) */}
        <TouchableOpacity
          style={styles.deleteButton}
          activeOpacity={0.7}
          onPress={confirmDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <>
              <Feather name="trash-2" size={16} color={COLORS.danger} />
              <Text style={styles.deleteText}>{t("prof.deleteAccount")}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>WhosDay · v1.0</Text>
      </ScrollView>

      <Modal visible={relinkVisible} animationType="slide" presentationStyle="pageSheet">
        <LinkWhatsAppScreen onLinked={() => setRelinkVisible(false)} onClose={() => setRelinkVisible(false)} />
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSubscribed={loadPro}
      />

      <LegalModal
        visible={legalDoc !== null}
        title={legalDoc === "privacy" ? t("prof.privacy") : t("prof.terms")}
        content={legalDoc === "privacy" ? PRIVACY_TEXT : TERMS_TEXT}
        onClose={() => setLegalDoc(null)}
      />
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  identityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: 26,
    alignItems: "center",
    ...SHADOWS.card,
  },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  email: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginTop: 14 },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginTop: 12,
  },
  planPillText: { color: COLORS.accent, fontWeight: "700", fontSize: 12 },
  planPillPro: { backgroundColor: COLORS.accent },
  planPillTextPro: { color: "#fff" },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  upgradeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeTitle: { fontSize: 15, fontWeight: "800", color: COLORS.accent },
  upgradeSub: { fontSize: 13, color: COLORS.accentDark, marginTop: 2, fontWeight: "500" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: COLORS.subtext,
    marginTop: 26,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.card,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  rowSub: { fontSize: 13, color: COLORS.subtext, marginTop: 2, fontWeight: "500" },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    marginTop: 12,
  },
  signOutText: { color: COLORS.danger, fontWeight: "700", fontSize: 15 },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    marginTop: 6,
  },
  deleteText: { color: COLORS.danger, fontWeight: "600", fontSize: 14 },
  footer: { textAlign: "center", color: COLORS.faintText, fontSize: 12, marginTop: 26 },
});
