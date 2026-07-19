-- CampusSwap AI — Task 1.2 (database foundation), File 1 of 3
-- Extensions + enum types. See design.md §1.3 "Data Model (PostgreSQL Schema)".
-- No RLS here (RLS is Task 1.4).

-- ── Extensions ────────────────────────────────────────────────────────────
-- citext: case-insensitive text for email + domain matching.
create extension if not exists citext;
-- pgcrypto: provides gen_random_uuid() for UUID primary keys.
create extension if not exists pgcrypto;

-- ── Enum types (design §1.3.1) ────────────────────────────────────────────
-- Guarded with a DO block so re-running the migration is idempotent.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_type') then
    create type listing_type as enum ('sell', 'donate');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type listing_status as enum ('active', 'reserved', 'sold', 'donated');
  end if;

  if not exists (select 1 from pg_type where typname = 'need_it_status') then
    create type need_it_status as enum ('open', 'fulfilled');
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum ('active', 'released', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_event') then
    create type notification_event as enum (
      'listing_reserved',
      'new_message',
      'badge_earned',
      'need_it_response',
      'listing_completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_target') then
    create type notification_target as enum ('listing', 'thread', 'need_it_request');
  end if;

  if not exists (select 1 from pg_type where typname = 'badge_threshold_type') then
    create type badge_threshold_type as enum ('first_donation', 'carbon_kg', 'completed_count');
  end if;
end
$$;
