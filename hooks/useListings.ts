import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  fetchFeedPage,
  fetchListingById,
  fetchMyListings,
} from "@/services/listingService";
import type { ListingWithImages } from "@/types";

/** Feed page size — kept in one place so pagination math stays consistent. */
export const FEED_PAGE_SIZE = 20;

/**
 * Campus feed hook (design §1.6 Flow 4, Req 4.1, 4.6, 8.2). Wraps
 * `fetchFeedPage` in an infinite query so the feed loads incrementally as the
 * user scrolls (Req 8.2). Campus scoping + active-only + recency ordering are
 * handled by RLS and the service query.
 *
 * `getNextPageParam` advances the offset only while a full page came back — a
 * short/empty page means the end of the feed, so we return `undefined` to stop.
 */
export function useFeed() {
  return useInfiniteQuery<
    ListingWithImages[],
    Error,
    InfiniteData<ListingWithImages[]>,
    ["feed"],
    number
  >({
    queryKey: ["feed"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchFeedPage({ limit: FEED_PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < FEED_PAGE_SIZE
        ? undefined
        : allPages.length * FEED_PAGE_SIZE,
  });
}

/**
 * Flatten the paged feed data into a single list for a FlatList. Safe to call
 * with `undefined` while the first page is loading.
 */
export function flattenFeed(
  data: InfiniteData<ListingWithImages[]> | undefined
): ListingWithImages[] {
  return data?.pages.flat() ?? [];
}

/**
 * Single listing hook for the detail screen (design §4.2 `listing/[id].tsx`,
 * Req 4.6). Disabled until an `id` is present so the param can hydrate.
 */
export function useListing(id: string | undefined) {
  return useQuery<ListingWithImages | null, Error>({
    queryKey: ["listing", id],
    queryFn: () => fetchListingById(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Current student's own listings for the Profile screen (design §4.2 Profile,
 * Req 7.2). Disabled until a `sellerId` is available (e.g. while the auth
 * profile hydrates) so we never query with an undefined owner.
 */
export function useMyListings(sellerId: string | undefined) {
  return useQuery<ListingWithImages[], Error>({
    queryKey: ["my-listings", sellerId],
    queryFn: () => fetchMyListings(sellerId as string),
    enabled: Boolean(sellerId),
  });
}
