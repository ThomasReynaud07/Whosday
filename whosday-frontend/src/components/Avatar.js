import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { avatarColorFor, initialsFor } from "../theme";

export default function Avatar({ name, size = 40 }) {
  const { bg, fg } = avatarColorFor(name);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initials, { color: fg, fontSize: size * 0.4 }]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "700" },
});
