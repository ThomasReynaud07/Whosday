import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../supabase";
import { useTheme, RADIUS, SHADOWS } from "../theme";
import { useI18n, t } from "../i18n";

export default function AuthScreen() {
  useI18n(); // re-render on language change
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert(t("auth.missingTitle"), t("auth.missingMsg"));
      return;
    }
    setLoading(true);
    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (mode === "signup") {
        Alert.alert(t("auth.checkEmailTitle"), t("auth.checkEmailMsg"));
      }
    } catch (err) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Feather name="gift" size={34} color="#fff" />
          </View>
          <Text style={styles.title}>WhosDay</Text>
          <Text style={styles.tagline}>{t("auth.tagline")}</Text>

          <View style={styles.card}>
            {/* Segmented login / signup */}
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, mode === "login" && styles.segmentActive]}
                onPress={() => setMode("login")}
              >
                <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>
                  {t("auth.login")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, mode === "signup" && styles.segmentActive]}
                onPress={() => setMode("signup")}
              >
                <Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>
                  {t("auth.signup")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <Feather name="mail" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.input}
                placeholder={t("auth.email")}
                placeholderTextColor={COLORS.faintText}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputRow}>
              <Feather name="lock" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.input}
                placeholder={t("auth.password")}
                placeholderTextColor={COLORS.faintText}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerHint}>
            {mode === "login" ? t("auth.footerLogin") : t("auth.footerSignup")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  badge: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
    ...SHADOWS.accent,
  },
  title: { fontSize: 32, fontWeight: "800", color: COLORS.text, letterSpacing: -0.6, textAlign: "center" },
  tagline: { fontSize: 15, color: COLORS.subtext, textAlign: "center", marginTop: 6, marginBottom: 28 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    ...SHADOWS.card,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: COLORS.segmentBg,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: 18,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.surface, ...SHADOWS.card },
  segmentText: { fontSize: 14, fontWeight: "700", color: COLORS.subtext },
  segmentTextActive: { color: COLORS.accent },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.text },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
    ...SHADOWS.accent,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  footerHint: { fontSize: 13, color: COLORS.faintText, textAlign: "center", marginTop: 22, lineHeight: 19 },
});
