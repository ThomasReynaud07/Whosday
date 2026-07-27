import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import { BACKEND_URL, authHeader } from "../api";
import { useTheme } from "../theme";
import { useI18n, t } from "../i18n";

// Shown right after signup/login until the user's own WhatsApp is linked
// (every account gets its own WAHA session - see backend waha.js). Also
// reusable inside a modal from the Profile tab to relink later.
//
// Two linking methods:
//  - pairing code (default): enter your number, get an 8-char code, type it
//    into WhatsApp. Works when WhatsApp is on the same phone as this app.
//  - QR (fallback): scan from another device with a camera.
export default function LinkWhatsAppScreen({ onLinked, onClose }) {
  useI18n(); // re-render on language change
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [status, setStatus] = useState("checking");
  const [method, setMethod] = useState("code"); // "code" | "qr"
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [qrTick, setQrTick] = useState(0);
  const [headers, setHeaders] = useState(null);

  const checkStatus = useCallback(async () => {
    try {
      const h = await authHeader();
      setHeaders(h);
      const { data } = await axios.get(`${BACKEND_URL}/waha-status`, { headers: h });
      setStatus(data.status);
    } catch (err) {
      setStatus("ERROR");
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const onLinkedRef = useRef(onLinked);
  onLinkedRef.current = onLinked;
  useEffect(() => {
    if (status === "WORKING") onLinkedRef.current?.();
  }, [status]);

  useEffect(() => {
    if (method !== "qr" || status !== "SCAN_QR_CODE") return;
    const interval = setInterval(() => setQrTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, [method, status]);

  async function ensureHeaders() {
    if (headers) return headers;
    const h = await authHeader();
    setHeaders(h);
    return h;
  }

  // Pairing-code flow: make sure the session exists, then ask WAHA for a code.
  async function getPairingCode() {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 8) {
      setError(t("link.errPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    setCode(null);
    try {
      const h = await ensureHeaders();
      await axios.post(`${BACKEND_URL}/waha/start-session`, {}, { headers: h });
      // Give the fresh session a moment to be ready to issue a code.
      await new Promise((r) => setTimeout(r, 1500));
      const { data } = await axios.post(
        `${BACKEND_URL}/waha/request-code`,
        { phoneNumber: digits },
        { headers: h },
      );
      setCode(data.code);
    } catch (err) {
      setError(t("link.errCode"));
    } finally {
      setBusy(false);
    }
  }

  async function startQr() {
    setBusy(true);
    setError(null);
    try {
      const h = await ensureHeaders();
      await axios.post(`${BACKEND_URL}/waha/start-session`, {}, { headers: h });
      await checkStatus();
    } catch (err) {
      setError(t("link.errStart"));
    } finally {
      setBusy(false);
    }
  }

  const linking = status === "WORKING";

  return (
    <SafeAreaView style={styles.container}>
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>{t("common.close")}</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("link.title")}</Text>
          <Text style={styles.subtitle}>{t("link.subtitle")}</Text>

          {status === "checking" ? (
            <ActivityIndicator style={styles.spacer} color={COLORS.accent} />
          ) : linking ? (
            <View style={styles.spacer}>
              <Text style={styles.linkedText}>{t("link.linked")}</Text>
            </View>
          ) : (
            <>
              {/* Method switch */}
              <View style={styles.segmented}>
                <TouchableOpacity
                  style={[styles.segment, method === "code" && styles.segmentActive]}
                  onPress={() => setMethod("code")}
                >
                  <Text style={[styles.segmentText, method === "code" && styles.segmentTextActive]}>
                    {t("link.withCode")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, method === "qr" && styles.segmentActive]}
                  onPress={() => setMethod("qr")}
                >
                  <Text style={[styles.segmentText, method === "qr" && styles.segmentTextActive]}>
                    {t("link.withQr")}
                  </Text>
                </TouchableOpacity>
              </View>

              {method === "code" ? (
                <View style={styles.spacer}>
                  {code ? (
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeLabel}>{t("link.yourCode")}</Text>
                      <Text style={styles.code}>{code}</Text>
                      <Text style={styles.steps}>{t("link.steps")}</Text>
                      <TouchableOpacity
                        style={styles.linkButton}
                        onPress={getPairingCode}
                        disabled={busy}
                      >
                        <Text style={styles.linkButtonText}>
                          {busy ? "…" : t("link.newCode")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>{t("link.yourNumber")}</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={t("form.phone")}
                        placeholderTextColor={COLORS.faintText}
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                      />
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={busy}
                        onPress={getPairingCode}
                      >
                        <Text style={styles.primaryButtonText}>
                          {busy ? t("link.generating") : t("link.getCode")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.spacer}>
                  {status === "SCAN_QR_CODE" && headers ? (
                    <>
                      <Image
                        style={styles.qr}
                        source={{ uri: `${BACKEND_URL}/waha/qr?t=${qrTick}`, headers }}
                      />
                      <Text style={styles.subtitle}>{t("link.qrHint")}</Text>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={startQr}>
                      <Text style={styles.primaryButtonText}>
                        {busy ? t("link.starting") : t("link.showQr")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  flex: { flex: 1 },
  closeButton: { alignSelf: "flex-end", padding: 16 },
  closeText: { color: COLORS.subtext, fontSize: 15 },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.subtext, textAlign: "center", marginTop: 8 },
  spacer: { marginTop: 24, alignItems: "center" },
  linkedText: { fontSize: 16, fontWeight: "700", color: COLORS.success },
  segmented: {
    flexDirection: "row",
    backgroundColor: COLORS.segmentBg,
    borderRadius: 9,
    padding: 3,
    marginTop: 24,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.surface },
  segmentText: { fontSize: 14, fontWeight: "600", color: COLORS.subtext },
  segmentTextActive: { color: COLORS.text },
  fieldLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.faintText,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    alignSelf: "stretch",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  codeBlock: { alignItems: "center", alignSelf: "stretch" },
  codeLabel: { fontSize: 12, fontWeight: "700", color: COLORS.faintText, letterSpacing: 0.6 },
  code: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.accent,
    letterSpacing: 4,
    marginTop: 10,
    textAlign: "center",
  },
  codeCopy: { fontSize: 12, color: COLORS.subtext, textAlign: "center", marginTop: 4 },
  steps: { fontSize: 13, color: COLORS.subtext, textAlign: "center", marginTop: 18, lineHeight: 19 },
  stepsBold: { fontWeight: "700", color: COLORS.text },
  linkButton: { marginTop: 18, paddingVertical: 8 },
  linkButtonText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },
  qr: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 13, marginTop: 16, textAlign: "center" },
});
