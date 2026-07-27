import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import { FREE_LIMIT } from "../api";
import { purchasePro, restorePurchases } from "../purchases";
import { useI18n, t } from "../i18n";

export default function PaywallModal({ visible, onClose, onSubscribed, priceText = "CHF 4.90 / mois" }) {
  useI18n(); // re-render on language change
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [busy, setBusy] = useState(false);

  const benefits = [
    { icon: "gift", text: t("pay.benefit1", { limit: FREE_LIMIT }) },
    { icon: "send", text: t("pay.benefit2") },
    { icon: "bell", text: t("pay.benefit3") },
    { icon: "heart", text: t("pay.benefit4") },
  ];

  async function subscribe() {
    setBusy(true);
    try {
      const ok = await purchasePro();
      if (ok) {
        onSubscribed?.();
        onClose?.();
      }
    } catch (err) {
      Alert.alert(t("pay.soon"), err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      Alert.alert(
        ok ? t("pay.restoredTitle") : t("pay.noSubTitle"),
        ok ? t("pay.restoredMsg") : t("pay.noSubMsg"),
      );
      if (ok) {
        onSubscribed?.();
        onClose?.();
      }
    } catch (err) {
      Alert.alert(t("pay.soon"), err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={24} color={COLORS.faintText} />
        </TouchableOpacity>

        <View style={styles.body}>
          <View style={styles.crown}>
            <Feather name="star" size={34} color="#fff" />
          </View>
          <Text style={styles.title}>{t("pay.title")}</Text>
          <Text style={styles.subtitle}>{t("pay.subtitle")}</Text>

          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b.text} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Feather name={b.icon} size={16} color={COLORS.accent} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} activeOpacity={0.85} disabled={busy} onPress={subscribe}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>{t("pay.cta")}</Text>
                <Text style={styles.ctaPrice}>{priceText}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={restore} disabled={busy} style={styles.restore}>
            <Text style={styles.restoreText}>{t("pay.restore")}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>{t("pay.legal")}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  close: { alignSelf: "flex-end", padding: 16 },
  body: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  crown: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...SHADOWS.accent,
  },
  title: { fontSize: 30, fontWeight: "800", color: COLORS.text, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: COLORS.subtext, textAlign: "center", marginTop: 8, lineHeight: 21 },
  benefits: { alignSelf: "stretch", marginTop: 32, gap: 16 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "600" },
  footer: { paddingHorizontal: 28, paddingBottom: 12 },
  cta: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
    ...SHADOWS.accent,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  ctaPrice: { color: COLORS.onAccentSoft, fontWeight: "600", fontSize: 13, marginTop: 2 },
  restore: { alignItems: "center", paddingVertical: 14 },
  restoreText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },
  legal: { fontSize: 11, color: COLORS.faintText, textAlign: "center", lineHeight: 16 },
});
