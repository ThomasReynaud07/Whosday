import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import { BACKEND_URL, authHeader } from "../api";
import { COLORS } from "../theme";

// Shown right after signup/login until the user's own WhatsApp is linked
// (every account gets its own WAHA session - see backend waha.js). Also
// reusable inside a modal from the Profile tab to relink later.
export default function LinkWhatsAppScreen({ onLinked, onClose }) {
  const [status, setStatus] = useState("checking");
  const [busy, setBusy] = useState(false);
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
    if (status !== "SCAN_QR_CODE") return;
    const interval = setInterval(() => setQrTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, [status]);

  async function startLinking() {
    setBusy(true);
    try {
      const h = headers || (await authHeader());
      await axios.post(`${BACKEND_URL}/waha/start-session`, {}, { headers: h });
      await checkStatus();
    } catch (err) {
      setStatus("ERROR");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      const h = headers || (await authHeader());
      await axios.post(`${BACKEND_URL}/waha/restart-session`, {}, { headers: h });
      await checkStatus();
    } catch (err) {
      setStatus("ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Fermer</Text>
        </TouchableOpacity>
      )}

      <View style={styles.body}>
        <Text style={styles.title}>Lier WhatsApp</Text>
        <Text style={styles.subtitle}>
          WhosDay envoie les messages d'anniversaire depuis ton propre WhatsApp.
        </Text>

        {(status === "checking" || status === "STARTING") && (
          <ActivityIndicator style={styles.spacer} color={COLORS.accent} />
        )}

        {(status === "NOT_CREATED" || status === "STOPPED") && (
          <TouchableOpacity
            style={[styles.primaryButton, styles.spacer]}
            disabled={busy}
            onPress={startLinking}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? "Démarrage…" : "Lier WhatsApp"}
            </Text>
          </TouchableOpacity>
        )}

        {status === "SCAN_QR_CODE" && headers && (
          <View style={styles.spacer}>
            <Image
              style={styles.qr}
              source={{ uri: `${BACKEND_URL}/waha/qr?t=${qrTick}`, headers }}
            />
            <Text style={styles.subtitle}>
              WhatsApp → Appareils connectés → Connecter un appareil, puis scanne.
            </Text>
          </View>
        )}

        {status === "FAILED" && (
          <View style={styles.spacer}>
            <Text style={styles.errorText}>Le QR code a expiré avant d'être scanné.</Text>
            <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={retry}>
              <Text style={styles.primaryButtonText}>
                {busy ? "Nouvelle tentative…" : "Réessayer"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "ERROR" && (
          <View style={styles.spacer}>
            <Text style={styles.errorText}>Impossible de joindre le serveur.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={checkStatus}>
              <Text style={styles.primaryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  closeButton: { alignSelf: "flex-end", padding: 16 },
  closeText: { color: COLORS.subtext, fontSize: 15 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 14,
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 8,
  },
  spacer: { marginTop: 24, alignItems: "center" },
  qr: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorText: { color: COLORS.danger, fontSize: 14, marginBottom: 12, textAlign: "center" },
});
