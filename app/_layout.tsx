import "react-native-url-polyfill/auto";
import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";

/**
 * Root layout. Providers only — no auth gate or session logic yet (those are
 * added in later tasks). Renders the Expo Router <Stack /> wrapped in the
 * TanStack Query provider.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack />
    </QueryClientProvider>
  );
}
