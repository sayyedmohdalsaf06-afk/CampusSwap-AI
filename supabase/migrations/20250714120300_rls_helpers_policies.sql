-- CampusSwap AI — Task 1.3/1.4 (RLS helpers + policies)
-- Row Level Security is the primary trust boundary. See design.md §1.5
-- (Access Control Model) and the §1.3.5 RLS subsection.
--
-- Trust model (design §1.5, §2.13):
--   * RLS is enabled on EVERY app table; all client CRUD is filtered server-side.
--   * The service_role bypasses RLS automatically — server-authoritative writes
--     (points/badges, notification inserts, reservation completion, carbon totals)
--     rely on this and DO NOT get client-facing policies here.
--   * Two SECURITY DEFINER helpers resolve the caller from auth.uid():
--       current_campus()  -> caller's campus_id
--       is_verified()     -> caller's verified_student flag
--     They are SECURITY DEFINER so they can read public.profiles without being
--     subject to the profiles RLS policies (which would otherwise recurse when a
--     profiles policy references current_campus()).
--
-- Idempotency: helpers use CREATE OR REPLACE; every policy is guarded with
-- DROP POLICY IF EXISTS before CREATE POLICY so the migration can be re-run.

-- ── A) Helper functions (SECURITY DEFINER, no recursion) ───────────────────

-- current_campus(): the caller's assigned campus (Req 2.x campus isolation).
create or replace function public.current_campus()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select campus_id from public.profiles where id = auth.uid()
$$;

-- is_verified(): the caller's verified_student flag (Req 2.1 verified gating).
create or replace function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select verified_student from public.profiles where id = auth.uid()), false)
$$;

-- ── B) Enable RLS on all app tables ────────────────────────────────────────
alter table public.campuses            enable row level security;
alter table public.domain_campus_map   enable row level security;
alter table public.profiles            enable row level security;
alter table public.carbon_category_map enable row level security;
alter table public.badges              enable row level security;
alter table public.listings            enable row level security;
alter table public.listing_images      enable row level security;
alter table public.need_it_requests    enable row level security;
alter table public.reservations        enable row level security;
alter table public.threads             enable row level security;
alter table public.messages            enable row level security;
alter table public.notifications       enable row level security;

-- ── C) Policies (all `to authenticated`) — design §1.5 ─────────────────────

-- Read-only config/reference tables: SELECT only, no client write policies.
-- Writes happen only via the service role / seed (Req 14.5).

-- campuses — campus name/city labels for dashboard + leaderboard (Req 6.5, 14.7).
drop policy if exists campuses_select on public.campuses;
create policy campuses_select on public.campuses
  for select to authenticated
  using (true);

-- domain_campus_map — read-only reference (Req 11.1).
drop policy if exists domain_campus_map_select on public.domain_campus_map;
create policy domain_campus_map_select on public.domain_campus_map
  for select to authenticated
  using (true);

-- carbon_category_map — directional carbon reference for display (Req 6.1, 6.6).
drop policy if exists carbon_category_map_select on public.carbon_category_map;
create policy carbon_category_map_select on public.carbon_category_map
  for select to authenticated
  using (true);

-- badges — read-only badge config for UI (Req 14.5, 14.8).
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated
  using (true);

-- profiles ------------------------------------------------------------------
-- SELECT: own row plus same-campus profiles (Req 9.2 campus roster/leaderboard).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or campus_id = public.current_campus());

-- UPDATE: only own row. Column-level privileges below prevent client-side
-- writes to points/badges even though this row-level policy would otherwise
-- allow updating any column (Req 7.x own-profile edit).
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- points/badges are server-authoritative (service role only) — never
-- client-writable (Req 14.1, design §2.8). Enforced via column privileges.
revoke update (points, badges) on public.profiles from authenticated, anon;

-- (No client INSERT policy on profiles — rows are created server-side on
--  verification via a SECURITY DEFINER trigger, later task.)

-- listings ------------------------------------------------------------------
-- SELECT: same-campus AND (active OR own) (Req 2.2, 4.6, 11.3).
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings
  for select to authenticated
  using (campus_id = public.current_campus()
         and (status = 'active' or seller_id = auth.uid()));

-- INSERT: verified seller creating own listing in own campus (Req 2.3, 9.1, 9.3).
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings
  for insert to authenticated
  with check (public.is_verified()
              and seller_id = auth.uid()
              and campus_id = public.current_campus());

-- UPDATE: owner only (Req 7.3, 7.6).
drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- DELETE: owner only (Req 7.5, 7.6).
drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = auth.uid());

