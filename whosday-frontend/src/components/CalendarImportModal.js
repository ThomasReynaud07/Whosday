import React, { useEffect, useState } from "react";
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
import { COLORS } from "../theme";
import { MESSAGE_TEMPLATES } from "../messageTemplates";
import Avatar from "./Avatar";

const FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

function normalize(name) {
  return name.trim().toLowerCase();
}

// The iOS "Birthdays" calendar is a special read-only calendar Apple
// generates from Contacts. It only carries name + date, no phone number -
// so we cross-reference against Contacts by name and pre-fill/pre-select
// anything that matches. Anything left unmatched can still be linked to a
// contact manually, or just skipped and added by hand later.
export default function CalendarImportModal({ visible, onClose, onImport }) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    if (visible) loadCalendarBirthdays();
  }, [visible]);

  async function loadCalendarBirthdays() {
    setLoading(true);
    try {
      const calendarPerm = await Calendar.requestCalendarPermissionsAsync();
      if (calendarPerm.status !== "granted") {
        Alert.alert("Permission requise", "Active l'accès au Calendrier dans Réglages pour importer.");
        setCandidates([]);
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const birthdayCalendar = calendars.find(
        (c) => c.title === "Birthdays" || c.source?.name === "Birthdays",
      );
      if (!birthdayCalendar) {
        Alert.alert("Introuvable", "Aucun calendrier Anniversaires trouvé sur cet appareil.");
        setCandidates([]);
        return;
      }

      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      const events = await Calendar.getEventsAsync([birthdayCalendar.id], start, end);

      // Best-effort: only used to pre-fill phone numbers, so a denied
      // permission here just means nothing gets auto-matched.
      let phoneByName = {};
      const contactsPerm = await Contacts.requestPermissionsAsync();
      if (contactsPerm.status === "granted") {
        const { data: contacts } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });
        phoneByName = Object.fromEntries(
          contacts
            .filter((c) => c.name && c.phoneNumbers?.length)
            .map((c) => [normalize(c.name), c.phoneNumbers[0].number.replace(/[^\d+]/g, "")]),
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
      Alert.alert("Erreur Calendrier", err.message);
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
      const phone = contact?.phoneNumbers?.[0]?.number;
      if (phone) {
        setCandidates((list) =>
          list.map((c) =>
            c.key === key
              ? { ...c, phoneNumber: phone.replace(/[^\d+]/g, ""), selected: true }
              : c,
          ),
        );
      }
    } catch (err) {
      Alert.alert("Erreur Contacts", err.message);
    }
  }

  const matchedCount = candidates.filter((c) => c.phoneNumber).length;
  const selectedCount = candidates.filter((c) => c.selected).length;
  const allSelected = matchedCount > 0 && selectedCount === matchedCount;

  function toggleSelectAll() {
    setCandidates((list) =>
      list.map((c) => (c.phoneNumber ? { ...c, selected: !allSelected } : c)),
    );
  }

  function handleImport() {
    const ready = candidates.filter((c) => c.selected && c.phoneNumber);
    if (ready.length === 0) {
      Alert.alert("Rien à importer", "Sélectionne au moins un anniversaire avec un numéro.");
      return;
    }
    onImport(
      ready.map((c) => ({
        name: c.name,
        phoneNumber: c.phoneNumber,
        month: c.month,
        day: c.day,
        message: MESSAGE_TEMPLATES[0].text,
      })),
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Importer du Calendrier</Text>
          <TouchableOpacity onPress={handleImport}>
            <Text style={[styles.headerAction, styles.headerActionPrimary]}>Importer</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} color={COLORS.accent} />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            {candidates.length === 0 && (
              <Text style={styles.empty}>
                Aucun anniversaire trouvé dans ton calendrier iOS.
              </Text>
            )}

            {candidates.length > 0 && (
              <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
                <Text style={styles.selectAllText}>
                  {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""} sur {matchedCount} avec numéro
                </Text>
                <Text style={styles.selectAllAction}>
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Text>
              </TouchableOpacity>
            )}

            {candidates.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={styles.row}
                activeOpacity={c.phoneNumber ? 0.6 : 1}
                onPress={() => toggle(c.key)}
              >
                <Avatar name={c.name} size={38} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowDate}>
                    {FORMATTER.format(new Date(2020, c.month - 1, c.day))}
                    {c.phoneNumber ? ` · ${c.phoneNumber}` : ""}
                  </Text>
                </View>
                {c.phoneNumber ? (
                  <View style={[styles.checkbox, c.selected && styles.checkboxChecked]}>
                    {c.selected && <Feather name="check" size={14} color="#fff" />}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => pickPhoneFor(c.key)}
                  >
                    <Text style={styles.linkButtonText}>Lier</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  headerAction: { fontSize: 15, color: COLORS.subtext },
  headerActionPrimary: { color: COLORS.accent, fontWeight: "700" },
  loading: { marginTop: 40 },
  body: { padding: 20 },
  empty: { textAlign: "center", color: COLORS.faintText, marginTop: 24 },
  selectAllRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  selectAllText: { fontSize: 12, color: COLORS.faintText },
  selectAllAction: { fontSize: 12, color: COLORS.accent, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  rowDate: { fontSize: 12, color: COLORS.subtext, marginTop: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  linkButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  linkButtonText: { fontSize: 12, color: COLORS.accent, fontWeight: "700" },
});
