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


/**
 * A listing image row (`public.listing_images`). See design.md §1.3 table
 * `listing_images` and Req 9.1. `storage_path` references the underlying object
 * in Supabase_Storage; `display_order` orders images within a listing (the
 * lowest order is the primary/cover image shown in the feed).
 */
export type ListingImage = {
  id: string;
  listing_id: string;
  storage_path: string;
  display_order: number;
};

/**
 * Lifecycle state of a Listing (design.md §1.3 enum `listing_status`,
 * Req 4.6, 13.5). Only `active` listings are browsable in the feed.
 */
export type ListingStatus = "active" | "reserved" | "sold" | "donated";

/**
 * Classification of a Listing (design.md §1.3 enum `listing_type`, Req 3.1).
 * `donate` listings omit price (Req 3.5).
 */
export type ListingType = "sell" | "donate";

/**
 * A marketplace listing (`public.listings`). See design.md §1.3 table
 * `listings` and Req 9.1. `price` is null for `donate` listings (Req 3.5) and
 * required for `sell` listings (Req 3.9). `campus_id` scopes the listing to its
 * seller's campus, enforced by RLS (Req 2.3, 9.3).
 */
export type Listing = {
  id: string;
  seller_id: string;
  campus_id: string;
  listing_type: ListingType;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  price: number | null;
  status: ListingStatus;
  carbon_savings_g: number | null;
  published_at: string | null;
  created_at: string;
};

/**
 * A Listing joined with its related `listing_images` rows (the PostgREST
 * embedded-relationship shape used by the feed + detail queries, design §1.6
 * Flow 4). Images are ordered client-side by `display_order`.
 */
export type ListingWithImages = Listing & {
  listing_images: ListingImage[];
};
