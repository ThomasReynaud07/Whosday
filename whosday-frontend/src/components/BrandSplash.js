import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLORS, SHADOWS } from "../theme";
import { t } from "../i18n";

// Shown while the app boots (auth session restore, etc.) - takes over
// immediately as the native splash screen hides, so there's no flash of
// blank white in between.
export default function BrandSplash() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Feather name="gift" size={36} color="#fff" />
      </View>
      <Text style={styles.title}>WhosDay</Text>
      <Text style={styles.subtitle}>{t("auth.tagline")}</Text>
      <ActivityIndicator style={styles.spinner} color={COLORS.faintText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.screenBg,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...SHADOWS.accent,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: COLORS.subtext, marginTop: 6 },
  spinner: { marginTop: 28 },
});
