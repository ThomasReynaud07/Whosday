import React, { useMemo, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS } from "../theme";
import { useI18n, t } from "../i18n";

// 24-hour locales per app language (avoids the iOS AM/PM picker).
const LOCALE_24H = { fr: "fr-FR", de: "de-DE", en: "en-GB" };

// UIDatePicker needs an explicit width >= 280pt or it fails to lay itself
// out correctly on iOS - see DateField.js for the full explanation.
const PICKER_WIDTH = Math.min(Dimensions.get("window").width - 80, 340);

function hmToDate(hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToHM(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

// Tap the field to reveal a native scrollable time wheel (iOS "spinner" /
// Android's default clock dialog), instead of typing "HH:MM" by hand.
export default function TimeField({ value, onChange }) {
  const { lang } = useI18n();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);

  function handleChange(event, date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed") return;
    if (date) onChange(dateToHM(date));
  }

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Feather name="clock" size={17} color={COLORS.faintText} />
        <Text style={styles.value}>{value}</Text>
        <Feather name="chevron-down" size={16} color={COLORS.faintText} />
      </TouchableOpacity>

      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            style={styles.picker}
            value={hmToDate(value)}
            mode="time"
            is24Hour={true}
            locale={LOCALE_24H[lang] || "fr-FR"}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.doneText}>{t("common.ok")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  value: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "700" },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 8,
    alignItems: "center",
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
  },
  picker: { width: PICKER_WIDTH },
  doneButton: { paddingVertical: 8, paddingHorizontal: 16 },
  doneText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
});
