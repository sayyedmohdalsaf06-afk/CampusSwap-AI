import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * expo-secure-store-backed storage adapter for Supabase Auth session
 * persistence. Keeps the JWT session in the device keychain/keystore rather
 * than plain AsyncStorage.
 */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * Shared Supabase client instance.
 *
 * This module exports the CLIENT ONLY. Auth helpers (sign-in, verify OTP,
 * session hydration) live in `services/authService.ts` (later tasks).
 */
// TODO(dev-diagnostics): remove once .env loading is confirmed.
// Verifies the EXPO_PUBLIC_* env vars are inlined at bundle time. An empty anon
// key means supabase-js sends no `apikey` header → 401 on every request.
if (__DEV__) {
  console.log("[supabase] EXPO_PUBLIC_SUPABASE_URL:", SUPABASE_URL || "(MISSING)");
  console.log(
    "[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY:",
    SUPABASE_ANON_KEY
      ? `present (len ${SUPABASE_ANON_KEY.length}, starts ${SUPABASE_ANON_KEY.slice(0, 8)}…)`
      : "(MISSING)"
  );
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
        "Create a `.env` at the project root (copy `.env.example`) with real values, " +
        "then restart Expo with `npx expo start -c` to clear the cache. " +
        "An empty anon key → no `apikey` header → 401."
    );
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
