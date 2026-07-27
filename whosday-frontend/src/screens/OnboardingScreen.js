import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import { t } from "../i18n";

// First-launch intro. Three slides explaining the promise, the WhatsApp link,
// and adding a birthday. Shown once (a flag is stored by the caller). Colors
// are stored as theme keys and resolved against the active palette.
const SLIDES = [
  { icon: "gift", colorKey: "accent", bgKey: "accentSoft", titleKey: "onb.t1", descKey: "onb.d1" },
  { icon: "message-circle", colorKey: "success", bgKey: "successSoft", titleKey: "onb.t2", descKey: "onb.d2" },
  { icon: "clock", colorKey: "celebrate", bgKey: "celebrateSoft", titleKey: "onb.t3", descKey: "onb.d3" },
];

export default function OnboardingScreen({ onDone }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function next() {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {!isLast ? (
          <TouchableOpacity onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>{t("onb.skip")}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.hero}>
        <View style={[styles.iconCircle, { backgroundColor: COLORS[slide.bgKey] }]}>
          <Feather name={slide.icon} size={54} color={COLORS[slide.colorKey]} />
        </View>
        <Text style={styles.title}>{t(slide.titleKey)}</Text>
        <Text style={styles.desc}>{t(slide.descKey)}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={next}>
          <Text style={styles.buttonText}>{isLast ? t("onb.start") : t("onb.next")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  topBar: { height: 44, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 22 },
  skip: { color: COLORS.subtext, fontWeight: "700", fontSize: 15 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, textAlign: "center", marginBottom: 14 },
  desc: { fontSize: 16, lineHeight: 24, color: COLORS.subtext, textAlign: "center", fontWeight: "500" },
  footer: { paddingHorizontal: 24, paddingBottom: 28 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.accent, width: 22 },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.pill,
    paddingVertical: 17,
    alignItems: "center",
    ...SHADOWS.accent,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
