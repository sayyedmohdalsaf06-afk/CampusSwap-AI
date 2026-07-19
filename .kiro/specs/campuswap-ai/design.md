# Design Document: CampusSwap AI

## Overview

CampusSwap AI is a React Native + Expo (iOS + Android) mobile marketplace backed by Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions), using Gemini 2.5 Flash — invoked only through Supabase Edge Functions — for AI-assisted listing automation and Supabase Auth email OTP for verification. It connects institutional-email-verified students within their own campus to sell and donate second-hand goods, with directional carbon-savings visualization. The application is **facilitate-only**: it never processes, holds, or routes funds — all transactions occur offline.

This document is the single design artifact for the v1 48-hour hackathon MVP. Because the workflow produces one design file, it deliberately folds three concerns into clearly separated top-level sections:

1. **Architecture** — system overview, components, data model, and sequence flows.
2. **Security & Compliance** — a dedicated section covering OTP hardening, campus isolation, API-key protection, PII, and abuse prevention.
3. **Roadmap** — a phased plan (Phase 0 hackathon MVP through Phase 3 monetization).

The design is intentionally pragmatic: everything below is buildable within a 48-hour window and demonstrable on a single pilot campus (Pune) while remaining multi-campus-ready through configuration.

### Design Priorities (in order)
1. Functional demo — the happy path must work end-to-end.
2. Excellent UX — smooth onboarding, listing, and browsing.
3. AI automation — Gemini-assisted listing creation.
4. Sustainability visualization — carbon savings at user and campus level.

### Technology Stack (authoritative)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Mobile client | React Native + Expo (SDK, Expo Router) | One codebase, iOS + Android, file-based routing, fast iteration |
| UI / styling | NativeWind v5 + Reanimated + Moti + Lucide Icons | Utility-first styling with smooth, animated UX |
| Client state | Zustand (client/UI state) + TanStack Query (server cache) | Clear split between ephemeral UI state and cached server data |
| Forms / validation | React Hook Form + Zod | Type-safe forms and schema validation shared client + Edge Functions |
| Backend | Supabase (managed Postgres platform) | PostgreSQL + Auth + Storage + Realtime + Edge Functions with Row Level Security — minimal infra for 48h, scales to many campuses |
| Database | Supabase PostgreSQL + Row Level Security (RLS) | Relational integrity, indexes, and per-campus isolation enforced at the data layer |
| Data access | PostgREST (@supabase/supabase-js) + Edge Functions (Deno/TS) | Direct RLS-guarded CRUD for normal ops; Edge Functions for privileged/secret logic |
| Auth | Supabase Auth (email OTP) | Passwordless OTP; JWT sessions; campus assigned from email domain |
| AI | Gemini 2.5 Flash (multimodal: images + text) via Edge Functions | Vision + text generation of titles, descriptions, condition, price, carbon refinement; key stays server-side |
| Storage | Supabase Storage (RLS-guarded bucket) | Listing images with policy-guarded client upload and server-side validation |
| Realtime | Supabase Realtime (Postgres change events) | Powers in-app messaging and notifications, RLS-aware |

---

# Part 1 — Architecture

## 1.1 System Overview

```
+---------------------------------------------------------------+
|            React Native + Expo App (iOS + Android)            |
|                                                               |
|  Onboarding  |  Feed/Search  |  Create Listing  |  Messaging  |
|  Profile     |  Sustainability Dashboard                      |
|                                                               |
|  Expo Router · NativeWind · Zustand · TanStack Query          |
|  services/ layer wraps @supabase/supabase-js (JWT session)    |
+-------------------------------|-------------------------------+
              HTTPS (PostgREST) | + WebSocket (Realtime)
                                v
+---------------------------------------------------------------+
|                       Supabase Backend                        |
|                                                               |
|  Supabase Auth (email OTP, JWT sessions)                      |
|  PostgreSQL + Row Level Security (campus scoping, ownership)  |
|  Supabase Storage (listing images, RLS-guarded bucket)        |
|  Supabase Realtime (Postgres change events: messages, notifs) |
|                                                               |
|  Edge Functions (Deno/TypeScript) — privileged/secret ops:    |
|   - onboarding: domain -> campus assignment (trigger/fn)      |
|   - ai-generate-listing / ai-estimate-carbon (Gemini proxy)   |
|   - reservation completion + gamification awards              |
|   - notification fan-out                                      |
+------------------------------------|--------------------------+
                                     |  (server-side only,
                                     v   key held as fn secret)
                            +--------------------+
                            |   Gemini 2.5 Flash |
                            |   (multimodal AI)  |
                            +--------------------+
```

**Key architectural decisions:**

- **Supabase as the single backend.** PostgreSQL, Auth, Storage, Realtime, and Edge Functions come from one managed platform, eliminating infrastructure setup cost in a 48-hour window while providing a production-grade, horizontally scalable Postgres foundation for growth to many campuses.
- **RLS-first data access.** Normal CRUD goes directly through PostgREST (`@supabase/supabase-js`) guarded by **Row Level Security** policies; **Edge Functions** are reserved for privileged or secret operations (AI proxy, reservation completion + gamification, notification fan-out, domain→campus assignment). This keeps the client thin and the trust boundary in the database.
- **Server-side AI proxy via Edge Functions.** Gemini 2.5 Flash is invoked only from Supabase Edge Functions, never directly from the React Native client. This is the single most important security choice: the Gemini API key is stored as an Edge Function secret and never shipped in a mobile bundle (bundles are trivially decompiled). See §2.3.
- **Campus scoping enforced at the data layer.** Rather than trusting the client, campus isolation is enforced through **RLS policies** (with indexed campus columns) plus Edge Function checks, so every read/write is filtered to the requester's campus server-side. Indexes + RLS scale this isolation to hundreds of thousands of users. See §1.5 and §2.2.
- **Configuration-driven multi-campus.** All campus assignment flows through the `domain_campus_map` table (resolved by a trigger/Edge Function on verification). Adding a campus is a data insert, not a code change (Req 11).

## 1.2 Components

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Onboarding_Service | Email domain validation, OTP generation/verification/expiry, campus assignment | Supabase Auth email OTP + `domain_campus_map` table; domain→campus resolved by trigger/Edge Function |
| Listing_Service | Create/edit/publish/delete listings, publish validation, status transitions, ownership + campus integrity | `listings` table + RLS policies + Postgres triggers |
| AI_Service | Proxy to Gemini for title/description/condition/price and carbon refinement; timeout + fallback | Supabase Edge Functions (`ai-generate-listing`, `ai-estimate-carbon`) |
| Feed_Service | Campus-scoped browse, search, category filter, pagination, active-only filtering | PostgREST queries (`@supabase/supabase-js`) with RLS-enforced campus filter + indexes |
| Recommendation_Engine | Rule-based ranking (category affinity + recency) | Client-side ranking over campus feed (v1) |
| Coordination_Service | Contact reveal, message threads, realtime delivery, offline guidance | `threads` + `messages` tables + Supabase Realtime channels |
| Sustainability_Service | Carbon baseline from map, optional AI refine, per-user + per-campus aggregation | `carbon_category_map` table + Edge Function refine + aggregate SQL queries |
| Profile_Service | Profile view, personal listings management, cumulative carbon, points + badges display | Client views over `users` + `listings` via PostgREST |
| NeedIt_Service | Create/browse/respond/close campus-scoped Need It requests; optional keyword match to listings | `need_it_requests` table + RLS policies; reuses `threads`/`messages` for responses |
| Reservation_Service | Create/release/expire/complete no-payment reservations; single-active-per-listing invariant; listing status transitions | `reservations` table + RLS policies + triggers + partial unique index; completion via Edge Function |
| Gamification_Service | Award points, grant badges, compute campus leaderboard — all server-side | `badges` table + `users.points`/`users.badges` written only by Edge Functions/triggers + aggregate queries |

### 1.2.1 Frontend Architecture

React Native + Expo (Expo SDK) with **Expo Router** for file-based navigation across the screens in §4.2. Styling uses **NativeWind v5** with **React Native Reanimated** + **Moti** for animations and **Lucide Icons**. State is split cleanly: **Zustand** holds client/UI state (session, filters, draft listing), while **TanStack Query** owns the server cache (feed, threads, notifications) with background refetch and optimistic updates. Forms use **React Hook Form** + **Zod** schemas (shared with Edge Functions for consistent validation). A thin `services/` layer wraps `@supabase/supabase-js` so screens never call the SDK directly — this isolates Supabase session handling, PostgREST queries, Storage uploads, and Realtime subscriptions behind typed functions, keeping the app maintainable as it scales.

### 1.2.2 Backend Architecture

Supabase provides the entire backend: **PostgreSQL** as the system of record, **Supabase Auth** for identity, **Supabase Storage** for images, **Supabase Realtime** for live updates, and **Edge Functions** (Deno/TypeScript) for privileged logic. The access pattern is deliberate:

- **Direct PostgREST** (via `@supabase/supabase-js`) for routine, RLS-guarded CRUD — listings, threads, messages, need-it requests, notifications reads.
- **Edge Functions** for anything privileged or secret: the AI proxy (`ai-generate-listing`, `ai-estimate-carbon`), reservation completion + gamification awards, notification fan-out, and domain→campus assignment.

**Row Level Security** is the primary trust boundary; indexed campus/owner columns keep RLS checks fast, allowing the same policies to scale from one pilot campus to hundreds of thousands of users across many campuses.

### 1.2.3 Auth Architecture

Authentication uses **Supabase Auth email OTP** (passwordless). On verification, the student's campus is derived from their email domain via a `domain_campus_map` lookup executed server-side by a trigger/Edge Function (never trusted from the client). Supabase issues a **JWT session** carrying the user id and claims used by RLS. A `verified_student` flag gates all browsing, listing, and coordination features. Adding a campus is a data insert into `domain_campus_map` — no code change (Req 11).

### 1.2.4 Storage Architecture

Listing images live in a dedicated **Supabase Storage** bucket. Clients upload directly, guarded by **Storage RLS policies** (only the owning seller may write objects under their listing path). Uploaded objects are referenced by `listing_images` rows so the relational model remains the source of truth. Edge Functions / triggers perform **server-side validation** of MIME type, file size, and per-listing image count before a listing may publish, so validation cannot be bypassed by the client.

