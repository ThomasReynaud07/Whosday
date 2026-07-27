// WhosDay design system.
// A vivid indigo primary paired with a warm "celebration" pink, on a soft
// off-white canvas. Elevated white cards + generous radii give it a modern,
// premium feel. The keys used across the app (accent, subtext, ...) are kept
// so everything picks up the new palette automatically.

export const COLORS = {
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
};

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
