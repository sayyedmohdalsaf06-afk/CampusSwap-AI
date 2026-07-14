-- CampusSwap AI — Task 1.2 (database foundation), File 3 of 3
-- Indexes. See design.md §1.3.4 "Indexes".
-- No RLS here (RLS is Task 1.4).
-- Note: domain_campus_map(domain) uniqueness is already covered by the UNIQUE
-- constraint in File 2, so no duplicate index is created here.

-- Primary campus feed: active, most-recent-first within a campus (Req 4.1, 16.5).
create index if not exists idx_listings_campus_status_published
  on listings (campus_id, status, published_at desc);

-- Category filter within a campus.
create index if not exists idx_listings_campus_category
  on listings (campus_id, category);

-- Fetch a listing's images.
create index if not exists idx_listing_images_listing
  on listing_images (listing_id);

-- Ordered message history per thread.
create index if not exists idx_messages_thread_created
  on messages (thread_id, created_at);

-- Campus scope + a participant's thread list.
create index if not exists idx_threads_campus on threads (campus_id);
create index if not exists idx_threads_buyer  on threads (buyer_id);
create index if not exists idx_threads_seller on threads (seller_id);

-- Campus-scoped, open-only Need It browse.
create index if not exists idx_need_it_requests_campus_status
  on need_it_requests (campus_id, status);

-- Look up a listing's reservations.
create index if not exists idx_reservations_listing
  on reservations (listing_id);

-- Single-active-reservation-per-listing invariant (Req 13.3): DB-level enforcement.
create unique index if not exists uq_reservations_active_per_listing
  on reservations (listing_id)
  where status = 'active';

-- Recipient's notifications, most-recent-first.
create index if not exists idx_notifications_recipient_created
  on notifications (recipient_id, created_at desc);

-- Campus roster / leaderboard scans.
create index if not exists idx_profiles_campus on profiles (campus_id);
