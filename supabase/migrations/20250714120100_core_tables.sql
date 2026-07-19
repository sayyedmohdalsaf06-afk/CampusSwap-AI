-- CampusSwap AI — Task 1.2 (database foundation), File 2 of 3
-- Core tables + foreign keys + check constraints. See design.md §1.3.2/§1.3.3.
-- Conventions: uuid PKs default gen_random_uuid(); created_at timestamptz not null default now().
-- No RLS here (RLS is Task 1.4). Tables are declared in dependency order.

-- 1) campuses — one row per tenant campus.
create table if not exists campuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,
  active      boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) domain_campus_map — sole source of campus assignment (Req 1.8, 11.1, 11.2).
create table if not exists domain_campus_map (
  id         uuid primary key default gen_random_uuid(),
  domain     citext not null unique,
  campus_id  uuid not null references campuses(id),
  created_at timestamptz not null default now()
);

-- 3) profiles — 1:1 extension of the Supabase Auth user (Req 9.2).
--    id is the auth.users FK (no default); campus_id null until verified.
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               citext not null,
  verified_student    boolean not null default false,
  campus_id           uuid references campuses(id),
  display_name        text,
  cumulative_carbon_g bigint not null default 0,
  points              int not null default 0,
  badges              jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

-- 4) carbon_category_map — directional carbon reference (Req 6.1).
create table if not exists carbon_category_map (
  id         uuid primary key default gen_random_uuid(),
  category   text not null unique,
  savings_g  int not null
);

-- 5) badges — seeded config, read-only to clients.
create table if not exists badges (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  label           text not null,
  description     text,
  threshold_type  badge_threshold_type not null,
  threshold_value int not null
);

-- 6) listings
create table if not exists listings (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid not null references profiles(id),
  campus_id        uuid not null references campuses(id),
  listing_type     listing_type not null,
  title            text not null,
  description      text,
  category         text not null,
  condition        text,
  price            numeric,
  status           listing_status not null default 'active',
  carbon_savings_g int,
  published_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- 7) listing_images — at least one row required to publish (Req 3.8, 9.1).
create table if not exists listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  storage_path  text not null,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

-- 8) need_it_requests
create table if not exists need_it_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id),
  campus_id    uuid not null references campuses(id),
  title        text not null,
  description  text not null,
  category     text not null,
  max_budget   numeric,
  status       need_it_status not null default 'open',
  created_at   timestamptz not null default now()
);

-- 9) reservations — NO monetary column by design (Req 13.4).
create table if not exists reservations (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id),
  buyer_id   uuid not null references profiles(id),
  campus_id  uuid not null references campuses(id),
  status     reservation_status not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 10) threads — subject is exactly one of listing_id / need_it_request_id.
create table if not exists threads (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid references listings(id),
  need_it_request_id uuid references need_it_requests(id),
  buyer_id           uuid not null references profiles(id),
  seller_id          uuid not null references profiles(id),
  campus_id          uuid not null references campuses(id),
  created_at         timestamptz not null default now(),
  constraint threads_one_subject check (
    (listing_id is not null)::int + (need_it_request_id is not null)::int = 1
  )
);

-- 11) messages
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

-- 12) notifications — in-app only (Req 15.10); rows created by Edge Functions.
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id),
  campus_id    uuid not null references campuses(id),
  event_type   notification_event not null,
  target_type  notification_target not null,
  target_id    uuid not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
