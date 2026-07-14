# Implementation Plan: CampusSwap AI

## Overview

This plan is sequenced for a **48-hour hackathon** and is organized by the **P0 → P1 → P2 build order** from design §4.1. It front-loads a single, linear P0 demo path so a working end-to-end story exists *before* any differentiator is attempted:

> **P0 linear demo:** verify (campus isolation) → create AI listing (sell/donate) → browse/search feed → reserve (no payment) → coordinate via minimal realtime messaging → seller marks sold/donated → sustainability carbon dashboard updates.

Only after the P0 demo is green (Checkpoint 3) do we layer the **P1** differentiators (Need It requests, gamification points/badges/leaderboard, in-app notifications, carbon AI refinement) and finally the **P2** polish (Need It ↔ listing keyword matching, reservation auto-expiry timer, badge-earn animations).

Each top-level task is tagged with its **priority tier `[P0]` / `[P1]` / `[P2]`**.

Build order within each tier is backend-first (PocketBase collections → access rules/integrity → hooks), then the React Native screens that consume them. External services (Gemini, Resend) are proxied server-side; their keys never ship in the mobile bundle.

Stack: React Native (iOS + Android) + PocketBase (collections, API rules, JS hooks, realtime, file storage) + Gemini (server-side proxy) + Resend (OTP email).

### New in this revision (per design §1.3 / §1.6)
- `listings.status` extended to `active | reserved | sold | donated`.
- **Listing images are modeled as a related `listing_images` collection** (each image its own record referencing its parent listing, with an optional `display_order`) rather than an inline file array; **≥1 related image is required to publish** and each image is validated server-side for MIME type, size, and count.
- New collections: `need_it_requests`, `reservations` (no monetary field; partial unique index for single-active), `badges` (seeded config), `notifications` (in-app only; recipient- and campus-scoped).
- New `users` fields: `points` (default 0) and `badges` (json array) — **server-written only** via hooks.
- New hooks: `reservations.pb.js` (single-active invariant, lifecycle, seller-only completion, release/expiry), `needit.pb.js` (campus/status defaults, owner-only close), `notifications.pb.js` (create in-app notifications on key events; in-app only, no push), `gamification.pb.js` (points on completion, carbon-proportional points, idempotent badge grants) + the campus-isolated `/api/leaderboard` endpoint.
- New screens: Need It List, Create Need It, Leaderboard, Notifications; reservation UI inside Listing Detail; points/badges on Profile.

## Tasks

### P0 — Must-have for a working linear demo

- [ ] 1. [P0] PocketBase backend foundation (collections + seed data)
  - [ ] 1.1 Define P0 collection schemas
    - Create `campuses`, `domain_campus_map` (unique lowercased `domain`, relation → campuses), extended `users` auth collection (`verified_student`, `campus` relation, `display_name`, `cumulative_carbon_g`), `otp_codes` (`email` indexed, `code_hash`, `expires_at`, `consumed`, `attempts`), `listings` (seller, campus, listing_type, title, description, category, condition, price nullable, **`status` select = `active` | `reserved` | `sold` | `donated`**, carbon_savings_g, published_at), **`listing_images` (relation → listings, `image` file, optional `display_order`) — images are related records, not an inline array**, `threads` (listing, buyer, seller, campus), `messages` (thread, sender, body, created), `carbon_category_map` (unique `category`, `savings_g`), and `reservations` (listing, buyer, campus, `status` select = `active` | `released` | `completed`, `expires_at`, created — **no monetary field by design**)
    - Add a **partial unique index** on `reservations(listing)` where `status = "active"` to back the single-active-reservation invariant at the storage layer
    - _Requirements: 9.1, 9.2, 11.1, 13.3, 13.4_
  - [ ] 1.2 Seed pilot campus and reference data
    - Insert the Pune pilot `campus` record (active=true), at least one `domain_campus_map` row for the pilot institutional domain, and `carbon_category_map` rows for each supported listing category
    - _Requirements: 6.1, 11.1, 11.2_
  - [ ] 1.3 Configure listing image upload validation
    - Set PocketBase file rules on `listing_images.image`: allowed MIME types (JPEG/PNG/WebP), max file size; enforce a maximum image count per listing and a **minimum of one related `listing_image` per published listing**, validated server-side
    - _Requirements: 3.8, 9.1_

