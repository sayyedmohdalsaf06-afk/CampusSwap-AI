import { supabase } from "@/lib/supabase";
// TODO(dev-diagnostics): remove once feed 401 is resolved.
import { SUPABASE_URL } from "@/lib/env";
import type { ListingType, ListingWithImages } from "@/types";

/**
 * Listing service — thin, typed wrapper over `lib/supabase.ts` for feed +
 * detail reads (design §1.2.1 services/ layer, §1.6 Flow 4). Contains NO
 * business logic: campus scoping is enforced entirely by RLS (Req 2.2), and
 * active-only + recency ordering are expressed as PostgREST query options.
 */

/**
 * PostgREST select expression that embeds each listing's related
 * `listing_images` rows (design §1.6 Flow 4 — the images relationship is used
 * to render the feed/detail). Kept in one place so feed + detail stay in sync.
 */
const LISTING_WITH_IMAGES_SELECT =
  "*, listing_images(id, listing_id, storage_path, display_order)";

/** A single page of the campus feed. */
export type FetchFeedPageParams = {
  /** Page size (bounded/incremental load — Req 8.2). */
  limit?: number;
  /** Zero-based offset into the campus feed. */
  offset?: number;
};

/**
 * Fetch one page of the campus feed (design §1.6 Flow 4).
 *
 * - `status = 'active'` — the feed shows active listings only (Req 4.6); RLS
 *   already restricts rows to the caller's campus (Req 2.2), so no campus
 *   filter is expressed here.
 * - Ordered by `published_at` (most recent first, nulls last) then `created_at`
 *   as a tiebreaker — recency ordering (Req 4.1).
 * - `range(offset, offset + limit - 1)` — index-backed, bounded page (Req 8.2).
 */
export async function fetchFeedPage({
  limit = 20,
  offset = 0,
}: FetchFeedPageParams = {}): Promise<ListingWithImages[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // TODO(dev-diagnostics): remove once feed 401 is resolved.
  if (__DEV__) {
    console.log(
      "[feed] GET",
      `${SUPABASE_URL}/rest/v1/listings?status=eq.active&select=...`
    );
    if (error) {
      console.error("[feed] query failed:", JSON.stringify(error, null, 2));
      console.error("[feed] error.code:", (error as any).code);
      console.error("[feed] error.message:", error.message);
      console.error("[feed] error.details:", (error as any).details);
      console.error("[feed] error.hint:", (error as any).hint);
      if ("status" in (error as any)) {
        console.error("[feed] error.status:", (error as any).status);
      }
    } else {
      console.log("[feed] rows:", data?.length ?? 0);
    }
  }

  if (error) throw error;
  return (data as ListingWithImages[] | null) ?? [];
}

/** Parameters for a campus feed search + category filter (design §1.6 Flow 4). */
export type SearchListingsParams = {
  /** Free-text query matched against title/description/category (Req 4.2). */
  query?: string;
  /** Optional category filter; null/undefined means "no category filter" (Req 4.3). */
  category?: string | null;
  /** Page size (bounded/incremental load — Req 8.2). */
  limit?: number;
  /** Zero-based offset into the result set. */
  offset?: number;
};

/**
 * Escape a user-supplied search term so it is safe to interpolate into a
 * PostgREST `or(...)` filter expression. PostgREST parses commas and
 * parentheses as filter syntax and treats `%` as a wildcard, so we strip those
 * characters (plus backslashes) from the trimmed term. The result is a plain
 * substring that can be wrapped in `%...%` for an `ilike` match (Req 4.2).
 */
function sanitizeSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[,()%\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search + filter the campus feed (design §1.6 Flow 4; Req 2.2, 4.2, 4.3, 4.6).
 *
 * - `status = 'active'` — search/browse returns active listings only (Req 4.6);
 *   RLS already scopes rows to the caller's campus (Req 2.2), so no campus
 *   filter is expressed here.
 * - When `category` is set → filter to that category (Req 4.3).
 * - When `query` is a non-empty (post-sanitize) string → match title,
 *   description, OR category via case-insensitive `ilike` (Req 4.2).
 * - Ordered by `published_at` (recent first, nulls last) then `created_at`, and
 *   bounded with `range(offset, offset + limit - 1)` (Req 8.2).
 *
 * With an empty query and no category this degrades to the recent active feed.
 */
export async function searchListings({
  query,
  category,
  limit = 20,
  offset = 0,
}: SearchListingsParams = {}): Promise<ListingWithImages[]> {
  let builder = supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .eq("status", "active");

  if (category) {
    builder = builder.eq("category", category);
  }

  const term = query ? sanitizeSearchTerm(query) : "";
  if (term.length > 0) {
    builder = builder.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`
    );
  }

  const { data, error } = await builder
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data as ListingWithImages[] | null) ?? [];
}

/**
 * Fetch all listings owned by a seller (with their images), newest first
 * (design §4.2 Profile; Req 7.2). Unlike the feed this is NOT restricted to
 * `status = 'active'` — the profile shows the seller's own listings across all
 * statuses (active/reserved/sold/donated). RLS still scopes visibility to the
 * caller's own rows, so a seller only ever reads back their own listings.
 */
export async function fetchMyListings(
  sellerId: string
): Promise<ListingWithImages[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ListingWithImages[] | null) ?? [];
}

/**
 * Fetch a seller's ACTIVE listings (with their images), newest first — for the
 * (frontend-only) public Seller Profile screen. READ-ONLY and additive.
 *
 * Unlike `fetchMyListings` (which returns the caller's own listings across all
 * statuses) this is scoped to `status = 'active'` so a public visitor only sees
 * listings that are still available. RLS keeps this campus-scoped (Req 2.2), so
 * a seller from another campus simply returns no rows — the screen degrades to
 * a friendly empty state.
 */
export async function fetchSellerListings(
  sellerId: string
): Promise<ListingWithImages[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .eq("seller_id", sellerId)
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ListingWithImages[] | null) ?? [];
}

/**
 * A best-effort public view of a seller's profile for the Seller Profile
 * screen. Only the fields safe to surface publicly are selected.
 */
export type PublicProfile = {
  id: string;
  display_name: string | null;
  points: number;
  cumulative_carbon_g: number;
};

/**
 * Best-effort fetch of a public-safe seller profile (name + impact). READ-ONLY
 * and additive.
 *
 * NOTE: the current RLS policy may restrict `profiles` reads to the row owner,
 * in which case this returns null for other sellers — the Seller Profile screen
 * MUST handle null by falling back to a generic "Campus seller" header. Any
 * error is swallowed to null so a restricted read never crashes the screen.
 *
 * // TODO(backend): expose a public-safe seller profile (name, impact, rating)
 * // via a dedicated view or policy so this reliably returns cross-user data.
 */
export async function fetchPublicProfile(
  id: string
): Promise<PublicProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, points, cumulative_carbon_g")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as PublicProfile | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a set of listings (with their images) by id, for the (local, frontend
 * only) Wishlist screen. READ-ONLY and additive — mirrors the feed/detail read
 * shape via `LISTING_WITH_IMAGES_SELECT`.
 *
 * Uses PostgREST `in(...)` to fetch only the requested ids. Any id that is not
 * visible to the caller under RLS (e.g. a different campus, or a removed
 * listing) simply does not come back — the Wishlist UI renders whatever is
 * returned. Returns an empty array for an empty id list without a round-trip.
 */
export async function fetchListingsByIds(
  ids: string[]
): Promise<ListingWithImages[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ListingWithImages[] | null) ?? [];
}

/**
 * Fetch a single listing (with its images) by id, or null when it does not
 * exist / is not visible to the caller under RLS (Req 4.6, 2.2).
 */
export async function fetchListingById(
  id: string
): Promise<ListingWithImages | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_IMAGES_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ListingWithImages | null) ?? null;
}


/**
 * Input for creating (publishing) a listing (design §1.6 Flow 2; Req 3.1–3.9,
 * 6.1/6.3, 9.1, 9.3).
 *
 * // TODO(auth): `sellerId` and `campusId` originate from the CURRENT
 * // authenticated, verified user's profile (future auth populates
 * // `authStore.profile.id` / `authStore.profile.campus_id`). RLS additionally
 * // enforces `seller_id = auth.uid()` and `campus_id = current_campus()` on
 * // INSERT (design §1.5), so these values must match the signed-in caller.
 */
export type CreateListingInput = {
  sellerId: string;
  campusId: string;
  listingType: ListingType;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  /** Required for `sell`; nulled for `donate` (Req 3.5, 3.9). */
  price: number | null;
};

/**
 * Fetch the directional carbon-savings baseline (gCO2e) for a category from
 * `carbon_category_map` (Req 6.1). Returns null when the category has no
 * mapping, in which case the listing's `carbon_savings_g` is left null so the
 * fallback/aggregation logic can treat it as "no baseline" (Req 6.3).
 */
async function carbonBaselineFor(category: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("carbon_category_map")
    .select("savings_g")
    .eq("category", category)
    .maybeSingle();
  if (error) throw error;
  return (data?.savings_g as number | undefined) ?? null;
}

/**
 * Create (publish) a listing (design §1.6 Flow 2). Inserts a `listings` row
 * under RLS with:
 *  - `status = 'active'` and `published_at = now` so it appears in the campus
 *    feed immediately (Req 4.1);
 *  - `price` forced to null for `donate` (Req 3.5);
 *  - `carbon_savings_g` set from the `carbon_category_map` baseline at creation
 *    (Req 6.1/6.3; null when the category is unmapped).
 *
 * Returns the new listing's id. Campus/seller/verification integrity is enforced
 * server-side by the `listings_insert` RLS policy (design §1.5, Req 9.3).
 */
export async function createListing(
  input: CreateListingInput,
): Promise<string> {
  const carbonSavings = await carbonBaselineFor(input.category);

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: input.sellerId,
      campus_id: input.campusId,
      listing_type: input.listingType,
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition,
      price: input.listingType === "sell" ? input.price : null,
      status: "active",
      carbon_savings_g: carbonSavings,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Attach an uploaded image to a listing by inserting a `listing_images` row
 * referencing its Supabase Storage `storage_path` (Req 3.8, 9.1). Ordering
 * within a listing is controlled by `displayOrder` (lowest = cover image).
 * RLS restricts inserts to images under a listing the caller owns (§1.5).
 */
export async function addListingImage(
  listingId: string,
  storagePath: string,
  displayOrder: number,
): Promise<void> {
  const { error } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    storage_path: storagePath,
    display_order: displayOrder,
  });
  if (error) throw error;
}
