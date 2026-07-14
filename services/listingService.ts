import { supabase } from "@/lib/supabase";
import type { ListingWithImages } from "@/types";

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
