import React, { useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { COLORS } from "../theme";

const FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

// UIDatePicker needs an explicit width >= 280pt or it fails to lay itself
// out correctly on iOS (known issue with this library on RN's New
// Architecture - the component doesn't inherit a usable width from flexbox
// alone, so without this it can render squished/unresponsive).
const PICKER_WIDTH = Math.min(Dimensions.get("window").width - 80, 340);

function toDate(month, day) {
  const d = new Date();
  d.setMonth((month || 1) - 1, day || 1);
  d.setHours(12, 0, 0, 0); // avoid DST/midnight edge cases shifting the day
  return d;
}

// Tap to reveal a native calendar/date wheel instead of typing month/day by
// hand. The year is shown (native pickers don't support hiding it) but only
// month + day are ever read back - birthdays repeat every year.
export default function DateField({ month, day, onChange }) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(month && day);

  function handleChange(event, date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed") return;
    if (date) onChange({ month: date.getMonth() + 1, day: date.getDate() });
  }

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)}>
        <Feather name="calendar" size={16} color={COLORS.faintText} />
        <Text style={hasValue ? styles.value : styles.placeholder}>
          {hasValue ? FORMATTER.format(toDate(month, day)) : "Date de naissance"}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            style={styles.picker}
            value={toDate(month, day)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale="fr-FR"
            onChange={handleChange}
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.doneButton} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>OK</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  value: { fontSize: 15, color: COLORS.text, fontWeight: "600" },
  placeholder: { fontSize: 15, color: COLORS.faintText },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
  },
  picker: { width: PICKER_WIDTH },
  doneButton: { paddingVertical: 8, paddingHorizontal: 16 },
  doneText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
});
