/**
 * Shared application types.
 *
 * Kept intentionally lean for the auth phase — feature types (Listing detail,
 * threads, reservations, notifications, etc.) are added by later tasks.
 */

/**
 * 1:1 extension of the Supabase Auth user (`public.profiles`). See design.md
 * §1.3 table `profiles` and Req 9.2. `campus_id` is null until the user is
 * verified against the domain_campus_map; `verified_student` gates all
 * browsing/listing/coordination features (Req 2.1).
 */
export type Profile = {
  id: string;
  email: string;
  verified_student: boolean;
  campus_id: string | null;
  display_name: string | null;
  points: number;
  cumulative_carbon_g: number;
};

/**
 * Auth gate status derived from the session + profile:
 *  - `loading`         — session/profile hydration in flight (show splash)
 *  - `unauthenticated` — no active Supabase session
 *  - `unverified`      — session exists but the profile is not a Verified_Student
 *                        (e.g. unsupported campus domain, Req 1.2)
 *  - `authenticated`   — session + verified_student profile (full access)
 */
export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "unverified"
  | "authenticated";
