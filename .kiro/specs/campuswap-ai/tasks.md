# Implementation Plan: CampusSwap AI

## Overview

This plan delivers the CampusSwap AI v1 MVP on the finalized **Supabase** architecture (PostgreSQL + RLS + indexes, Supabase Auth email OTP, Supabase Storage, Supabase Realtime, and Edge Functions) with a React Native + Expo (Expo Router) client. The architecture is **frozen** — the same tables, RLS policies, indexes, Edge Functions, and screens from the design document — this plan only **reprioritizes and resequences** the work for a **48-hour sustainability hackathon**.

> **Reprioritization headline:** the **sustainability + gamification payoff is now protected P0 time** (Sustainability Dashboard hero "kg CO₂e saved" number, points, badges, and campus leaderboard), and the build is **front-loaded with seed data + demo-protection** so the demo can never stall on live signup, live AI, or a Realtime hiccup. Optional features (Need It, search/filter, recommendations, AI carbon refine, in-app notifications, auto-expiry, keyword matching, badge animations) are **deferred to P1/P2** without losing any requirement traceability.

### Priority tiers
- **P0 (must-have demo path):** schema/RLS/**seed** → demo accounts + OTP bypass → app shell + auth → feed + listing detail → AI listing generation (with Gemini fallback) → reservation (+ `reserve-complete`) → messaging (minimal realtime, with Realtime fallback) → **sustainability dashboard** → **gamification + leaderboard**.
- **P1 (deferred differentiators):** AI carbon refine (`ai-estimate-carbon`), search + category filters, rule-based recommendations, Need It requests, in-app notifications (optional).
- **P2 (polish/stretch):** reservation auto-expiry, Need It → listing keyword matching, badge-earn animations + final polish, hardening tests.

### Architecture guardrails (from design — FROZEN)
- **Prefer PostgREST + RLS** for all routine CRUD (`@supabase/supabase-js`); every read/write is filtered by the `current_campus()` / `is_verified()` SQL helpers.
- **Edge Functions only where a secret or server authority is required:** `ai-generate-listing` and `ai-estimate-carbon` (Gemini 2.5 Flash key stays server-side), optional `send-otp-email` (Resend), and `reserve-complete` (service-role: status flip + carbon aggregation + gamification + completion notifications, all inline — no event bus, no queue, no CQRS).
- **Server-authoritative writes** (`profiles.points`, `profiles.badges`, `notifications` inserts, reservation completion, carbon totals) are performed by the service role / SECURITY DEFINER functions and are never client-writable.
- **Notification fan-out** for PostgREST-created events runs via SECURITY DEFINER Postgres triggers; completion-path events run inline in `reserve-complete`.
- Every multi-tenant table carries `campus_id`; campus-scoped composite indexes back every hot query for index-backed, keyset pagination.

### Stack
React Native + Expo + Expo Router + NativeWind + Zustand + TanStack Query + React Hook Form + Zod + Reanimated + Moti + Lucide; Supabase (PostgreSQL, Auth, Storage, Realtime, RLS, Edge Functions); Gemini 2.5 Flash; Resend.

## Tasks

### P0 — Foundation: schema + RLS + seed  _(branch: `p0-foundation`)_

- [ ] 1. [P0] Supabase project + database schema, indexes, RLS, and reference seed
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
  - [ ]* 1.6 Write demo-critical property test — campus isolation
    - **Property 4: Campus isolation invariant** — **Validates: Requirements 2.2, 2.4, 4.6, 11.3**
    - Demo-critical: campus isolation underpins the whole trust story; keep this P0 test, defer the remaining isolation/access property tests to P2 hardening (Task 23)

- [ ] 2. [P0] Comprehensive demo seed data (pulled EARLY — the demo-mode dataset)
  - [ ] 2.1 Add the comprehensive demo seed so every screen looks populated
    - `supabase/seed/demo.sql` (per design §4.3 seed note): demo `profiles` with varied `points`/`cumulative_carbon_g`/pre-earned `badges`; 8–12 `listings` across categories (books, electronics, furniture, cycles) with a mix of `active`/`reserved`/`sold`/`donated`, each with ≥1 seeded `listing_images`; 2–3 `open` `need_it_requests`; a pre-seeded `thread` with `messages`; and a few seeded `notifications` — so the feed, listing detail, chat, dashboard, leaderboard, and notifications screens all look alive during the demo. **Pull this early**, not as a final-phase task.
    - _Requirements: 4.1, 6.5, 14.6_

### P0 — Demo protection: demo accounts + OTP bypass  _(branch: `p0-demo-protection`)_

- [ ] 3. [P0] Demo mode, pre-verified accounts, and OTP dev-bypass
  - [ ] 3.1 Add a demo-mode toggle/config
    - Add an `EXPO_PUBLIC_APP_ENV=demo` config path (env + `lib/env.ts` flag) that enables demo-friendly behavior across the app: pre-seeded data, relaxed/tightened timeouts, and deterministic content. Gate all demo-only behavior behind this flag so production paths are unaffected
    - _Requirements: 10.2, 10.3_
  - [ ] 3.2 Seed pre-verified demo accounts
    - `supabase/seed/demo_accounts.sql`: seed 2–3 already-verified demo `profiles` (with `auth.users` rows and assigned `campus_id`, `verified_student = true`) so the demo never depends on a live signup. Keep this seed file separate from the content seed (Task 2.1)
    - _Requirements: 9.2, 11.1_
  - [ ] 3.3 Implement the OTP fallback / dev-bypass sign-in path
    - Add a **demo-mode-only**, guarded dev-bypass in `services/authService.ts` that signs in a pre-seeded verified demo account without waiting on live email OTP, so onboarding can never stall the demo. The bypass is inert unless `EXPO_PUBLIC_APP_ENV=demo`; **live Supabase Auth email OTP remains the real, default path**
    - _Requirements: 1.4, 1.8, 10.1_

### P0 — App shell + authentication  _(branch: `p0-app-auth`)_

- [ ] 4. [P0] Auth backend, Expo app scaffold, Supabase client, and auth screens
  - [ ] 4.1 Implement domain→campus profile creation on verification
    - Add a SECURITY DEFINER Postgres trigger on the Supabase Auth signup/verify event that lowercases the email domain, looks it up in `domain_campus_map`, and — when present — creates/updates the `profiles` row with `campus_id = map[domain]` and `verified_student = true`; when the domain is absent, leave the profile unverified so the client surfaces "campus not supported"
    - _Requirements: 1.1, 1.2, 1.8, 9.2, 11.1_
  - [ ] 4.2 Add optional `send-otp-email` Edge Function (Resend)
    - Optional Edge Function delivering the OTP email via Resend using a custom template when built-in Supabase Auth delivery is not sufficient; hold `RESEND_API_KEY`/`RESEND_FROM_EMAIL` as function secrets only; surface delivery-failure so the client can offer a resend (Supabase Auth still owns generation, expiry, single-use, and rate limiting)
    - _Requirements: 1.3, 1.6, 10.1_
  - [ ] 4.3 Scaffold the Expo Router app shell
    - Create the Expo app per design §4.4 (`app/`, `components/`, `features/`, `services/`, `stores/`, `hooks/`, `lib/`, `utils/`, `types/`); configure NativeWind, Reanimated, Moti, Lucide; set up route groups `(auth)` and `(tabs)` and the root `app/_layout.tsx` with the TanStack Query `QueryClient` provider, Zustand session store, and an **auth gate** routing unverified users to `(auth)` and verified users to `(tabs)`
    - _Requirements: 2.1_
  - [ ] 4.4 Wire the Supabase client and session handling
    - Add `lib/supabase.ts` (`@supabase/supabase-js` + `react-native-url-polyfill`), configure `expo-secure-store` for JWT session persistence, read `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, and add a typed `services/authService.ts` wrapping `signInWithOtp` / `verifyOtp` and session hydration (the demo dev-bypass from Task 3.3 plugs in here)
    - _Requirements: 1.3, 1.4_
  - [ ] 4.5 Build the auth screens
    - `(auth)/email.tsx` (RHF + Zod institutional-email entry → request OTP) and `(auth)/otp.tsx` (code entry → verify → campus assigned by domain), with resend action, error states for unsupported campus / invalid code / expired code / delivery failure, and a demo-mode entry point to the dev-bypass sign-in
    - _Requirements: 1.2, 1.4, 1.5, 1.7, 10.1_

- [ ] 5. [P0] Checkpoint — login (with demo bypass available)
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a student enters a supported institutional email, receives and verifies a live OTP, is auto-assigned to their campus, and lands in the authenticated app; unsupported domains are rejected; and in demo mode a pre-verified account can sign in via the dev-bypass so onboarding never blocks the demo.

### P0 — Marketplace: feed + listing detail + AI listing  _(branch: `p0-marketplace`)_

- [ ] 6. [P0] Campus feed and Listing Detail (view)
  - [ ] 6.1 Implement the campus feed
    - `(tabs)/index.tsx` + `hooks/useFeed.ts`: PostgREST SELECT under RLS (campus + active-only), ordered `published_at DESC`, index-backed keyset/range pagination for incremental scroll; render each listing's primary `listing_image` and a **reserved-state indicator**; empty-state message
    - _Requirements: 4.1, 4.6, 8.1, 8.2, 13.5, 16.5_
  - [ ] 6.2 Build the Listing Detail view
    - `listing/[id].tsx`: photos + details + contact action (reservation controls are added in Task 9.3); reflect listing status; "no longer available" state when sold/donated while preserving threads
    - _Requirements: 4.6, 5.1, 13.5_

- [ ] 7. [P0] Storage + AI listing generation (with Gemini fallback)
  - [ ] 7.1 Create the listing-images Storage bucket, RLS, and publish/image validation
    - Create the Supabase Storage bucket for listing images and Storage RLS policies (only the owning seller may write under their listing path; authenticated read for same-campus-visible listings); add a SECURITY DEFINER trigger/function validating each `listing_images` row server-side (MIME JPEG/PNG/WebP, size, max count) and blocking publish of a listing with zero related `listing_images`
    - _Requirements: 3.8, 9.1_
  - [ ] 7.2 Implement the `ai-generate-listing` Edge Function (Gemini proxy)
    - Deno/TS Edge Function requiring an authenticated, verified caller that proxies image refs + optional text to **Gemini 2.5 Flash**, returning suggested title/description/condition and — when `listing_type = sell` — a suggested price; enforce a **tightened demo timeout** (≤15s, shorter in demo mode), per-user rate limiting, and a clean error return for manual fallback; hold `GEMINI_API_KEY` as a function secret only
    - _Requirements: 3.2, 3.3, 3.4, 8.3, 10.2, 16.4_
  - [ ] 7.3 Implement the explicit Gemini manual-entry fallback path
    - First-class fallback in `services/aiService.ts` / the Create Listing flow: on `ai-generate-listing` timeout or error, deterministically switch to manual entry of title/description/condition/price so publishing always continues; in demo mode use the tightened timeout so the demo never waits on live AI
    - _Requirements: 3.7, 10.2, 8.3_
  - [ ] 7.4 Implement the image upload service
    - `services/imageService.ts`: pick images with `expo-image-picker`, upload to Supabase Storage under the seller's listing path, insert corresponding `listing_images` rows (with `display_order`) via PostgREST under RLS; support retry and proceed-without-failed-image (≥1 image still required)
    - _Requirements: 3.8, 9.1, 10.2_
  - [ ] 7.5 Build the Create Listing screen
    - `listing/create.tsx`: Listing_Type select (sell/donate), image picker wired to 7.4, AI-populated **editable** fields via `ai-generate-listing` with a progress indicator and the manual-entry fallback (7.3) on timeout/error; RHF + Zod publish validation requiring title/category/condition/**≥1 image**, price required for `sell` and omitted for `donate`; insert `listings` via PostgREST under RLS (seller/self/campus); set `carbon_savings_g` from the `carbon_category_map` baseline at creation; duplicate-submission guard while publish is in flight
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 3.9, 6.1, 6.3, 8.3, 9.1, 9.3, 10.2, 10.3_
  - [ ]* 7.6 Write demo-critical property test — publish validation
    - **Property 7: Publish validation** — **Validates: Requirements 3.8, 3.9**
    - Demo-critical: guarantees the listing-creation happy path is sound; other listing/ownership property tests are deferred to P2 hardening (Task 23)
  - [ ]* 7.7 Write integration test for AI generation (mock Gemini)
    - Verify the function returns editable fields on success and that timeout/error degrades cleanly to the manual-entry signal (mock Gemini responses)
    - _Requirements: 3.2, 3.7, 10.2_

- [ ] 8. [P0] Checkpoint — AI listing appears in feed
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a verified student uploads a photo, Gemini generates an editable listing (with manual fallback and a tight demo timeout), publishes it, and the listing appears in the campus-scoped feed.

### P0 — Reserve + chat  _(branch: `p0-reserve-chat`)_

- [ ] 9. [P0] No-payment reservation system
  - [ ] 9.1 Implement reservation create/release via PostgREST
    - `services/reservationService.ts` + `hooks/useReservation.ts`: INSERT a `reservation` (buyer/self/campus, target listing `active`) under RLS — the **partial unique index** + status check enforce single-active-per-listing; on success flip the listing to `reserved`; UPDATE `status = 'released'` (buyer or seller) returns the listing to `active` and clears the active reservation; **no monetary field is ever touched**
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.7, 13.8_
  - [ ] 9.2 Implement the `reserve-complete` Edge Function (seller-only base)
    - Deno/TS Edge Function (service role) that verifies the caller is the listing's `seller` (else reject), sets the listing to `sold`/`donated`, and marks the reservation `completed`; this is the completion server path that Tasks 13/14 extend with carbon aggregation and gamification
    - _Requirements: 13.6, 13.8_
  - [ ] 9.3 Build reservation UI within Listing Detail
    - Extend `listing/[id].tsx`: reservation controls — **Reserve** (buyer), **Reserved** indicator, **Release** (buyer/seller), and **seller-complete** (mark sold/donated) — reflecting status transitions live
    - _Requirements: 4.6, 13.1, 13.5, 13.6, 13.7_
  - [ ]* 9.4 Write demo-critical property test — single active reservation
    - **Property 28: Single active reservation per listing** — **Validates: Requirements 13.3**
    - Demo-critical: the reserve step depends on this invariant; the remaining reservation lifecycle/access/no-funds property tests are deferred to P2 hardening (Task 23)

- [ ] 10. [P0] Profile and personal listings management
  - [ ] 10.1 Build the profile and personal listings management
    - `(tabs)/profile.tsx`: show assigned campus and cumulative carbon; list the user's own listings; edit, mark sold/donated (removes from active browsing), and delete — all gated by the ownership RLS policy (points + badges display is added in Task 14.3)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 11. [P0] Minimal realtime messaging (with Realtime fallback)
  - [ ] 11.1 Implement the messaging service + Realtime subscription
    - `services/messageService.ts` + `hooks/useThread.ts`: find/create a same-campus `thread` (buyer, seller, listing/need-it, campus) via PostgREST under RLS; send plain-text `messages`; subscribe to a **per-thread Supabase Realtime channel** for live delivery; order by `created_at`. Scope is intentionally minimal — **no** push, read receipts, typing indicators, voice notes, image sharing, or presence
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7, 5.8, 2.4_
  - [ ] 11.2 Implement the Realtime fallback path
    - First-class graceful-degradation path: on Realtime disconnect, **auto-resubscribe on reconnect** and **PostgREST refetch/backfill** missed `messages` (and `notifications` when Task 20 lands) so coordination keeps working even if the live channel drops mid-demo
    - _Requirements: 5.5, 15.7_
  - [ ] 11.3 Build the thread list and message thread screens
    - `chat/index.tsx` (the user's threads) and `chat/[threadId].tsx` (plain-text realtime messages with timestamps); display explicit no-payment UI + offline-transaction guidance; when a listing is sold/donated, show "no longer available" while preserving existing threads
    - _Requirements: 5.2, 5.3, 5.9_

- [ ] 12. [P0] Checkpoint — reserve → chat → complete
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** a buyer reserves an active listing (single-active enforced, no funds), buyer and seller coordinate over realtime chat (with auto-resubscribe/backfill on disconnect), and the seller completes the exchange as sold/donated.

### P0 — Sustainability + gamification (the differentiators)  _(branch: `p0-sustainability-gamification`)_

- [ ] 13. [P0] Carbon aggregation + Sustainability Dashboard hero number
  - [ ] 13.1 Add carbon aggregation to the `reserve-complete` server path
    - Extend `reserve-complete` (service role) so completion adds the listing's `carbon_savings_g` to `profiles.cumulative_carbon_g` and recomputes the per-campus aggregate over completed listings only; **P0 uses the `carbon_category_map` baseline** set at creation (Task 7.5) as the value — the optional AI refine is deferred to P1 (Task 16); label values as directional estimates
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_
  - [ ] 13.2 Build the Sustainability Dashboard screen (hero number)
    - `dashboard/index.tsx`: hero **"kg CO₂e saved"** number for the student plus the per-campus aggregated total, all labeled as directional estimates — the sustainability-judge payoff, protected P0 time
    - _Requirements: 6.4, 6.5, 6.6_

- [ ] 14. [P0] Gamification: points + badges + campus leaderboard
  - [ ] 14.1 Add points + badge awards to `reserve-complete` (service role, idempotent)
    - Inside the `reserve-complete` server path: increase `profiles.points` on completed sale/donation, add carbon-proportional points as `cumulative_carbon_g` rises, and grant badges by evaluating each seeded badge's `threshold_type`/`threshold_value` against the student's stats; badge grants are **idempotent** (append a key only if absent); all writes are service-role only
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [ ] 14.2 Build the campus-scoped Leaderboard screen
    - `dashboard/leaderboard.tsx`: PostgREST/RPC read filtered by `current_campus()`, ordered non-increasingly by `points` (or `cumulative_carbon_g`); never returns cross-campus entries
    - _Requirements: 14.6, 14.7_
  - [ ] 14.3 Add points + badges display to Profile
    - Extend `(tabs)/profile.tsx` to display the student's `points` and granted `badges`
    - _Requirements: 14.8_

- [ ] 15. [P0] Checkpoint — sustainability hero number + gamification updates
  - Ensure all tests pass, ask the user if questions arise. **Demoable:** completing an exchange increments the student's and campus's carbon totals, the Sustainability Dashboard hero **"kg CO₂e saved"** number ticks up, points/badges are awarded server-side, and the campus leaderboard re-ranks. **This is the end of the protected P0 build path.**

### P1 — Optional differentiators (deferred; land if time allows)  _(branch: `p1-optional`)_

- [ ] 16. [P1] AI carbon refinement (deferred from P0)
  - [ ] 16.1 Implement the `ai-estimate-carbon` Edge Function (optional refine)
    - Deno/TS Edge Function returning the `carbon_category_map` baseline optionally refined by Gemini 2.5 Flash; when Gemini returns nothing, fall back cleanly to the baseline; wire it into the carbon path so it augments (does not replace) the P0 baseline; `GEMINI_API_KEY` stays a function secret. **Deferred:** P0 ships on the baseline only
    - _Requirements: 6.1, 6.2, 6.3, 16.4_

- [ ] 17. [P1] Search and category filters (deferred from P0)
  - [ ] 17.1 Implement search and category filter
    - `(tabs)/search.tsx`: keyword search matching title/description/category and a category filter, both inheriting the campus + active-only RLS scope; empty-state on no matches. **Deferred:** the P0 feed is browse-only
    - _Requirements: 4.2, 4.3, 4.5, 4.6_

- [ ] 18. [P1] Rule-based recommendations (deferred from P0)
  - [ ] 18.1 Implement client-side rule-based recommendations
    - `features/recommendations/`: deterministic ranking over the campus feed using category affinity and recency. **Deferred:** the P0 feed uses plain recency ordering
    - _Requirements: 4.4_

- [ ] 19. [P1] Need It requests (deferred from P0)
  - [ ] 19.1 Implement the Need It service (create/browse/close)
    - `services/needitService.ts`: create `need_it_requests` via PostgREST (RLS pins `campus_id = current_campus()`, defaults `status = 'open'`); browse returns only same-campus `open` requests; owner-only close sets `status = 'fulfilled'` (RLS `requester_id = auth.uid()`), excluding it from browsing thereafter
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_
  - [ ] 19.2 Build the Need It screens + respond via reused thread
    - `(tabs)/needit.tsx` (campus-scoped, open-only browse), `needit/create.tsx` (title/description/category + optional budget); a **Respond** action reuses the messaging thread flow (Task 11) to open a same-campus thread between responder and requester
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

- [ ] 20. [P1] In-app notifications (optional)
  - [ ] 20.1 Implement service-role notification inserts on key events
    - Add SECURITY DEFINER Postgres triggers that insert `notifications` on PostgREST-created events: reservation insert → seller (`listing_reserved`, target listing), message insert → other participant(s) (`new_message`, target thread), Need It response thread insert → requester (`need_it_response`, target need_it_request); and extend `reserve-complete` to insert completion-path notifications: buyer (`listing_completed`, target listing) and, on badge grant, the student (`badge_earned`). **In-app only — no push transport**
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.10_
  - [ ] 20.2 Build the Notifications screen + Realtime + mark-read + deep-link
    - `notifications/index.tsx`: recipient-scoped, most-recent-first list with a per-user Supabase Realtime subscription (reusing the Task 11.2 fallback for backfill); mark-as-read (own `read` toggle); tapping a notification deep-links to its target (listing / thread / need_it_request); add a header entry point/badge in the root layout
    - _Requirements: 15.6, 15.7, 15.8, 15.9, 15.10_

- [ ] 21. [P1] Checkpoint — optional features (only if P0 is green)
  - Ensure all tests pass, ask the user if questions arise. **Demoable (optional):** search/filter and recommendations sharpen browsing; a student posts a campus-scoped Need It request and another responds via a thread; in-app notifications deliver over Realtime and deep-link to the item. Attempt this checkpoint **only after** the P0 sustainability + gamification checkpoint (Task 15) is green.

### P2 — Polish, stretch, and hardening tests  _(branch: `p2-polish`)_

- [ ] 22. [P2] Deferred polish features
  - [ ] 22.1 Add reservation auto-expiry
    - Background/scheduled release: when a reservation's `expires_at` elapses, set the listing back to `active` and clear the active reservation. **Deferred:** manual release covers the P0 demo
    - _Requirements: 13.7_
  - [ ] 22.2 Surface Need It → listing keyword matching (optional feature)
    - Within the Need It flow (Task 19), surface existing **active**, **same-campus** listings whose title/description/category match the request keywords. **Deferred:** optional (`MAY`)
    - _Requirements: 12.8_
  - [ ] 22.3 Badge-earn animations + final polish pass
    - Add Moti/Reanimated micro-animations (incl. the badge-earn celebration), empty states, loading indicators, and graceful error/degradation UI (AI timeout fallback, Realtime auto-resubscribe + PostgREST backfill, optimistic-update rollback) across screens. **Deferred:** static badges + basic states suffice for the P0 demo
    - _Requirements: 8.3, 10.2, 10.3, 14.4_

- [ ] 23. [P2] Hardening tests (deferred property/example tests — keep traceability)
  - [ ]* 23.1 Onboarding property tests
    - **Property 1: Domain-gated registration** — **Validates: Requirements 1.1, 1.2**
    - **Property 2: OTP validity requires match, freshness, and single use** — **Validates: Requirements 1.4, 1.5, 1.6, 1.7**
    - **Property 3: Campus assignment derives solely from the domain map** — **Validates: Requirements 1.8, 11.1**
  - [ ]* 23.2 Access-control and pagination property tests
    - **Property 5: Access restricted to verified students** — **Validates: Requirements 2.1**
    - **Property 21: Verified users carry a campus reference** — **Validates: Requirements 9.2**
    - **Property 42: Index-backed, cursor-based pagination** — **Validates: Requirements 16.2, 16.5**
  - [ ]* 23.3 Listing publish/ownership property tests (remaining)
    - **Property 6: Listing–campus consistency (ownership integrity)** — **Validates: Requirements 2.3, 9.1, 9.3**
    - **Property 8: Donate listings omit price** — **Validates: Requirements 3.5**
    - **Property 9: Editable AI values round-trip** — **Validates: Requirements 3.6**
    - **Property 20: Ownership-gated mutation** — **Validates: Requirements 7.6**
    - **Property 23: Duplicate-submission guard** — **Validates: Requirements 10.3**
  - [ ]* 23.4 Feed/search/pagination property tests
    - **Property 10: Feed recency ordering** — **Validates: Requirements 4.1**
    - **Property 11: Search and filter correctness** — **Validates: Requirements 4.2, 4.3, 4.6**
    - **Property 12: Rule-based recommendation ordering** — **Validates: Requirements 4.4**
    - **Property 22: Incremental (bounded) feed loading** — **Validates: Requirements 8.2**
  - [ ]* 23.5 Coordination property tests
    - **Property 13: Sold/donated availability with thread preservation** — **Validates: Requirements 4.6, 5.5, 7.4**
    - **Property 14: No-payment invariant** — **Validates: Requirements 5.2**
  - [ ]* 23.6 Reservation lifecycle property tests (remaining)
    - **Property 29: Reservation status lifecycle validity** — **Validates: Requirements 13.1, 13.2, 13.6**
    - **Property 30: Reservation release/expiry round-trip** — **Validates: Requirements 13.7**
    - **Property 31: Reservation access control (same-campus, seller-only completion)** — **Validates: Requirements 13.8**
    - **Property 32: Reservation no-funds invariant** — **Validates: Requirements 13.4**
  - [ ]* 23.7 Profile/listings property tests
    - **Property 17: Profile lists exactly the user's own listings** — **Validates: Requirements 7.2**
    - **Property 18: Edit persistence round-trip** — **Validates: Requirements 7.3**
    - **Property 19: Deleted listings disappear from the feed** — **Validates: Requirements 7.5**
  - [ ]* 23.8 Carbon + gamification award property tests
    - **Property 15: Carbon baseline and fallback** — **Validates: Requirements 6.1, 6.3**
    - **Property 16: Carbon aggregation** — **Validates: Requirements 6.4, 6.5**
    - **Property 33: Points monotonic non-decrease on completion** — **Validates: Requirements 14.2, 14.3**
    - **Property 34: Badge threshold monotonicity** — **Validates: Requirements 14.4, 14.5**
  - [ ]* 23.9 Leaderboard property test
    - **Property 35: Leaderboard ordering and campus isolation** — **Validates: Requirements 14.6, 14.7**
  - [ ]* 23.10 Need It property tests
    - **Property 24: Need It creation validity and campus/status defaults** — **Validates: Requirements 12.1, 12.2**
    - **Property 25: Need It browse isolation (same-campus, open-only)** — **Validates: Requirements 12.3, 12.4**
    - **Property 26: Need It owner-only closure round-trip** — **Validates: Requirements 12.6, 12.7**
  - [ ]* 23.11 Notification property/example tests
    - **Property 36: Notification event coverage** — **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
    - **Property 37: Notification recipient and campus isolation** — **Validates: Requirements 15.6**
    - **Property 38: Notification recency ordering** — **Validates: Requirements 15.7**
    - **Property 39: Notification mark-read round-trip** — **Validates: Requirements 15.8**
    - **Property 40: Notification deep-link target integrity** — **Validates: Requirements 15.9**
    - **Property 41: Notifications are in-app only** — **Validates: Requirements 15.10**
  - [ ]* 23.12 Keyword-matching property test
    - **Property 27: Need It keyword-match relevance (optional feature)** — **Validates: Requirements 12.8**

## Notes

- **P0 first, always.** The P0 build path (Tasks 1–15) is the protected must-have: seed + demo protection are front-loaded, and the **sustainability + gamification payoff (Tasks 13–15) is protected P0 time**. Do not start P1 (Tasks 16–21) until the Task 15 checkpoint is green; P2 (Tasks 22–23) is last.
- **Demo protection is a first-class P0 concern:** comprehensive seed (Task 2), demo-mode toggle (3.1), pre-verified accounts (3.2), OTP dev-bypass (3.3), Gemini manual fallback (7.3), and Realtime fallback (11.2) ensure the demo never stalls on live signup, live AI, or a dropped channel. Live Supabase Auth OTP, live Gemini, and live Realtime remain the real default paths.
- **Architecture is FROZEN:** same Supabase tables, RLS, indexes, Edge Functions, and screens as the design. This plan only re-tiers and re-sequences — no new architecture, no removed traceability.
- **Tests are optional (`*`)** and can be skipped for a faster MVP. P0 keeps only a handful of **demo-critical** property tests (Property 4 campus isolation, Property 7 publish validation, Property 28 single-active reservation); the remaining property/example tests are grouped under **P2 hardening (Task 23)** with full traceability preserved. Property tests run ≥100 iterations, mock Gemini/Resend, and are tagged **Feature: campuswap-ai, Property {number}: {property_text}**.
- **No PocketBase anywhere:** all persistence is Supabase PostgreSQL with RLS. Routine CRUD is PostgREST under RLS; Edge Functions exist only for the Gemini proxy, Resend, and the server-authoritative `reserve-complete` path.
- **No funds anywhere:** `reservations` has no monetary column and no code path touches money — reservations are a pickup-intent signal only.
- Each task references specific requirement sub-clauses (Req 1–16) and, where applicable, the design's Correctness Properties (Properties 1–42) for traceability.

## Task Dependency Graph

Each wave lists incomplete leaf sub-tasks that can be worked in parallel. Every leaf sub-task appears exactly once; test sub-tasks always follow the code they validate; no two tasks in the same wave modify the same file. Checkpoint tasks (5, 8, 12, 15, 21) gate tier transitions and are omitted here.

```json
{
  "waves": [
    { "id": 0,  "tier": "P0", "group": "foundation",        "tasks": ["1.1"] },
    { "id": 1,  "tier": "P0", "group": "foundation",        "tasks": ["1.2"] },
    { "id": 2,  "tier": "P0", "group": "foundation",        "tasks": ["1.3", "1.4"] },
    { "id": 3,  "tier": "P0", "group": "foundation",        "tasks": ["1.5", "4.1"] },
    { "id": 4,  "tier": "P0", "group": "foundation",        "tasks": ["2.1", "1.6"] },
    { "id": 5,  "tier": "P0", "group": "demo-protection",   "tasks": ["3.2", "4.2", "4.3"] },
    { "id": 6,  "tier": "P0", "group": "app-auth",          "tasks": ["3.1", "4.4"] },
    { "id": 7,  "tier": "P0", "group": "app-auth",          "tasks": ["3.3", "4.5"] },
    { "id": 8,  "tier": "P0", "group": "marketplace",       "tasks": ["6.1", "7.1"] },
    { "id": 9,  "tier": "P0", "group": "marketplace",       "tasks": ["6.2", "7.2"] },
    { "id": 10, "tier": "P0", "group": "marketplace",       "tasks": ["7.3", "7.4"] },
    { "id": 11, "tier": "P0", "group": "marketplace",       "tasks": ["7.5"] },
    { "id": 12, "tier": "P0", "group": "marketplace",       "tasks": ["7.6", "7.7"] },
    { "id": 13, "tier": "P0", "group": "reserve-chat",      "tasks": ["9.1", "11.1"] },
    { "id": 14, "tier": "P0", "group": "reserve-chat",      "tasks": ["9.2", "11.2"] },
    { "id": 15, "tier": "P0", "group": "reserve-chat",      "tasks": ["9.3", "11.3", "10.1"] },
    { "id": 16, "tier": "P0", "group": "reserve-chat",      "tasks": ["9.4"] },
    { "id": 17, "tier": "P0", "group": "sustainability",    "tasks": ["13.1"] },
    { "id": 18, "tier": "P0", "group": "gamification",      "tasks": ["14.1"] },
    { "id": 19, "tier": "P0", "group": "sustainability-gamification", "tasks": ["13.2", "14.2", "14.3"] },
    { "id": 20, "tier": "P1", "group": "optional",          "tasks": ["16.1", "17.1", "18.1"] },
    { "id": 21, "tier": "P1", "group": "optional",          "tasks": ["19.1", "20.1"] },
    { "id": 22, "tier": "P1", "group": "optional",          "tasks": ["19.2", "20.2"] },
    { "id": 23, "tier": "P2", "group": "polish",            "tasks": ["22.1", "22.2"] },
    { "id": 24, "tier": "P2", "group": "polish",            "tasks": ["22.3"] },
    { "id": 25, "tier": "P2", "group": "hardening-tests",   "tasks": ["23.1", "23.2", "23.3", "23.4"] },
    { "id": 26, "tier": "P2", "group": "hardening-tests",   "tasks": ["23.5", "23.6", "23.7", "23.8"] },
    { "id": 27, "tier": "P2", "group": "hardening-tests",   "tasks": ["23.9", "23.10", "23.11", "23.12"] }
  ]
}
```

## Branch Strategy

- **`main` is protected** — no direct pushes; all changes land via reviewed PRs; CI (tests + type-check) must be green to merge.
- **Branches follow the P0/P1/P2 tiering**, each cut from `main` and merged back via a single PR when its checkpoint is green:
  - `p0-foundation` — schema, indexes, RLS, reference + comprehensive demo seed (Tasks 1–2)
  - `p0-demo-protection` — demo mode, pre-verified accounts, OTP dev-bypass (Task 3)
  - `p0-app-auth` — domain→campus trigger, app shell, Supabase client, auth screens (Tasks 4–5)
  - `p0-marketplace` — feed, listing detail, Storage/validation, `ai-generate-listing` + Gemini fallback, Create Listing (Tasks 6–8)
  - `p0-reserve-chat` — reservation + `reserve-complete`, profile, minimal realtime messaging + Realtime fallback (Tasks 9–12)
  - `p0-sustainability-gamification` — carbon aggregation + dashboard hero, points/badges + leaderboard (Tasks 13–15)
  - `p1-optional` — AI carbon refine, search/filter, recommendations, Need It, in-app notifications (Tasks 16–21)
  - `p2-polish` — auto-expiry, keyword matching, badge animations + polish, hardening tests (Tasks 22–23)
- **One PR per branch** into `main`, titled after its tier/group and closed only after its checkpoint demo passes. **Do not open a P1 PR until the P0 branches are merged and the Task 15 checkpoint is green.**
- **Tag checkpoints on `main`** after each P0 branch merges:
  - `v0.1-foundation` (schema + seed ready)
  - `v0.2-demo-protection` (demo accounts + bypass ready)
  - `v0.3-login` (Checkpoint: login with demo bypass available)
  - `v0.4-marketplace` (Checkpoint: AI listing appears in feed)
  - `v0.5-reserve-chat` (Checkpoint: reserve → chat → complete)
  - `v0.6-sustainability-gamification` (Checkpoint: sustainability hero number + gamification updates)

## Conventional Commit Sequence

Ordered commits aligned to the new P0-first sequence (backend-first within each group; seed + demo-protection early; sustainability + gamification as P0; notifications/needit/search as P1/P2):

**P0 — `p0-foundation`**
1. `chore(supabase): initialize project, migrations, functions, and seed layout`
2. `feat(db): add enums and core tables (profiles, listings, threads, reservations, notifications)`
3. `feat(db): add campus-scoped indexes and single-active-reservation partial unique index`
4. `feat(db): add current_campus()/is_verified() helpers and RLS policies on all tables`
5. `chore(seed): seed pilot campus, domain map, carbon category map, and badge config`
6. `chore(seed): add comprehensive demo seed so every screen looks populated`
7. `test(db): property test for campus isolation invariant`

**P0 — `p0-demo-protection`**
8. `chore(seed): seed pre-verified demo accounts with assigned campus`
9. `feat(config): add EXPO_PUBLIC_APP_ENV=demo demo-mode toggle`
10. `feat(auth): add demo-mode-only OTP dev-bypass sign-in path`

**P0 — `p0-app-auth`**
11. `feat(auth): add domain→campus profile-creation trigger on verification`
12. `feat(auth): add optional send-otp-email Edge Function (Resend)`
13. `feat(app): scaffold Expo Router app shell, providers, and auth gate`
14. `feat(auth): wire Supabase client, secure-store session, and auth screens`

**P0 — `p0-marketplace`**
15. `feat(feed): add campus feed and Listing Detail view`
16. `feat(db): add listing-images Storage bucket, storage RLS, and publish/image validation`
17. `feat(ai): add ai-generate-listing Edge Function (Gemini proxy, tightened demo timeout)`
18. `feat(ai): add explicit Gemini manual-entry fallback path`
19. `feat(feed): add image upload service and Create Listing screen with publish validation`
20. `test(feed,ai): property test for publish validation + AI generation integration test`

**P0 — `p0-reserve-chat`**
21. `feat(reservations): add reservation create/release and reserve-complete Edge Function`
22. `feat(reservations): add Listing Detail reservation UI`
23. `feat(feed): add profile and personal listings management`
24. `feat(chat): add messaging service, Realtime subscription, and Realtime fallback`
25. `feat(chat): add thread list and message thread screens`
26. `test(reservations): property test for single active reservation`

**P0 — `p0-sustainability-gamification`**
27. `feat(carbon): add carbon aggregation to reserve-complete (category-map baseline)`
28. `feat(carbon): add Sustainability Dashboard hero kg CO₂e number`
29. `feat(gamification): add server-authoritative points and idempotent badge awards`
30. `feat(gamification): add campus leaderboard and profile points/badges display`

**P1 — `p1-optional`**
31. `feat(carbon): add ai-estimate-carbon Edge Function (optional refine)`
32. `feat(feed): add search and category filters`
33. `feat(feed): add client-side rule-based recommendations`
34. `feat(needit): add Need It create/browse/close and screens with thread responses`
35. `feat(notifications): add service-role notification triggers and Notifications screen`

**P2 — `p2-polish`**
36. `feat(reservations): add reservation auto-expiry`
37. `feat(needit): add optional listing keyword matching`
38. `feat(ui): add badge-earn animations and final polish pass`
39. `test(*): add deferred hardening property/example tests`
40. `docs: update README with setup, env vars, and demo script`

## Demo Checkpoints

Ordered to protect the P0 sustainability story; the optional-features checkpoint is separate and attempted only if P0 is green.

1. **Login (with demo bypass available):** verify a supported email via live OTP and auto-assign campus by domain — or, in demo mode, sign in a pre-verified account via the dev-bypass so onboarding never blocks the demo (unsupported domains rejected).
2. **AI listing in feed:** photo → Gemini-generated editable listing (with tight-timeout manual fallback) → publish → visible in the campus-scoped feed.
3. **Reserve → chat → complete:** reserve an active listing (single-active, no funds) → realtime chat (auto-resubscribe/backfill on disconnect) → seller completes as sold/donated.
4. **Sustainability hero number updates:** completion increments per-user + per-campus carbon totals and the Dashboard **"kg CO₂e saved"** hero number ticks up.
5. **Gamification / leaderboard updates:** points/badges are awarded server-side and the campus leaderboard re-ranks.

**Optional-features checkpoint (P1, separate):** search/filter + recommendations sharpen browsing; a Need It request is posted and answered via a thread; an in-app notification delivers over Realtime and deep-links to the item. Attempt **only after** checkpoints 1–5 are green.

## Recommended Implementation Order

Build strictly P0-first in this exact order (front-load seed + demo protection, front-load the sustainability payoff, defer optional features):

1. **Supabase schema + RLS + seed data** (P0) — tables, indexes, RLS, reference seed, and the comprehensive demo seed pulled early.
2. **Demo accounts + OTP bypass** (P0) — demo-mode toggle, pre-verified accounts, and the guarded dev-bypass so the demo never depends on live signup.
3. **App shell + authentication** (P0) — domain→campus trigger, Expo scaffold, Supabase client/session, auth screens.
4. **Feed + Listing Detail** (P0) — campus-scoped browse and the detail view.
5. **AI listing generation (with Gemini fallback)** (P0) — Storage/validation, `ai-generate-listing`, explicit manual fallback, Create Listing.
6. **Reservation (+ reserve-complete)** (P0) — create/release, seller-only completion, reservation UI, profile.
7. **Messaging (minimal realtime, with Realtime fallback)** (P0) — thread + plain-text messages + Realtime + auto-resubscribe/backfill.
8. **Sustainability dashboard** (P0) — carbon aggregation in `reserve-complete` + the hero "kg CO₂e saved" number.
9. **Gamification + leaderboard** (P0) — server-authoritative points + badges + campus leaderboard + profile rewards.
10. **Optional (P1/P2)** — in-app notifications, Need It requests, search/filter, rule-based recommendations, AI carbon refine, reservation auto-expiry, keyword matching, badge animations, and hardening tests.

Within every group, do backend work (migrations/RLS/Edge Functions) before the screens that consume it.

## Estimated Implementation Timeline (48-hour hackathon)

P0 (steps 1–9) is prioritized and protected; the optional P1/P2 (step 10) is the tail. Seed + demo protection come first so the demo is safe from the start, and the sustainability + gamification payoff is protected P0 time.

| Tier / group | Focus | Rough budget |
|--------------|-------|--------------|
| P0 — Foundation (seed early) | Supabase project, schema/indexes/RLS, reference seed, **comprehensive demo seed** | ~5h |
| P0 — Demo protection | Demo-mode toggle, pre-verified accounts, OTP dev-bypass | ~2h |
| P0 — App shell + auth | domain→campus trigger, Expo scaffold, Supabase client/session, auth screens | ~5h |
| P0 — Feed + Listing Detail | Campus feed + detail view | ~4h |
| P0 — AI listing (Gemini fallback) | Storage/validation, `ai-generate-listing`, manual fallback, Create Listing | ~6h |
| P0 — Reservation (+reserve-complete) | Create/release, seller completion, reservation UI, profile | ~5h |
| P0 — Messaging (Realtime fallback) | Thread + realtime + auto-resubscribe/backfill, thread screens | ~4h |
| P0 — Sustainability dashboard | Carbon aggregation + hero "kg CO₂e saved" number | ~3h |
| P0 — Gamification + leaderboard | Points + badges (server-side) + campus leaderboard + profile rewards | ~4h |
| **P0 subtotal (steps 1–9)** | **Protected must-have demo path** | **~38h** |
| P1/P2 — Optional (step 10) | AI carbon refine, search/filter, recommendations, Need It, notifications, auto-expiry, keyword matching, badge animations, hardening tests | ~10h |
| **Total** | | **~48h** |

> **Sequencing rule:** the **P0 path (steps 1–9, ~38h) must be green** — verify (or demo-bypass) → list → browse → reserve → chat → complete → **sustainability hero number + gamification/leaderboard** — **before** investing in the P1/P2 tail. If time runs short, cut the P1/P2 tail (step 10) and optional `*` tests first; the demo-protection tasks and the sustainability + gamification payoff are non-negotiable P0. Budgets are guidance — reallocate toward whichever P0 payoff best lands the sustainability story.

## Workflow Completion

This spec workflow produces planning artifacts only — it does not implement the feature. To begin building, open `tasks.md` and click **"Start task"** next to a task item (start with Task 1.1). Tasks marked with `*` are optional test sub-tasks and will not be auto-implemented.