- [ ] 2. [P0] Access control and data integrity (server-enforced)
  - [ ] 2.1 Configure collection API rules
    - `listings` List/View: `@request.auth.verified_student = true && campus = @request.auth.campus && status = "active"`; Create: `@request.auth.verified_student = true && @request.data.campus = @request.auth.campus`; Update/Delete: `seller = @request.auth.id`
    - `listing_images` create/view/delete gated so the related `listing.seller = @request.auth.id` (owner-managed images)
    - `threads`/`messages` rules restrict to buyer/seller sharing the thread campus
    - `reservations` Create rule: `@request.auth.verified_student = true && @request.data.campus = @request.auth.campus && listing.campus = @request.auth.campus` (same-campus reservations only)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.6, 7.6, 11.3, 13.8_
  - [ ] 2.2 Implement listing–campus integrity hook
    - On listing create/update, reject when `listing.campus != seller.campus` (defense-in-depth beyond the create rule)
    - _Requirements: 9.3_
  - [ ]* 2.3 Write property tests for isolation and ownership
    - **Property 4: Campus isolation invariant** — **Validates: Requirements 2.2, 2.4, 4.6, 11.3**
    - **Property 5: Access restricted to verified students** — **Validates: Requirements 2.1**
    - **Property 6: Listing–campus consistency** — **Validates: Requirements 2.3, 9.1, 9.3**
    - **Property 20: Ownership-gated mutation** — **Validates: Requirements 7.6**

- [ ] 3. [P0] Onboarding backend hooks (OTP + campus assignment)
  - [ ] 3.1 Implement `request-otp` hook
    - Lowercase domain, look up `domain_campus_map`; reject absent domains with 422 "campus not supported"; generate OTP, store hash only with `expires_at` = now + 10 min, send via Resend; per-email/per-IP rate limiting; surface delivery-failure with resend option
    - _Requirements: 1.1, 1.2, 1.3, 10.1_
  - [ ] 3.2 Implement `verify-otp` hook
    - Find active OTP for email; enforce hash match, not expired, not consumed, attempts < cap (constant-time compare); on success consume code, set `verified_student = true`, assign `campus = map[domain]`, issue auth token; invalid → 401, expired → offer resend
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_
  - [ ]* 3.3 Write property tests for onboarding
    - **Property 1: Domain-gated registration** — **Validates: Requirements 1.1, 1.2**
    - **Property 2: OTP validity requires match, freshness, single use** — **Validates: Requirements 1.4, 1.5, 1.6, 1.7**
    - **Property 3: Campus assignment derives solely from the domain map** — **Validates: Requirements 1.8, 11.1**
    - **Property 21: Verified users carry a campus reference** — **Validates: Requirements 9.2**
  - [ ]* 3.4 Write example/integration tests for OTP email path
    - OTP request sends email (mock Resend), expired-OTP resend offer, single-use replay rejection
    - _Requirements: 1.3, 1.7, 10.1_

- [ ] 4. [P0] React Native app scaffold and auth wiring
  - [ ] 4.1 Scaffold app, navigation, and PocketBase auth
    - Create the RN (Expo-friendly) project per §4.4 (`app/screens`, `app/components`, `app/lib/pocketbase.ts`, `app/hooks`, `app/navigation`), navigation shell (onboarding vs. authenticated stacks), integrate PocketBase JS SDK, persist auth token, and gate authenticated routes behind `verified_student`
    - _Requirements: 2.1_

- [ ] 5. [P0] Onboarding UI
  - [ ] 5.1 Build email and OTP entry screens
    - `EmailEntry` screen (calls `request-otp`), `OtpEntry` screen (calls `verify-otp`), resend action, and error states for unsupported campus, invalid code, expired code, and delivery failure
    - _Requirements: 1.2, 1.5, 1.7, 10.1_

- [ ] 6. [P0] Checkpoint — end-to-end onboarding demo
  - Ensure all tests pass, ask the user if questions arise. (A user can now verify via institutional email and reach the authenticated app.)

