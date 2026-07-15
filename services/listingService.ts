import { supabase } from "@/lib/supabase";
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
