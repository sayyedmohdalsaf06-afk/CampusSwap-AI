# Implementation Plan: CampusSwap AI

## Overview

This plan delivers the CampusSwap AI v1 MVP on the finalized **Supabase** architecture (PostgreSQL + RLS + indexes, Supabase Auth email OTP, Supabase Storage, Supabase Realtime, and Edge Functions) with a React Native + Expo (Expo Router) client. It is sequenced for a **48-hour hackathon**: work is organized into **five phases, each independently demoable, each ending in a working checkpoint**, and each ordered **backend-first** (SQL migrations / RLS / Edge Functions) **then screens** to minimize integration risk.

> **P0 linear demo path (Phases 1–3):** login with institutional email (campus isolation via RLS) → create an AI-generated listing (sell/donate) → browse/search the campus feed → reserve (no payment) → coordinate via minimal realtime messaging → seller completes (sold/donated). Only after this P0 path is green do we layer the **differentiators** — sustainability + gamification (Phase 4) and Need It + notifications + polish (Phase 5).

### Architecture guardrails (from design)
- **Prefer PostgREST + RLS** for all routine CRUD (`@supabase/supabase-js`); every read/write is filtered by the `current_campus()` / `is_verified()` SQL helpers.
- **Edge Functions only where a secret or server authority is required:** `ai-generate-listing` and `ai-estimate-carbon` (Gemini 2.5 Flash key stays server-side), optional `send-otp-email` (Resend), and `reserve-complete` (service-role: status flip + carbon aggregation + gamification + completion notifications, all inline — no event bus, no queue, no CQRS).
- **Server-authoritative writes** (`profiles.points`, `profiles.badges`, `notifications` inserts, reservation completion, carbon totals) are performed by the service role / SECURITY DEFINER functions and are never client-writable.
- **Notification fan-out** for events created directly via PostgREST (reservation insert → `listing_reserved`, message insert → `new_message`, Need It response thread → `need_it_response`) runs via SECURITY DEFINER Postgres triggers; completion-path events (`listing_completed`, `badge_earned`) run inline in `reserve-complete`.
- Every multi-tenant table carries `campus_id`; campus-scoped composite indexes back every hot query (feed, threads, notifications, leaderboard) for index-backed, keyset pagination.

### Stack
React Native + Expo + Expo Router + NativeWind + Zustand + TanStack Query + React Hook Form + Zod + Reanimated + Moti + Lucide; Supabase (PostgreSQL, Auth, Storage, Realtime, RLS, Edge Functions); Gemini 2.5 Flash; Resend.

## Tasks

### Phase 1 — Trust Foundation  _(Checkpoint: login with institutional email)_

- [ ] 1. [Phase 1] Supabase project + database schema, indexes, RLS, and seed
  - [ ] 1.1 Initialize the Supabase project and repo backend layout
    - Init the Supabase CLI project (`supabase/config.toml`), create the `supabase/migrations/`, `supabase/functions/`, and `supabase/seed/` folders per design §4.4; configure local dev + linked project settings
    - _Requirements: 11.1, 16.4_
  - [ ] 1.2 Create enums and core tables migration
    - SQL migration defining Postgres enum types (`listing_type`, `listing_status`, `need_it_status`, `reservation_status`, `notification_event`, `notification_target`, `badge_threshold_type`) and all tables: `campuses`, `domain_campus_map` (citext unique `domain`), `profiles` (1:1 FK → `auth.users`, `verified_student`, `campus_id`, `display_name`, `cumulative_carbon_g`, `points`, `badges`), `carbon_category_map`, `listings` (status default `active`, nullable `price`, `carbon_savings_g`, `published_at`), `listing_images` (FK → listings ON DELETE CASCADE, `storage_path`, `display_order`), `threads` (CHECK exactly one of `listing_id`/`need_it_request_id`), `messages`, `need_it_requests`, `reservations` (**no monetary column**, `expires_at`), `badges` config, `notifications`
    - _Requirements: 9.1, 9.2, 13.4_
  - [ ] 1.3 Create indexes migration (incl. single-active-reservation invariant)
    - Add indexes: `domain_campus_map(domain)` unique; `listings(campus_id, status, published_at DESC)`; `listings(campus_id, category)`; `listing_images(listing_id)`; `messages(thread_id, created_at)`; `threads(campus_id)`, `threads(buyer_id)`, `threads(seller_id)`; `need_it_requests(campus_id, status)`; `reservations(listing_id)`; **partial unique index `reservations(listing_id) WHERE status = 'active'`**; `notifications(recipient_id, created_at DESC)`; `profiles(campus_id)`
    - _Requirements: 13.3, 16.2, 16.5, 8.2_
  - [ ] 1.4 Create RLS helpers and policies migration
    - Define SQL helpers `current_campus()` and `is_verified()` (resolve caller via `auth.uid()`); enable RLS on every app table and add policies per design §1.5: `profiles` (own + same-campus SELECT; UPDATE own non-privileged cols only; `points`/`badges` not client-writable), `listings` (SELECT campus + active-or-own; INSERT verified/self/campus; UPDATE/DELETE owner), `listing_images` (owner-managed, visible-with-parent), `threads`/`messages` (participants + same campus), `need_it_requests` (open-or-own SELECT; owner close), `reservations` (same-campus participants; INSERT buyer/self/active-listing; completion via service role), `notifications` (recipient SELECT, own `read` toggle, INSERT service-role only), and read-only `badges`/`carbon_category_map`/`campuses`/`domain_campus_map`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.6, 7.6, 9.3, 11.3, 12.7, 13.8, 14.1, 14.7, 15.6, 16.1_
  - [ ] 1.5 Seed campus + reference + badge config
    - Seed migration/data: the Pune pilot `campuses` row (`active = true`), a `domain_campus_map` row mapping the pilot institutional domain → campus, `carbon_category_map` rows for each supported category (books, electronics, furniture, hostel essentials, cycles), and `badges` config rows (`first_donation`, `carbon_kg` milestone, `completed_count`)
    - _Requirements: 6.1, 11.1, 11.2, 14.5_
  - [ ]* 1.6 Write property tests for isolation and access control
    - **Property 4: Campus isolation invariant** — **Validates: Requirements 2.2, 2.4, 4.6, 11.3**
    - **Property 5: Access restricted to verified students** — **Validates: Requirements 2.1**
    - **Property 21: Verified users carry a campus reference** — **Validates: Requirements 9.2**
    - **Property 42: Index-backed, cursor-based pagination** — **Validates: Requirements 16.2, 16.5**

