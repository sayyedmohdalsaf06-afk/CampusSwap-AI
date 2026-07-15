import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeReservation,
  fetchActiveReservation,
  releaseReservation,
  reserveListing,
  type CompleteReservationInput,
  type ReserveListingInput,
} from "@/services/reservationService";
import type { ActiveReservation } from "@/types";

/**
 * Reservation hooks (design §1.6 Flow 6; Req 13.1–13.8). A read hook for the
 * active reservation plus three mutation hooks (reserve / release / complete)
 * that wrap the reservation service. On success each mutation invalidates the
 * affected listing, its reservation, and the feed so the detail screen + feed
 * reflect the new `listing.status` (Req 13.5).
 */

/**
 * The active reservation for a listing (design §1.6 Flow 6). Disabled until an
 * `id` is present so the route param can hydrate. Returns null when there is no
 * active reservation or RLS hides it from a non-participant (expected — the
 * reserved state is still visible via `listing.status`).
 */
export function useActiveReservation(listingId: string | undefined) {
  return useQuery<ActiveReservation | null, Error>({
    queryKey: ["reservation", listingId],
    queryFn: () => fetchActiveReservation(listingId as string),
    enabled: Boolean(listingId),
  });
}

/**
 * Invalidate the queries that depend on a listing's reservation state: the
 * listing detail (`['listing', id]`), its active reservation
 * (`['reservation', id]`), and the campus feed (`['feed']`) which hides
 * non-active listings (Req 13.5).
 */
function useInvalidateReservationQueries() {
  const queryClient = useQueryClient();
  return (listingId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
    void queryClient.invalidateQueries({ queryKey: ["reservation", listingId] });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  };
}

/**
 * Reserve an active listing (Req 13.1–13.3). Guarding against duplicate submits
 * is handled by the caller via the mutation's `isPending` flag (Req 10.3).
 */
export function useReserve() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<string, Error, ReserveListingInput>({
    mutationFn: (input) => reserveListing(input),
    onSuccess: (_id, variables) => invalidate(variables.listingId),
  });
}

/**
 * Release a reservation, returning the listing to `active` (Req 13.7). Requires
 * the affected `listingId` so we can invalidate the right queries after the
 * reservation row is updated.
 */
export function useRelease() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<
    void,
    Error,
    { reservationId: string; listingId: string }
  >({
    mutationFn: ({ reservationId }) => releaseReservation(reservationId),
    onSuccess: (_void, variables) => invalidate(variables.listingId),
  });
}

/**
 * Seller completion of a reserved listing → sold/donated (Req 13.6, 13.8).
 */
export function useComplete() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<void, Error, CompleteReservationInput>({
    mutationFn: (input) => completeReservation(input),
    onSuccess: (_void, variables) => invalidate(variables.listingId),
  });
}
