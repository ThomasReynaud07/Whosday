import React, { useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS } from "../theme";

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
  const [open, setOpen] = useState(false);

  function handleChange(event, date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed") return;
    if (date) onChange(dateToHM(date));
  }

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{value}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            style={styles.picker}
            value={hmToDate(value)}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  value: { fontSize: 15, color: COLORS.text, fontWeight: "600" },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginTop: 8,
    alignItems: "center",
    paddingBottom: 8,
  },
  picker: { width: PICKER_WIDTH },
  doneButton: { paddingVertical: 8, paddingHorizontal: 16 },
  doneText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
});
