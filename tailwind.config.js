/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ["Jakarta"],
        jakarta: ["Jakarta"],
        jakartaMedium: ["Jakarta-Medium"],
        jakartaSemibold: ["Jakarta-Semibold"],
        jakartaBold: ["Jakarta-Bold"],
        jakartaExtrabold: ["Jakarta-Extrabold"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
        card: "20px",
      },
    },
  },
  plugins: [],
};
