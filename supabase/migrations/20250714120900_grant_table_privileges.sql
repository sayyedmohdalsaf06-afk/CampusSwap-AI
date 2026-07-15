-- Grant base table privileges to the authenticated and anon roles for all app tables.
-- Required because tables created via migrations may not inherit the default schema grants
-- on newer Supabase projects. RLS policies (20250714120300) provide row-level filtering
-- ON TOP of these privileges — they do NOT grant access themselves.
-- This does NOT modify RLS policies or schema.

-- authenticated role: full CRUD subject to RLS row filtering
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, delete on public.listing_images to authenticated;
grant select, insert on public.threads to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.need_it_requests to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.campuses to authenticated;
grant select on public.domain_campus_map to authenticated;
grant select on public.carbon_category_map to authenticated;
grant select on public.badges to authenticated;

-- anon role: read-only on config/reference tables + the dev-only listings read
grant select on public.campuses to anon;
grant select on public.domain_campus_map to anon;
grant select on public.carbon_category_map to anon;
grant select on public.badges to anon;
grant select on public.listings to anon;
grant select on public.listing_images to anon;

-- usage on sequences (needed for insert if any serial/generated columns, though we use uuid defaults)
grant usage on all sequences in schema public to authenticated;
grant usage on all sequences in schema public to anon;

-- NOTE: RLS (20250714120300) still filters rows; these grants only allow the role to ATTEMPT the operation.
