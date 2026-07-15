import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, friendlyErrorMessage } from "../api";
import { COLORS } from "../theme";
import TimeField from "../components/TimeField";
import Avatar from "../components/Avatar";
import BirthdayFormModal from "../components/BirthdayFormModal";
import CalendarImportModal from "../components/CalendarImportModal";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function daysUntilNext(month, day) {
  const now = new Date();
  const thisYear = now.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  next.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < today) next = new Date(thisYear + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

function dateBadgeLabel(days) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days}j`;
}

export default function BirthdaysScreen() {
  const [birthdays, setBirthdays] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [sortMode, setSortMode] = useState("date");

  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const loadBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      setBirthdays(await api.getBirthdays());
    } catch (err) {
      Alert.alert("Erreur", `Impossible de joindre le serveur.\n${err.message}`);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api.getSettings());
    } catch (err) {
      // Non bloquant - un pull-to-refresh permettra de réessayer.
    }
  }, []);

  useEffect(() => {
    loadBirthdays();
    loadSettings();
  }, [loadBirthdays, loadSettings]);

  const sortedBirthdays = useMemo(() => {
    const list = [...birthdays];
    if (sortMode === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => daysUntilNext(a.month, a.day) - daysUntilNext(b.month, b.day));
    }
    return list;
  }, [birthdays, sortMode]);

  async function saveSettings() {
    if (settings.sendMode === "fixed" && !TIME_RE.test(settings.fixedTime)) {
      Alert.alert("Heure invalide", "Utilise le format HH:MM, ex. 09:00.");
      return;
    }
    setSavingSettings(true);
    try {
      await api.updateSettings(settings);
      await loadSettings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Erreur", err.response?.data?.error || err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitForm(payload) {
    try {
      if (editingBirthday) {
        await api.updateBirthday(editingBirthday.id, payload);
      } else {
        await api.createBirthday(payload);
      }
      setFormVisible(false);
      setEditingBirthday(null);
      loadBirthdays();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Erreur", friendlyErrorMessage(err));
    }
  }

  async function deleteBirthday(id) {
    try {
      await api.deleteBirthday(id);
      loadBirthdays();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Alert.alert("Erreur", err.response?.data?.error || err.message);
    }
  }

  async function testSend(id, name) {
    setBusyId(id);
    try {
      await api.sendBirthday(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Envoyé", `Message envoyé à ${name}.`);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Échec de l'envoi", err.response?.data?.error || err.message);
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
      Alert.alert(
        succeeded > 0 ? `${succeeded} importé(s), le reste a échoué` : "Erreur",
        friendlyErrorMessage(firstError),
      );
    } else {
      Alert.alert("Importé", `${succeeded} anniversaire(s) ajouté(s).`);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WhosDay</Text>
        <Text style={styles.subtitle}>Rappels d'anniversaires</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sortedBirthdays}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading && !initialLoad}
        onRefresh={() => {
          loadBirthdays();
          loadSettings();
        }}
        ListHeaderComponent={
          <>
            {settings && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Feather name="clock" size={13} color={COLORS.faintText} />
                  <Text style={styles.sectionLabel}>HEURE D'ENVOI AUTO</Text>
                </View>
                <View style={styles.segmented}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.segment, settings.sendMode === "fixed" && styles.segmentActive]}
                    onPress={() => setSettings((s) => ({ ...s, sendMode: "fixed" }))}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        settings.sendMode === "fixed" && styles.segmentTextActive,
                      ]}
                    >
                      Fixe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.segment, settings.sendMode === "random" && styles.segmentActive]}
                    onPress={() => setSettings((s) => ({ ...s, sendMode: "random" }))}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        settings.sendMode === "random" && styles.segmentTextActive,
                      ]}
                    >
                      Aléatoire
                    </Text>
                  </TouchableOpacity>
                </View>

                {settings.sendMode === "fixed" ? (
                  <TimeField
                    value={settings.fixedTime}
                    onChange={(fixedTime) => setSettings((s) => ({ ...s, fixedTime }))}
                  />
                ) : (
                  <View style={styles.row}>
                    <View style={styles.rowInput}>
                      <TimeField
                        value={settings.randomWindowStart}
                        onChange={(randomWindowStart) =>
                          setSettings((s) => ({ ...s, randomWindowStart }))
                        }
                      />
                    </View>
                    <View style={styles.rowInput}>
                      <TimeField
                        value={settings.randomWindowEnd}
                        onChange={(randomWindowEnd) =>
                          setSettings((s) => ({ ...s, randomWindowEnd }))
                        }
                      />
                    </View>
                  </View>
                )}

                <View style={styles.settingsFooter}>
                  {settings.todayTargetTime ? (
                    <View style={styles.hintRow}>
                      <View style={styles.hintDot} />
                      <Text style={styles.settingsHint}>
                        Aujourd'hui à {settings.todayTargetTime}
                      </Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.saveButton}
                    disabled={savingSettings}
                    onPress={saveSettings}
                  >
                    <Text style={styles.saveButtonText}>
                      {savingSettings ? "Enregistrement…" : "Enregistrer"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryButton}
                onPress={() => {
                  setEditingBirthday(null);
                  setFormVisible(true);
                }}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Ajouter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.secondaryButton}
                onPress={() => setCalendarVisible(true)}
              >
                <Feather name="calendar" size={16} color={COLORS.accent} />
                <Text style={styles.secondaryButtonText}>Importer</Text>
              </TouchableOpacity>
            </View>

            {sortedBirthdays.length > 0 && (
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionLabel}>
                  {birthdays.length} ANNIVERSAIRE{birthdays.length > 1 ? "S" : ""}
                </Text>
                <TouchableOpacity
                  onPress={() => setSortMode((m) => (m === "date" ? "name" : "date"))}
                >
                  <Text style={styles.sortToggle}>
                    Trier : {sortMode === "date" ? "Date" : "Nom"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          initialLoad ? (
            <ActivityIndicator style={styles.loadingSpinner} color={COLORS.accent} />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="gift" size={28} color={COLORS.faintText} />
              <Text style={styles.empty}>Aucun anniversaire pour l'instant</Text>
              <Text style={styles.emptySubtext}>
                Ajoutes-en un, ou importe depuis Contacts / Calendrier ci-dessus.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const days = daysUntilNext(item.month, item.day);
          const isSoon = days <= 1;
          return (
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.card}
              onPress={() => {
                setEditingBirthday(item);
                setFormVisible(true);
              }}
            >
              <Avatar name={item.name} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDetail}>{item.phoneNumber}</Text>
              </View>
              <View style={[styles.dateBadge, isSoon && styles.dateBadgeSoon]}>
                <Text style={[styles.dateBadgeText, isSoon && styles.dateBadgeTextSoon]}>
                  {dateBadgeLabel(days)}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.iconButton}
                disabled={busyId === item.id}
                onPress={() => testSend(item.id, item.name)}
              >
                <Feather name="send" size={15} color={busyId === item.id ? "#C7C7CC" : COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.iconButton}
                onPress={() => deleteBirthday(item.id)}
              >
                <Feather name="trash-2" size={15} color={COLORS.danger} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      <BirthdayFormModal
        visible={formVisible}
        initialValues={editingBirthday}
        onClose={() => {
          setFormVisible(false);
          setEditingBirthday(null);
        }}
        onSubmit={submitForm}
      />

      <CalendarImportModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onImport={importFromCalendar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: COLORS.faintText,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: COLORS.segmentBg,
    borderRadius: 9,
    padding: 3,
    marginBottom: 12,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: "center" },
  segmentActive: { backgroundColor: "#FFFFFF" },
  segmentText: { fontSize: 13, fontWeight: "600", color: COLORS.subtext },
  segmentTextActive: { color: COLORS.text },
  settingsFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  settingsHint: { fontSize: 13, color: COLORS.subtext },
  saveButton: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  saveButtonText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },
  row: { flexDirection: "row", gap: 10 },
  rowInput: { flex: 1 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sortToggle: { fontSize: 12, color: COLORS.accent, fontWeight: "600" },
  loadingSpinner: { marginTop: 60 },
  emptyState: { alignItems: "center", marginTop: 50, gap: 6 },
  empty: { color: COLORS.text, fontSize: 15, fontWeight: "600", marginTop: 4 },
  emptySubtext: { color: COLORS.faintText, fontSize: 13, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  cardDetail: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  dateBadge: {
    backgroundColor: COLORS.segmentBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateBadgeSoon: { backgroundColor: COLORS.accentSoft },
  dateBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.subtext },
  dateBadgeTextSoon: { color: COLORS.accent },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
});
