// WhosDay design system.
// A vivid indigo primary paired with a warm "celebration" pink. Two palettes
// (light + dark) share the exact same keys, so screens read colors through
// useTheme() and switch automatically. The indigo accent is kept in both so
// branding stays consistent.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightTheme = {
  // Primary (indigo)
  accent: "#6366F1",
  accentDark: "#4F46E5",
  accentSoft: "#EEF0FF",
  accentSofter: "#F5F6FF",

  // Celebration (pink) - used for "today"/soon birthday accents
  celebrate: "#F65C8E",
  celebrateSoft: "#FFEDF2",

  // Text
  text: "#141726",
  subtext: "#6E7180",
  faintText: "#A2A5B4",

  // Surfaces & lines
  screenBg: "#F7F8FC",
  surface: "#FFFFFF",
  border: "#ECEDF3",
  divider: "#F2F3F7",
  segmentBg: "#EFF0F6",
  avatarBg: "#F0F1F7",

  // Status
  danger: "#EF4444",
  dangerSoft: "#FDECEC",
  success: "#16A34A",
  successSoft: "#E7F6EC",

  // Header hero foreground helpers (text on the indigo band)
  onAccent: "#FFFFFF",
  onAccentSoft: "rgba(255,255,255,0.82)",
  onAccentFaint: "rgba(255,255,255,0.55)",

  isDark: false,
};

export const darkTheme = {
  // Primary (indigo) - lighter tints so accents read on dark surfaces
  accent: "#818CF8",
  accentDark: "#A5B4FC",
  accentSoft: "#242747",
  accentSofter: "#1B1D33",

  celebrate: "#F97DA6",
  celebrateSoft: "#3A1F2C",

  text: "#F3F4F8",
  subtext: "#A6A9BA",
  faintText: "#71748A",

  screenBg: "#0E0F1A",
  surface: "#1A1B29",
  border: "#2A2C3F",
  divider: "#22243440",
  segmentBg: "#262A3E",
  avatarBg: "#262A3E",

  danger: "#F87171",
  dangerSoft: "#3A1F1F",
  success: "#34D399",
  successSoft: "#14301F",

  onAccent: "#FFFFFF",
  onAccentSoft: "rgba(255,255,255,0.82)",
  onAccentFaint: "rgba(255,255,255,0.55)",

  isDark: true,
};

// Backward-compatible default palette (light). Only used by any code that
// reads colors at module scope; components should use useTheme() instead.
export const COLORS = lightTheme;

// ---- Theme context (light / dark / system) ----

const THEME_PREF_KEY = "themePref"; // "light" | "dark" | "system"
const ThemeContext = createContext({ colors: lightTheme, pref: "system", setPref: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // "light" | "dark" | null, reacts live
  const [pref, setPrefState] = useState("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREF_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const setPref = (value) => {
    setPrefState(value);
    AsyncStorage.setItem(THEME_PREF_KEY, value).catch(() => {});
  };

  const scheme = pref === "system" ? system || "light" : pref;
  const colors = scheme === "dark" ? darkTheme : lightTheme;

  const value = useMemo(() => ({ colors, pref, setPref }), [colors, pref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Returns the active palette (same keys as COLORS). Screens do:
//   const COLORS = useTheme();
// so existing `COLORS.x` references keep working unchanged.
export function useTheme() {
  return useContext(ThemeContext).colors;
}

// For the settings toggle: current preference + setter.
export function useThemePref() {
  const { pref, setPref } = useContext(ThemeContext);
  return { pref, setPref };
}

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const SPACING = {
  screen: 20,
};

// iOS-friendly soft shadows (Android uses elevation).
export const SHADOWS = {
  card: {
    shadowColor: "#1B1D3A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#1B1D3A",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  accent: {
    shadowColor: "#6366F1",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

const AVATAR_PALETTE = [
  { bg: "#EEF0FF", fg: "#6366F1" },
  { bg: "#FFEDF2", fg: "#F65C8E" },
  { bg: "#E7F6EC", fg: "#16A34A" },
  { bg: "#FFF3E3", fg: "#E08A1E" },
  { bg: "#E6F3FE", fg: "#2E80EB" },
  { bg: "#F3EBFE", fg: "#8B5CF6" },
  { bg: "#E4F8F5", fg: "#0FA79A" },
];

export function avatarColorFor(name) {
  const key = name || "?";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initialsFor(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
