import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Platform-aware Supabase Auth session storage.
 *
 * Why NOT expo-secure-store:
 *  - SecureStore does NOT exist on web, so web sessions were never persisted
 *    or restored (users were signed out on every reload).
 *  - SecureStore also enforces a ~2KB per-item limit; a full Supabase session
 *    (access + refresh JWTs + user object) can exceed it and get truncated,
 *    silently corrupting the persisted session on native too.
 *
 * Strategy:
 *  - Native (iOS/Android): @react-native-async-storage/async-storage — no size
 *    cap, the storage adapter Supabase officially recommends for React Native.
 *  - Web: leave `storage` undefined so supabase-js falls back to its built-in
 *    localStorage adapter (and pairs with detectSessionInUrl for magic links).
 */
// Inferred type: `typeof AsyncStorage | undefined`. AsyncStorage structurally
// satisfies supabase-js's `SupportedStorage` (getItem/setItem/removeItem), and
// `undefined` selects the built-in localStorage adapter on web.
const authStorage = Platform.OS === "web" ? undefined : AsyncStorage;

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

// TODO(dev-diagnostics): remove once feed 401 is resolved.
if (__DEV__) {
  const k = SUPABASE_ANON_KEY;
  const looksLegacyJwt = k.startsWith("eyJ") && k.length > 100;
  const looksPublishable = k.startsWith("sb_publishable_");
  if (!looksLegacyJwt && !looksPublishable) {
    console.warn(
      `[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY looks INVALID (len ${k.length}). ` +
        "A valid legacy anon key is a JWT (~200+ chars, starts 'eyJ'); the new key starts 'sb_publishable_'. " +
        "A wrong/truncated key → 401 on every request. Copy the exact 'anon public' key from " +
        "Supabase → Project Settings → API, matching your EXPO_PUBLIC_SUPABASE_URL project, then `npx expo start -c`."
    );
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Native → AsyncStorage; web → undefined (supabase-js default localStorage).
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web needs URL detection so the magic-link callback (#access_token=… /
    // ?code=…) is parsed automatically on load. Native handles the deep-link
    // exchange explicitly in app/(auth)/callback.tsx.
    detectSessionInUrl: Platform.OS === "web",
  },
});