- [ ] 2. [Phase 1] Auth: email OTP onboarding + domain→campus assignment
  - [ ] 2.1 Implement domain→campus profile creation on verification
    - Add a SECURITY DEFINER Postgres trigger on the Supabase Auth signup/verify event that lowercases the email domain, looks it up in `domain_campus_map`, and — when present — creates/updates the `profiles` row with `campus_id = map[domain]` and `verified_student = true`; when the domain is absent, leave the profile unverified so the client surfaces "campus not supported"
    - _Requirements: 1.1, 1.2, 1.8, 9.2, 11.1_
  - [ ] 2.2 Add optional `send-otp-email` Edge Function (Resend)
    - Optional Edge Function that delivers the OTP email via Resend using a custom template when built-in Supabase Auth delivery is not sufficient; hold `RESEND_API_KEY`/`RESEND_FROM_EMAIL` as function secrets only; surface delivery-failure so the client can offer a resend (Supabase Auth still owns generation, expiry, single-use, and rate limiting)
    - _Requirements: 1.3, 1.6, 10.1_
  - [ ]* 2.3 Write property tests for onboarding
    - **Property 1: Domain-gated registration** — **Validates: Requirements 1.1, 1.2**
    - **Property 2: OTP validity requires match, freshness, and single use** — **Validates: Requirements 1.4, 1.5, 1.6, 1.7**
    - **Property 3: Campus assignment derives solely from the domain map** — **Validates: Requirements 1.8, 11.1**