### 1.2.5 Realtime Architecture

Live updates use **Supabase Realtime** subscribing to **Postgres change events**. The client opens **per-thread** channels for `messages` and a per-user channel for `notifications`. Subscriptions are **RLS-aware** — a client only receives change events for rows its policies permit, so realtime inherits the same campus/recipient isolation as reads. This powers in-app messaging and notification delivery without additional infrastructure.

### 1.2.6 AI Architecture

Gemini **2.5 Flash** is invoked **only** through Supabase Edge Functions — `ai-generate-listing` (photos + text → title/description/condition/price) and `ai-estimate-carbon` (category baseline refinement). Each call enforces a **15-second timeout** with clean fallback to manual entry / the category-map baseline, plus **per-user rate limiting** to cap cost and abuse. The Gemini **API key is stored as an Edge Function secret** and never reaches the client bundle (see §2.3).

## 1.3 Data Model (PostgreSQL Schema)

The system of record is **Supabase PostgreSQL**. The schema is deliberately lean for a 48-hour build yet startup-scalable: every app row carries a `campus_id` so **campus = tenant** isolation is enforced by RLS and kept fast by campus-scoped indexes. Conventions applied to every table below: primary keys are `uuid` with `default gen_random_uuid()`; `created_at` is `timestamptz not null default now()`; foreign keys use Postgres-native `uuid` references. Routine reads/writes go straight through PostgREST under RLS; only three concerns use Edge Functions with the service role — (1) the Gemini proxy, (2) Resend email delivery, and (3) server-authoritative writes (gamification, notifications, reservation completion).

### 1) Enums (Postgres enum types)

| Enum type | Values |
|-----------|--------|
| `listing_type` | `'sell'`, `'donate'` |
| `listing_status` | `'active'`, `'reserved'`, `'sold'`, `'donated'` |
| `need_it_status` | `'open'`, `'fulfilled'` |
| `reservation_status` | `'active'`, `'released'`, `'completed'` |
| `notification_event` | `'listing_reserved'`, `'new_message'`, `'badge_earned'`, `'need_it_response'`, `'listing_completed'` |
| `notification_target` | `'listing'`, `'thread'`, `'need_it_request'` |
| `badge_threshold_type` | `'first_donation'`, `'carbon_kg'`, `'completed_count'` |

### 2) Tables

**`campuses`** — one row per tenant campus.

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | not null (e.g., "Pune Pilot Campus") |
| city | text | not null |
| active | boolean | not null default `true` (pilot toggle) |
| created_at | timestamptz | not null default `now()` |

**`domain_campus_map`** — sole source of campus assignment; add a row to enable a campus, no code change (Req 1.8, 11.1, 11.2).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| domain | citext | UNIQUE, not null (e.g., `university.edu`; `citext` = case-insensitive) |
| campus_id | uuid | not null, FK → `campuses(id)` |
| created_at | timestamptz | not null default `now()` |

**`profiles`** — 1:1 extension of the Supabase Auth user (Req 9.2).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE (1:1) |
| email | citext | not null (institutional email — PII, §2.4) |
| verified_student | boolean | not null default `false` (true only after OTP success) |
| campus_id | uuid | FK → `campuses(id)`, null until verified; required once verified |
| display_name | text | shown in threads |
| cumulative_carbon_g | bigint | not null default `0` (completed-transaction savings cache) |
| points | int | not null default `0` — **server-written only** (Req 14.1, §2.8) |
| badges | jsonb | not null default `'[]'` — array of badge keys, **server-written only** (Req 14.4, §2.8) |
| created_at | timestamptz | not null default `now()` |

**`carbon_category_map`** — directional carbon reference (Req 6.1).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| category | text | UNIQUE, not null (matches listing categories) |
| savings_g | int | not null (directional gCO2e saved by reuse) |

