import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert("Informations manquantes", "Entre ton email et ton mot de passe.");
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
        Alert.alert("Vérifie ton email", "Confirme ton adresse pour terminer l'inscription.");
      }
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.title}>WhosDay</Text>
          <Text style={styles.subtitle}>
            {mode === "login" ? "Connecte-toi à ton compte" : "Crée ton compte"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.faintText}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={COLORS.faintText}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            disabled={loading}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "login" ? "Se connecter" : "S'inscrire"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          >
            <Text style={styles.switchButtonText}>
              {mode === "login"
                ? "Pas encore de compte ? Inscris-toi"
                : "Déjà un compte ? Connecte-toi"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: { fontSize: 14, color: COLORS.subtext, textAlign: "center", marginTop: 6, marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchButton: { marginTop: 18, alignItems: "center" },
  switchButtonText: { color: COLORS.accent, fontWeight: "600", fontSize: 13 },
});
