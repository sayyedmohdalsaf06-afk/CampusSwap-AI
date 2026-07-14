/**
 * Client-side environment configuration.
 *
 * Only `EXPO_PUBLIC_*` variables are safe to read here — they are inlined into
 * the client bundle. Never read server/edge secrets (service role key, Gemini,
 * Resend, PostHog) from this file.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

/** True when running in the demo-friendly environment (`EXPO_PUBLIC_APP_ENV=demo`). */
export const isDemo = APP_ENV === "demo";

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_ENV,
  isDemo,
} as const;
