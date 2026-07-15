-- Additive policy: allow the anon role to SELECT domain_campus_map. Needed for the
-- PRE-SIGNUP campus-support check on the email screen (runs as anon before a session
-- exists). domain→campus rows are non-sensitive configuration. This does NOT modify
-- the existing `domain_campus_map_select` (authenticated) policy — it only ADDS an
-- anon read. Idempotent (drop-if-exists guard).

drop policy if exists "domain_campus_map_anon_read" on public.domain_campus_map;
create policy "domain_campus_map_anon_read" on public.domain_campus_map
  for select to anon
  using (true);

-- To remove: drop policy if exists "domain_campus_map_anon_read" on public.domain_campus_map;