- [ ] 7. [P0] AI-assisted listing creation (happy path + fallback)
  - [ ] 7.1 Implement Gemini AI proxy hook (`generate-listing`)
    - Proxy authenticated, verified-user requests with photos + optional text to Gemini; return suggested title/description/condition, and price when `listing_type = sell`; enforce 15s timeout and per-user rate limiting; Gemini API key stays in backend env only
    - _Requirements: 3.2, 3.3, 3.4, 8.3, 10.2_
  - [ ] 7.2 Build listing creation UI with publish validation
    - `CreateListing` screen: Listing_Type selection (sell/donate), image picker that uploads one or more **`listing_images` records** (with optional display order), AI-populated editable fields, progress indicator during AI call with manual-entry fallback on timeout/error; publish validation requiring title/category/condition/**≥1 related listing_image**, price required for `sell`, price omitted for `donate`; duplicate-submission guard while publish is in flight
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 3.9, 8.3, 9.1, 10.2, 10.3_
  - [ ]* 7.3 Write property tests for listing publish
    - **Property 7: Publish validation** — **Validates: Requirements 3.8, 3.9**
    - **Property 8: Donate listings omit price** — **Validates: Requirements 3.5**
    - **Property 9: Editable AI values round-trip** — **Validates: Requirements 3.6**
    - **Property 23: Duplicate-submission guard** — **Validates: Requirements 10.3**
  - [ ]* 7.4 Write integration test for AI generation (mock Gemini)
    - Verify generate-listing returns editable fields on success and that timeout/error degrades to manual entry (mock Gemini responses)
    - _Requirements: 3.2, 3.7, 10.2_

- [ ] 8. [P0] Campus feed (browse, search, recommendations)
  - [ ] 8.1 Implement feed browse
    - `Feed` screen: campus-scoped active-only feed ordered by `published_at` (most recent first), incremental/paginated loading, and empty-state message; render a **reserved-state indicator** for listings whose status is `reserved`; show each listing's primary `listing_image`
    - _Requirements: 4.1, 4.6, 8.1, 8.2, 13.5_
  - [ ] 8.2 Implement search and category filter
    - `SearchFilter` screen: search matching title/description/category and category filter, both inheriting campus + active-only scope; empty-state on no matches
    - _Requirements: 4.2, 4.3, 4.5, 4.6_
  - [ ] 8.3 Implement client-side rule-based recommendations
    - Deterministic ranking over the campus feed using category affinity and recency
    - _Requirements: 4.4_
  - [ ]* 8.4 Write property tests for feed
    - **Property 10: Feed recency ordering** — **Validates: Requirements 4.1**
    - **Property 11: Search and filter correctness** — **Validates: Requirements 4.2, 4.3, 4.6**
    - **Property 12: Rule-based recommendation ordering** — **Validates: Requirements 4.4**
    - **Property 22: Incremental (bounded) feed loading** — **Validates: Requirements 8.2**

- [ ] 9. [P0] Checkpoint — listing + browse demo
  - Ensure all tests pass, ask the user if questions arise. (A verified user can now create an AI-assisted listing and browse/search the campus feed.)

- [ ] 10. [P0] Buyer-to-seller coordination (minimal realtime messaging, no payments)
  - [ ] 10.1 Implement contact + minimal realtime messaging
    - Realtime messaging STAYS in the MVP but is intentionally **minimal** and optimized for 48-hour delivery; it exists ONLY to coordinate offline exchanges. Build `ThreadList` and `MessageThread` screens. Scope is limited to:
      - **Thread creation**: contact action that finds/creates a same-campus `thread` (buyer, seller, listing, campus) — same-campus participants only
      - **Plain text messages**: send/receive `messages` with a text `body` only
      - **Realtime subscriptions**: live send/receive via PocketBase realtime subscriptions on the thread's messages
      - **Message timestamps**: use the `created` field for delivery ordering (oldest → newest)
      - **Thread preservation**: when a listing is marked sold/donated, show a "no longer available" indication while preserving all existing message threads
      - **No-payment UI + offline guidance**: explicit no-payment UI and offline-transaction guidance
    - **Out of scope for Task 10 (do NOT implement in v1):** push notifications; typing indicators; read receipts; image sharing in messages; voice notes; presence/online status; advanced moderation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 2.4_
  - [ ]* 10.2 Write property tests for coordination
    - **Property 13: Sold/donated availability with thread preservation** — **Validates: Requirements 4.6, 5.5, 7.4**
    - **Property 14: No-payment invariant** — **Validates: Requirements 5.2**

- [ ] 11. [P0] Reservation system (no payment)
  - [ ] 11.1 Implement `reservations.pb.js` hook and completion endpoint
    - **Create hook** (single-active invariant): reject the create when the `listing.status` is not `active`, and reject when any `reservation` with `status = "active"` already references the same listing (backed by the partial unique index from 1.1); on success flip the listing to `reserved`; touch **no monetary field** (none exists)
    - **Update hook** (release/expiry): buyer or seller may set `status = "released"`; hook then flips the listing back to `active` and clears the active reservation
    - **`/api/reservations/complete` endpoint**: restrict the action to the listing's `seller`; set the listing to `sold` or `donated` and mark the reservation `completed` (this completion point later triggers gamification in Task 17.1)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.8_
  - [ ] 11.2 Build reservation UI within Listing Detail
    - `ListingDetail` screen reservation controls: **Reserve** action (buyer), **Reserved** indicator, **Release** action (buyer/seller), and **seller-complete** (mark sold/donated); reflect status transitions live
    - _Requirements: 13.1, 13.5, 13.6, 13.7_
  - [ ]* 11.3 Write property tests for reservations
    - **Property 28: Single active reservation per listing** — **Validates: Requirements 13.3**
    - **Property 29: Reservation status lifecycle validity** — **Validates: Requirements 13.1, 13.2, 13.6**
    - **Property 30: Reservation release/expiry round-trip** — **Validates: Requirements 13.7**
    - **Property 31: Reservation access control (same-campus, seller-only completion)** — **Validates: Requirements 13.8**
    - **Property 32: Reservation no-funds invariant** — **Validates: Requirements 13.4**

- [ ] 12. [P0] Profile and listings management
  - [ ] 12.1 Build profile and personal listings management
    - `Profile` screen showing assigned campus and cumulative carbon; list of the user's own listings; edit, mark sold/donated (removes from active browsing), and delete — all gated by ownership rule
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 12.2 Write property tests for profile/management
    - **Property 17: Profile lists exactly the user's own listings** — **Validates: Requirements 7.2**
    - **Property 18: Edit persistence round-trip** — **Validates: Requirements 7.3**
    - **Property 19: Deleted listings disappear from the feed** — **Validates: Requirements 7.5**

- [ ] 13. [P0] Sustainability carbon-savings dashboard
  - [ ] 13.1 Implement carbon estimate hook and aggregation (baseline)
    - In `carbon.pb.js`: on listing create, set `carbon_savings_g` = `carbon_category_map[category]` baseline (AI refinement is deferred to P1 Task 18); on completed transaction, add to seller `cumulative_carbon_g`; compute per-campus aggregate over completed listings only; keep baseline as fallback when no refined estimate exists
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
  - [ ] 13.2 Build sustainability dashboard UI
    - `SustainabilityDashboard` screen: per-user cumulative and per-campus aggregated carbon savings, all labeled as directional estimates
    - _Requirements: 6.4, 6.5, 6.6_
  - [ ]* 13.3 Write property tests for carbon
    - **Property 15: Carbon baseline and fallback** — **Validates: Requirements 6.1, 6.3**
    - **Property 16: Carbon aggregation** — **Validates: Requirements 6.4, 6.5**

- [ ] 14. [P0] Checkpoint — full P0 linear demo pass
  - Ensure all tests pass, ask the user if questions arise. **A working P0 linear demo must exist here before starting P1/P2:** verify → AI listing (sell/donate) → browse/search → reserve → message → seller marks sold/donated → carbon dashboard updates.

### P1 — Strong differentiators (land after the P0 demo is green)

- [ ] 15. [P1] P1 schema extensions (Need It, badges, gamification fields, notifications)
  - [ ] 15.1 Add P1 collections and server-only user fields
    - Create `need_it_requests` (requester, campus, title, description, category, max_budget nullable, `status` select = `open` | `fulfilled`, created) and `badges` config collection (unique `key`, `label`, `description`, `threshold_type` = `first_donation` | `carbon_kg` | `completed_count`, `threshold_value`); add `users.points` (number, default 0) and `users.badges` (json array) — **excluded from every client-updatable rule; server-written only**; seed `badges` config rows (first_donation, carbon_kg milestone, completed_count)
    - _Requirements: 12.1, 12.2, 14.1, 14.4, 14.5_
  - [ ] 15.2 Add `notifications` collection (in-app only)
    - Create `notifications` (recipient → users, campus → campuses, `event_type` select = `listing_reserved` | `new_message` | `badge_earned` | `need_it_response` | `listing_completed`, `target_type` select = `listing` | `thread` | `need_it_request`, `target_id` text, `read` bool default false, created); List/View rule `recipient = @request.auth.id && campus = @request.auth.campus` (ordered created desc); Update rule limited to the recipient toggling `read = true`; create is **server-only**. **No push transport/field exists** (in-app only)
    - _Requirements: 15.6, 15.7, 15.8, 15.10_

- [ ] 16. [P1] Need It requests
  - [ ] 16.1 Implement `needit.pb.js` hook and API rules
    - List/View rule: `@request.auth.verified_student = true && campus = @request.auth.campus && status = "open"`; Create rule: `@request.auth.verified_student = true && @request.data.campus = @request.auth.campus`; Update/Delete rule: `requester = @request.auth.id`; create hook pins `campus` to the requester's campus and defaults `status = "open"`; update hook restricts owner changes to the `status → fulfilled` transition (owner-only close)
    - _Requirements: 12.2, 12.3, 12.4, 12.6, 12.7_
  - [ ] 16.2 Build Need It screens + respond via reused messaging thread
    - `NeedItList` screen (campus-scoped, `open`-only browse), `CreateNeedIt` screen (title/description/category + optional budget); a **Respond** action reuses the existing messaging thread flow (Task 10.1) to open a same-campus thread between responder and requester
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [ ]* 16.3 Write property tests for Need It
    - **Property 24: Need It creation validity and campus/status defaults** — **Validates: Requirements 12.1, 12.2**
    - **Property 25: Need It browse isolation (same-campus, open-only)** — **Validates: Requirements 12.3, 12.4**
    - **Property 26: Need It owner-only closure round-trip** — **Validates: Requirements 12.6, 12.7**

- [ ] 17. [P1] Gamification (points, badges, leaderboard)
  - [ ] 17.1 Implement `gamification.pb.js` award hook
    - Wire into reservation completion (Task 11.1 completion point): server-side increase `users.points` on completed sale/donation, add carbon-proportional points as `cumulative_carbon_g` rises, and grant badges by evaluating each seeded badge's `threshold_type`/`threshold_value` against the student's stats; badge grants are **idempotent** (append a key only if absent); all writes happen server-side only
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [ ] 17.2 Implement `/api/leaderboard` endpoint (campus-isolated)
    - Filter strictly by `@request.auth.campus`; order non-increasingly by `points` (or `cumulative_carbon_g`); never return cross-campus entries
    - _Requirements: 14.6, 14.7_
  - [ ] 17.3 Build Leaderboard screen + Profile points/badges display
    - `Leaderboard` screen consuming `/api/leaderboard`; extend `Profile` to display the student's `points` and granted `badges`
    - _Requirements: 14.6, 14.7, 14.8_
  - [ ]* 17.4 Write property tests for gamification
    - **Property 33: Points monotonic non-decrease on completion** — **Validates: Requirements 14.2, 14.3**
    - **Property 34: Badge threshold monotonicity** — **Validates: Requirements 14.4, 14.5**
    - **Property 35: Leaderboard ordering and campus isolation** — **Validates: Requirements 14.6, 14.7**

- [ ] 18. [P1] In-app notifications
  - [ ] 18.1 Implement `notifications.pb.js` event hooks (in-app only)
    - Create in-app `notifications` records server-side on each key event: listing reserved → notify seller (`listing_reserved`, target listing); message delivered → notify the other thread participant(s) (`new_message`, target thread); badge granted → notify student (`badge_earned`); Need It response → notify requester (`need_it_response`, target need_it_request); reserved listing marked sold/donated → notify buyer (`listing_completed`, target listing). Wire into the reservation (Task 11.1), messaging (Task 10.1), gamification (Task 17.1), and Need It respond (Task 16.2) flows. **No push transport** is invoked
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.10_
  - [ ] 18.2 Build Notifications screen + mark-read + deep-linking
    - `Notifications` screen: recipient-scoped, most-recent-first list with realtime subscription on the user's own notifications; mark-as-read action; tapping a notification deep-links to its target (listing / thread / need_it_request); add a header entry point/badge
    - _Requirements: 15.6, 15.7, 15.8, 15.9_
  - [ ]* 18.3 Write property/example tests for notifications
    - **Property 36: Notification event coverage** — **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
    - **Property 37: Notification recipient and campus isolation** — **Validates: Requirements 15.6**
    - **Property 38: Notification recency ordering** — **Validates: Requirements 15.7**
    - **Property 39: Notification mark-read round-trip** — **Validates: Requirements 15.8**
    - **Property 40: Notification deep-link target integrity** — **Validates: Requirements 15.9**
    - **Property 41: Notifications are in-app only** — **Validates: Requirements 15.10**

- [ ] 19. [P1] Carbon AI refinement
  - [ ] 19.1 Extend `carbon.pb.js` with optional Gemini refinement
    - When the AI service is available, refine the carbon-savings estimate via Gemini; when it does not return an estimate, keep the `carbon_category_map` baseline (clean fallback to P0 behavior)
    - _Requirements: 6.2, 6.3_

### P2 — Nice-to-have / stretch polish

- [ ] 20. [P2] Need It → listing keyword matching
  - [ ] 20.1 Surface matching active listings for a Need It request
    - When keyword matching is enabled, surface existing **active**, **same-campus** listings whose title/description/category match the request keywords (within the Need It flow)
    - _Requirements: 12.8_
  - [ ]* 20.2 Write property test for keyword matching
    - **Property 27: Need It keyword-match relevance (optional feature)** — **Validates: Requirements 12.8**

- [ ] 21. [P2] Reservation auto-expiry background timer
  - [ ] 21.1 Implement scheduled auto-release at `expires_at`
    - Add a background job in `reservations.pb.js` that, when a reservation's `expires_at` elapses, auto-releases it: listing → `active`, active reservation cleared (manual release from Task 11.1 already covers the demo; this automates it). Behavior is validated by the existing Property 30 (Task 11.3)
    - _Requirements: 13.7_

- [ ] 22. [P2] Badge-earn animations
  - [ ] 22.1 Add badge-earn celebration animation
    - When a new badge is granted, play a celebration animation on the Profile/badge UI (static badges from Task 17.3 already suffice for the demo)
    - _Requirements: 14.4_

## Notes

- **Priority tiers:** every top-level task is tagged `[P0]` / `[P1]` / `[P2]`. Complete **all P0** (Tasks 1–14) and land the Checkpoint 3 linear demo before starting P1; then P1 (Tasks 15–19); then P2 polish (Tasks 20–22).
- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP, but they encode the design's correctness properties (P1–P41) and are recommended before the demo.
- **Sequencing rationale:** Tasks 1–6 produce the earliest demoable slice (onboarding); Tasks 7–9 deliver the core listing + browse loop; Tasks 10–13 add coordination, reservation, profile, and the sustainability dashboard — completing the P0 linear demo at Checkpoint 3 (Task 14). P1/P2 build strictly on top.
- **Listing images are a related collection:** photos live in `listing_images` (one record per image, optional `display_order`), not an inline array on `listings`. At least one related image is required to publish and each image is validated server-side (MIME/size/count). User-facing behavior is unchanged — this is a data-model refinement.
- Task 10 keeps realtime messaging in the MVP but deliberately simplifies it: thread creation, plain-text messages, realtime subscriptions, `created` timestamps/ordering, thread preservation after sold/donated, and the no-payment UI + offline guidance only. It explicitly excludes push notifications, typing indicators, read receipts, in-message image sharing, voice notes, presence/online status, and advanced moderation (deferred to Roadmap Phase 1).
- **In-app notifications only:** notifications (Task 18) are created server-side on key events and delivered in-app; **push notifications remain out of scope** for v1. Notification reads are recipient- and campus-scoped, and only the recipient may toggle `read`.
- **No funds anywhere in reservations:** the `reservations` collection has no monetary field and no reservation hook touches money (Property 32) — reservations are a pickup-intent signal only.
- **Server-authoritative gamification:** `users.points` and `users.badges` are never client-writable; they are mutated only inside the completion hook (Task 17.1), and the leaderboard is campus-isolated (Task 17.2).
- The Gemini API key is never shipped in the client; all AI calls go through the server-side proxy hooks (Tasks 7.1, 19.1) with timeout + fallback.
- Campus isolation and ownership are enforced server-side (Task 2) — the client cannot bypass them.
- Each task references specific requirement sub-clauses and, where applicable, the design's correctness properties for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "7.1"] },
    { "id": 3, "tasks": ["5.1", "2.3", "3.3", "3.4"] },
    { "id": 4, "tasks": ["7.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "7.3"] },
    { "id": 6, "tasks": ["10.1", "11.1", "7.4", "8.4"] },
    { "id": 7, "tasks": ["11.2", "12.1", "10.2"] },
    { "id": 8, "tasks": ["13.1", "11.3", "12.2"] },
    { "id": 9, "tasks": ["13.2", "13.3"] },
    { "id": 10, "tasks": ["15.1", "15.2"] },
    { "id": 11, "tasks": ["16.1", "17.1", "19.1"] },
    { "id": 12, "tasks": ["16.2", "17.2", "18.1"] },
    { "id": 13, "tasks": ["17.3", "16.3", "18.2"] },
    { "id": 14, "tasks": ["17.4", "18.3"] },
    { "id": 15, "tasks": ["20.1", "21.1", "22.1"] },
    { "id": 16, "tasks": ["20.2"] }
  ]
}
```