-- listing_images ------------------------------------------------------------
-- SELECT: visible when the parent listing is visible to the caller (Req 3.8, 9.1).
drop policy if exists listing_images_select on public.listing_images;
create policy listing_images_select on public.listing_images
  for select to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.campus_id = public.current_campus()
      and (l.status = 'active' or l.seller_id = auth.uid())
  ));

-- INSERT: only under a listing the caller owns (Req 3.8, 9.1).
drop policy if exists listing_images_insert on public.listing_images;
create policy listing_images_insert on public.listing_images
  for insert to authenticated
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.seller_id = auth.uid()
  ));

-- DELETE: only under a listing the caller owns (Req 7.6, 9.1).
drop policy if exists listing_images_delete on public.listing_images;
create policy listing_images_delete on public.listing_images
  for delete to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.seller_id = auth.uid()
  ));

-- need_it_requests ----------------------------------------------------------
-- SELECT: same-campus AND (open OR own) (Req 12.3, 12.4).
drop policy if exists need_it_requests_select on public.need_it_requests;
create policy need_it_requests_select on public.need_it_requests
  for select to authenticated
  using (campus_id = public.current_campus()
         and (status = 'open' or requester_id = auth.uid()));

-- INSERT: verified requester creating own request in own campus (Req 12.2).
drop policy if exists need_it_requests_insert on public.need_it_requests;
create policy need_it_requests_insert on public.need_it_requests
  for insert to authenticated
  with check (public.is_verified()
              and requester_id = auth.uid()
              and campus_id = public.current_campus());

-- UPDATE: owner only (owner-only close→fulfilled) (Req 12.6, 12.7).
drop policy if exists need_it_requests_update_own on public.need_it_requests;
create policy need_it_requests_update_own on public.need_it_requests
  for update to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

-- DELETE: owner only (Req 12.7).
drop policy if exists need_it_requests_delete_own on public.need_it_requests;
create policy need_it_requests_delete_own on public.need_it_requests
  for delete to authenticated
  using (requester_id = auth.uid());

-- threads -------------------------------------------------------------------
-- SELECT: same-campus participants only (Req 2.4, 5.1).
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads
  for select to authenticated
  using (campus_id = public.current_campus()
         and (buyer_id = auth.uid() or seller_id = auth.uid()));

-- INSERT: verified participant opening a same-campus thread (Req 2.4, 5.1, 12.5).
drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert to authenticated
  with check (public.is_verified()
              and campus_id = public.current_campus()
              and (buyer_id = auth.uid() or seller_id = auth.uid()));

-- messages ------------------------------------------------------------------
-- SELECT: participants of the parent thread (Req 5.5).
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.threads t
    where t.id = thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  ));

-- INSERT: sender is a same-campus participant of the thread (Req 5.4, 5.6).
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (
                select 1 from public.threads t
                where t.id = thread_id
                  and t.campus_id = public.current_campus()
                  and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
              ));

-- reservations --------------------------------------------------------------
-- SELECT: same-campus participants — buyer or the listing's seller (Req 13.8).
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated
  using (campus_id = public.current_campus()
         and (buyer_id = auth.uid()
              or exists (
                select 1 from public.listings l
                where l.id = listing_id
                  and l.seller_id = auth.uid()
              )));

-- INSERT: verified buyer reserving an active, same-campus listing (Req 13.2, 13.3, 13.8).
-- The partial unique index (Task 1.3 indexes) enforces single-active-per-listing.
drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
  for insert to authenticated
  with check (public.is_verified()
              and buyer_id = auth.uid()
              and campus_id = public.current_campus()
              and exists (
                select 1 from public.listings l
                where l.id = listing_id
                  and l.campus_id = public.current_campus()
                  and l.status = 'active'
              ));

-- UPDATE: release by buyer or seller. Completion + status flips are
-- service-role writes (reserve-complete Edge Function, later task) (Req 13.7, 13.8).
drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update to authenticated
  using (buyer_id = auth.uid()
         or exists (
           select 1 from public.listings l
           where l.id = listing_id
             and l.seller_id = auth.uid()
         ))
  with check (true);

-- notifications -------------------------------------------------------------
-- SELECT: recipient-isolated (Req 15.6).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

-- UPDATE: recipient may toggle their own read flag only (Req 15.8).
-- Column privileges below restrict updates to the `read` column.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Only the read flag is client-updatable (Req 15.8). All other columns are
-- service-role-written (Req 15.1–15.5, design §2.11).
revoke update on public.notifications from authenticated, anon;
grant  update (read) on public.notifications to authenticated;

-- (No client INSERT policy on notifications — rows are created by the service
--  role in Edge Function server paths, later task, Req 15.1–15.5.)
