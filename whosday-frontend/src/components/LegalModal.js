import React, { useMemo } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, RADIUS } from "../theme";
import { t } from "../i18n";

// Simple full-page reader for the legal texts (CGU / Privacy). Content is the
// plain-text string from src/legal.js.
export default function LegalModal({ visible, title, content, onClose }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
            <Feather name="x" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.text}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: COLORS.text },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.segmentBg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 20, paddingBottom: 48 },
  text: { fontSize: 14, lineHeight: 22, color: COLORS.text },
});
