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
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
