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

/**
 * Demo-mode-only credentials for the seeded, pre-verified demo account. These
 * are used ONLY when `isDemo` is true (the demo dev-bypass sign-in) and depend
 * on a seeded demo account (a later demo-protection task). They are throwaway
 * demo creds — NOT production credentials — and are inert in non-demo builds.
 */
export const DEMO_EMAIL = process.env.EXPO_PUBLIC_DEMO_EMAIL ?? "";
export const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? "";

/**
 * @deprecated dev bypass, unused. Nothing branches on this at runtime anymore —
 * the auth ROUTING gate always runs (see app/_layout.tsx). Kept only so any
 * lingering references resolve; safe to delete once no code reads it. When it
 * was active (`EXPO_PUBLIC_SKIP_AUTH=true`) it skipped the routing gate to test
 * authenticated UI; it never mocked a user/session/profile.
 */
export const SKIP_AUTH = process.env.EXPO_PUBLIC_SKIP_AUTH === "true";

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_ENV,
  isDemo,
  DEMO_EMAIL,
  DEMO_PASSWORD,
} as const;
