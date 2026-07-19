-- CampusSwap AI — Auth: domain→campus profile creation on signup
-- See design.md §1.2.3 (Auth Architecture), §1.6 Flow 1 (Email OTP Onboarding +
-- Campus Assignment), and §2.1 (Authentication). Implements the server-side
-- trigger that finalizes a profile when a Supabase Auth user is created.
--
-- Requirements:
--   1.8  — assign the Verified_Student to the Campus mapped to their email domain
--   9.2  — persist each user with a verified_student flag and assigned campus ref
--   11.1 — campus assignment derives SOLELY from domain_campus_map (config, not code)
--   1.2  — unsupported domains → profile with null campus + verified_student=false
--          so the client can surface a "campus not supported" outcome
--
-- SECURITY / RLS NOTE:
--   This function is SECURITY DEFINER and therefore BYPASSES Row Level Security.
--   That is intentional and required: there is NO client INSERT policy on
--   public.profiles by design (see 20250714120300_rls_helpers_policies.sql).
--   Profile rows are created ONLY here, server-side, on the auth.users insert
--   event — a decompiled client can never forge a verified profile or assign
--   itself a campus. `set search_path = public, pg_temp` prevents search-path
--   hijacking of the SECURITY DEFINER function.

-- ── handle_new_user(): resolve domain→campus and finalize the profile ───────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain citext;
  v_campus uuid;
begin
  -- Lowercase the email domain (citext makes the map lookup case-insensitive).
  v_domain := lower(split_part(NEW.email, '@', 2))::citext;

  -- Campus assignment derives solely from domain_campus_map (Req 11.1).
  -- Absent domain → v_campus stays null → unverified profile (Req 1.2).
  select campus_id
    into v_campus
    from public.domain_campus_map
   where domain = v_domain;

  -- Create/finalize the 1:1 profile row. verified_student is true only when
  -- the domain maps to a supported campus (Req 1.8, 9.2, 11.1); unsupported
  -- domains yield a null campus + verified_student=false (Req 1.2).
  insert into public.profiles (id, email, campus_id, verified_student, display_name)
  values (
    NEW.id,
    NEW.email,
    v_campus,
    v_campus is not null,
    split_part(NEW.email, '@', 1)
  )
  on conflict (id) do update
    set email            = excluded.email,
        campus_id        = coalesce(profiles.campus_id, excluded.campus_id),
        verified_student = (coalesce(profiles.campus_id, excluded.campus_id) is not null);

  return NEW;
end;
$$;

-- ── Trigger: fire on every new auth.users row ──────────────────────────────
-- Guarded with DROP so the migration is idempotent / re-runnable.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
