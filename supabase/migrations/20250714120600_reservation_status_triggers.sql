-- CampusSwap AI — Reservation lifecycle: listing-status sync triggers.
-- See design.md §1.6 Flow 6 (Reservation Lifecycle) and Req 13.1, 13.7.
--
-- Why a SECURITY DEFINER trigger?
--   A buyer reserving a listing can INSERT a `reservations` row under RLS, but
--   the buyer is NOT the listing's seller and therefore CANNOT UPDATE the
--   seller's `listings` row (listings_update_own restricts UPDATE to the owner,
--   design §1.5). So the buyer-initiated reserve/release cannot itself flip the
--   listing's status. This trigger runs with the table owner's privileges to
--   keep `listings.status` in sync with the reservation lifecycle server-side.
--
-- Scope of this trigger (status SYNC only):
--   * AFTER INSERT of an `active` reservation      -> listing 'active'  -> 'reserved' (Req 13.1)
--   * AFTER UPDATE to a `released` reservation      -> listing 'reserved' -> 'active'  (Req 13.7)
--   * It intentionally does NOT act on status = 'completed'. Completion to
--     'sold'/'donated' is performed EXPLICITLY by the seller (services/
--     reservationService.completeReservation), because only the seller may
--     update their own listing under RLS.
--
-- Invariants NOT enforced here (already provided by earlier migrations):
--   * Single-active-reservation-per-listing is enforced by the existing PARTIAL
--     UNIQUE index `uq_reservations_active_per_listing`
--     (reservations(listing_id) WHERE status = 'active') — see 20250714120200_indexes.sql (Req 13.3).
--   * Reserve/select/release access control is enforced by the reservations RLS
--     policies — see 20250714120300_rls_helpers_policies.sql (Req 13.2, 13.8).
--
-- Future note (out of scope here): completion + gamification/carbon awards and
-- notification fan-out will later move into a service-role `reserve-complete`
-- Edge Function (design §1.6 Flow 6/7). This migration only syncs listing status.
--
-- Idempotency: CREATE OR REPLACE for the function; DROP TRIGGER IF EXISTS before
-- each CREATE TRIGGER so the migration can be re-run safely.

-- ── Function: keep listings.status in sync with the reservation lifecycle ──
create or replace function public.reservation_apply_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Reserve: a newly created active reservation moves the listing to 'reserved'.
  -- Guard on the current listing status = 'active' so we never clobber a listing
  -- that is already reserved/sold/donated (Req 13.1).
  if (tg_op = 'INSERT') then
    if (new.status = 'active') then
      update public.listings
         set status = 'reserved'
       where id = new.listing_id
         and status = 'active';
    end if;
    return new;
  end if;

  -- Release: an active reservation transitioning to 'released' returns the
  -- listing to 'active' (Req 13.7). Completion ('completed') is handled
  -- explicitly by the seller and is intentionally NOT acted on here.
  if (tg_op = 'UPDATE') then
    if (new.status = 'released' and old.status = 'active') then
      update public.listings
         set status = 'active'
       where id = new.listing_id
         and status = 'reserved';
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ── Triggers on public.reservations ────────────────────────────────────────
drop trigger if exists reservations_after_insert_sync_listing on public.reservations;
create trigger reservations_after_insert_sync_listing
  after insert on public.reservations
  for each row
  execute function public.reservation_apply_listing_status();

drop trigger if exists reservations_after_update_sync_listing on public.reservations;
create trigger reservations_after_update_sync_listing
  after update on public.reservations
  for each row
  execute function public.reservation_apply_listing_status();
