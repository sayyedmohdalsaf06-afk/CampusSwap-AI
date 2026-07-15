import { supabase } from "@/lib/supabase";
import type { ActiveReservation, ReservationOutcome } from "@/types";

/**
 * Reservation service — thin, typed wrapper over `lib/supabase.ts` for the
 * no-payment reservation lifecycle (design §1.6 Flow 6; Req 13.1–13.8). It
 * contains NO funds handling of any kind: reserving is a pickup-intent signal
 * only and the `reservations` table has no monetary column by design (Req 13.4,
 * design §2.9).
 *
 * Access control is enforced server-side by the reservations RLS policies
 * (buyer = self, same campus, active listing to reserve; buyer/seller to
 * release/select) and the single-active-per-listing invariant by the partial
 * unique index `uq_reservations_active_per_listing` (design §1.5, §1.3.4). The
 * `listings.status` sync (active↔reserved) is performed by the SECURITY DEFINER
 * trigger in migration 20250714120600 (Req 13.1, 13.7).
 */

/** Postgres unique-violation error code (partial unique index conflict). */
const UNIQUE_VIOLATION = "23505";

/**
 * PostgREST select expression for an active reservation with its buyer profile
 * embedded. Kept in one place so the hook + detail UI stay in sync.
 */
const ACTIVE_RESERVATION_SELECT =
  "id, listing_id, buyer_id, campus_id, status, created_at, buyer:profiles!buyer_id(display_name, email)";

/**
 * Input for reserving a listing (design §1.6 Flow 6; Req 13.1–13.3, 13.8).
 *
 * // TODO(auth): `buyerId` and `campusId` originate from the CURRENT
 * // authenticated, verified user's profile (`useAuthStore().profile.id` /
 * // `.campus_id`). RLS additionally enforces `buyer_id = auth.uid()`,
 * // `campus_id = current_campus()`, and that the target listing is `active`
 * // on INSERT (design §1.5), so these values must match the signed-in caller.
 */
export type ReserveListingInput = {
  listingId: string;
  buyerId: string;
  campusId: string;
};

/**
 * Reserve an active listing (Req 13.1, 13.2, 13.3, 13.8). Inserts a
 * `reservations` row (status defaults to `active`); the AFTER INSERT trigger
 * flips the listing to `reserved` (Req 13.1). No funds are touched (Req 13.4).
 *
 * If the listing already has an active reservation, the partial unique index
 * raises a unique-violation (code 23505); we translate it into a friendly
 * "already reserved" error so the UI can surface it cleanly (Req 13.3). Any
 * other error (e.g. RLS rejection when the listing is not `active`, Req 13.2)
 * is rethrown as-is.
 */
export async function reserveListing({
  listingId,
  buyerId,
  campusId,
}: ReserveListingInput): Promise<string> {
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      campus_id: campusId,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error("This item is already reserved.");
    }
    throw error;
  }
  return (data as { id: string }).id;
}

/**
 * Release a reservation (Req 13.7). Sets the reservation `status = 'released'`;
 * the AFTER UPDATE trigger returns the listing to `active`. Permitted for the
 * buyer or the listing's seller by the reservations UPDATE RLS policy.
 */
export async function releaseReservation(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "released" })
    .eq("id", reservationId);

  if (error) throw error;
}

/**
 * Input for a Seller completing a reserved listing (Req 13.6, 13.8).
 */
export type CompleteReservationInput = {
  reservationId: string;
  listingId: string;
  /** Terminal listing outcome chosen by the seller. */
  outcome: ReservationOutcome;
};

/**
 * SELLER completion of a reserved listing (Req 13.6, 13.8). Performs the status
 * transition only:
 *  - updates the `listings` row to `status = outcome` ('sold' | 'donated'), and
 *  - updates the `reservations` row to `status = 'completed'`.
 *
 * Both writes are permitted by RLS for the listing's seller (listings_update_own
 * and the reservations UPDATE policy). No funds are touched (Req 13.4).
 *
 * // TODO(auth): this action is restricted to the listing's SELLER; the caller
 * // must be the authenticated owner (RLS `seller_id = auth.uid()` guards the
 * // listing update).
 * // TODO(gamification): completion will later route through a service-role
 * // `reserve-complete` Edge Function that ALSO awards points/carbon and fans
 * // out notifications inline (design §1.6 Flow 6/7). For now it performs the
 * // status transition only — no points, no carbon, no notifications, no funds.
 */
export async function completeReservation({
  reservationId,
  listingId,
  outcome,
}: CompleteReservationInput): Promise<void> {
  const { error: listingError } = await supabase
    .from("listings")
    .update({ status: outcome })
    .eq("id", listingId);

  if (listingError) throw listingError;

  const { error: reservationError } = await supabase
    .from("reservations")
    .update({ status: "completed" })
    .eq("id", reservationId);

  if (reservationError) throw reservationError;
}

/**
 * Fetch the active reservation for a listing with its buyer profile embedded
 * (design §1.6 Flow 6). Returns null when there is no active reservation, or
 * when RLS hides the row from a non-participant — that is expected, and the
 * reserved state itself remains visible via `listing.status` (Req 13.5).
 */
export async function fetchActiveReservation(
  listingId: string
): Promise<ActiveReservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select(ACTIVE_RESERVATION_SELECT)
    .eq("listing_id", listingId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return (data as ActiveReservation | null) ?? null;
}
