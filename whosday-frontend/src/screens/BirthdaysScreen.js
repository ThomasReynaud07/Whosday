import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, friendlyErrorMessage, isFreeLimitError } from "../api";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import Avatar from "../components/Avatar";
import ScreenHeader from "../components/ScreenHeader";
import BirthdayFormModal from "../components/BirthdayFormModal";
import CalendarImportModal from "../components/CalendarImportModal";
import PaywallModal from "../components/PaywallModal";
import { syncBirthdayReminders } from "../reminders";
import { useI18n, t } from "../i18n";

function nextBirthdayYear(month, day) {
  const now = new Date();
  const thisYear = now.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  next.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return next < today ? thisYear + 1 : thisYear;
}

function daysUntilNext(month, day) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(nextBirthdayYear(month, day), month - 1, day);
  next.setHours(0, 0, 0, 0);
  return Math.round((next - today) / 86400000);
}

function dateBadgeLabel(days) {
  if (days === 0) return t("bd.today");
  if (days === 1) return t("bd.tomorrow");
  if (days < 7) return t("bd.inDays", { n: days });
  if (days < 30) return t("bd.inWeeks", { n: Math.round(days / 7) });
  return t("bd.inDaysShort", { n: days });
}

function ageTurning(birthYear, month, day) {
  if (!birthYear) return null;
  return nextBirthdayYear(month, day) - birthYear;
}

function monthName(m, lang) {
  return new Intl.DateTimeFormat(lang, { month: "long" }).format(new Date(2020, m - 1, 1));
}

function buildSections(list, lang) {
  const byMonth = {};
  list.forEach((b) => {
    (byMonth[b.month] ||= []).push(b);
  });
  const currentMonth = new Date().getMonth() + 1;
  const sections = [];
  for (let i = 0; i < 12; i++) {
    const m = ((currentMonth - 1 + i) % 12) + 1;
    if (byMonth[m]) {
      sections.push({
        title: monthName(m, lang),
        data: byMonth[m].sort((a, b) => a.day - b.day),
      });
    }
  }
  return sections;
}

