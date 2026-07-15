-- DEV / TESTING ONLY — sample seller + listings for feed UI testing. Safe to
-- re-run (idempotent). Depends on the reference seed (supabase/seed/reference.sql)
-- for the campus + carbon categories. Remove before production.

-- ── Demo seller ─────────────────────────────────────────────────────────────
-- listings.seller_id → profiles.id → auth.users.id, so we need a demo auth user
-- and its profile before any listings can be inserted. Fixed UUIDs keep this
-- idempotent across re-runs.

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','demo.seller@dpu.edu.in', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- Explicitly upsert the profile as a safety net. The handle_new_user trigger may
-- also create it; this guarantees a verified student on the Dr. D. Y. Patil
-- Vidyapeeth campus (11111111-... from the reference seed) regardless.
insert into public.profiles (id, email, verified_student, campus_id, display_name)
values ('a0000000-0000-0000-0000-000000000001','demo.seller@dpu.edu.in', true, '11111111-1111-1111-1111-111111111111','Demo Seller')
on conflict (id) do update set verified_student = true, campus_id = excluded.campus_id, display_name = coalesce(public.profiles.display_name, excluded.display_name);

-- ── Sample listings ─────────────────────────────────────────────────────────
-- All active, on the demo seller's campus, published now. Categories match
-- carbon_category_map keys and carbon_savings_g mirrors that category's baseline.
-- No listing_images rows: no real Storage objects exist, so the feed card renders
-- its clean "No photo" placeholder rather than a broken image. The donate listing
-- has price null (Req 3.5).

insert into public.listings (id, seller_id, campus_id, listing_type, title, description, category, condition, price, status, carbon_savings_g, published_at)
values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','sell','Hero Sprint Pro 26T cycle','Well-maintained 26T cycle, great for the daily campus commute.','cycles','Good', 4200, 'active', 90000, now()),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','sell','Higher Engineering Mathematics – B.S. Grewal (43rd ed.)','Standard first-year engineering maths text, minimal markings inside.','books','Good', 380, 'active', 1200, now()),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','sell','Sony WH-CH520 wireless headphones','Comfortable over-ear wireless headphones with long battery life.','electronics','Like New', 2500, 'active', 25000, now()),
  ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','donate','Study lamp + 4-socket extension board','Handy desk lamp with a spare extension board — free to a hostel roommate.','hostel_essentials','Fair', null, 'active', 5000, now()),
  ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','sell','HP 15s laptop (i5, 8GB) – hostel use','Reliable i5 laptop with 8GB RAM, ideal for coursework and hostel use.','electronics','Good', 28000, 'active', 25000, now())
on conflict (id) do nothing;

-- ── Removal ──────────────────────────────────────────────────────────────────
-- To remove: delete from public.listings where id in ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000005');
--            delete from public.profiles where id = 'a0000000-0000-0000-0000-000000000001';
--            delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001';
