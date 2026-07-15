import * as Linking from "expo-linking";

import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { DEMO_EMAIL, DEMO_PASSWORD, isDemo } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

/**
 * Auth service — the ONLY place screens/stores touch Supabase Auth. Wraps
 * lib/supabase.ts (design §1.2.1: thin typed services/ layer). Contains no
 * business logic beyond authentication + the caller's own profile read.
 *
 * See design.md §1.2.3 (Auth Architecture), §1.6 Flow 1, §2.1 (Auth is
 * end-to-end Supabase Auth email OTP; no custom OTP table).
 */

/** Lowercased email domain, e.g. "student@University.edu" → "university.edu". */
function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/**
 * Domain gating (Req 1.1, 1.2): returns true when the email's domain exists in
 * `domain_campus_map`. The map is read-only to authenticated clients per RLS
 * (design §1.5); an absent domain means the campus is not supported yet.
 *
 * Note: this pre-check runs before requesting an OTP so the client can show a
 * "campus not supported" message without sending a code. The authoritative
 * assignment still happens server-side in the handle_new_user() trigger.
 */
export async function isCampusSupported(email: string): Promise<boolean> {
  const domain = domainOf(email);
  if (!domain) return false;

  const { data, error } = await supabase
    .from("domain_campus_map")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Request an email OTP (Req 1.3). Supabase Auth generates, delivers, expires,
 * and rate-limits the code natively (design §2.1). `shouldCreateUser: true`
 * creates the auth.users row on first sign-in, which fires the
 * handle_new_user() trigger to finalize the campus-scoped profile.
 *
 * Delivery errors are surfaced so the UI can offer a resend (Req 10.1).
 */
export async function requestOtp(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (__DEV__) console.log("[auth] requestOtp: sending email OTP to", normalized);
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (__DEV__) console.warn("[auth] requestOtp failed:", error.message);
    throw error;
  }
}

/**
 * Send a magic sign-in LINK as a FALLBACK when email OTP delivery is flaky
 * (Req 1.3, 10.1). Same underlying `signInWithOtp`, but supplying
 * `emailRedirectTo` makes Supabase deliver a clickable link that returns to the
 * app's callback route (web: detectSessionInUrl parses it; native:
 * exchangeCodeIfPresent below completes it). `shouldCreateUser: true` still
 * fires the server-side handle_new_user() trigger on first sign-in.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const redirectTo = getAuthRedirectUrl();
  if (__DEV__) {
    console.log("[auth] sendMagicLink: to", normalized, "redirectTo", redirectTo);
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) {
    if (__DEV__) console.warn("[auth] sendMagicLink failed:", error.message);
    throw error;
  }
}

/**
 * Complete a magic-link sign-in from an incoming deep link URL on NATIVE
 * (where detectSessionInUrl is disabled). Handles both auth flows:
 *   - PKCE:     campuswap://auth/callback?code=…        → exchangeCodeForSession
 *   - Implicit: campuswap://auth/callback#access_token=…&refresh_token=… → setSession
 * Returns true when a session was established, false when the URL carried no
 * auth payload (nothing to do). Throws on an actual exchange error so the
 * callback screen can route back to the email screen (Req 10.1).
 *
 * On web this is a no-op path — detectSessionInUrl already consumed the URL.
 */
export async function exchangeCodeIfPresent(url: string): Promise<boolean> {
  if (!url) return false;

  // PKCE authorization code (?code=…).
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === "string" && code.length > 0) {
    if (__DEV__) console.log("[auth] exchangeCodeIfPresent: exchanging PKCE code");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  // Implicit flow tokens in the URL fragment (#access_token=…&refresh_token=…).
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const params = new URLSearchParams(url.slice(hashIndex + 1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      if (__DEV__) console.log("[auth] exchangeCodeIfPresent: setting session from URL tokens");
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) throw error;
      return true;
    }
  }

  if (__DEV__) console.log("[auth] exchangeCodeIfPresent: no auth payload in URL");
  return false;
}

/**
 * Verify a submitted OTP (Req 1.4–1.7). Supabase validates the code + expiry
 * and issues a JWT session on success; an invalid/expired code throws so the
 * UI can show an invalid-code message and offer a resend.
 */
export async function verifyOtp(email: string, token: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (__DEV__) console.log("[auth] verifyOtp: verifying code for", normalized);
  const { error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: token.trim(),
    type: "email",
  });
  if (error) {
    if (__DEV__) console.warn("[auth] verifyOtp failed:", error.message);
    throw error;
  }
  if (__DEV__) console.log("[auth] verifyOtp: success — session established");
}

/**
 * Fetch the caller's own profile row (RLS restricts SELECT to own + same-campus
 * rows). Returns null when no session / no profile row yet.
 *
 * NOTE: profile creation — including `campus_id` assignment and the
 * `verified_student` flag — is performed SERVER-SIDE by the `handle_new_user`
 * trigger on `auth.users` insert (see
 * supabase/migrations/20250714120400_auth_profile_trigger.sql). There is NO
 * client INSERT policy on `public.profiles` by design, so this service MUST NOT
 * attempt to create/insert a profile row. It only READS the row the trigger
 * created. A momentarily-null profile right after first sign-in simply means
 * the trigger row hasn't been read yet — the caller can re-fetch (e.g. the
 * onboarding "Refresh" action).
 */
export async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (__DEV__) console.log("[auth] fetchProfile: no active user/session");
    return null;
  }

  if (__DEV__) console.log("[auth] fetchProfile: loading profile for user", user.id);
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, verified_student, campus_id, display_name, points, cumulative_carbon_g"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn("[auth] fetchProfile failed:", error.message);
    throw error;
  }
  const profile = (data as Profile | null) ?? null;
  if (__DEV__) {
    console.log("[auth] fetchProfile: loaded", {
      hasProfile: profile != null,
      campusId: profile?.campus_id ?? null,
      verifiedStudent: profile?.verified_student ?? false,
    });
  }
  return profile;
}

/**
 * DEMO-ONLY dev-bypass sign-in. Guarded so it ONLY runs when `isDemo`
 * (EXPO_PUBLIC_APP_ENV=demo). Signs in a seeded, pre-verified demo account with
 * password creds from env so the demo never depends on live email OTP. This
 * depends on a seeded demo account (a later demo-protection task) and is INERT
 * in non-demo builds — live Supabase Auth email OTP remains the real, default
 * path. Never ship demo creds to production.
 */
export async function demoSignIn(): Promise<void> {
  if (!isDemo) {
    throw new Error("Demo sign-in is only available in demo mode.");
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) throw error;
}

/** Sign the current user out and clear the persisted session. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
