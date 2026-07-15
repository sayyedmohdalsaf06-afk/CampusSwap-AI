-- CampusSwap AI — Task 7.1 (Storage): listing-images bucket + Storage RLS
-- See design.md §1.2.4 (Storage Architecture) and §2.6 (Storage Security).
--
-- Trust model (design §2.6):
--   * Listing image OBJECTS live in a dedicated Supabase Storage bucket and are
--     referenced by `listing_images` rows so the relational model stays the
--     source of truth.
--   * Uploads are AUTHENTICATED and OWNER-SCOPED: a seller may only write objects
--     under a path whose first segment is their own uid. Clients upload to
--     `${uid}/${listingId}/${uuid}.jpg` (see services/imageService.ts), so the
--     first path segment == auth.uid() proves ownership of the write path.
--   * Public READ is provided by making the bucket public so getPublicUrl()
--     renders in the feed/detail without a signed URL round-trip.
--
-- NOTE: server-side MIME/size/count validation (the SECURITY DEFINER publish
--       trigger in Task 7.1's validation half) can be tightened later; this
--       migration provisions the bucket + owner-path write/delete policies only.
-- Idempotent: bucket insert guarded by ON CONFLICT; policies guarded by
--             DROP POLICY IF EXISTS before CREATE.

-- ── A) Bucket ──────────────────────────────────────────────────────────────
-- Public READ (so getPublicUrl renders); writes are still gated by the policies
-- below. See design §1.2.4/§2.6.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

-- ── B) Storage RLS policies on storage.objects ──────────────────────────────
-- INSERT: authenticated owner may write only under their own uid path segment
-- (owner writes under `${auth.uid()}/...`, design §2.6).
drop policy if exists "listing_images_owner_insert" on storage.objects;
create policy "listing_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: same owner-path check (a seller may remove only their own objects).
drop policy if exists "listing_images_owner_delete" on storage.objects;
create policy "listing_images_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- (Public SELECT is provided by the public bucket above — no explicit SELECT
--  policy is required for anonymous/authenticated reads of listing images.)
