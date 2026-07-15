export const COLORS = {
  accent: "#5B5FEF",
  accentSoft: "#EEEEFD",
  text: "#111114",
  subtext: "#8A8A93",
  faintText: "#B0B0B8",
  border: "#EBEBEF",
  divider: "#F0F0F3",
  segmentBg: "#F4F4F6",
  screenBg: "#FAFAFB",
  avatarBg: "#F1F1F4",
  danger: "#E5484D",
  success: "#22C55E",
};

const AVATAR_PALETTE = [
  { bg: "#EEEEFD", fg: "#5B5FEF" },
  { bg: "#FDEEF3", fg: "#E1497A" },
  { bg: "#EAF6EF", fg: "#1F9D5C" },
  { bg: "#FFF4E5", fg: "#C9791C" },
  { bg: "#EAF2FD", fg: "#2563EB" },
];

export function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initialsFor(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
