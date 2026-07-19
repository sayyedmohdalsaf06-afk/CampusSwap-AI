-- ============================================================================
-- DEV ONLY — REMOVE BEFORE PRODUCTION. Temporary anon read of ACTIVE listings
-- for UI testing while auth is paused (EXPO_PUBLIC_SKIP_AUTH). This does NOT
-- modify auth and does NOT alter existing RLS policies; it only ADDS one policy.
-- Remove by dropping the policy (see footer).
-- ============================================================================
--
-- Scope: adds a SINGLE additive SELECT policy on public.listings for the `anon`
-- role only. Authenticated users keep the existing campus-scoped policy
-- (listings_select) completely untouched. Only ACTIVE listings are visible to
-- anon clients (Req 4.6). No other tables (listing_images, profiles, etc.) are
-- affected.
--
-- Idempotent: guarded with DROP POLICY IF EXISTS before CREATE POLICY so the
-- migration can be safely re-run.

drop policy if exists "listings_dev_anon_read" on public.listings;
create policy "listings_dev_anon_read" on public.listings
  for select to anon
  using (status = 'active');

-- ----------------------------------------------------------------------------
-- To remove: drop policy if exists "listings_dev_anon_read" on public.listings;
-- ----------------------------------------------------------------------------
