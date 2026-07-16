/**
 * Design-system tokens (design-system foundation).
 *
 * Single source of truth for palette, elevation (shadows), gradient stops, and
 * a radius scale — mirrors the Tailwind theme in `tailwind.config.js` so both
 * NativeWind class names and inline RN style objects stay in sync. This file is
 * presentational-only: no backend, auth, or data logic lives here.
 */
import type { ViewStyle } from "react-native";

/**
 * Core palette. Matches `theme.extend.colors` in tailwind.config.js so a value
 * referenced inline (e.g. an icon `color`) is identical to its utility class.
 */
export const colors = {
  primary: "#22C55E",
  primaryDark: "#16A34A",
  secondary: "#10B981",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  ink: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  green: {
    50: "#F0FDF4",
    100: "#BBF7D0",
    300: "#86EFAC",
    600: "#16A34A",
    700: "#065F46",
  },
  amber: {
    bg: "#FEF3C7",
    text: "#92400E",
    base: "#F59E0B",
  },
  blue: {
    bg: "#EFF6FF",
    text: "#1D4ED8",
    base: "#3B82F6",
  },
  danger: {
    bg: "#FEF2F2",
    text: "#DC2626",
    base: "#EF4444",
  },
} as const;

/**
 * Elevation presets as RN style objects (React Native has no CSS box-shadow).
 * `soft` for chips/inputs, `card` for content cards, `floating` for FABs and
 * elevated surfaces. `elevation` covers Android; `shadow*` covers iOS.
 */
export const shadows = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  floating: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} satisfies Record<string, ViewStyle>;

/**
 * Gradient stop arrays for `expo-linear-gradient`'s `colors` prop. Kept as
 * plain string tuples so consumers control direction (start/end) per usage.
 */
export const gradients = {
  greenBanner: ["#16A34A", "#059669", "#0D9488"],
  greenSoft: ["#F0FDF4", "#F8FAFC"],
  authHeader: ["#22C55E", "#10B981"],
  splash: ["#22C55E", "#16A34A"],
} as const;

/**
 * Numeric radius scale (px) mirroring `borderRadius` in tailwind.config.js —
 * for cases where a radius must be applied via inline style rather than a class.
 */
export const radius = {
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  card: 20,
} as const;

export type AppColors = typeof colors;
export type AppShadows = typeof shadows;
export type AppGradients = typeof gradients;
export type AppRadius = typeof radius;
