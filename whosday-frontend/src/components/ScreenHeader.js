import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOWS } from "../theme";

// The signature "hero" band at the top of each tab: a full-bleed indigo
// panel (extends under the status bar) with a big rounded bottom edge and
// white title/subtitle. `overlap` renders a card that floats over the bottom
// edge of the band - used for the search field on the Birthdays screen.
export default function ScreenHeader({ title, subtitle, right, overlap }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.row}>
          <View style={styles.titles}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ? <View>{right}</View> : null}
        </View>
        {overlap ? <View style={styles.overlapSpacer} /> : null}
      </View>
      {overlap ? <View style={styles.overlap}>{overlap}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.screenBg },
  hero: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    ...SHADOWS.accent,
  },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  titles: { flex: 1 },
  title: { fontSize: 30, fontWeight: "800", color: COLORS.onAccent, letterSpacing: -0.6 },
  subtitle: { fontSize: 14, color: COLORS.onAccentSoft, marginTop: 3, fontWeight: "500" },
  overlapSpacer: { height: 26 },
  overlap: { marginTop: -34, paddingHorizontal: 20 },
});
