import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Calendar from "expo-calendar";
import * as Contacts from "expo-contacts";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import { useI18n, t, getTemplates } from "../i18n";
import Avatar from "./Avatar";

function normalize(name) {
  return name.trim().toLowerCase();
}

function cleanPhone(number) {
  return String(number || "").replace(/[^\d+]/g, "");
}

// Import birthdays either from the iOS "Contacts" (reads the birthday saved on
// each contact card - the reliable default) or from the iOS "Birthdays"
// calendar (Apple auto-generates it from Contacts; carries name + date only,
// so we cross-reference Contacts by name to fill in phone numbers).
export default function CalendarImportModal({ visible, onClose, onImport }) {
  const { lang } = useI18n();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [source, setSource] = useState("contacts"); // "contacts" | "calendar"
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const FORMATTER = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long" });

  useEffect(() => {
    if (!visible) return;
    if (source === "contacts") loadFromContacts();
    else loadFromCalendar();
  }, [visible, source]);

  async function loadFromContacts() {
    setLoading(true);
    setCandidates([]);
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("imp.permTitle"), t("imp.permContacts"));
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Birthday, Contacts.Fields.PhoneNumbers],
      });
      const seen = new Set();
      const list = data
        .filter((c) => c.birthday && c.name && typeof c.birthday.month === "number")
        .map((c) => {
          // expo-contacts returns month 0-indexed; the app uses 1-12.
          const month = c.birthday.month + 1;
          const day = c.birthday.day;
          const phone = cleanPhone(c.phoneNumbers?.[0]?.number);
          return { key: c.id, name: c.name, month, day, phoneNumber: phone, selected: Boolean(phone) };
        })
        .filter((c) => {
          const k = `${normalize(c.name)}-${c.month}-${c.day}`;
          return seen.has(k) ? false : seen.add(k);
        });
      setCandidates(list);
    } catch (err) {
      Alert.alert(t("form.contactError"), err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFromCalendar() {
    setLoading(true);
    setCandidates([]);
    try {
      const calendarPerm = await Calendar.requestCalendarPermissionsAsync();
      if (calendarPerm.status !== "granted") {
        Alert.alert(t("imp.permTitle"), t("imp.permCalendar"));
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const birthdayCalendar = calendars.find(
        (c) => c.title === "Birthdays" || c.source?.name === "Birthdays",
      );
      if (!birthdayCalendar) {
        Alert.alert(t("imp.calNotFoundTitle"), t("imp.calNotFoundMsg"));
        return;
      }

      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      const events = await Calendar.getEventsAsync([birthdayCalendar.id], start, end);

      // Best-effort phone matching against Contacts by name.
      let phoneByName = {};
      const contactsPerm = await Contacts.requestPermissionsAsync();
      if (contactsPerm.status === "granted") {
        const { data: contacts } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });
        phoneByName = Object.fromEntries(
          contacts
            .filter((c) => c.name && c.phoneNumbers?.length)
            .map((c) => [normalize(c.name), cleanPhone(c.phoneNumbers[0].number)]),
        );
      }

      const seen = new Set();
      const list = events
        .map((e) => {
          const d = new Date(e.startDate);
          const name = e.title.replace(/[’']s Birthday$/, "");
          const key = `${name}-${d.getMonth()}-${d.getDate()}`;
          return { key, name, month: d.getMonth() + 1, day: d.getDate() };
        })
        .filter((e) => (seen.has(e.key) ? false : seen.add(e.key)))
        .map((e) => {
          const matchedPhone = phoneByName[normalize(e.name)] || "";
          return { ...e, phoneNumber: matchedPhone, selected: Boolean(matchedPhone) };
        });

      setCandidates(list);
    } catch (err) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(key) {
    setCandidates((list) =>
      list.map((c) => (c.key === key && c.phoneNumber ? { ...c, selected: !c.selected } : c)),
    );
  }

  async function pickPhoneFor(key) {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      const phone = cleanPhone(contact?.phoneNumbers?.[0]?.number);
      if (phone) {
        setCandidates((list) =>
          list.map((c) => (c.key === key ? { ...c, phoneNumber: phone, selected: true } : c)),
        );
      }
    } catch (err) {
      Alert.alert(t("form.contactError"), err.message);
    }
  }

  const matchedCount = candidates.filter((c) => c.phoneNumber).length;
  const selectedCount = candidates.filter((c) => c.selected).length;
  const allSelected = matchedCount > 0 && selectedCount === matchedCount;

  function toggleSelectAll() {
    setCandidates((list) => list.map((c) => (c.phoneNumber ? { ...c, selected: !allSelected } : c)));
  }

  function handleImport() {
    const ready = candidates.filter((c) => c.selected && c.phoneNumber);
    if (ready.length === 0) {
      Alert.alert(t("imp.nothingTitle"), t("imp.nothingMsg"));
      return;
    }
    onImport(
      ready.map((c) => ({
        name: c.name,
        phoneNumber: c.phoneNumber,
        month: c.month,
        day: c.day,
        message: getTemplates()[0].text,
      })),
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("imp.title")}</Text>
          <TouchableOpacity
            onPress={handleImport}
            activeOpacity={0.85}
            disabled={selectedCount === 0}
            style={[styles.importButton, selectedCount === 0 && styles.importButtonDisabled]}
          >
            <Text style={[styles.importText, selectedCount === 0 && styles.importTextDisabled]}>
              {selectedCount > 0 ? t("imp.add", { n: selectedCount }) : t("imp.addEmpty")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Source switch */}
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, source === "contacts" && styles.segmentActive]}
            onPress={() => setSource("contacts")}
          >
            <Feather name="users" size={15} color={source === "contacts" ? COLORS.accent : COLORS.subtext} />
            <Text style={[styles.segmentText, source === "contacts" && styles.segmentTextActive]}>{t("imp.contacts")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, source === "calendar" && styles.segmentActive]}
            onPress={() => setSource("calendar")}
          >
            <Feather name="calendar" size={15} color={source === "calendar" ? COLORS.accent : COLORS.subtext} />
            <Text style={[styles.segmentText, source === "calendar" && styles.segmentTextActive]}>{t("imp.calendar")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sourceHint}>
          {source === "contacts" ? t("imp.hintContacts") : t("imp.hintCalendar")}
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loading} color={COLORS.accent} />
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {candidates.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="calendar" size={24} color={COLORS.faintText} />
                </View>
                <Text style={styles.empty}>{t("imp.emptyTitle")}</Text>
                <Text style={styles.emptySub}>
                  {source === "contacts" ? t("imp.emptySubContacts") : t("imp.emptySubCalendar")}
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll} activeOpacity={0.7}>
                  <Text style={styles.selectAllText}>
                    {t("imp.selectedOf", { sel: selectedCount, matched: matchedCount })}
                  </Text>
                  <Text style={styles.selectAllAction}>
                    {allSelected ? t("imp.deselectAll") : t("imp.selectAll")}
                  </Text>
                </TouchableOpacity>

                {candidates.map((c) => {
                  const hasPhone = Boolean(c.phoneNumber);
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.card, c.selected && styles.cardSelected]}
                      activeOpacity={hasPhone ? 0.7 : 1}
                      onPress={() => toggle(c.key)}
                    >
                      <Avatar name={c.name} size={42} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.rowDate} numberOfLines={1}>
                          {FORMATTER.format(new Date(2020, c.month - 1, c.day))}
                          {hasPhone ? ` · ${c.phoneNumber}` : ` · ${t("imp.noNumber")}`}
                        </Text>
                      </View>
                      {hasPhone ? (
                        <View style={[styles.checkbox, c.selected && styles.checkboxChecked]}>
                          {c.selected && <Feather name="check" size={14} color="#fff" />}
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.linkButton} onPress={() => pickPhoneFor(c.key)}>
                          <Text style={styles.linkButtonText}>{t("imp.link")}</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  cancel: { fontSize: 15, color: COLORS.subtext, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  importButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...SHADOWS.accent,
  },
  importButtonDisabled: { backgroundColor: COLORS.segmentBg, shadowOpacity: 0, elevation: 0 },
  importText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  importTextDisabled: { color: COLORS.faintText },
  segmented: {
    flexDirection: "row",
    backgroundColor: COLORS.segmentBg,
    borderRadius: RADIUS.md,
    padding: 3,
    marginHorizontal: 20,
    marginTop: 16,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: COLORS.surface, ...SHADOWS.card },
  segmentText: { fontSize: 14, fontWeight: "700", color: COLORS.subtext },
  segmentTextActive: { color: COLORS.accent },
  sourceHint: { fontSize: 12.5, color: COLORS.subtext, marginHorizontal: 20, marginTop: 10 },
  loading: { marginTop: 50 },
  body: { padding: 20 },
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.segmentBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  empty: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: COLORS.subtext, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 19 },
  selectAllRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  selectAllText: { fontSize: 12.5, color: COLORS.subtext, fontWeight: "500" },
  selectAllAction: { fontSize: 12.5, color: COLORS.accent, fontWeight: "800" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...SHADOWS.card,
  },
  cardSelected: { borderColor: COLORS.accent },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  rowDate: { fontSize: 12.5, color: COLORS.subtext, marginTop: 2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  linkButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  linkButtonText: { fontSize: 12.5, color: COLORS.accent, fontWeight: "800" },
});
