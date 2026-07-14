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
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/**
 * Verify a submitted OTP (Req 1.4–1.7). Supabase validates the code + expiry
 * and issues a JWT session on success; an invalid/expired code throws so the
 * UI can show an invalid-code message and offer a resend.
 */
export async function verifyOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
}

/**
 * Fetch the caller's own profile row (RLS restricts SELECT to own + same-campus
 * rows). Returns null when no session / no profile row yet.
 */
export async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, verified_student, campus_id, display_name, points, cumulative_carbon_g"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile | null) ?? null;
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