- [ ] 3. [Phase 1] Expo app scaffold, Supabase client, and auth screens
  - [ ] 3.1 Scaffold the Expo Router app shell
    - Create the Expo app per design §4.4 (`app/`, `components/`, `features/`, `services/`, `stores/`, `hooks/`, `lib/`, `utils/`, `types/`); configure NativeWind, Reanimated, Moti, Lucide; set up Expo Router route groups `(auth)` and `(tabs)` and the root `app/_layout.tsx` with the TanStack Query `QueryClient` provider, Zustand session store, and an **auth gate** that routes unverified users to `(auth)` and verified users to `(tabs)`
    - _Requirements: 2.1_
  - [ ] 3.2 Wire the Supabase client and session handling
    - Add `lib/supabase.ts` (`@supabase/supabase-js` + `react-native-url-polyfill`), configure `expo-secure-store` for JWT session persistence, read `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, and add a typed `services/authService.ts` wrapping `signInWithOtp` / `verifyOtp` and session hydration
    - _Requirements: 1.3, 1.4_
  - [ ] 3.3 Build the auth screens
    - `(auth)/email.tsx` (RHF + Zod institutional-email entry → request OTP) and `(auth)/otp.tsx` (code entry → verify → campus assigned by domain), with resend action and error states for unsupported campus, invalid code, expired code, and delivery failure
    - _Requirements: 1.2, 1.4, 1.5, 1.7, 10.1_

- [ ] 4. [Phase 1] Checkpoint — login with institutional email
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a student enters a supported institutional email, receives and verifies an OTP, is auto-assigned to their campus, and lands in the authenticated app; unsupported domains are rejected.

### Phase 2 — Core Marketplace Loop  _(Checkpoint: AI-generated listing appears in feed)_

- [ ] 5. [Phase 2] Storage bucket, storage RLS, and server-side image validation
  - [ ] 5.1 Create the listing-images Storage bucket and RLS policies
    - Create the Supabase Storage bucket for listing images and add Storage RLS policies so only the owning seller may write objects under their own listing path; authenticated read for same-campus-visible listings
    - _Requirements: 3.8, 9.1_
  - [ ] 5.2 Enforce server-side image validation and publish guard
    - Add a SECURITY DEFINER trigger/function that validates each `listing_images` row server-side (MIME type JPEG/PNG/WebP, size limit, max count per listing) and blocks publishing a listing with zero related `listing_images`, so validation cannot be bypassed by the client
    - _Requirements: 3.8, 9.1_

- [ ] 6. [Phase 2] `ai-generate-listing` Edge Function (Gemini proxy)
  - [ ] 6.1 Implement the `ai-generate-listing` Edge Function
    - Deno/TS Edge Function that requires an authenticated, verified caller and proxies image refs + optional text to **Gemini 2.5 Flash**, returning suggested title/description/condition and — when `listing_type = sell` — a suggested price; enforce a **15-second timeout**, per-user rate limiting, and clean error return for manual fallback; hold `GEMINI_API_KEY` as a function secret only
    - _Requirements: 3.2, 3.3, 3.4, 8.3, 10.2, 16.4_
  - [ ]* 6.2 Write integration test for AI generation (mock Gemini)
    - Verify the function returns editable fields on success and that timeout/error degrades cleanly to a manual-entry signal (mock Gemini responses)
    - _Requirements: 3.2, 3.7, 10.2_

- [ ] 7. [Phase 2] Create Listing (image upload + AI + publish validation)
  - [ ] 7.1 Implement the image upload service
    - `services/imageService.ts`: pick images with `expo-image-picker`, upload to Supabase Storage under the seller's listing path, and insert corresponding `listing_images` rows (with `display_order`) via PostgREST under RLS; support retry and proceed-without-failed-image (≥1 image still required)
    - _Requirements: 3.8, 9.1, 10.2_
  - [ ] 7.2 Build the Create Listing screen
    - `listing/create.tsx`: Listing_Type select (sell/donate), image picker wired to 7.1, AI-populated **editable** fields via `ai-generate-listing` with a progress indicator and manual-entry fallback on timeout/error; RHF + Zod publish validation requiring title/category/condition/**≥1 image**, price required for `sell` and omitted for `donate`; insert `listings` via PostgREST under RLS (seller/self/campus); duplicate-submission guard while publish is in flight
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 3.9, 8.3, 9.1, 9.3, 10.2, 10.3_
  - [ ]* 7.3 Write property tests for listing publish and ownership
    - **Property 6: Listing–campus consistency (ownership integrity)** — **Validates: Requirements 2.3, 9.1, 9.3**
    - **Property 7: Publish validation** — **Validates: Requirements 3.8, 3.9**
    - **Property 8: Donate listings omit price** — **Validates: Requirements 3.5**
    - **Property 9: Editable AI values round-trip** — **Validates: Requirements 3.6**
    - **Property 20: Ownership-gated mutation** — **Validates: Requirements 7.6**
    - **Property 23: Duplicate-submission guard** — **Validates: Requirements 10.3**

- [ ] 8. [Phase 2] Campus feed, search, filters, and recommendations
  - [ ] 8.1 Implement the campus feed
    - `(tabs)/index.tsx` + `hooks/useFeed.ts`: PostgREST SELECT under RLS (campus + active-only), ordered `published_at DESC`, index-backed keyset/range pagination for incremental scroll; render each listing's primary `listing_image` and a **reserved-state indicator**; empty-state message
    - _Requirements: 4.1, 4.6, 8.1, 8.2, 13.5, 16.5_
  - [ ] 8.2 Implement search and category filter
    - `(tabs)/search.tsx`: keyword search matching title/description/category and a category filter, both inheriting the campus + active-only RLS scope; empty-state on no matches
    - _Requirements: 4.2, 4.3, 4.5, 4.6_
  - [ ] 8.3 Implement client-side rule-based recommendations
    - `features/recommendations/`: deterministic ranking over the campus feed using category affinity and recency
    - _Requirements: 4.4_
  - [ ]* 8.4 Write property tests for feed, search, and pagination
    - **Property 10: Feed recency ordering** — **Validates: Requirements 4.1**
    - **Property 11: Search and filter correctness** — **Validates: Requirements 4.2, 4.3, 4.6**
    - **Property 12: Rule-based recommendation ordering** — **Validates: Requirements 4.4**
    - **Property 22: Incremental (bounded) feed loading** — **Validates: Requirements 8.2**

- [ ] 9. [Phase 2] Checkpoint — AI-generated listing appears in feed
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a verified student uploads a photo, Gemini generates an editable listing (with manual fallback), publishes it, and the listing appears in the campus-scoped feed with working search and category filters.

### Phase 3 — Messaging & Reservation  _(Checkpoint: reserve → chat → complete)_

- [ ] 10. [Phase 3] Minimal realtime messaging (no payments)
  - [ ] 10.1 Implement the messaging service + Realtime subscription
    - `services/messageService.ts` + `hooks/useThread.ts`: find/create a same-campus `thread` (buyer, seller, listing/need-it, campus) via PostgREST under RLS; send plain-text `messages`; subscribe to a **per-thread Supabase Realtime channel** for live delivery; use `created_at` for ordering. Scope is intentionally minimal — **no** push, read receipts, typing indicators, voice notes, image sharing, or presence
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7, 5.8, 2.4_
  - [ ] 10.2 Build the thread list and message thread screens
    - `chat/index.tsx` (the user's threads) and `chat/[threadId].tsx` (plain-text realtime messages with timestamps); display explicit no-payment UI + offline-transaction guidance; when a listing is sold/donated, show "no longer available" while preserving existing threads
    - _Requirements: 5.2, 5.3, 5.9_
  - [ ]* 10.3 Write property tests for coordination
    - **Property 13: Sold/donated availability with thread preservation** — **Validates: Requirements 4.6, 5.5, 7.4**
    - **Property 14: No-payment invariant** — **Validates: Requirements 5.2**

- [ ] 11. [Phase 3] No-payment reservation system
  - [ ] 11.1 Implement reservation create/release via PostgREST
    - `services/reservationService.ts` + `hooks/useReservation.ts`: INSERT a `reservation` (buyer/self/campus, target listing `active`) under RLS — the **partial unique index** + status check enforce single-active-per-listing; on success flip the listing to `reserved`; UPDATE `status = 'released'` (buyer or seller) returns the listing to `active` and clears the active reservation; **no monetary field is ever touched**
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.7, 13.8_
  - [ ] 11.2 Implement the `reserve-complete` Edge Function (seller-only)
    - Deno/TS Edge Function (service role) that verifies the caller is the listing's `seller` (else reject), sets the listing to `sold`/`donated`, and marks the reservation `completed`; this is the completion server path that Phase 4 extends with carbon aggregation, gamification, and completion notifications
    - _Requirements: 13.6, 13.8_
  - [ ] 11.3 Build reservation UI within Listing Detail
    - `listing/[id].tsx`: photos + details + contact action; reservation controls — **Reserve** (buyer), **Reserved** indicator, **Release** (buyer/seller), and **seller-complete** (mark sold/donated) — reflecting status transitions live
    - _Requirements: 4.6, 5.1, 13.1, 13.5, 13.6, 13.7_
  - [ ]* 11.4 Write property tests for reservations
    - **Property 28: Single active reservation per listing** — **Validates: Requirements 13.3**
    - **Property 29: Reservation status lifecycle validity** — **Validates: Requirements 13.1, 13.2, 13.6**
    - **Property 30: Reservation release/expiry round-trip** — **Validates: Requirements 13.7**
    - **Property 31: Reservation access control (same-campus, seller-only completion)** — **Validates: Requirements 13.8**
    - **Property 32: Reservation no-funds invariant** — **Validates: Requirements 13.4**

- [ ] 12. [Phase 3] Profile and personal listings management
  - [ ] 12.1 Build the profile and personal listings management
    - `(tabs)/profile.tsx`: show assigned campus and cumulative carbon; list the user's own listings; edit, mark sold/donated (removes from active browsing), and delete — all gated by the ownership RLS policy
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 12.2 Write property tests for profile/listings management
    - **Property 17: Profile lists exactly the user's own listings** — **Validates: Requirements 7.2**
    - **Property 18: Edit persistence round-trip** — **Validates: Requirements 7.3**
    - **Property 19: Deleted listings disappear from the feed** — **Validates: Requirements 7.5**

- [ ] 13. [Phase 3] Checkpoint — reserve → chat → complete
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a buyer reserves an active listing (single-active enforced, no funds), buyer and seller coordinate over realtime chat, and the seller completes the exchange as sold/donated — the full P0 linear demo is now green.

### Phase 4 — Sustainability & Gamification  _(Checkpoint: sustainability hero number updates)_

- [ ] 14. [Phase 4] Carbon aggregation + gamification in the completion server path
  - [ ] 14.1 Add carbon baseline + aggregation to `reserve-complete`
    - Set `listings.carbon_savings_g` from `carbon_category_map[category]` at creation time (baseline); extend the `reserve-complete` server path (service role) so completion adds the listing's carbon to `profiles.cumulative_carbon_g` and recomputes the per-campus aggregate over completed listings only; keep the category-map value as the fallback when no refined estimate exists; label values as directional
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_
  - [ ] 14.2 Implement the `ai-estimate-carbon` Edge Function (optional refine)
    - Deno/TS Edge Function returning the `carbon_category_map` baseline optionally refined by Gemini 2.5 Flash; when Gemini returns nothing, fall back cleanly to the baseline; `GEMINI_API_KEY` stays a function secret
    - _Requirements: 6.1, 6.2, 6.3, 16.4_
  - [ ] 14.3 Add points + badge awards to `reserve-complete` (service role, idempotent)
    - Inside the `reserve-complete` server path: increase `profiles.points` on completed sale/donation, add carbon-proportional points as `cumulative_carbon_g` rises, and grant badges by evaluating each seeded badge's `threshold_type`/`threshold_value` against the student's stats; badge grants are **idempotent** (append a key only if absent); all writes are service-role only
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [ ]* 14.4 Write property tests for carbon and gamification awards
    - **Property 15: Carbon baseline and fallback** — **Validates: Requirements 6.1, 6.3**
    - **Property 16: Carbon aggregation** — **Validates: Requirements 6.4, 6.5**
    - **Property 33: Points monotonic non-decrease on completion** — **Validates: Requirements 14.2, 14.3**
    - **Property 34: Badge threshold monotonicity** — **Validates: Requirements 14.4, 14.5**

- [ ] 15. [Phase 4] Sustainability Dashboard, Leaderboard, and Profile rewards
  - [ ] 15.1 Build the Sustainability Dashboard screen
    - `dashboard/index.tsx`: hero **"kg CO₂e saved"** number for the student plus the per-campus aggregated total, all labeled as directional estimates
    - _Requirements: 6.4, 6.5, 6.6_
  - [ ] 15.2 Build the campus-scoped Leaderboard screen
    - `dashboard/leaderboard.tsx`: PostgREST/RPC read filtered by `current_campus()`, ordered non-increasingly by `points` (or `cumulative_carbon_g`); never returns cross-campus entries
    - _Requirements: 14.6, 14.7_
  - [ ] 15.3 Add points + badges display to Profile
    - Extend `(tabs)/profile.tsx` to display the student's `points` and granted `badges`
    - _Requirements: 14.8_
  - [ ]* 15.4 Write property test for leaderboard ordering and isolation
    - **Property 35: Leaderboard ordering and campus isolation** — **Validates: Requirements 14.6, 14.7**

- [ ] 16. [Phase 4] Checkpoint — sustainability hero number updates
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** completing an exchange increments the student's and campus's carbon totals, the Sustainability Dashboard hero number ticks up, points/badges are awarded server-side, and the campus leaderboard re-ranks.

### Phase 5 — Need It + Notifications + Polish  _(Checkpoint: Need It request triggers notification)_

- [ ] 17. [Phase 5] Need It requests
  - [ ] 17.1 Implement the Need It service (create/browse/close)
    - `services/needitService.ts`: create `need_it_requests` via PostgREST (RLS pins `campus_id = current_campus()`, defaults `status = 'open'`); browse returns only same-campus `open` requests; owner-only close sets `status = 'fulfilled'` (RLS `requester_id = auth.uid()`), excluding it from browsing thereafter
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_
  - [ ] 17.2 Build the Need It screens + respond via reused thread
    - `(tabs)/needit.tsx` (campus-scoped, open-only browse), `needit/create.tsx` (title/description/category + optional budget); a **Respond** action reuses the Phase 3 messaging thread flow to open a same-campus thread between responder and requester
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [ ]* 17.3 Write property tests for Need It
    - **Property 24: Need It creation validity and campus/status defaults** — **Validates: Requirements 12.1, 12.2**
    - **Property 25: Need It browse isolation (same-campus, open-only)** — **Validates: Requirements 12.3, 12.4**
    - **Property 26: Need It owner-only closure round-trip** — **Validates: Requirements 12.6, 12.7**

- [ ] 18. [Phase 5] In-app notifications
  - [ ] 18.1 Implement service-role notification inserts on key events
    - Add SECURITY DEFINER Postgres triggers that insert `notifications` on PostgREST-created events: reservation insert → seller (`listing_reserved`, target listing), message insert → other participant(s) (`new_message`, target thread), Need It response thread insert → requester (`need_it_response`, target need_it_request); and extend the `reserve-complete` server path to insert completion-path notifications: buyer (`listing_completed`, target listing) and, on badge grant, the student (`badge_earned`). **In-app only — no push transport**
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.10_
  - [ ] 18.2 Build the Notifications screen + Realtime + mark-read + deep-link
    - `notifications/index.tsx`: recipient-scoped, most-recent-first list with a per-user Supabase Realtime subscription; mark-as-read (own `read` toggle); tapping a notification deep-links to its target (listing / thread / need_it_request); add a header entry point/badge in the root layout
    - _Requirements: 15.6, 15.7, 15.8, 15.9, 15.10_
  - [ ]* 18.3 Write property/example tests for notifications
    - **Property 36: Notification event coverage** — **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
    - **Property 37: Notification recipient and campus isolation** — **Validates: Requirements 15.6**
    - **Property 38: Notification recency ordering** — **Validates: Requirements 15.7**
    - **Property 39: Notification mark-read round-trip** — **Validates: Requirements 15.8**
    - **Property 40: Notification deep-link target integrity** — **Validates: Requirements 15.9**
    - **Property 41: Notifications are in-app only** — **Validates: Requirements 15.10**

- [ ] 19. [Phase 5] Demo seed data, keyword matching, and final polish
  - [ ] 19.1 Add demo seed data
    - `supabase/seed/demo.sql` (per design §4.3 seed note): 2–3 verified demo `profiles` with varied points/carbon/badges; 8–12 `listings` across categories with a mix of `active`/`reserved`/`sold`/`donated`, each with ≥1 `listing_images`; 2–3 `open` `need_it_requests`; a pre-seeded thread with `messages`; and a few seeded `notifications` — so every screen looks populated during the demo
    - _Requirements: 4.1, 6.5, 14.6_
  - [ ] 19.2 Final polish pass
    - Add Moti/Reanimated micro-animations (incl. badge-earn celebration), empty states, loading indicators, and graceful error/degradation UI (AI timeout fallback, Realtime auto-resubscribe + PostgREST backfill, optimistic-update rollback) across screens
    - _Requirements: 8.3, 10.2, 10.3, 14.4_
  - [ ] 19.3 Surface Need It → listing keyword matching (optional feature)
    - Within the Need It flow, surface existing **active**, **same-campus** listings whose title/description/category match the request keywords
    - _Requirements: 12.8_
  - [ ]* 19.4 Write property test for keyword matching
    - **Property 27: Need It keyword-match relevance (optional feature)** — **Validates: Requirements 12.8**

- [ ] 20. [Phase 5] Checkpoint — Need It request triggers notification
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a student posts a campus-scoped Need It request, another student responds (opening a thread), the requester receives an in-app notification delivered over Realtime, taps it, and deep-links straight to the item — on fully seeded, polished screens.

## Notes

- **Five independently demoable phases:** each phase ends in a working checkpoint (Tasks 4, 9, 13, 16, 20) and is built **backend-first** (migrations/RLS/Edge Functions) then screens to minimize integration risk.
- **P0 linear path first:** Phases 1–3 constitute the P0 must-have demo; do not start the Phase 4/5 differentiators until the Phase 3 checkpoint is green.
- **Tests are optional (`*`)** and can be skipped for a faster MVP, but they encode the design's 42 correctness properties and are recommended before each demo. Property tests run ≥100 iterations, mock Gemini/Resend, and are tagged **Feature: campuswap-ai, Property {number}: {property_text}**.
- **No PocketBase anywhere:** all persistence is Supabase PostgreSQL with RLS; there are no collections, `pb_hooks`, `.pb.js` files, or API rules. Routine CRUD is PostgREST under RLS; Edge Functions exist only for the Gemini proxy, Resend, and the server-authoritative `reserve-complete` path.
- **Server-authoritative writes** (`points`, `badges`, notification inserts, reservation completion, carbon totals) run only via the service role / SECURITY DEFINER functions and are never client-writable.
- **No funds anywhere:** `reservations` has no monetary column and no code path touches money — reservations are a pickup-intent signal only.
- Each task references specific requirement sub-clauses (Req 1–16) and, where applicable, the design's Correctness Properties (Properties 1–42) for traceability.

## Task Dependency Graph

Each wave lists incomplete leaf sub-tasks that can be worked in parallel. Every leaf sub-task appears exactly once; test sub-tasks always follow the code they validate; no two tasks in the same wave modify the same file. Checkpoint tasks (4, 9, 13, 16, 20) gate the transition between phases and are omitted here.

```json
{
  "waves": [
    { "id": 0,  "phase": 1, "tasks": ["1.1", "3.1"] },
    { "id": 1,  "phase": 1, "tasks": ["1.2", "3.2"] },
    { "id": 2,  "phase": 1, "tasks": ["1.3", "1.4", "3.3"] },
    { "id": 3,  "phase": 1, "tasks": ["1.5", "2.1", "2.2"] },
    { "id": 4,  "phase": 1, "tasks": ["1.6", "2.3"] },
    { "id": 5,  "phase": 2, "tasks": ["5.1", "6.1"] },
    { "id": 6,  "phase": 2, "tasks": ["5.2", "6.2"] },
    { "id": 7,  "phase": 2, "tasks": ["7.1"] },
    { "id": 8,  "phase": 2, "tasks": ["7.2"] },
    { "id": 9,  "phase": 2, "tasks": ["7.3", "8.1"] },
    { "id": 10, "phase": 2, "tasks": ["8.2", "8.3"] },
    { "id": 11, "phase": 2, "tasks": ["8.4"] },
    { "id": 12, "phase": 3, "tasks": ["10.1", "11.1"] },
    { "id": 13, "phase": 3, "tasks": ["10.2", "11.2"] },
    { "id": 14, "phase": 3, "tasks": ["11.3", "10.3"] },
    { "id": 15, "phase": 3, "tasks": ["11.4", "12.1"] },
    { "id": 16, "phase": 3, "tasks": ["12.2"] },
    { "id": 17, "phase": 4, "tasks": ["14.1", "14.2"] },
    { "id": 18, "phase": 4, "tasks": ["14.3"] },
    { "id": 19, "phase": 4, "tasks": ["14.4", "15.1"] },
    { "id": 20, "phase": 4, "tasks": ["15.2", "15.3"] },
    { "id": 21, "phase": 4, "tasks": ["15.4"] },
    { "id": 22, "phase": 5, "tasks": ["17.1", "18.1"] },
    { "id": 23, "phase": 5, "tasks": ["17.2", "18.2"] },
    { "id": 24, "phase": 5, "tasks": ["17.3", "18.3"] },
    { "id": 25, "phase": 5, "tasks": ["19.1", "19.3"] },
    { "id": 26, "phase": 5, "tasks": ["19.4", "19.2"] }
  ]
}
```

## Branch Strategy

- **`main` is protected** — no direct pushes; all changes land via reviewed PRs; CI (tests + type-check) must be green to merge.
- **One branch per phase**, cut from `main`, merged back via a single PR when its checkpoint is green:
  - `phase-1/trust-foundation`
  - `phase-2/core-marketplace`
  - `phase-3/messaging-reservation`
  - `phase-4/sustainability-gamification`
  - `phase-5/needit-notifications`
- **One PR per phase** into `main`, titled after the phase and closed only after its checkpoint demo passes.
- **Tag a checkpoint per phase** on `main` after each PR merges:
  - `v0.1-trust-foundation` (Checkpoint: login with institutional email)
  - `v0.2-core-marketplace` (Checkpoint: AI-generated listing appears in feed)
  - `v0.3-messaging-reservation` (Checkpoint: reserve → chat → complete)
  - `v0.4-sustainability-gamification` (Checkpoint: sustainability hero number updates)
  - `v0.5-needit-notifications` (Checkpoint: Need It request triggers notification)

## Conventional Commit Sequence

Ordered commits aligned to the phases (backend-first within each):

**Phase 1 — `phase-1/trust-foundation`**
1. `chore(supabase): initialize project, migrations, functions, and seed layout`
2. `feat(db): add enums and core tables (profiles, listings, threads, reservations, notifications)`
3. `feat(db): add campus-scoped indexes and single-active-reservation partial unique index`
4. `feat(db): add current_campus()/is_verified() helpers and RLS policies on all tables`
5. `chore(seed): seed pilot campus, domain map, carbon category map, and badge config`
6. `feat(auth): add domain→campus profile-creation trigger on verification`
7. `feat(auth): add optional send-otp-email Edge Function (Resend)`
8. `feat(app): scaffold Expo Router app shell, providers, and auth gate`
9. `feat(auth): wire Supabase client, secure-store session, and auth screens`
10. `test(auth,db): property tests for isolation, access control, and onboarding`

**Phase 2 — `phase-2/core-marketplace`**
11. `feat(db): add listing-images Storage bucket, storage RLS, and publish/image validation`
12. `feat(ai): add ai-generate-listing Edge Function (Gemini proxy, 15s timeout + fallback)`
13. `feat(feed): add image upload service and Create Listing screen with publish validation`
14. `feat(feed): add campus feed, search, category filters, and rule-based recommendations`
15. `test(feed,ai): property + integration tests for listing publish and feed`

**Phase 3 — `phase-3/messaging-reservation`**
16. `feat(chat): add messaging service, Realtime subscription, and thread screens`
17. `feat(reservations): add reservation create/release and reserve-complete Edge Function`
18. `feat(reservations): add Listing Detail reservation UI`
19. `feat(feed): add profile and personal listings management`
20. `test(chat,reservations): property tests for coordination, reservations, and profile`

**Phase 4 — `phase-4/sustainability-gamification`**
21. `feat(carbon): add carbon baseline, aggregation, and ai-estimate-carbon refine`
22. `feat(gamification): add server-authoritative points and idempotent badge awards`
23. `feat(carbon): add Sustainability Dashboard, Leaderboard, and profile rewards`
24. `test(carbon,gamification): property tests for carbon, points, badges, and leaderboard`

**Phase 5 — `phase-5/needit-notifications`**
25. `feat(needit): add Need It create/browse/close and screens with thread responses`
26. `feat(notifications): add service-role notification triggers and Notifications screen`
27. `chore(seed): add demo seed data for a populated campus`
28. `feat(needit): add optional listing keyword matching and final polish`
29. `test(needit,notifications): property tests for Need It and notifications`
30. `docs: update README with setup, env vars, and demo script`

## Demo Checkpoints

1. **Phase 1 — Login with institutional email:** verify a supported email via OTP, auto-assign campus by domain, and enter the authenticated app (unsupported domains rejected).
2. **Phase 2 — AI-generated listing appears in feed:** photo → Gemini-generated editable listing (with manual fallback) → publish → visible in the campus-scoped feed with search/filters.
3. **Phase 3 — Reserve → chat → complete:** reserve an active listing (single-active, no funds) → realtime chat to coordinate → seller completes as sold/donated.
4. **Phase 4 — Sustainability hero number updates:** completion increments per-user + per-campus carbon totals, awards points/badges, and re-ranks the campus leaderboard.
5. **Phase 5 — Need It request triggers notification:** post a Need It request → another student responds → requester gets an in-app Realtime notification and deep-links to the item.

## Recommended Implementation Order

Build strictly in phase order, completing the **P0 linear path first**:

1. **Phase 1 — Trust Foundation** (P0): schema → indexes → RLS → seed → auth → app shell → auth screens. Nothing works without a verified, campus-scoped identity.
2. **Phase 2 — Core Marketplace Loop** (P0): Storage/validation → `ai-generate-listing` → Create Listing → feed/search/recommendations.
3. **Phase 3 — Messaging & Reservation** (P0): messaging + Realtime → reservation + `reserve-complete` → Listing Detail → profile. **The P0 linear demo must be green here** before starting differentiators.
4. **Phase 4 — Sustainability & Gamification** (differentiator): carbon aggregation + gamification inside `reserve-complete` → dashboard/leaderboard/profile rewards.
5. **Phase 5 — Need It + Notifications + Polish** (differentiator): Need It → notifications → demo seed → keyword matching → final polish.

Within every phase, do backend work (migrations/RLS/Edge Functions) before the screens that consume it.

## Estimated Implementation Timeline (48-hour hackathon)

| Phase | Focus | Rough budget |
|-------|-------|--------------|
| Phase 1 — Trust Foundation | Supabase project, schema/indexes/RLS/seed, auth OTP + campus assignment, app shell + auth screens | ~8h |
| Phase 2 — Core Marketplace Loop | Storage + validation, Gemini listing Edge Function, Create Listing, feed/search/recommendations | ~12h |
| Phase 3 — Messaging & Reservation | Realtime messaging, reservation + `reserve-complete`, Listing Detail, profile management | ~12h |
| Phase 4 — Sustainability & Gamification | Carbon aggregation + AI refine, points/badges, dashboard/leaderboard/profile rewards | ~8h |
| Phase 5 — Need It + Notifications + Polish | Need It, notifications (triggers + screen), demo seed, keyword matching, polish | ~8h |
| **Total** | | **~48h** |

> **Sequencing rule:** the **P0 linear path (Phases 1–3, ~32h) must be green** — a working verify → list → browse → reserve → chat → complete demo — **before** investing in the Phase 4/5 differentiators. If time runs short, cut Phase 5 polish (19.2/19.3) and optional test sub-tasks (`*`) first; keep every checkpoint demoable. Budgets are guidance — reallocate toward whichever differentiator best lands the sustainability story if the P0 path finishes early.

## Workflow Completion

This spec workflow produces planning artifacts only — it does not implement the feature. To begin building, open `tasks.md` and click **"Start task"** next to a task item (start with Task 1.1). Tasks marked with `*` are optional test sub-tasks and will not be auto-implemented.