**`listings`**

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| seller_id | uuid | not null, FK → `profiles(id)` (owner, Req 9.1) |
| campus_id | uuid | not null, FK → `campuses(id)` (= seller's campus, Req 9.3) |
| listing_type | listing_type | not null (Req 3.1) |
| title | text | not null (required to publish, Req 3.8) |
| description | text | AI-suggested, editable |
| category | text | not null; drives carbon + filter |
| condition | text | AI-suggested, editable |
| price | numeric | null; required for `sell`, null for `donate` (Req 3.4/3.5/3.9) |
| status | listing_status | not null default `'active'`; only `active` browsable (Req 4.6), `reserved` shows indicator (Req 13.5) |
| carbon_savings_g | int | baseline from map, optional AI refine (Req 6.1/6.3) |
| published_at | timestamptz | feed ordering key (Req 4.1) |
| created_at | timestamptz | not null default `now()` |

**`listing_images`** — at least one row required to publish (Req 3.8, 9.1).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| listing_id | uuid | not null, FK → `listings(id)` ON DELETE CASCADE |
| storage_path | text | not null — Supabase Storage object path (validated server-side, §2.6) |
| display_order | int | not null default `0` (ordering within a listing) |
| created_at | timestamptz | not null default `now()` |

**`threads`** — the subject is a listing **OR** a Need It request (exactly one FK set).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| listing_id | uuid | null, FK → `listings(id)` |
| need_it_request_id | uuid | null, FK → `need_it_requests(id)` |
| buyer_id | uuid | not null, FK → `profiles(id)` (initiator) |
| seller_id | uuid | not null, FK → `profiles(id)` (owner/responder) |
| campus_id | uuid | not null, FK → `campuses(id)` (both participants' campus, Req 2.4) |
| created_at | timestamptz | not null default `now()` |

> CHECK: exactly one of `listing_id` / `need_it_request_id` is non-null.

**`messages`**

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| thread_id | uuid | not null, FK → `threads(id)` ON DELETE CASCADE |
| sender_id | uuid | not null, FK → `profiles(id)` |
| body | text | not null (plain text) |
| created_at | timestamptz | not null default `now()` (delivery ordering) |

**`need_it_requests`**

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| requester_id | uuid | not null, FK → `profiles(id)` (owner, Req 12.1, 12.7) |
| campus_id | uuid | not null, FK → `campuses(id)` (= requester's campus, Req 12.2) |
| title | text | not null (Req 12.1) |
| description | text | not null (Req 12.1) |
| category | text | not null; drives optional keyword match (Req 12.8) |
| max_budget | numeric | null (optional maximum budget, Req 12.1) |
| status | need_it_status | not null default `'open'`; only `open` browsable (Req 12.4, 12.6) |
| created_at | timestamptz | not null default `now()` |

**`reservations`** — **no monetary column by design** (Req 13.4, §2.9).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| listing_id | uuid | not null, FK → `listings(id)` (≤ one `active` per listing, Req 13.3) |
| buyer_id | uuid | not null, FK → `profiles(id)` (reserving buyer, Req 13.8) |
| campus_id | uuid | not null, FK → `campuses(id)` (listing's campus, Req 13.8) |
| status | reservation_status | not null default `'active'`; `active` blocks other reservations (Req 13.3, 13.6, 13.7) |
| expires_at | timestamptz | reservation timeout; on expiry → listing back to `active` (Req 13.7) |
| created_at | timestamptz | not null default `now()` |

**`badges`** — seeded config, read-only to clients.

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| key | text | UNIQUE, not null (stable key stored in `profiles.badges`, e.g. `first_donation`) |
| label | text | not null (display name) |
| description | text | what the badge recognizes |
| threshold_type | badge_threshold_type | not null (metric evaluated, Req 14.5) |
| threshold_value | int | not null (value at which granted; e.g. `50` kg, `1` donation) |

**`notifications`** — in-app only (Req 15.10); rows created by Edge Functions.

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid | PK, default `gen_random_uuid()` |
| recipient_id | uuid | not null, FK → `profiles(id)` (addressee, Req 15.1–15.6) |
| campus_id | uuid | not null, FK → `campuses(id)` (campus-consistent delivery, Req 15.6) |
| event_type | notification_event | not null (the event that produced it, Req 15.1–15.5) |
| target_type | notification_target | not null (deep-link target type, Req 15.9) |
| target_id | uuid | not null (id of related listing / thread / need_it_request, Req 15.9) |
| read | boolean | not null default `false` (Req 15.8) |
| created_at | timestamptz | not null default `now()` (most-recent-first, Req 15.7) |

### 3) Relationships / Foreign Keys

- **campus (tenant) 1—\*** `profiles`, `listings`, `threads`, `need_it_requests`, `reservations`, `notifications` — every app row is pinned to one campus via `campus_id`.
- **profile 1—\*** `listings`, `need_it_requests`, `reservations`, `notifications`; a profile also participates in `threads` as either `buyer_id` or `seller_id`.
- **listing 1—\*** `listing_images` (**ON DELETE CASCADE**) and **1—(≤1 active)** `reservation` (enforced by a partial unique index, see §4).
- **thread 1—\*** `messages` (**ON DELETE CASCADE**); each thread references either a `listing` or a `need_it_request` (exactly one).
- **domain_campus_map \*—1 campus**; `profiles.id` is a 1:1 FK to `auth.users(id)`.

### 4) Indexes

| Index | Rationale |
|-------|-----------|
| `domain_campus_map(domain)` UNIQUE | one campus per email domain; fast onboarding lookup |
| `listings(campus_id, status, published_at DESC)` | primary campus feed (active, most-recent-first) |
| `listings(campus_id, category)` | category filter within a campus |
| `listing_images(listing_id)` | fetch a listing's images |
| `messages(thread_id, created_at)` | ordered message history per thread |
| `threads(campus_id)`, `threads(buyer_id)`, `threads(seller_id)` | campus scope + a participant's thread list |
| `need_it_requests(campus_id, status)` | campus-scoped, open-only browse |
| `reservations(listing_id)` | look up a listing's reservations |
| **`reservations(listing_id)` PARTIAL UNIQUE `WHERE status = 'active'`** | DB-level enforcement of the **single-active-reservation-per-listing** invariant (Req 13.3) |
| `notifications(recipient_id, created_at DESC)` | recipient's notifications, most-recent-first |
| `profiles(campus_id)` | campus roster / leaderboard scans |

> The `campus_id` composite indexes keep RLS-filtered, multi-tenant queries fast as the platform grows to hundreds of campuses and hundreds of thousands of rows — every hot query is served from a campus-scoped index rather than a full scan.

### 5) Row Level Security Policies

RLS is **enabled on every app table** and is the primary trust boundary. Policies reference two SQL helpers that read the caller's own profile via `auth.uid()`: `current_campus()` (the caller's `campus_id`) and `is_verified()` (their `verified_student` flag). Server-authoritative writes (points, badges, notifications, reservation completion) are performed by Edge Functions using the **service role**, which bypasses RLS by design (Req 14/15/13.6).

- **profiles** — SELECT own row plus same-campus profiles (`campus_id = current_campus()`); UPDATE only own row and only non-privileged columns. `points` and `badges` are **not** client-updatable (written by Edge Functions via the service role).
- **listings** — SELECT where `campus_id = current_campus() AND (status = 'active' OR seller_id = auth.uid())`; INSERT where `seller_id = auth.uid() AND campus_id = current_campus()`; UPDATE/DELETE where `seller_id = auth.uid()`.
- **listing_images** — INSERT/UPDATE/DELETE allowed when the parent `listings.seller_id = auth.uid()`; SELECT allowed when the parent listing is visible to the caller.
- **threads** — SELECT/INSERT restricted to participants (`buyer_id = auth.uid() OR seller_id = auth.uid()`) AND `campus_id = current_campus()`.
- **messages** — SELECT for participants of the parent thread; INSERT only by a participant of the thread (`sender_id = auth.uid()`), same campus.
- **need_it_requests** — SELECT where `campus_id = current_campus() AND (status = 'open' OR requester_id = auth.uid())`; INSERT where `requester_id = auth.uid() AND campus_id = current_campus()`; UPDATE/DELETE where `requester_id = auth.uid()`.
- **reservations** — SELECT for same-campus participants (buyer or listing's seller); INSERT where `buyer_id = auth.uid() AND campus_id = current_campus()` AND the target listing is `active`. Completion and status flips are performed by an Edge Function / service role.
- **notifications** — SELECT where `recipient_id = auth.uid()`; UPDATE limited to toggling the `read` flag on own rows; INSERT via **service role only** (Edge Functions).
- **badges**, **carbon_category_map**, **campuses**, **domain_campus_map** — read-only to authenticated clients; writes only via service role / seed.

> **Server-authoritative by design:** `points`, `badges`, notification creation, and reservation completion are written by Edge Functions using the service role (intentionally bypassing RLS), matching Req 14, Req 15, and Req 13.6. Clients can never inflate scores, self-grant badges, forge notifications, or complete reservations they do not own.

## 1.4 Interfaces

Interfaces split into two groups. **Prefer direct PostgREST** for everything routine — the client talks to the database through `@supabase/supabase-js`, and every call is filtered by **Row Level Security** (§1.5). **Edge Functions** are reserved for the three concerns that require secrets or server authority: the Gemini AI proxy, Resend email delivery, and server-authoritative writes (points/badges, notification fan-out, reservation completion). Edge Functions run with the **service role** and hold the sensitive keys (Gemini API key, Resend API key, service-role key) that must never ship in a mobile bundle.

### (A) Direct client CRUD via PostgREST (`@supabase/supabase-js`, RLS-guarded)

All operations below are issued directly from the client and constrained server-side by the RLS policies in §1.5 — no custom endpoint is needed.

| Table | Client operations | Purpose / Requirements |
|-------|-------------------|------------------------|
| `listings` | SELECT (feed + detail), INSERT, UPDATE own, DELETE own | Campus feed (active, recency), publish, owner edit/delete (Req 4.1, 4.6, 3.1–3.9, 7.3–7.6, 9.1) |
| `listing_images` | INSERT (owner), SELECT | Attach ≥1 image to a listing, read a listing's images (Req 3.8, 9.1) |
| `threads` | SELECT (participant), INSERT | List/open a thread, start a conversation (Req 5.1, 2.4, 12.5) |
| `messages` | SELECT (participant), INSERT + **Realtime subscribe** | Send plain-text messages, receive live via Realtime (Req 5.4, 5.5, 5.6) |
| `need_it_requests` | SELECT (open + own), INSERT, UPDATE own | Browse/create Need It requests, owner close→fulfilled (Req 12.1–12.4, 12.6, 12.7) |
| `reservations` | INSERT (reserve), SELECT, UPDATE (release) | Reserve an active listing, view, release (Req 13.1–13.3, 13.7) |
| `notifications` | SELECT + **Realtime subscribe**, UPDATE `read` flag | Recipient-scoped list (most-recent-first), live receive, mark-read (Req 15.6–15.8) |
| `profiles` | SELECT (own + same-campus), UPDATE own (non-privileged cols) | Profile view, own-listings owner, cumulative carbon (Req 7.1, 7.2, 9.2) |
| `badges` | SELECT | Read-only badge config for UI (Req 14.5, 14.8) |
| `carbon_category_map` | SELECT | Directional carbon reference for display (Req 6.1, 6.6) |
| `campuses` | SELECT | Campus name/city for dashboard + leaderboard labels (Req 6.5, 14.7) |

> Feed pagination, search, category filter, and the campus-scoped leaderboard are all **PostgREST queries** (index-backed `select` with `range`/`order`/`filter`) executed directly by the client under RLS — no server endpoint required (Req 4.1–4.3, 8.2, 14.6, 14.7). Rule-based recommendation ranking runs client-side over the campus feed (Req 4.4).

### (B) Edge Function endpoints (Deno/TypeScript, service role — secrets only)

Only privileged/secret operations become Edge Functions. Each holds the keys the client must never see and enforces server authority.

| Edge Function | Purpose | Secrets / role | Requirements |
|---------------|---------|----------------|--------------|
| `ai-generate-listing` | Proxy photos + text to **Gemini 2.5 Flash**; return title/description/condition/price (15s timeout + manual fallback) | Gemini API key | 3.2–3.4, 3.7, 10.2 |
| `ai-estimate-carbon` | Category baseline from `carbon_category_map` + optional Gemini refine | Gemini API key | 6.1–6.3 |
| `send-otp-email` | Deliver OTP email via **Resend** — *only if* a custom template/flow is needed. **Supabase Auth can send email OTP directly**, so this is optional and used solely for custom delivery | Resend API key | 1.1–1.3, 10.1 |
| `reserve-complete` | **Seller-only**: set listing `sold`/`donated`, close the reservation, then trigger gamification award + notification fan-out in the same server path | service role | 13.6, 13.8, 14.2–14.5, 15.1/15.5 |

> **Server-authoritative writes.** Gamification award (points/badges) and notification fan-out are **not** separate endpoints — they run **inside** the server path of `reserve-complete` and of the message-send flow, using the **service role** (bypassing RLS by design). This keeps orchestration minimal: no event bus, no queue, no extra API surface. Domain→campus assignment on verification runs as a Postgres trigger / lightweight Edge Function on the Supabase Auth signup event (Req 1.8, 11.1). Prefer PostgREST everywhere else — an operation becomes an Edge Function only when it must carry a secret (Gemini/Resend key) or write server-authoritative rows (points, badges, notifications, reservation completion).

## 1.5 Access Control Model (Row Level Security)

**Row Level Security (RLS) is the primary access-control mechanism** — enabled on every app table and enforced by PostgreSQL itself, so the client cannot bypass it (Req 2, 7, 9, 11, 12, 13, 14, 15). Policies build on two SQL helpers that resolve the caller from `auth.uid()`: `current_campus()` (the caller's `campus_id`) and `is_verified()` (their `verified_student` flag). This restates, as the access-control model, the policy set defined in the §1.3 RLS subsection. **Server-authoritative writes** (points, badges, notification creation, reservation completion) are performed by Edge Functions using the **service role**, which bypasses RLS by design.

- **profiles** — SELECT own row plus same-campus profiles (`campus_id = current_campus()`); UPDATE only own row and only non-privileged columns. `points` and `badges` are **not** client-writable — they are written by Edge Functions via the service role (Req 9.2, 14.1).
- **listings** — SELECT where `campus_id = current_campus() AND (status = 'active' OR seller_id = auth.uid())` (verified, same-campus, active-or-own); INSERT where `is_verified() AND seller_id = auth.uid() AND campus_id = current_campus()`; UPDATE/DELETE where `seller_id = auth.uid()` (Req 2.1, 2.2, 2.3, 4.6, 7.3–7.6, 9.1, 9.3, 11.3).
- **listing_images** — INSERT/DELETE allowed when the parent `listings.seller_id = auth.uid()`; SELECT allowed when the parent listing is visible to the caller. Publish requires ≥1 image (Req 3.8, 9.1).
- **need_it_requests** — SELECT where `campus_id = current_campus() AND (status = 'open' OR requester_id = auth.uid())`; INSERT where `is_verified() AND requester_id = auth.uid() AND campus_id = current_campus()`; UPDATE where `requester_id = auth.uid()` (owner-only close→`fulfilled`). Responses reuse `threads`/`messages` (Req 12.2, 12.3, 12.4, 12.5, 12.6, 12.7).
- **threads** — SELECT/INSERT restricted to participants (`buyer_id = auth.uid() OR seller_id = auth.uid()`) AND `campus_id = current_campus()` (Req 2.4, 5.1, 12.5).
- **messages** — SELECT for participants of the parent thread; INSERT only by a thread participant (`sender_id = auth.uid()`), same campus (Req 5.4, 5.5, 5.6).
- **reservations** — SELECT for same-campus participants (buyer or the listing's seller); INSERT where `is_verified() AND buyer_id = auth.uid() AND campus_id = current_campus()` AND the target listing is `active`. Release is an UPDATE by buyer or seller; **completion and status flips are service-role writes** via the `reserve-complete` Edge Function (Req 13.2, 13.3, 13.6, 13.7, 13.8). No monetary column exists, so no policy references funds (Req 13.4).
- **notifications** — SELECT where `recipient_id = auth.uid()` (recipient-isolated, same campus); UPDATE limited to toggling the own `read` flag; **INSERT via service role only** (Edge Functions). Ordered most-recent-first (Req 15.6, 15.7, 15.8). No push transport (Req 15.10).
- **badges**, **carbon_category_map**, **campuses**, **domain_campus_map** — read-only to authenticated clients; writes only via service role / seed (Req 14.5).

> **Service-role writes bypass RLS by design.** Points/badges awards (Req 14.1–14.5), notification creation (Req 15.1–15.5), and reservation completion (Req 13.6) are performed only by Edge Functions using the service role. A decompiled client or crafted PostgREST request can never inflate scores, self-grant badges, forge notifications, or complete a reservation it does not own — the trust boundary lives in the database, not the app. The campus-scoped leaderboard is a read-only PostgREST/RPC query filtered by `current_campus()`, guaranteeing per-campus isolation (Req 14.6, 14.7).

## 1.6 Sequence Flows

All flows follow the pattern **Client → Supabase (PostgREST/Auth/Realtime/Storage) → Edge Functions (only when a secret or server authority is required)**. There is no event bus and no orchestration layer — server-authoritative side effects (gamification, notifications) run inline in the relevant Edge Function's server path.

### Flow 1 — Email OTP Onboarding + Campus Assignment (Req 1)

Supabase Auth issues and verifies the OTP directly (a custom `send-otp-email` Edge Function via Resend is used only if a bespoke template is required). On verification, a trigger/Edge Function resolves domain→campus and finalizes the profile.

```
User          RN App                 Supabase Auth              Trigger / Edge Fn
 |  enter email  |                         |                          |
 |-------------->| signInWithOtp(email)     |                          |
 |               |------------------------->| generate + email OTP     |
 |               |                          | (built-in delivery, or   |
 |               |                          |  send-otp-email→Resend)  |
 |               |   OTP sent (or err → resend, Req 1.1–1.3, 10.1)     |
 |<--------------|                          |                          |
 |  enter code   |                          |                          |
 |-------------->| verifyOtp(email, code)   |                          |
 |               |------------------------->| validate code + expiry   |
 |               |    invalid → error (Req 1.5); expired → resend (Req 1.7)
 |               |          success → issue JWT session (Req 1.4)      |
 |               |                          | on new user → trigger --->| lowercase domain
 |               |                          |                          | lookup domain_campus_map
 |               |                          |          domain absent → campus-not-supported (Req 1.2)
 |               |                          |          set profiles.campus_id = map[domain],
 |               |                          |          verified_student = true (Req 1.8, 11.1)
 |               |   JWT session (uid + claims for RLS)                |
 |<--------------|                          |                          |
```

### Flow 2 — AI-Assisted Listing Creation with Fallback (Req 3, 10.2)

Client calls the `ai-generate-listing` Edge Function (which holds the Gemini key), then inserts the listing and images **directly via PostgREST** under RLS; photos upload to **Supabase Storage**.

```
Seller       RN App              Edge Fn: ai-generate-listing     Gemini 2.5 Flash
 | pick type   |                       |                              |
 | (sell/donate, Req 3.1)              |                              |
 | add photos → Supabase Storage upload (RLS-guarded bucket, §1.2.4)  |
 |------------>| invoke ai-generate-listing (image refs + text)       |
 |             | (spinner, Req 8.3) --->| multimodal analyze --------->| (Req 3.2–3.4)
 |             |   15s timeout <--------|<-- title/desc/condition/price|
 |  timeout/error → manual entry, publishing still works (Req 3.7, 10.2)
 |  edit any AI field (Req 3.6)         |                              |
 |------------>| PostgREST INSERT listings (RLS: verified, seller=uid, |
 |             |   campus=current_campus()) (Req 2.3, 9.1, 9.3)        |
 |             | PostgREST INSERT listing_images (≥1 required, Req 3.8)|
 |             | sell && no price → client+constraint reject (Req 3.9) |
 |             | donate → price omitted (Req 3.5)                      |
 |             | carbon baseline via ai-estimate-carbon (Req 6.1)     |
 |<------------| listing published                                    |
```

### Flow 3 — Buyer → Seller Minimal Realtime Messaging (Req 5, 2.4)

Messaging is deliberately **minimal**: thread creation, plain-text messages, a Realtime subscription, and stored timestamps. It **excludes** push notifications, read receipts, typing indicators, voice notes, image sharing, and presence (Req 5.7, 5.8). Messages are inserted via PostgREST; the counterpart receives them over a Supabase Realtime channel; the notification row is written server-side.

```
Buyer        RN App                 Supabase (PostgREST + Realtime)   Server path
 | tap Contact |                          |                              |
 |------------>| PostgREST find/insert thread (buyer, seller, listing,   |
 |             |   campus) — RLS: participant & same campus (Req 2.4, 5.1)|
 |             | show offline guidance (Req 5.3), no payment UI (Req 5.2)|
 |  subscribe Realtime channel on messages for this thread (Req 5.5)     |
 | send msg    | PostgREST INSERT message (plain text, RLS participant,   |
 |------------>|   sender=uid, same campus) (Req 5.4, 5.7)               |
 |             |   created timestamp stored (Req 5.6)                    |
 |             |   Realtime delivers row → Seller device (Req 5.5)       |
 |             |   notification row created server-side (service role) ->| (Req 15.2)
 |  (no push/read-receipt/typing/voice/image/presence — Req 5.8)         |
 |  if listing sold/donated → show "no longer available", keep thread (Req 5.9)
```

### Flow 4 — Feed Browsing (Req 4, 8)

Pure PostgREST — no server endpoint. RLS applies the campus + status filter; an index backs pagination; recommendations rank client-side.

```
Student      RN App                 Supabase (PostgREST, RLS)
 | open Feed   |                          |
 |------------>| SELECT listings                                        |
 |             |   RLS filter: campus_id = current_campus()             |
 |             |               AND status = 'active' (Req 2.2, 4.6, 11.3)|
 |             |   order by published_at DESC (Req 4.1)                 |
 |             |   range(offset, limit) → index-backed page (Req 8.2)   |
 |             | search/category filter as PostgREST filters (Req 4.2, 4.3)
 |<------------| campus feed page                                       |
 | rule-based recommendation ranking runs client-side (Req 4.4)         |
```

### Flow 5 — Need It Request Create + Respond (Req 12)

Pure PostgREST for create/browse/close; responding reuses the Flow 3 messaging thread. No separate offer entity.

```
Requester    RN App                 Supabase (PostgREST, RLS)
 | fill form (title/desc/category, optional budget, Req 12.1)           |
 |------------>| INSERT need_it_requests                                |
 |             |   RLS: verified, requester=uid, campus=current_campus()|
 |             |   status defaults 'open' (Req 12.2)                    |
 |<------------| created                                                |

Responder    RN App                 Supabase (PostgREST, RLS)
 | browse Need It                                                       |
 |------------>| SELECT need_it_requests — RLS: same campus & 'open' (Req 12.3, 12.4)
 | (optional) surface matching active listings by keyword (Req 12.8)    |
 | tap Respond → PostgREST find/insert thread(responder, requester),    |
 |              same campus → reuses Flow 3 messaging (Req 12.5)         |
 |              notification row created server-side (Req 15.4)          |

Requester closes/fulfills:
 |------------>| UPDATE need_it_requests SET status='fulfilled'         |
 |             |   RLS: requester_id = auth.uid() (non-owner rejected, Req 12.7)
 |             |   excluded from browse thereafter (Req 12.6)           |
```

### Flow 6 — Reservation Lifecycle (Req 13)

Reserve and release are PostgREST writes under RLS; the **partial unique index** enforces a single active reservation; **seller completion** goes through the `reserve-complete` Edge Function (service role).

```
                          listing.status transitions
       reserve             reserve-complete (sold/donate)
active ---------> reserved --------------------------> sold | donated   (Req 13.1, 13.6)
   ^                 |
   | release/expiry  |
   +-----------------+   (Req 13.7)

Buyer        RN App                 Supabase (PostgREST, RLS + index)
 | tap Reserve |                          |
 |------------>| INSERT reservation (buyer=uid, campus=current_campus(),|
 |             |   listing active) — RLS + partial unique index enforce |
 |             |   single-active-per-listing (Req 13.2, 13.3, 13.8)     |
 |             |   NO funds touched — no monetary column (Req 13.4)     |
 |             |   listing → 'reserved'; feed shows reserved (Req 13.1, 13.5)
 |             |   notification row created server-side for seller (Req 15.1)
 |<------------| reserved                                               |

Release or expiry:
 |------------>| UPDATE reservation SET status='released' (buyer/seller)|
 |             |   listing → 'active', no active reservation (Req 13.7) |

Seller completes → Edge Fn: reserve-complete (service role)
 |------------>| invoke reserve-complete                                |
 |             |   verify actor = listing.seller else reject (Req 13.8) |
 |             |   listing → 'sold' | 'donated'; reservation 'completed'(Req 13.6)
 |             |   run gamification award + notification fan-out inline  |
 |             |   (Flow 7); notify buyer (Req 15.5)                     |
```

### Flow 7 — Sustainability Update + Gamification (Req 6, 14)

On completion, the `reserve-complete` server path updates carbon totals and awards points/badges — all with the service role, inline, no separate endpoint. Baseline comes from `carbon_category_map`, with optional Gemini refine via `ai-estimate-carbon`.

```
reserve-complete server path (service role)      Supabase (Postgres)
 | completion confirmed (sold/donated) (Req 14.2)                       |
 |----------------------------------------------->| profiles.cumulative_carbon_g +=
 |    carbon = carbon_category_map[category]       |   listing.carbon_savings_g (Req 6.4)
 |    (optional ai-estimate-carbon refine, Req 6.2)| recompute campus aggregate =
 |                                                 |   sum(carbon over completed, campus=X) (Req 6.5)
 |                                                 | values labeled "directional estimate" (Req 6.6)
 |    profiles.points += completion_reward (Req 14.2)                   |
 |    profiles.points += round(carbon_delta_kg * rate) (Req 14.3)       |
 |  badge evaluation (idempotent append, no duplicates, Req 14.4, 14.5):|
 |    first_donation: donations ≥ 1 → grant                             |
 |    carbon_kg: cumulative_carbon_kg ≥ threshold → grant               |
 |    completed_count: completed_txns ≥ threshold → grant               |
 |    on grant → notification row for student (Req 15.3)                |

Leaderboard (read-only PostgREST/RPC):
Student      RN App                 Supabase (PostgREST, RLS)
 |------------>| SELECT profiles WHERE campus_id = current_campus()     |
 |             |   order by points (or cumulative_carbon_g) DESC (Req 14.6, 14.7)
 |<------------| campus-scoped ranking                                  |
```

### Flow 8 — In-App Notifications (Req 15)

In-app only — no push transport (Req 15.10). Rows are **inserted server-side (service role)** during the message-send and reserve-complete server paths (Flows 3, 5, 6, 7); the client receives them over a **Supabase Realtime** channel and marks-read via PostgREST.

```
Server paths (service role)         Supabase (notifications table)
 | listing reserved (Flow 6) ----->| INSERT (recipient=seller, event=listing_reserved, target=listing) (Req 15.1)
 | new message (Flow 3) ---------->| INSERT (recipient=other participant, event=new_message, target=thread) (Req 15.2)
 | badge granted (Flow 7) -------->| INSERT (recipient=student, event=badge_earned, target=badge) (Req 15.3)
 | need it response (Flow 5) ----->| INSERT (recipient=requester, event=need_it_response, target=need_it_request) (Req 15.4)
 | listing completed (Flow 6) ---->| INSERT (recipient=buyer, event=listing_completed, target=listing) (Req 15.5)

Student      RN App                 Supabase (PostgREST + Realtime)
 | open notifications                                                   |
 |------------>| SELECT notifications — RLS: recipient_id = auth.uid()   |
 |             |   (recipient + campus isolation, Req 15.6)             |
 |             |   order by created_at DESC (most-recent-first, Req 15.7)|
 |  subscribe Realtime channel on own notifications (in-app only, Req 15.10)
 | mark read   | UPDATE notification SET read = true (own row, Req 15.8) |
 | tap notif   | deep-link by target_type/target_id                     |
 |             |   → listing | thread | need_it_request (Req 15.9)      |
```

## 1.7 Error Handling

The guiding principle is **graceful degradation**: a failure in one dependency (AI, Storage, Realtime) never blocks the core flow. TanStack Query drives optimistic UI with automatic rollback on mutation error, and RLS/constraint violations are surfaced as clear, actionable messages.

| Failure | Behavior | Requirement |
|---------|----------|-------------|
| Invalid / expired OTP | Show invalid-code message; offer **resend** (Supabase Auth re-issues a fresh OTP) | 1.5, 1.7, 10.1 |
| Unsupported email domain | Domain absent from `domain_campus_map` → "campus not supported"; no profile finalized | 1.2 |
| Resend / OTP email delivery failure | Surface delivery-failure message + allow resend (no silent retry) | 10.1 |
| Gemini timeout (>15s) or error | `ai-generate-listing` fails cleanly → **fall back to manual entry**; publishing continues | 3.7, 10.2 |
| Gemini no carbon estimate | `ai-estimate-carbon` returns nothing → use `carbon_category_map` baseline | 6.3 |
| Supabase Storage upload error | Retry the upload; allow manual retry / proceed without the failed image (≥1 image still required to publish) | 3.8, 10.2 |
| Realtime disconnect | Auto-resubscribe on reconnect and **fetch latest via PostgREST** to backfill missed rows (graceful degradation — messaging/notifications still work by refetch) | 5.5, 15.7 |
| Publish missing required field | Reject via client validation + NOT NULL/CHECK constraints; prompt for the missing field | 3.8, 3.9 |
| Publish with zero listing_images | Reject + prompt for at least one image (enforced server-side) | 3.8, 9.1 |
| Reserve a non-active listing | Reject — only `active` listings are reservable (RLS + status check) | 13.2 |
| Reserve a listing already reserved | **Partial unique index** violation surfaced to the user as "already reserved" | 13.3 |
| Complete a reservation as non-seller | `reserve-complete` Edge Function rejects any actor ≠ listing.seller | 13.6, 13.8 |
| Reservation expiry elapses | Auto-release: listing → `active`, no active reservation remains | 13.7 |
| Optimistic UI mutation failure | **TanStack Query rolls back** the optimistic update and shows the error | 10.3 |
| Duplicate in-flight submission | Disable submit while the mutation is pending (idempotent guard against double-submit) | 10.3 |
| Edit/delete a listing you do not own | Rejected by RLS (`seller_id = auth.uid()`) | 7.6 |
| Close a Need It request you do not own | Rejected by RLS (`requester_id = auth.uid()`) | 12.7 |
| Client attempts to write points/badges | Rejected — `points`/`badges` are service-role writes only | 14.1 |
| Client attempts to read another user's notifications | Rejected by RLS (`recipient_id = auth.uid()`) | 15.6 |

---

# Part 2 — Security & Compliance

Security is central to CampusSwap's trust proposition. The **deliberate decision to handle no payments** (Req 5.2) is itself the largest risk-reduction lever: it removes PCI-DSS scope, escrow/money-transmission licensing exposure, and chargeback/fraud liability from the MVP entirely. This is a conscious design choice, not an omission.

## 2.1 Authentication (Email OTP)

Authentication uses **Supabase Auth email OTP** end-to-end. **No custom OTP table is maintained** — there is no `otp_codes` collection, no hashed/consumed/attempts model, and no custom verification logic. Supabase Auth natively owns code generation, delivery, expiry, single-use, and rate limiting.

The flow is:

1. **Email entry.** The student submits their institutional email.
2. **Domain gating.** The email domain is checked against `domain_campus_map`; an unsupported domain returns a **campus-not-supported** outcome before any code is sent (Req 1.1, 1.2).
3. **OTP issue + delivery.** Supabase Auth (`signInWithOtp`) generates and emails the one-time code, and natively manages its **expiry, single-use consumption, and per-email rate limiting** (Req 1.6, 1.7).
4. **Verification → session.** On `verifyOtp`, Supabase validates the code and expiry and issues a **JWT session**; an invalid code is rejected and an expired code offers a resend (Req 1.4, 1.5, 1.7).
5. **Campus + profile finalization.** The email domain determines the campus; the `profiles` row is created/updated (via a Postgres trigger or a lightweight Edge Function on the signup event) with `campus_id` and `verified_student = true` (Req 1.8, 11.1).

**Resend** is used only if a custom OTP email template/delivery flow is required (the optional `send-otp-email` Edge Function); otherwise Supabase Auth's built-in email delivery is used directly. Either way, no OTP secrets are stored or verified by application code.

## 2.2 Campus Data Isolation / Multi-Tenancy

- Isolation relies **primarily on PostgreSQL Row Level Security (RLS)** plus `campus_id` filtering (§1.5), enforced by the database itself and never by the client. Every SELECT/INSERT/UPDATE/DELETE is constrained by the `current_campus()` and `is_verified()` SQL helpers that resolve the caller from `auth.uid()`.
- Feed, search, recommendation, messaging, and notification queries all inherit the same campus filter, guaranteeing no cross-campus content leaks (Req 2.2, 11.3).
- Messaging is restricted to thread participants sharing the thread's campus (Req 2.4).
- Notifications are recipient- and campus-scoped, so a student never receives or reads another student's or another campus's notifications (Req 15.6).
- Listing INSERT/UPDATE policies require `campus_id = current_campus()` (the seller's campus), enforcing `listing.campus == seller.campus` in the database as defense-in-depth (Req 9.3).

## 2.3 Gemini API Key Protection

- **The Gemini key is never shipped in the React Native client.** Mobile bundles are trivially extracted, so an embedded key would be immediately compromised and abused. The key is stored as an **Edge Function secret only**.
- All Gemini calls go **only through the `ai-generate-listing` and `ai-estimate-carbon` Supabase Edge Functions**; the client never calls Gemini directly.
- Each Edge Function requires an authenticated, verified caller and applies **per-user rate limiting** to cap cost and prevent abuse of the AI endpoint.
- The Edge Functions also centralize the **15-second timeout** and manual/baseline fallback logic (Req 3.7, 10.2).

## 2.4 PII Handling (Institutional Emails)

- The primary PII is the student's institutional email. It lives in **Supabase Auth (`auth.users`)** and the `profiles` extension row, transmitted over HTTPS/TLS in transit.
- Emails are used only for verification and identity; the UI displays `display_name`, not the raw email, to limit exposure between users.
- **RLS prevents email enumeration** — a caller can read only their own profile and same-campus profiles, and email is not exposed for cross-user browsing.

## 2.5 Email Security (Resend)

- When a custom OTP template is used, the **Resend API key is stored as an Edge Function secret only** and is never exposed to the client.
- **Domain gating** (Req 1.1) means emails are only sent to addresses on supported campus domains, preventing the service from being used as an open email relay.
- Delivery failures surface a **resend** option rather than silent retries that could amplify abuse (Req 10.1).
- **Supabase Auth handles OTP rate limiting** natively, bounding email volume without custom throttling code.

## 2.6 Storage Security

- Listing images are stored in **Supabase Storage** and referenced by `listing_images` rows so the relational model stays the source of truth.
- **Authenticated uploads only**, enforced by **Storage RLS policies**: the owning seller may write objects only under their own listing path.
- **Server-side validation** of MIME type (JPEG/PNG/WebP), file size limits, and maximum image count per listing is enforced before publish, so the client cannot bypass it.
- At least one `listing_image` is required to publish (Req 3.8, 9.1), validated server-side rather than only in the UI.

## 2.7 No-Payments Compliance Posture

- Because no funds are processed, held, or routed (Req 5.2), the MVP is **out of scope for PCI-DSS and money-transmitter regulation**. The app explicitly guides users to complete exchanges offline (Req 5.3).
- **Future note:** if payments, escrow, or monetization are added (see Roadmap Phase 3), the compliance surface expands materially — PCI-DSS scope via a payment processor, KYC/AML considerations for any fund holding, tax/invoicing for platform fees, and stronger data-retention/consent controls. These must be designed before any money movement is introduced and are intentionally deferred out of v1.

## 2.8 Gamification Integrity

- **Server-authoritative scoring.** `profiles.points` and `profiles.badges` are **not client-writable** — they are excluded from every client-updatable RLS policy and mutated only by **Edge Functions / SECURITY DEFINER functions using the service role** (§1.6 Flow 7). This prevents a decompiled client or crafted PostgREST request from inflating a score or self-granting a badge (Req 14.1, 14.4).
- **Deterministic, auditable awards.** Point and badge rules are pure functions of a student's completed transactions and cumulative carbon savings, so awards are reproducible and cannot be forged.
- **Idempotent badge grants.** Badge keys are appended only if absent, so re-running the award path cannot duplicate badges or double-count.
- **Leaderboard campus isolation.** The leaderboard is a **campus-filtered read** constrained by RLS / `current_campus()`, so no cross-campus ranking or foreign user stats are ever exposed — the same isolation guarantee as the feed (Req 14.7).

## 2.9 Reservation No-Funds Posture

- A reservation is a **pickup-intent signal only**. The `reservations` table has **no monetary column** — no price, deposit, or hold — and no reservation code path touches funds (Req 13.4). This keeps reservations fully inside the facilitate-only, no-payments posture (§2.7): reserving an item creates zero PCI-DSS or money-transmission exposure.
- The single-active-reservation invariant is enforced in the database by the **partial unique index** (`reservations(listing_id) WHERE status = 'active'`) plus RLS, so the "hold" is purely a status flag, not a financial commitment (Req 13.3).

## 2.10 Need It Request Campus Isolation

- Need It requests inherit the same **RLS**-enforced campus filter as listings: browse policies return only **same-campus, `open`** requests, and creation is pinned to the requester's campus (`requester_id = auth.uid() AND campus_id = current_campus()`) (Req 12.2, 12.3, 12.4). No cross-campus request is ever visible or answerable.
- Closing a request is **owner-only**, gated by RLS on `requester_id = auth.uid()`, preventing a student from closing another student's request (Req 12.7).

## 2.11 In-App Notification Isolation and Transport

- Notifications are **in-app only** — no push notification transport, token registration, or third-party push provider is integrated (Req 15.10). Push remains explicitly out of scope for v1.
- Delivery is recipient- and campus-scoped via **RLS** (`recipient_id = auth.uid()`, campus-scoped), so notifications never leak across users or campuses (Req 15.6).
- Notification rows are **created by the service role only** (Edge Functions during the message-send and reserve-complete server paths); clients may only list their own notifications and toggle the `read` flag (Req 15.8), preventing forged or cross-user notifications.

## 2.12 Realtime Security

- **Supabase Realtime subscriptions are RLS-aware.** A client receives change events only for rows its RLS policies already permit it to read, so realtime inherits the exact same trust boundary as PostgREST reads.
- In practice this means: message change events are delivered **only to thread participants**, notification change events **only to the recipient**, and every stream is **campus-scoped** throughout.
- No separate authorization layer is needed for realtime — enabling RLS on `messages` and `notifications` is sufficient to guarantee that a decompiled client cannot subscribe to another thread's messages or another user's/campus's notifications.

## 2.13 Server-Authoritative Actions

The following writes MUST **bypass all client-initiated writes** and run only via **Edge Functions / SECURITY DEFINER functions / the service role**:

- **Points updates** (`profiles.points`) — awarded on completion (Req 14.2, 14.3).
- **Badge grants** (`profiles.badges`) — deterministic, idempotent appends (Req 14.4, 14.5).
- **Notification fan-out** — creating `notifications` rows for key events (Req 15.1–15.5).
- **Reservation completion** — flipping a listing to `sold`/`donated` and the reservation to `completed` (Req 13.6).
- **Sustainability aggregation** — updating `profiles.cumulative_carbon_g` and campus carbon totals (Req 6.4, 6.5).

This is the **core server-authority boundary**: RLS denies these mutations to clients entirely, and only trusted server code (holding the service-role key, invisible to the mobile bundle) performs them. Because the trust boundary lives in the database and the Edge Functions rather than in the app, a compromised or crafted client can never inflate scores, self-grant badges, forge notifications, complete reservations it does not own, or falsify carbon totals.

---

# Part 3 — Roadmap

The roadmap ties phases to market sizing: the immediate **SOM** is the pilot campus (Pune); the **SAM** is Indian metro university campuses (Pune → Bangalore → Delhi); the **TAM** is the broader student second-hand + adjacent-services market that later monetization unlocks.

### Phase 0 — 48-Hour Hackathon MVP (ships now) — targets SOM (single pilot campus)
- Institutional-email OTP onboarding via Resend + domain→campus assignment (Req 1, 11).
- Campus-scoped feed with search, category filter, pagination, recency ordering (Req 2, 4, 8).
- Listing creation: sell + donate, Gemini-assisted title/description/condition/price with manual fallback (Req 3, 10.2).
- Buyer↔seller minimal realtime messaging (thread + plain text + realtime + timestamps), offline-only, no payments (Req 5).
- Carbon-savings baseline from Carbon_Category_Map, per-user + per-campus totals (Req 6).
- Profile + personal listings management, including points + badges display (Req 7, 14.8).
- **Need It requests**: campus-scoped want-ads with responses via messaging (Req 12) — *now in v1*.
- **No-payment reservation system**: single-active reservation per listing, seller-confirmed completion, release/expiry (Req 13) — *now in v1*.
- **Gamification**: server-side points + badges + campus leaderboard (Req 14) — *now in v1*; primary showcase for sustainability judges alongside the carbon dashboard.
- **In-app notifications**: per-user, campus-consistent in-app notifications for key events with mark-read + deep-linking (Req 15) — *now in v1*; push notifications remain out of scope.
- Server-enforced campus isolation, ownership rules, hashed/expiring OTPs, backend Gemini proxy, server-authoritative gamification (Part 2).

### Phase 1 — Post-Hackathon Hardening — deepens SOM trust
- Student-ID verification and admin allowlists (deferred from v1).
- AI-based recommendations replacing the rule-based engine.
- Realtime messaging polish (typing indicators, read receipts, push notifications).
- OTP/rate-limit tuning, monitoring, and abuse dashboards.
- AI-refined carbon estimates enabled by default with confidence labeling.
- Need It → listing keyword matching (Req 12.8), reservation auto-expiry background timer, and badge-earn animations (v1 ships the core of each; these are polish/stretch — see P2).

### Phase 2 — Multi-Campus Expansion — grows into SAM
- Onboard additional campuses purely via `domain_campus_map` entries (Pune → Bangalore → Delhi).
- Cross-campus operational tooling (per-campus admin views) while preserving strict data isolation.
- Localization and campus-specific category/carbon tuning.

### Phase 3 — Monetization + University Sustainability SaaS — captures TAM
- University sustainability SaaS dashboards (aggregate campus carbon impact reporting).
- Featured/promoted listings and sponsorships.
- Adjacent verticals: rentals, storage, and moving services.
- Introduce payments/monetization only after the expanded compliance work described in §2.7 (PCI-DSS, KYC/AML, tax/invoicing, data retention).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Domain-gated registration

*For any* email address and any Domain_Campus_Map, registration is accepted if and only if the email's domain exists in the map; absent domains are rejected with a campus-not-supported outcome.

**Validates: Requirements 1.1, 1.2**

### Property 2: OTP validity requires match, freshness, and single use

*For any* generated OTP, a verification attempt succeeds if and only if the submitted code matches the active code, the code has not expired (age < 10 minutes), and the code has not already been consumed; all other attempts are rejected.

**Validates: Requirements 1.4, 1.5, 1.6, 1.7**

### Property 3: Campus assignment derives solely from the domain map

*For any* verified student, the assigned Campus equals the Campus mapped to the student's email domain in the Domain_Campus_Map, and campus assignment originates from no other source.

**Validates: Requirements 1.8, 11.1**

### Property 4: Campus isolation invariant

*For any* verified student and any dataset spanning multiple campuses, every listing, search result, and recommendation returned to that student, and every messaging counterpart permitted, belongs to that student's assigned campus; no cross-campus content is ever returned or permitted.

**Validates: Requirements 2.2, 2.4, 4.6, 11.3**

### Property 5: Access restricted to verified students

*For any* user who is not a verified student, access to browsing, listing creation, and coordination features is denied.

**Validates: Requirements 2.1**

### Property 6: Listing–campus consistency (ownership integrity)

*For any* listing create or update operation, the operation is accepted only if the listing's campus equals its seller's assigned campus; any operation associating a listing with a different campus is rejected.

**Validates: Requirements 2.3, 9.1, 9.3**

### Property 7: Publish validation

*For any* listing publish attempt, the publish is accepted if and only if the listing has a title, a category, a condition, at least one related listing_image, and — when the listing type is `sell` — a price; otherwise the publish is rejected.

**Validates: Requirements 3.8, 3.9**

### Property 8: Donate listings omit price

*For any* listing whose type is `donate`, the persisted listing contains no price value.

**Validates: Requirements 3.5**

### Property 9: Editable AI values round-trip

*For any* AI-generated title, description, condition, or price that the seller edits before publishing, the published listing reflects the edited values rather than the original AI suggestions.

**Validates: Requirements 3.6**

### Property 10: Feed recency ordering

*For any* set of active campus listings, the feed returns them ordered so that publish timestamps are non-increasing (most recent first).

**Validates: Requirements 4.1**

### Property 11: Search and filter correctness

*For any* search query or category filter over a campus listing set, every returned listing matches the query in its title, description, or category (for search) or belongs to the selected category (for filter), and all returned listings have active status.

**Validates: Requirements 4.2, 4.3, 4.6**

### Property 12: Rule-based recommendation ordering

*For any* set of campus listings, the recommendation ranking is a deterministic function of the defined rule criteria (category affinity and recency).

**Validates: Requirements 4.4**

### Property 13: Sold/donated availability with thread preservation

*For any* listing marked sold or donated, the listing is excluded from active browsing results and reported as no longer available, while all pre-existing message threads referencing it are preserved.

**Validates: Requirements 4.6, 5.5, 7.4**

### Property 14: No-payment invariant

*For any* listing or coordination interaction, the system exposes no payment, escrow, or fund-holding capability in its API surface or data records.

**Validates: Requirements 5.2**

### Property 15: Carbon baseline and fallback

*For any* listing, its carbon-savings estimate equals the Carbon_Category_Map value for its category whenever the AI service does not return a refined estimate.

**Validates: Requirements 6.1, 6.3**

### Property 16: Carbon aggregation

*For any* verified student, the cumulative carbon savings equals the sum of carbon-savings estimates over that student's completed transactions; and *for any* campus, the aggregated campus total equals the sum of carbon-savings estimates over that campus's completed transactions only.

**Validates: Requirements 6.4, 6.5**

### Property 17: Profile lists exactly the user's own listings

*For any* verified student, the set of listings shown on their profile equals exactly the set of listings whose seller is that student.

**Validates: Requirements 7.2**

### Property 18: Edit persistence round-trip

*For any* edit a seller makes to one of their own listings, reading the listing back returns the edited values.

**Validates: Requirements 7.3**

### Property 19: Deleted listings disappear from the feed

*For any* listing deleted by its owner, the listing is absent from all subsequent feed and search results.

**Validates: Requirements 7.5**

### Property 20: Ownership-gated mutation

*For any* pair of actor and listing, an edit or delete operation is permitted if and only if the actor is the listing's seller.

**Validates: Requirements 7.6**

### Property 21: Verified users carry a campus reference

*For any* user marked as a verified student, the persisted user record has a non-null assigned-campus reference.

**Validates: Requirements 9.2**

### Property 22: Incremental (bounded) feed loading

*For any* campus listing set larger than the page size, a single feed request returns at most the page-size number of listings rather than the entire set.

**Validates: Requirements 8.2**

### Property 23: Duplicate-submission guard

*For any* request that is already in flight, a duplicate submission of the same request does not produce a second effective operation.

**Validates: Requirements 10.3**

### Property 24: Need It creation validity and campus/status defaults

*For any* Need It request submission, creation is accepted if and only if a title, a description, and a category are present (a maximum budget is optional); and every accepted request is persisted with its campus equal to the requester's campus and with status `open`.

**Validates: Requirements 12.1, 12.2**

### Property 25: Need It browse isolation (same-campus, open-only)

*For any* verified student and any dataset spanning multiple campuses and mixed request statuses, every Need It request returned in browsing belongs to that student's campus and has status `open`; no cross-campus or non-open request is returned.

**Validates: Requirements 12.3, 12.4**

### Property 26: Need It owner-only closure round-trip

*For any* actor and any Need It request, a close/fulfill operation succeeds if and only if the actor is the request's requester; on success the request status becomes `fulfilled` and the request is thereafter excluded from browsing results.

**Validates: Requirements 12.6, 12.7**

### Property 27: Need It keyword-match relevance (optional feature)

*For any* Need It request, when keyword matching is enabled, every surfaced Listing is active, belongs to the same campus, and matches the request keywords in its title, description, or category.

**Validates: Requirements 12.8**

### Property 28: Single active reservation per listing

*For any* listing and any sequence of reservation attempts, the number of reservations with status `active` referencing that listing never exceeds one.

**Validates: Requirements 13.3**

### Property 29: Reservation status lifecycle validity

*For any* listing, reserving an `active` listing creates an `active` reservation and sets the listing to `reserved`; attempting to reserve a listing whose status is not `active` is rejected; and seller completion of a reserved listing sets the listing to `sold` or `donated` and marks the reservation `completed`.

**Validates: Requirements 13.1, 13.2, 13.6**

### Property 30: Reservation release/expiry round-trip

*For any* reserved listing, releasing the reservation or reaching its expiry returns the listing to status `active` and leaves no `active` reservation referencing it.

**Validates: Requirements 13.7**

### Property 31: Reservation access control (same-campus, seller-only completion)

*For any* reservation action, the action is permitted only between verified students assigned to the listing's campus, and completion of a reservation is permitted only for the listing's seller; all other actors are rejected.

**Validates: Requirements 13.8**

### Property 32: Reservation no-funds invariant

*For any* reservation across its entire lifecycle (create, release, expire, complete), the system exposes and moves no monetary value — no reservation record or API operation processes, holds, or routes funds.

**Validates: Requirements 13.4**

### Property 33: Points monotonic non-decrease on completion

*For any* verified student, completing a sale or donation results in a Points score greater than or equal to the score before completion, and the increase is proportional (non-decreasing) in the associated carbon-savings increase.

**Validates: Requirements 14.2, 14.3**

### Property 34: Badge threshold monotonicity

*For any* verified student and any badge, once the student's relevant statistic (first donation, cumulative carbon in kg CO2e, or completed-transaction count) reaches the badge's threshold, the badge is granted and remains granted, and repeated evaluation does not duplicate the badge.

**Validates: Requirements 14.4, 14.5**

### Property 35: Leaderboard ordering and campus isolation

*For any* verified student and any dataset spanning multiple campuses, the Leaderboard returns only students from the requesting student's campus, ordered non-increasingly by the chosen metric (Points or carbon savings); no cross-campus entry is returned.

**Validates: Requirements 14.6, 14.7**

### Property 36: Notification event coverage

*For any* qualifying key event (a listing reserved, a message delivered to a thread, a badge granted, a Need It response, or a reserved listing marked sold/donated), an in-app Notification is created for the correct recipient referencing the correct related item.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**

### Property 37: Notification recipient and campus isolation

*For any* verified student and any dataset spanning multiple recipients and campuses, the notifications returned to that student are exactly those addressed to that student within their assigned campus; no other student's or campus's notifications are returned.

**Validates: Requirements 15.6**

### Property 38: Notification recency ordering

*For any* set of a student's notifications, the notifications are returned ordered so that creation timestamps are non-increasing (most recent first).

**Validates: Requirements 15.7**

### Property 39: Notification mark-read round-trip

*For any* notification a recipient marks as read, reading the notification back returns a read state of read.

**Validates: Requirements 15.8**

### Property 40: Notification deep-link target integrity

*For any* notification, selecting it resolves to the related item it references, whose type is one of listing, thread, or need_it_request.

**Validates: Requirements 15.9**

### Property 41: Notifications are in-app only

*For any* notification produced by the system, delivery occurs only within the CampusSwap application and no push-notification transport is invoked.

**Validates: Requirements 15.10**

### Property 42: Index-backed, cursor-based pagination

*For any* feed, message-thread, notification, or leaderboard query, results are served by an index-backed, cursor/keyset-based paginated query (bounded page size, no full-table scan), so performance holds as campuses and rows scale. Enforcement rests on the campus-scoped composite indexes and keyset ordering defined in §1.3.

**Validates: Requirements 16.2, 16.5** (also supports 8.2)

## Testing Strategy

**Dual approach:**
- **Property-based tests** (min. 100 iterations each) validate the universal properties above — especially the campus-isolation invariant (Property 4), ownership integrity (Properties 6, 20), OTP validity (Property 2), publish validation (Property 7), carbon aggregation (Property 16), the single-active-reservation invariant (Property 28), reservation lifecycle and no-funds invariants (Properties 29, 30, 32), Need It browse isolation (Property 25), points monotonicity (Property 33), badge-threshold monotonicity (Property 34), leaderboard ordering + isolation (Property 35), and notification recipient/campus isolation + recency ordering (Properties 37, 38). Each test is tagged **Feature: campuswap-ai, Property {number}: {property_text}**.
- **Example/edge tests** cover: OTP request sends email (mocked Resend), expired-OTP resend offer, empty-state messaging, offline-guidance display, directional-estimate labeling, duplicate-submission UI guard, Need It respond creates a thread (12.5), reserved-state feed indicator (13.5), gamification badge-type coverage (14.5), profile points/badges display (14.8), notification event coverage per event type (Property 36), notification mark-read (Property 39), and notification deep-link resolution (Property 40).
- **Integration tests (1–3 examples, mocked externally):** Gemini listing generation and carbon refinement (mock Gemini responses), Resend delivery path, and feed render performance on the pilot dataset.

External services (Gemini, Resend) are mocked in property tests to keep iterations fast and cost-free; a small number of real integration checks validate wiring for the demo.


---

# Part 4 — MVP Scope, Screens, Demo, and Structure

These four sections are the final-review deliverables. They translate the architecture above into a concrete, demo-oriented build plan for a 48-hour hackathon with a small team, explicitly optimized to **impress sustainability judges**.

## 4.1 MVP Scope — P0 / P1 / P2

Priorities are demo-driven. **P0** is the minimum for a working, credible end-to-end demo. **P1** are the strong differentiators to land if time allows. **P2** are nice-to-have stretch polish. The **gamification** features (P1) and the **sustainability dashboard** (P0) together form the *"win the sustainability judges"* showcase — carbon impact made visible, then rewarded.

### P0 — Must-have for a working demo
| Capability | Requirements | Why P0 |
|-----------|--------------|--------|
| Onboarding + campus isolation | Req 1, 2, 9, 11 | Nothing works without a verified, campus-scoped identity; Supabase Auth email OTP + RLS enforce campus scoping — also the trust story. |
| AI listing creation (sell/donate) | Req 3, 10.2 | The core "wow" of AI automation via the `ai-generate-listing` Edge Function; must have a manual fallback so the demo never stalls. |
| Campus feed + rule-based recommendations | Req 4, 8 | The primary browsing surface judges will see first, served over PostgREST under RLS. |
| Minimal realtime messaging | Req 5 | Proves buyer↔seller coordination without payments; Supabase Realtime feels live on stage. |
| Reservation system (no payment) | Req 13 | Shows intent-to-pickup and the facilitate-only model concretely (single-active partial unique index). |
| Sustainability dashboard (carbon) | Req 6 | The heart of the sustainability pitch — per-user + per-campus carbon savings. |

### P1 — Strong differentiators (land if time allows)
| Capability | Requirements | Why P1 |
|-----------|--------------|--------|
| Need It requests | Req 12 | Two-sided marketplace demand signal; great narrative but not required for a linear demo. |
| Gamification: points + badges + leaderboard | Req 14 | **Sustainability-judge showcase** — turns carbon savings into visible rewards + campus competition. |
| In-app notifications | Req 15 | Drives re-engagement for reservations, messages, badges, and Need It responses; created via service-role insert + delivered over Supabase Realtime; in-app only (no push). |
| Carbon AI refinement | Req 6.2 | Sharper carbon numbers via the `ai-estimate-carbon` Edge Function (Gemini 2.5 Flash); falls back cleanly to the category map (P0). |

### P2 — Nice-to-have / stretch
| Capability | Requirements | Why P2 |
|-----------|--------------|--------|
| Need It → listing keyword matching | Req 12.8 | Optional (`MAY`); adds delight but not core. |
| Reservation auto-expiry timer | Req 13.7 (background) | Manual release covers the demo; automated expiry is polish. |
| Badge-earn animations | Req 14.4 (UX) | Visual celebration; static badges suffice for the demo. |

> Build order guidance: complete all P0 first (linear demo path), then layer gamification (P1) because it is the highest-impact differentiator for the target judges, then Need It, then in-app notifications, then any P2 polish.

## 4.2 Screens — Expo Router Routes

Screens are file-based routes under `app/`, organized with route groups. Each route maps to the requirements it satisfies.

| Route | Screen / Purpose | Requirements |
|-------|------------------|--------------|
| `(auth)/email.tsx` | Email Entry — enter institutional email, request OTP | 1.1–1.3, 10.1 |
| `(auth)/otp.tsx` | OTP Entry — enter code, verify, assign campus by domain | 1.4–1.8 |
| `(tabs)/index.tsx` | Feed / Home — campus-scoped active listings, recency order, recommendations | 2.2, 4.1, 4.4, 8.1, 8.2 |
| `(tabs)/search.tsx` | Search / Filter — keyword search + category filter, empty state | 4.2, 4.3, 4.5 |
| `(tabs)/needit.tsx` | Need It List — browse campus `open` requests | 12.3, 12.4 |
| `(tabs)/profile.tsx` | Profile — campus, cumulative carbon, own listings, **points + badges** | 7.1, 7.2, 6.4, 14.8 |
| `listing/[id].tsx` | Listing Detail — photos, details, contact action, **reservation state + actions** | 4.6, 5.1, 13.1–13.8 |
| `listing/create.tsx` | Create Listing (AI) — type select, image upload (Supabase Storage → `listing_images`), AI generate + editable fields, publish validation | 3.1–3.9, 8.3, 10.2 |
| `needit/create.tsx` | Create Need It — title/description/category + optional budget | 12.1, 12.2 |
| `chat/index.tsx` | Thread List — list of the user's threads | 5.1, 2.4 |
| `chat/[threadId].tsx` | Message Thread — plain-text realtime messages, timestamps, offline guidance | 5.3–5.9 |
| `dashboard/index.tsx` | Sustainability Dashboard — per-user + per-campus carbon totals, directional labeling | 6.4, 6.5, 6.6 |
| `dashboard/leaderboard.tsx` | Leaderboard — campus-scoped ranking by points/carbon | 14.6, 14.7 |
| `profile/index.tsx` | Profile detail (if surfaced separately from the tab) | 7.1, 7.2, 6.4, 14.8 |
| `notifications/index.tsx` | Notifications — recipient-scoped, most-recent-first list; mark-read; deep-link to target | 15.6–15.9 |

> Reservation UI lives *within* `listing/[id].tsx` (Reserve / Reserved indicator / Release / Seller-complete) rather than as a standalone route, keeping navigation lean for a small team. A notification badge/entry point lives in the app header (root layout) linking to `notifications/index.tsx`.

## 4.3 Demo Flow (scripted, judge-facing)

A single ~4-minute narrative that lands the sustainability story around one item — a **bicycle** — run on seeded data so every screen looks populated. The payoff is the **hero number: "kg CO₂e saved."**

1. **Login with college email.** Enter a college email → Supabase Auth sends an email OTP → verify → campus is assigned automatically by email domain. *Say: "Only verified students in this campus can see or transact — trust by design."*
2. **Upload bicycle image.** Tap Create → choose **Sell/Donate** → snap/upload a photo of a bicycle → the image lands in Supabase Storage. *Say: "One photo is all it takes to start."*
3. **Gemini generates the listing.** The `ai-generate-listing` Edge Function calls Gemini 2.5 Flash to fill title, description, and condition; if AI is unavailable, a manual fallback keeps the flow moving. *Say: "AI turns a photo into a quality listing in seconds — with a manual fallback so the demo never stalls."*
4. **Publish listing.** Publish inserts the listing over PostgREST under RLS, with at least one `listing_images` record. *Say: "Published straight into the campus feed."*
5. **Matching student is notified.** A matching student receives an **in-app notification** (service-role insert + Supabase Realtime delivery). *Say: "The right student hears about it instantly."*
6. **Student reserves the item.** The second student **reserves** the bicycle; a single-active partial unique index guarantees one active reservation, and the listing flips to *reserved*. *Say: "No money touches the app — reserving just signals pickup intent."*
7. **Realtime chat to coordinate.** The two students exchange plain-text messages over Supabase Realtime to arrange the handoff. *Say: "Coordination is in-app; the exchange happens offline."*
8. **Complete the exchange.** The `reserve-complete` Edge Function transitions the listing to *sold* or *donated*, preserving the thread. *Say: "One tap closes the loop."*
9. **Sustainability dashboard updates.** Carbon aggregation runs and the **Sustainability Dashboard** hero number — **"kg CO₂e saved"** — ticks up for the student and the campus. *Say: "Every reuse is measured in CO₂e — impact you can see."*
10. **Leaderboard updates.** The campus-scoped **Leaderboard** re-ranks by points/carbon and the student climbs. *Say: "Sustainability becomes a game students want to win."*

**Suggested seed data** (so the demo looks alive):
- 1 active `campus` (e.g., Pune) + a `domain_campus_map` entry mapping the email domain to that campus.
- 2–3 verified demo `profiles` with varied `points`, `cumulative_carbon_g`, and a couple of pre-earned badges.
- 8–12 `listings` across categories (books, electronics, furniture, cycles) with a mix of `active`/`reserved`/`sold`/`donated`, each with ≥1 seeded `listing_images` record.
- 2–3 `open` `need_it_requests`.
- A pre-seeded message thread with a few `messages`.
- A few seeded `notifications` for a demo student (a reservation, a message, a badge).
- Seeded `carbon_category_map` and `badges` config (e.g., first_donation, carbon_kg milestone, completed_count).

## 4.4 Recommended File / Folder Structure

Production-ready React Native + Expo Router client with a Supabase backend (migrations, Edge Functions, and seed) living in the same repo.

```
CampusSwap-AI/
├── app/                        # Expo Router (file-based routes)
│   ├── (auth)/                 # email.tsx, otp.tsx
│   ├── (tabs)/                 # index (feed), search, needit, profile
│   ├── listing/                # [id].tsx (detail+reservation), create.tsx
│   ├── chat/                   # index.tsx (threads), [threadId].tsx
│   ├── dashboard/              # index.tsx (sustainability), leaderboard.tsx
│   ├── profile/                # profile detail (if separate from tabs)
│   ├── notifications/          # index.tsx
│   └── _layout.tsx             # root layout / providers (QueryClient, auth gate)
├── components/                 # reusable UI (ListingCard, BadgeChip, CarbonStat, NotificationItem…)
├── features/                   # feature modules (listings, needit, reservations, chat, gamification…)
├── services/                   # typed wrappers over supabase-js (authService, listingService, …)
├── stores/                     # Zustand stores (auth, filters, draft)
├── hooks/                      # TanStack Query hooks (useFeed, useThread, useReservation, useNotifications…)
├── lib/                        # supabase client init, query client, env, theme (NativeWind)
├── utils/                      # formatters, carbon helpers, validators
├── types/                      # shared TS types + Zod schemas + generated DB types
├── supabase/
│   ├── migrations/             # SQL: tables, enums, indexes, RLS policies
│   ├── functions/              # Edge Functions: ai-generate-listing, ai-estimate-carbon, reserve-complete, (send-otp-email)
│   └── seed/                   # seed data (campus, domain map, carbon map, badges, demo data)
├── .env.example
├── app.json / eas.json
└── README.md
```

> `app/` uses Expo Router file-based routing (route groups keep auth and tabs isolated); `services/` and `hooks/` separate typed supabase-js access from TanStack Query data-fetching; `supabase/migrations` capture schema + RLS so the whole team runs an identical backend, and `supabase/seed` guarantees the demo always looks populated.

## 4.5 Environment Variables

CampusSwap-AI splits configuration into **client-safe** values (bundled into the app) and **server-only secrets** (available only inside Edge Functions).

**Client (safe to ship in the app bundle)** — must be prefixed `EXPO_PUBLIC_`:
- `EXPO_PUBLIC_SUPABASE_URL` — the project's Supabase URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the anon key (RLS enforces all access).
- `EXPO_PUBLIC_APP_ENV` — environment label (e.g., `development` / `production`).

**Server / Edge Function secrets (NEVER public, NEVER `EXPO_PUBLIC_`):**
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key for privileged inserts (e.g., notifications).
- `GEMINI_API_KEY` — Gemini 2.5 Flash key for AI listing generation and carbon estimation.
- `RESEND_API_KEY` — Resend API key for transactional email.
- `RESEND_FROM_EMAIL` — verified sender address for Resend.
- `POSTHOG_KEY` — optional/future analytics.

> The service-role key, Gemini key, and Resend keys are **Edge-Function-only**. They must never appear in the client bundle and must never be exposed through any `EXPO_PUBLIC_` variable.

## 4.6 Dependencies

**Frontend (npm):**
- `expo`, `expo-router` — app runtime + file-based routing.
- `nativewind` + `tailwindcss` — styling (NativeWind v5).
- `zustand` — local/client state.
- `@tanstack/react-query` — server state / data fetching.
- `react-hook-form` + `zod` — forms and validation schemas.
- `@supabase/supabase-js` — Supabase client (auth, data, storage, realtime).
- `expo-image-picker` — capture/select listing images.
- `expo-secure-store` — secure session/token storage.
- `react-native-reanimated` + `moti` — animations.
- `lucide-react-native` — icons.
- `react-native-url-polyfill` — URL polyfill required by supabase-js on React Native.

**Backend / Edge Functions (Deno / CLI):**
- `supabase` CLI — migrations, functions, and local dev.
- Within functions: `@supabase/supabase-js` (service role), `@google/generative-ai` (Gemini 2.5 Flash), `resend`.

**Optional:**
- `posthog-react-native` — future analytics.
