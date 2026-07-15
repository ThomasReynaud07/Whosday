import React, { useCallback, useEffect, useState } from "react";
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
import axios from "axios";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
import { BACKEND_URL, authHeader } from "../api";
import { COLORS } from "../theme";
import Avatar from "../components/Avatar";
import LinkWhatsAppScreen from "./LinkWhatsAppScreen";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [wahaStatus, setWahaStatus] = useState("checking");
  const [relinkVisible, setRelinkVisible] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const headers = await authHeader();
      const { data } = await axios.get(`${BACKEND_URL}/waha-status`, { headers });
      setWahaStatus(data.status);
    } catch (err) {
      setWahaStatus("ERROR");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus, relinkVisible]);

  function handleSignOut() {
    Alert.alert("Déconnexion", "Tu es sûr de vouloir te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  const isWorking = wahaStatus === "WORKING";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Avatar name={user?.email || "?"} size={48} />
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Feather name="star" size={16} color={COLORS.faintText} />
            <Text style={styles.rowText}>Plan gratuit · jusqu'à 5 anniversaires</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.card} onPress={() => setRelinkVisible(true)}>
          <View style={styles.row}>
            <Feather
              name="message-circle"
              size={16}
              color={isWorking ? COLORS.success : COLORS.faintText}
            />
            {wahaStatus === "checking" ? (
              <ActivityIndicator size="small" color={COLORS.faintText} />
            ) : (
              <Text style={styles.rowText}>
                WhatsApp · {isWorking ? "Lié" : "Non lié"}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={COLORS.faintText} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Feather name="log-out" size={16} color={COLORS.danger} />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={relinkVisible} animationType="slide" presentationStyle="pageSheet">
        <LinkWhatsAppScreen
          onLinked={() => setRelinkVisible(false)}
          onClose={() => setRelinkVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  body: { paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  email: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { fontSize: 14, color: COLORS.subtext },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 8,
  },
  signOutText: { color: COLORS.danger, fontWeight: "700", fontSize: 15 },
});
