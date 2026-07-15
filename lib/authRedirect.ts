import * as Linking from "expo-linking";

/**
 * Build the auth callback URL that Supabase redirects back to after a magic
 * link (and, on web, an OTP magic link) is followed.
 *
 * `Linking.createURL("/auth/callback")` resolves to the right value for every
 * runtime automatically:
 *   - Expo Go (dev):     exp://<lan-ip>:8081/--/auth/callback
 *   - Dev/prod native:   campuswap://auth/callback   (from app.json "scheme")
 *   - Web:               http://localhost:8081/auth/callback
 *
 * IMPORTANT — Supabase Dashboard → Authentication → URL Configuration:
 * every value this can produce must be registered as an allowed Redirect URL,
 * otherwise Supabase rejects the redirect. Register (see report for details):
 *   - http://localhost:8081/*          (Expo Web dev)
 *   - exp://* / --/auth/callback       (Expo Go — use your LAN URL; wildcard host)
 *   - campuswap://auth/callback        (dev/prod deep link)
 * and set the Site URL to your primary web origin (e.g. http://localhost:8081).
 */
export function getAuthRedirectUrl(): string {
  const url = Linking.createURL("/auth/callback");
  if (__DEV__) {
    console.log("[authRedirect] getAuthRedirectUrl() =>", url);
  }
  return url;
}
