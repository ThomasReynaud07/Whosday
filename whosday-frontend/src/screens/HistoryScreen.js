import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../api";
import { COLORS } from "../theme";
import Avatar from "../components/Avatar";

export default function HistoryScreen() {
  const [messages, setMessages] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await api.getMessagesSent());
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        <Text style={styles.subtitle}>Messages envoyés</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading && !initialLoad}
        onRefresh={load}
        ListEmptyComponent={
          initialLoad ? (
            <ActivityIndicator style={styles.loadingSpinner} color={COLORS.accent} />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="clock" size={28} color={COLORS.faintText} />
              <Text style={styles.empty}>Aucun message envoyé pour l'instant</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.name} size={36} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowDetail}>
                {item.phone_number} · {item.sent_at}
              </Text>
              {item.status === "failed" && item.error && (
                <Text style={styles.rowError}>{item.error}</Text>
              )}
            </View>
            <Feather
              name={item.status === "sent" ? "check-circle" : "x-circle"}
              size={18}
              color={item.status === "sent" ? COLORS.success : COLORS.danger}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  loadingSpinner: { marginTop: 60 },
  emptyState: { alignItems: "center", marginTop: 50, gap: 6 },
  empty: { color: COLORS.text, fontSize: 15, fontWeight: "600", marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  rowDetail: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  rowError: { fontSize: 12, color: COLORS.danger, marginTop: 2 },
});
