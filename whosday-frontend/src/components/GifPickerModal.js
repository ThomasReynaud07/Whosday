import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS } from "../theme";
import { t } from "../i18n";
import { searchGifs, GIPHY_READY } from "../giphy";

// Full-screen GIPHY search. onSelect receives { mp4, preview }.
export default function GifPickerModal({ visible, onClose, onSelect }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !GIPHY_READY) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchGifs(query)
        .then((res) => active && setGifs(res))
        .catch(() => active && setGifs([]))
        .finally(() => active && setLoading(false));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [visible, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("gif.title")}</Text>
          <View style={{ width: 60 }} />
        </View>

        {!GIPHY_READY ? (
          <View style={styles.center}>
            <Feather name="image" size={28} color={COLORS.faintText} />
            <Text style={styles.notReady}>{t("gif.notReady")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchField}>
              <Feather name="search" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("gif.search")}
                placeholderTextColor={COLORS.faintText}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {loading && gifs.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.accent} />
            ) : (
              <FlatList
                data={gifs}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.grid}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cell}
                    activeOpacity={0.7}
                    onPress={() => onSelect({ gif: item.gif, preview: item.preview })}
                  >
                    <Image source={{ uri: item.preview }} style={styles.gif} />
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  cancel: { fontSize: 15, color: COLORS.subtext, fontWeight: "500", width: 60 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  notReady: { color: COLORS.subtext, fontSize: 14, textAlign: "center" },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    margin: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 4 },
  gif: { flex: 1, borderRadius: 10, backgroundColor: COLORS.segmentBg },
});
