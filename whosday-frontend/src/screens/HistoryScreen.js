import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../api";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import Avatar from "../components/Avatar";
import ScreenHeader from "../components/ScreenHeader";
import { useI18n, t } from "../i18n";

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(date, lang) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return t("hist.today");
  if (sameDay(date, yesterday)) return t("hist.yesterday");
  const opts = date.getFullYear() === now.getFullYear()
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat(lang, opts).format(date);
}

function buildSections(messages, lang) {
  const sections = [];
  let current = null;
  for (const msg of messages) {
    const label = dayLabel(new Date(msg.sent_at), lang);
    if (!current || current.title !== label) {
      current = { title: label, data: [] };
      sections.push(current);
    }
    current.data.push(msg);
  }
  return sections;
}

export default function HistoryScreen() {
  const { lang } = useI18n();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [messages, setMessages] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await api.getMessagesSent());
    } catch {
      // Non bloquant - le pull-to-refresh permet de réessayer.
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const total = messages.length;
  const sections = React.useMemo(() => buildSections(messages, lang), [messages, lang]);
  const timeFmt = React.useMemo(
    () => new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }),
    [lang],
  );

  async function resend(item) {
    if (!item.birthday_id) return;
    try {
      await api.sendBirthday(item.birthday_id);
      Alert.alert(t("bd.sentTitle"), t("bd.sentMsg", { name: item.name }));
      load();
    } catch (err) {
      Alert.alert(t("bd.sendFailTitle"), err.response?.data?.error || err.message);
    }
  }

  function renderItem({ item }) {
    const sent = item.status === "sent";
    return (
      <View style={styles.card}>
        <Avatar name={item.name} size={42} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.time}>{timeFmt.format(new Date(item.sent_at))}</Text>
          {!sent && item.error ? (
            <Text style={styles.errorText} numberOfLines={2}>
              {item.error}
            </Text>
          ) : null}
        </View>
        {!sent && item.birthday_id ? (
          <TouchableOpacity style={styles.resendBtn} activeOpacity={0.8} onPress={() => resend(item)}>
            <Feather name="refresh-cw" size={13} color={COLORS.accent} />
            <Text style={styles.resendText}>{t("hist.resend")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.badge, sent ? styles.badgeSent : styles.badgeFailed]}>
            <Feather name={sent ? "check" : "x"} size={12} color={sent ? COLORS.success : COLORS.danger} />
            <Text style={[styles.badgeText, { color: sent ? COLORS.success : COLORS.danger }]}>
              {sent ? t("hist.sent") : t("hist.failed")}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("hist.title")}
        subtitle={total > 0 ? t("hist.subtitleCount", { count: total }) : t("hist.subtitleEmpty")}
      />

      <SectionList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading && !initialLoad}
        onRefresh={load}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={renderItem}
        ListEmptyComponent={
          initialLoad ? (
            <ActivityIndicator style={styles.loadingSpinner} color={COLORS.accent} />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="send" size={24} color={COLORS.accent} />
              </View>
              <Text style={styles.empty}>{t("hist.emptyTitle")}</Text>
              <Text style={styles.emptySubtext}>{t("hist.emptySub")}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: COLORS.subtext,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  loadingSpinner: { marginTop: 80 },
  emptyState: { alignItems: "center", marginTop: 70, paddingHorizontal: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  empty: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  emptySubtext: { color: COLORS.subtext, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.card,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  time: { fontSize: 13, color: COLORS.subtext, marginTop: 3, fontWeight: "500" },
  errorText: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeSent: { backgroundColor: COLORS.successSoft },
  badgeFailed: { backgroundColor: COLORS.dangerSoft },
  badgeText: { fontSize: 12, fontWeight: "800" },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  resendText: { fontSize: 12, fontWeight: "800", color: COLORS.accent },
});