export default function BirthdaysScreen() {
  const { lang } = useI18n();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [birthdays, setBirthdays] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");

  const [formVisible, setFormVisible] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const loadBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getBirthdays();
      setBirthdays(list);
      syncBirthdayReminders(list);
    } catch (err) {
      Alert.alert(t("common.error"), `${t("bd.loadError")}\n${err.message}`);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadBirthdays();
  }, [loadBirthdays]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? birthdays.filter((b) => b.name.toLowerCase().includes(q)) : birthdays;
    return buildSections(filtered, lang);
  }, [birthdays, search, lang]);

  // The soonest upcoming birthday (for the "Coming up" card).
  const nextUp = useMemo(() => {
    if (birthdays.length === 0) return null;
    return [...birthdays].sort(
      (a, b) => daysUntilNext(a.month, a.day) - daysUntilNext(b.month, b.day),
    )[0];
  }, [birthdays]);

  async function submitForm(payload) {
    try {
      if (editingBirthday) await api.updateBirthday(editingBirthday.id, payload);
      else await api.createBirthday(payload);
      setFormVisible(false);
      setEditingBirthday(null);
      loadBirthdays();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (isFreeLimitError(err)) {
        setFormVisible(false);
        setEditingBirthday(null);
        setPaywallVisible(true);
      } else {
        Alert.alert(t("common.error"), friendlyErrorMessage(err));
      }
    }
  }

  function confirmDelete(item) {
    Alert.alert(
      t("bd.deleteTitle"),
      t("bd.deleteMsg", { name: item.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("bd.delete"), style: "destructive", onPress: () => deleteBirthday(item.id) },
      ],
    );
  }

  async function deleteBirthday(id) {
    try {
      await api.deleteBirthday(id);
      loadBirthdays();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Alert.alert(t("common.error"), err.response?.data?.error || err.message);
    }
  }

  async function testSend(id, name) {
    setBusyId(id);
    try {
      await api.sendBirthday(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("bd.sentTitle"), t("bd.sentMsg", { name }));
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("bd.sendFailTitle"), err.response?.data?.error || err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function importFromCalendar(items) {
    setCalendarVisible(false);
    const results = await Promise.allSettled(items.map((item) => api.createBirthday(item)));
    loadBirthdays();
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const firstError = results.find((r) => r.status === "rejected")?.reason;
    if (firstError) {
      if (isFreeLimitError(firstError)) {
        if (succeeded > 0) Alert.alert(t("bd.importPartialTitle"), t("bd.importPartialMsg", { n: succeeded }));
        setPaywallVisible(true);
      } else {
        Alert.alert(t("common.error"), friendlyErrorMessage(firstError));
      }
    } else {
      Alert.alert(t("bd.importedTitle"), t("bd.importedMsg", { n: succeeded }));
    }
  }

  function openAdd() {
    setEditingBirthday(null);
    setFormVisible(true);
  }

  function renderItem({ item }) {
    const days = daysUntilNext(item.month, item.day);
    const isSoon = days <= 1;
    const age = ageTurning(item.birthYear, item.month, item.day);
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.card}
        onPress={() => {
          setEditingBirthday(item);
          setFormVisible(true);
        }}
      >
        <Avatar name={item.name} size={46} uri={item.photoUrl} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="clock" size={11} color={COLORS.faintText} />
            <Text style={styles.cardMeta}>{item.sendTime}</Text>
            {age != null && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.cardMeta}>{t("bd.years", { n: age })}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.dateBadge, isSoon && styles.dateBadgeSoon]}>
            <Text style={[styles.dateBadgeText, isSoon && styles.dateBadgeTextSoon]}>
              {dateBadgeLabel(days)}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.iconButton}
              disabled={busyId === item.id}
              onPress={() => testSend(item.id, item.name)}
            >
              {busyId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Feather name="send" size={15} color={COLORS.accent} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.iconButton}
              onPress={() => confirmDelete(item)}
            >
              <Feather name="trash-2" size={15} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const count = birthdays.length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="WhosDay"
        subtitle={count > 0 ? t("bd.subtitleCount", { count }) : t("bd.subtitleEmpty")}
        right={
          <TouchableOpacity
            style={styles.importChip}
            activeOpacity={0.8}
            onPress={() => setCalendarVisible(true)}
          >
            <Feather name="calendar" size={15} color={COLORS.onAccent} />
            <Text style={styles.importChipText}>{t("bd.import")}</Text>
          </TouchableOpacity>
        }
        overlap={
          <View style={styles.searchField}>
            <Feather name="search" size={17} color={COLORS.faintText} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("bd.search")}
              placeholderTextColor={COLORS.faintText}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        }
      />

      <SectionList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading && !initialLoad}
        onRefresh={loadBirthdays}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          !search.trim() && nextUp ? (
            <TouchableOpacity
              style={styles.upcomingCard}
              activeOpacity={0.85}
              onPress={() => {
                setEditingBirthday(nextUp);
                setFormVisible(true);
              }}
            >
              <Avatar name={nextUp.name} size={44} uri={nextUp.photoUrl} />
              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingLabel}>{t("bd.upcoming")}</Text>
                <Text style={styles.upcomingName} numberOfLines={1}>
                  {nextUp.name}
                </Text>
              </View>
              <Text style={styles.upcomingCountdown}>
                {dateBadgeLabel(daysUntilNext(nextUp.month, nextUp.day))}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={renderItem}
        ListEmptyComponent={
          initialLoad ? (
            <ActivityIndicator style={styles.loadingSpinner} color={COLORS.accent} />
          ) : search.trim() ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="search" size={26} color={COLORS.faintText} />
              </View>
              <Text style={styles.empty}>{t("bd.noResultTitle")}</Text>
              <Text style={styles.emptySubtext}>{t("bd.noResultSub", { q: search.trim() })}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="gift" size={26} color={COLORS.accent} />
              </View>
              <Text style={styles.empty}>{t("bd.emptyTitle")}</Text>
              <Text style={styles.emptySubtext}>{t("bd.emptySub")}</Text>
            </View>
          )
        }
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={openAdd}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <BirthdayFormModal
        visible={formVisible}
        initialValues={editingBirthday}
        onClose={() => {
          setFormVisible(false);
          setEditingBirthday(null);
        }}
        onSubmit={submitForm}
        onDelete={(item) => {
          setFormVisible(false);
          setEditingBirthday(null);
          confirmDelete(item);
        }}
      />

      <CalendarImportModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onImport={importFromCalendar}
      />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSubscribed={loadBirthdays}
      />
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  importChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  importChipText: { color: COLORS.onAccent, fontWeight: "700", fontSize: 13 },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...SHADOWS.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 8,
    ...SHADOWS.accent,
  },
  upcomingInfo: { flex: 1 },
  upcomingLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: COLORS.onAccentSoft },
  upcomingName: { fontSize: 17, fontWeight: "800", color: COLORS.onAccent, marginTop: 2 },
  upcomingCountdown: { fontSize: 14, fontWeight: "800", color: COLORS.onAccent },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: COLORS.subtext,
    marginTop: 20,
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 14,
    ...SHADOWS.card,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  cardMeta: { fontSize: 13, color: COLORS.subtext, fontWeight: "500" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.faintText },
  cardRight: { alignItems: "flex-end", gap: 8 },
  dateBadge: {
    backgroundColor: COLORS.segmentBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  dateBadgeSoon: { backgroundColor: COLORS.celebrateSoft },
  dateBadgeText: { fontSize: 11, fontWeight: "800", color: COLORS.subtext },
  dateBadgeTextSoon: { color: COLORS.celebrate },
  cardActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accentSofter,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.accent,
  },
});
