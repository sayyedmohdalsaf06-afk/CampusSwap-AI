-- CampusSwap AI — Task 1.5: reference / configuration seed data
-- Seeds ONLY reference/config tables: campuses, domain_campus_map,
-- carbon_category_map, and badges config. See design.md §1.3 (tables) and
-- §4.3 (seed note), and Requirements 6.1/6.6 (directional carbon map),
-- 11.1/11.2 (domain→campus mapping enables campuses via config), and
-- 14.5 (badge thresholds cover first-donation, carbon-kg, completed-count).
--
-- NOTE: This file contains NO demo users/profiles, auth users, listings, or
--       any transactional data — demo content is a separate, later
--       demo-protection task (see tasks.md §2.1/§3.2).
-- NOTE: Every statement is idempotent (guarded by `on conflict ... do nothing`),
--       so re-running this seed against an existing database is safe.

-- ── campuses (Pune pilot cohort) ───────────────────────────────────────────
-- Fixed UUIDs so domain_campus_map can reference them deterministically.
insert into campuses (id, name, city, active) values
  ('11111111-1111-1111-1111-111111111111', 'Dr. D. Y. Patil Vidyapeeth',                      'Pune', true),
  ('22222222-2222-2222-2222-222222222222', 'MIT World Peace University',                      'Pune', true),
  ('33333333-3333-3333-3333-333333333333', 'College of Engineering Pune (COEP)',              'Pune', true),
  ('44444444-4444-4444-4444-444444444444', 'Vishwakarma Institute of Technology (VIT Pune)',  'Pune', true)
on conflict (id) do nothing;

-- ── domain_campus_map (sole source of campus assignment; Req 1.8, 11.1, 11.2)
-- One realistic institutional domain per campus. `domain` is citext (unique),
-- so lookups are case-insensitive.
insert into domain_campus_map (domain, campus_id) values
  ('dpu.edu.in',    '11111111-1111-1111-1111-111111111111'),
  ('mitwpu.edu.in', '22222222-2222-2222-2222-222222222222'),
  ('coep.ac.in',    '33333333-3333-3333-3333-333333333333'),
  ('vit.edu',       '44444444-4444-4444-4444-444444444444')
on conflict (domain) do nothing;

-- ── carbon_category_map (directional gCO2e saved by reuse; Req 6.1, 6.6) ─────
-- Values are DIRECTIONAL estimates of the CO2e avoided by reusing an item
-- rather than buying new (per design §6 / Req 6.6). Category keys are lowercase
-- snake_case and MUST match the listing `category` values used across the app.
insert into carbon_category_map (category, savings_g) values
  ('books',             1200),
  ('electronics',      25000),
  ('furniture',        30000),
  ('hostel_essentials', 5000),
  ('cycles',           90000)
on conflict (category) do nothing;

-- ── badges (default gamification definitions; Req 14.5) ──────────────────────
-- Covers all three `badge_threshold_type` enum values:
--   first_donation  → granted on first completed donation
--   carbon_kg       → granted at a cumulative kg CO2e milestone
--   completed_count → granted at a completed sales/donations count
insert into badges (key, label, description, threshold_type, threshold_value) values
  ('first_donation', 'First Donation', 'Awarded for your first completed donation.', 'first_donation',  1),
  ('eco_starter',    'Eco Starter',    'Saved 10 kg CO₂e through reuse.',            'carbon_kg',       10),
  ('eco_hero',       'Eco Hero',       'Saved 50 kg CO₂e through reuse.',            'carbon_kg',       50),
  ('eco_legend',     'Eco Legend',     'Saved 100 kg CO₂e through reuse.',           'carbon_kg',      100),
  ('swapper_5',      'Campus Swapper', 'Completed 5 sales or donations.',            'completed_count',  5),
  ('swapper_25',     'Swap Champion',  'Completed 25 sales or donations.',           'completed_count', 25)
on conflict (key) do nothing;
