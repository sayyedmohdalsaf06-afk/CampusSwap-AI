# Requirements Document

## Introduction

CampusSwap AI is an AI-powered, campus-verified peer-to-peer marketplace that enables verified university students to sell and donate second-hand goods (books, electronics, furniture, hostel essentials, cycles) within their own university community. The product is built on four pillars: (1) trust established through institutional-email verification and a campus-scoped feed, (2) AI-assisted listing automation, (3) sustainability visualization through carbon-savings estimates, and (4) a foundation for future university partnerships.

This document specifies requirements for the version 1 (v1) hackathon MVP, deliverable within a 48-hour window and demonstrable on a single pilot campus while remaining architecturally ready for multiple campuses. The application is a React Native (Expo) mobile app (iOS and Android) backed by Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Supabase Realtime, and Edge Functions), with campus isolation and ownership enforced through PostgreSQL Row Level Security (RLS) policies. AI features use Gemini 2.5 Flash invoked exclusively server-side via Supabase Edge Functions, and transactional email is delivered through Resend.

The architecture is intentionally optimized for both 48-hour hackathon execution and startup-grade scalability. Because Supabase and PostgreSQL scale horizontally and RLS combined with appropriate indexes enforces isolation efficiently, the same design supports multi-campus expansion to hundreds of thousands of users without a redesign. Onboarding an additional campus is a configuration change (adding email domains) rather than a code change.

CampusSwap AI is facilitate-only: the application connects buyers and sellers and enables coordination but does not process, hold, or route any funds. All transactions occur offline.

### In Scope (v1)
- Institutional-email OTP onboarding (via Supabase Auth email OTP) and campus scoping
- Creating listings for selling or donating, with AI-assisted title/description generation, condition estimation, and price suggestion
- Browsing and searching a campus-only feed with rule-based recommendations
- Buyer-to-seller coordination via in-app contact reveal and minimal realtime messaging (thread creation, plain-text messages, Supabase Realtime subscriptions, timestamps; no payments)
- Sustainability carbon-savings visualization at individual and campus levels
- User profile and personal listings management
- "Need It" requests: campus-scoped posts where a Verified_Student describes an item they want and other students can respond with a matching offer
- Reservation system: no-payment reservation of an active Listing to signal pickup intent, with a single active reservation per Listing and seller-confirmed completion or release/expiry
- Gamification: points and badges for sustainable participation (completed sales/donations and accumulated carbon savings), plus a campus-scoped leaderboard and profile display
- In-app notifications: per-user, campus-consistent notifications for key events (reservation of a listing, new message in a participated thread, badge earned, response to a Need It request, and a reserved item marked sold/donated), with mark-as-read and deep-linking to the relevant item

### Out of Scope (Future)
The following capabilities are explicitly deferred and MUST NOT be implemented in v1:
- Swap/trade transactions
- Any in-app payments, escrow, or fund holding (including for reservations)
- Student-ID verification and admin allowlist verification
- AI-based recommendations (v1 recommendations remain rule-based)
- Monetization features (university sustainability SaaS dashboards, featured listings, sponsorships)
- Push notifications (v1 notifications are in-app only)
- Extended messaging features: read receipts, typing indicators, voice notes, image sharing, and presence status

## Glossary

- **CampusSwap**: The overall CampusSwap AI mobile application (React Native / Expo) and its Supabase backend services.
- **Onboarding_Service**: The component responsible for account registration, institutional-email verification, and campus assignment, implemented via Supabase Auth (email OTP) together with a domain-to-campus mapping table and Edge Function logic where server-side verification is needed.
- **Institutional_Email**: An email address whose domain is registered in the Domain_Campus_Map (e.g., `student@university.edu`).
- **OTP**: A one-time passcode delivered by email (via Supabase Auth and Resend) for verifying ownership of an Institutional_Email.
- **Campus**: A university community, identified by one or more email domains via the Domain_Campus_Map.
- **Domain_Campus_Map**: A PostgreSQL table mapping email domains to Campus records, used to gate registration and assign a Campus.
- **Verified_Student**: A user who has completed Institutional_Email OTP verification and been assigned to a Campus.
- **Listing_Service**: The component responsible for creating, editing, publishing, and managing listings, backed by PostgreSQL tables and Edge Functions.
- **Listing**: A record describing an item offered for sale or donation, including its related Listing_Images, title, description, category, condition, price (for sale listings), and status.
- **Listing_Image**: An image record related to a Listing, stored as a row in the `listing_images` PostgreSQL table with a foreign key to its parent Listing, a reference to the underlying image object in Supabase Storage, and an optional display order. Each Listing has one or more related Listing_Image rows.
- **Listing_Type**: The classification of a Listing as either `sell` or `donate`.
- **AI_Service**: The server-side component that integrates with Gemini 2.5 Flash via Supabase Edge Functions to generate listing content, estimate condition, suggest price, and estimate carbon savings; AI credentials are never exposed to the client.
- **Feed_Service**: The component that provides the campus-scoped browsing, search, and recommendation experience.
- **Recommendation_Engine**: The rule-based component that ranks or suggests listings within a Campus.
- **Coordination_Service**: The component that enables buyer-to-seller contact reveal and in-app messaging, using Supabase Realtime for live updates.
- **Sustainability_Service**: The component that calculates and displays carbon-savings estimates.
- **Carbon_Category_Map**: A predefined mapping of item categories to directional carbon-savings values.
- **Profile_Service**: The component that manages user profiles and personal listings management.
- **Seller**: A Verified_Student who publishes a Listing.
- **Buyer**: A Verified_Student who views or expresses interest in a Listing.
- **NeedIt_Service**: The component responsible for creating, browsing, responding to, and closing Need It requests.
- **NeedIt_Request**: A campus-scoped record describing an item a Verified_Student wants, including title, description, category, optional maximum budget, requester reference, Campus reference, and status.
- **Requester**: A Verified_Student who creates a NeedIt_Request.
- **Reservation_Service**: The component responsible for creating, releasing, expiring, and completing reservations on Listings.
- **Reservation**: A no-payment record signaling a Buyer's intent to pick up a specific active Listing, including the Buyer reference, the Listing reference, and a reservation state.
- **Listing_Status**: The lifecycle state of a Listing, one of `active`, `reserved`, `sold`, or `donated`.
- **Gamification_Service**: The component responsible for awarding Points, granting Badges, and computing the Leaderboard.
- **Points**: A numeric score attributed to a Verified_Student for sustainable participation actions such as completed transactions and accumulated carbon savings.
- **Badge**: An achievement granted to a Verified_Student when a defined threshold is reached (for example, first donation, a carbon-savings milestone, or a completed-transaction count).
- **Leaderboard**: A campus-scoped ranking of Verified_Students by Points or by carbon savings.
- **Notification_Service**: The component responsible for creating, delivering, ordering, marking as read, and deep-linking in-app notifications for a Verified_Student.
- **Notification**: A per-user, in-app record informing a Verified_Student of a key event, including the recipient reference, the event type, a read state, a creation timestamp, and a deep-link reference to the related item (a Listing, message thread, or NeedIt_Request).
- **RLS_Policy**: A PostgreSQL Row Level Security policy that constrains which rows a Verified_Student may read or write, used to enforce campus isolation and record ownership at the database layer.
- **Edge_Function**: A Supabase Edge Function providing server-side logic (for example, AI invocation via Gemini 2.5 Flash and OTP/verification handling), keeping secrets and privileged operations off the client.
- **Supabase_Storage**: The Supabase object storage service that holds uploaded image objects referenced by Listing_Image rows.
- **Realtime_Channel**: A Supabase Realtime channel (backed by PostgreSQL change events) used to push live message and status updates to subscribed participants.

## Requirements

### Requirement 1: Institutional-Email OTP Onboarding

**User Story:** As a prospective student user, I want to register and verify my identity using my institutional email, so that I can access a trusted, campus-verified marketplace.

#### Acceptance Criteria

1. WHEN a prospective user submits an email address for registration, THE Onboarding_Service SHALL verify that the email domain exists in the Domain_Campus_Map.
2. IF the submitted email domain is absent from the Domain_Campus_Map, THEN THE Onboarding_Service SHALL reject the registration and return a message indicating the campus is not supported.
3. WHEN a submitted email domain is present in the Domain_Campus_Map, THE Onboarding_Service SHALL initiate a Supabase Auth email OTP and request delivery of the OTP to the submitted email through Resend.
4. WHEN a user submits an OTP that matches the active OTP for the submitted email, THE Onboarding_Service SHALL mark the user as a Verified_Student.
5. IF a user submits an OTP that does not match the active OTP, THEN THE Onboarding_Service SHALL reject the verification attempt and return an invalid-code message.
6. THE Onboarding_Service SHALL expire each OTP within 10 minutes of generation.
7. IF a user submits an expired OTP, THEN THE Onboarding_Service SHALL reject the verification attempt and offer to resend a new OTP.
8. THE Onboarding_Service SHALL treat each OTP as single-use and invalidate an OTP once it has been successfully verified.
9. WHEN a user is marked as a Verified_Student, THE Onboarding_Service SHALL assign the user to the Campus mapped to the user's email domain in the Domain_Campus_Map.

### Requirement 2: Campus Scoping and Access Control

**User Story:** As a Verified_Student, I want to only see and interact with content from my own campus, so that I can trust that transactions stay within my university community.

#### Acceptance Criteria

1. WHERE a user is not a Verified_Student, THE CampusSwap SHALL restrict access to browsing, listing creation, and coordination features.
2. THE Feed_Service SHALL return only Listings that belong to the requesting Verified_Student's assigned Campus, enforced by RLS_Policy on the underlying PostgreSQL tables.
3. WHEN a Verified_Student creates a Listing, THE Listing_Service SHALL associate the Listing with the Verified_Student's assigned Campus.
4. THE Coordination_Service SHALL permit contact and messaging only between Verified_Students assigned to the same Campus, enforced by RLS_Policy at the database layer.

### Requirement 3: Listing Creation with AI Assistance

**User Story:** As a Seller, I want AI to help me create a listing from my photos and minimal input, so that I can publish a quality listing quickly.

#### Acceptance Criteria

1. WHEN a Seller starts a new Listing, THE Listing_Service SHALL require the Seller to select a Listing_Type of either `sell` or `donate`.
2. WHEN a Seller provides one or more item photos and optional text input, THE AI_Service SHALL generate a suggested title and description for the Listing using Gemini 2.5 Flash invoked through a Supabase Edge Function.
3. WHEN the AI_Service generates listing content, THE AI_Service SHALL produce a suggested condition estimate for the item.
4. WHERE the Listing_Type is `sell`, THE AI_Service SHALL produce a suggested price for the item.
5. WHERE the Listing_Type is `donate`, THE Listing_Service SHALL omit the price field from the Listing.
6. THE Listing_Service SHALL allow the Seller to edit any AI-generated title, description, condition, and price value before publishing.
7. IF the AI_Service fails to return a result within 15 seconds or returns an error, THEN THE Listing_Service SHALL allow the Seller to enter title, description, condition, and price manually and continue publishing.
8. WHEN a Seller publishes a Listing, THE Listing_Service SHALL require a title, a category, a condition, and at least one image uploaded to Supabase_Storage and recorded as a related Listing_Image row in the `listing_images` table, and SHALL validate each submitted image server-side for MIME type, size, and count.
9. IF a Seller attempts to publish a `sell` Listing without a price, THEN THE Listing_Service SHALL reject the publish action and prompt for a price.

### Requirement 4: Campus Feed Browsing, Search, and Recommendations

**User Story:** As a Buyer, I want to browse, search, and receive relevant suggestions within my campus feed, so that I can find items I need.

#### Acceptance Criteria

1. WHEN a Verified_Student opens the feed, THE Feed_Service SHALL display active Listings from the Verified_Student's assigned Campus ordered with the most recently published Listings first.
2. WHEN a Verified_Student submits a search query, THE Feed_Service SHALL return Campus Listings whose title, description, or category match the query.
3. WHEN a Verified_Student applies a category filter, THE Feed_Service SHALL return only Campus Listings in the selected category.
4. THE Recommendation_Engine SHALL rank recommended Listings using rule-based criteria including category and recency.
5. IF no Listings match a search query or filter, THEN THE Feed_Service SHALL display an empty-state message.
6. THE Feed_Service SHALL exclude Listings with a status other than active from browsing and search results.

### Requirement 5: Buyer-to-Seller Coordination With Minimal Realtime Messaging

**User Story:** As a Buyer, I want to contact the seller directly through the app using minimal realtime messaging, so that I can arrange an offline exchange without any in-app payment.

#### Acceptance Criteria

1. WHEN a Buyer selects the contact action on a Listing, THE Coordination_Service SHALL initiate an in-app message thread between the Buyer and the Seller of that Listing.
2. THE CampusSwap SHALL NOT provide any in-app payment, escrow, or fund-holding capability.
3. THE Coordination_Service SHALL display guidance that all transactions occur offline between the Buyer and the Seller.
4. WHEN a Buyer or Seller sends a plain-text message in a thread, THE Coordination_Service SHALL deliver the message to the other participant within the same Campus.
5. WHEN a message is delivered to a thread, THE Coordination_Service SHALL update subscribed participants in realtime through a Supabase Realtime_Channel.
6. WHEN a message is created, THE Coordination_Service SHALL store and display a timestamp for the message.
7. THE Coordination_Service SHALL limit message content to plain text only.
8. THE Coordination_Service SHALL exclude push notifications, read receipts, typing indicators, voice notes, image sharing, and presence status from message threads.
9. WHERE a Listing has been marked as sold or donated, THE Coordination_Service SHALL indicate the Listing is no longer available while preserving existing message threads.

### Requirement 6: Sustainability Carbon-Savings Visualization

**User Story:** As a Verified_Student, I want to see the environmental impact of reusing items, so that I understand the sustainability benefit of buying and selling second-hand.

#### Acceptance Criteria

1. WHEN a Listing is created, THE Sustainability_Service SHALL calculate a directional carbon-savings estimate using the Carbon_Category_Map for the Listing's category.
2. WHERE the AI_Service is available, THE AI_Service MAY refine the carbon-savings estimate for a Listing using Gemini 2.5 Flash via a Supabase Edge Function.
3. IF the AI_Service does not return a carbon-savings estimate, THEN THE Sustainability_Service SHALL use the Carbon_Category_Map value as the carbon-savings estimate.
4. WHEN a Verified_Student views their profile, THE Sustainability_Service SHALL display the cumulative carbon savings attributed to that Verified_Student's completed transactions.
5. THE Sustainability_Service SHALL display an aggregated carbon-savings total for the Verified_Student's assigned Campus.
6. THE Sustainability_Service SHALL label carbon-savings values as directional estimates.

### Requirement 7: Profile and Listings Management

**User Story:** As a Verified_Student, I want to manage my profile and my listings, so that I can keep my marketplace presence accurate.

#### Acceptance Criteria

1. WHEN a Verified_Student opens their profile, THE Profile_Service SHALL display the Verified_Student's assigned Campus and cumulative carbon savings.
2. THE Profile_Service SHALL display a list of all Listings created by the Verified_Student.
3. WHEN a Seller edits one of their own Listings, THE Listing_Service SHALL save the updated Listing values.
4. WHEN a Seller marks one of their own Listings as sold or donated, THE Listing_Service SHALL update the Listing status and remove the Listing from active browsing results.
5. WHEN a Seller deletes one of their own Listings, THE Listing_Service SHALL remove the Listing from the feed.
6. IF a user attempts to edit or delete a Listing they do not own, THEN THE Listing_Service SHALL reject the action, enforced by RLS_Policy on the Listing table.

## Non-Functional Requirements

### Requirement 8: Performance and Mobile Experience

**User Story:** As a Verified_Student, I want the app to respond promptly, so that browsing and listing feel smooth during a demo.

#### Acceptance Criteria

1. WHEN a Verified_Student opens the feed, THE Feed_Service SHALL render the initial set of Listings within 2 seconds on the pilot-campus dataset.
2. WHEN a Verified_Student scrolls the feed, THE CampusSwap SHALL load additional Listings incrementally rather than loading all Listings at once.
3. WHEN a Verified_Student requests AI-generated listing content, THE CampusSwap SHALL display a progress indicator until the AI_Service responds or the 15-second timeout elapses.

### Requirement 9: Data Model Integrity

**User Story:** As the system operator, I want the data model to enforce campus and ownership boundaries, so that the marketplace remains trustworthy.

#### Acceptance Criteria

1. THE CampusSwap SHALL persist each Listing in a PostgreSQL table with foreign-key references to its Seller and its Campus, and SHALL persist each Listing's images as related Listing_Image rows in the `listing_images` table, each with a foreign key to its parent Listing and a reference to its object in Supabase_Storage.
2. THE CampusSwap SHALL persist each user with a Verified_Student status flag and an assigned Campus reference.
3. IF a data operation would associate a Listing with a Campus different from its Seller's assigned Campus, THEN THE Listing_Service SHALL reject the operation, enforced by RLS_Policy and referential constraints in PostgreSQL.

### Requirement 10: External Service Resilience

**User Story:** As a Verified_Student, I want the app to remain usable when external services fail, so that I can still complete core actions during a demo.

#### Acceptance Criteria

1. IF Resend fails to deliver an OTP, THEN THE Onboarding_Service SHALL allow the user to request a resend and display a delivery-failure message.
2. IF Gemini 2.5 Flash is unavailable or the AI Edge_Function returns an error, THEN THE AI_Service SHALL degrade to manual entry for listing content and to Carbon_Category_Map values for carbon savings.
3. WHILE an external service call is in progress, THE CampusSwap SHALL prevent duplicate submission of the same request.

### Requirement 11: Multi-Campus-Ready, Single-Campus Pilot

**User Story:** As the system operator, I want the architecture to support multiple campuses while piloting on one, so that expansion requires configuration rather than redesign.

#### Acceptance Criteria

1. THE CampusSwap SHALL determine Campus assignment exclusively through the Domain_Campus_Map.
2. WHERE additional email domains are added to the Domain_Campus_Map, THE CampusSwap SHALL support the corresponding additional Campuses without code changes to campus scoping logic.
3. THE Feed_Service SHALL isolate Listings, search results, and recommendations per Campus through RLS_Policy so that no cross-campus content is returned.

## Additional Functional Requirements

### Requirement 12: Need It Requests

**User Story:** As a Verified_Student, I want to post a request describing an item I want and receive offers from other students, so that I can source items that are not currently listed.

#### Acceptance Criteria

1. WHEN a Verified_Student submits a NeedIt_Request, THE NeedIt_Service SHALL require a title, a description, and a category, and SHALL accept an optional maximum budget.
2. WHEN a Verified_Student creates a NeedIt_Request, THE NeedIt_Service SHALL associate the NeedIt_Request with the Verified_Student's assigned Campus and set the NeedIt_Request status to `open`.
3. WHEN a Verified_Student browses Need It requests, THE NeedIt_Service SHALL return only NeedIt_Requests that belong to the requesting Verified_Student's assigned Campus.
4. THE NeedIt_Service SHALL return only NeedIt_Requests whose status is `open` in campus browsing results.
5. WHEN a Verified_Student on the same Campus responds to a NeedIt_Request, THE Coordination_Service SHALL initiate an in-app message thread between the responding Verified_Student and the Requester.
6. WHEN a Requester closes or fulfills their own NeedIt_Request, THE NeedIt_Service SHALL update the NeedIt_Request status to `fulfilled` and exclude the NeedIt_Request from campus browsing results.
7. IF a Verified_Student attempts to close a NeedIt_Request they do not own, THEN THE NeedIt_Service SHALL reject the action, enforced by RLS_Policy on the NeedIt_Request table.
8. WHERE keyword matching is enabled, THE NeedIt_Service MAY surface existing active Listings on the same Campus whose title, description, or category match the NeedIt_Request keywords.

### Requirement 13: No-Payment Reservation System

**User Story:** As a Buyer, I want to reserve an active listing to signal my intent to pick it up, so that the seller holds the item for me without any payment.

#### Acceptance Criteria

1. WHEN a Buyer reserves an active Listing, THE Reservation_Service SHALL create a Reservation and set the Listing_Status to `reserved`.
2. IF a Buyer attempts to reserve a Listing whose Listing_Status is not `active`, THEN THE Reservation_Service SHALL reject the reservation.
3. THE Reservation_Service SHALL permit at most one active Reservation per Listing at a time.
4. THE Reservation_Service SHALL NOT process, hold, or route any funds when creating or completing a Reservation.
5. WHEN a Listing is reserved, THE Feed_Service SHALL indicate the reserved state of the Listing.
6. WHEN a Seller confirms completion of a reserved Listing as sold or donated, THE Reservation_Service SHALL set the Listing_Status to `sold` or `donated` accordingly and close the Reservation.
7. WHEN a Reservation is released or expires after its reservation timeout elapses, THE Reservation_Service SHALL set the Listing_Status back to `active` and clear the Reservation.
8. THE Reservation_Service SHALL permit reservation actions only between Verified_Students assigned to the same Campus as the Listing, and SHALL restrict completion of a Reservation to the Listing's Seller.

### Requirement 14: Gamification for Sustainable Participation

**User Story:** As a Verified_Student, I want to earn points and badges for reuse and donation activity, so that I am rewarded for contributing to campus sustainability.

#### Acceptance Criteria

1. THE Gamification_Service SHALL persist a Points score for each Verified_Student.
2. WHEN a Verified_Student completes a sale or donation, THE Gamification_Service SHALL increase the Verified_Student's Points score.
3. WHEN a Verified_Student's cumulative carbon savings increases, THE Gamification_Service SHALL increase the Verified_Student's Points score in proportion to the carbon savings.
4. WHEN a Verified_Student reaches a defined Badge threshold, THE Gamification_Service SHALL grant the corresponding Badge to the Verified_Student.
5. THE Gamification_Service SHALL support Badge thresholds for at least a first donation, a carbon-savings milestone measured in kg CO2e, and a completed-transaction count.
6. WHEN a Verified_Student views the Leaderboard, THE Gamification_Service SHALL return a ranking of Verified_Students from the requesting Verified_Student's assigned Campus ordered by Points or by carbon savings.
7. THE Gamification_Service SHALL isolate each Leaderboard per Campus through RLS_Policy so that no cross-campus ranking is returned.
8. WHEN a Verified_Student views their profile, THE Profile_Service SHALL display the Verified_Student's Points score and granted Badges.

### Requirement 15: In-App Notifications

**User Story:** As a Verified_Student, I want to receive in-app notifications for key events, so that I can stay informed and quickly return to the relevant item without leaving the app.

#### Acceptance Criteria

1. WHEN a Buyer reserves a Verified_Student's Listing, THE Notification_Service SHALL create an in-app Notification for the Listing's Seller referencing the reserved Listing.
2. WHEN a message is delivered to a thread, THE Notification_Service SHALL create an in-app Notification for each other Verified_Student participating in that thread referencing the message thread.
3. WHEN the Gamification_Service grants a Badge to a Verified_Student, THE Notification_Service SHALL create an in-app Notification for that Verified_Student referencing the granted Badge.
4. WHEN a Verified_Student responds to a NeedIt_Request, THE Notification_Service SHALL create an in-app Notification for the Requester referencing the NeedIt_Request.
5. WHEN a Seller marks a reserved Listing as sold or donated, THE Notification_Service SHALL create an in-app Notification for the Buyer who reserved the Listing referencing the Listing.
6. THE Notification_Service SHALL deliver to each Verified_Student only Notifications addressed to that Verified_Student within the Verified_Student's assigned Campus, enforced by RLS_Policy on the Notification table.
7. WHEN a Verified_Student views their Notifications, THE Notification_Service SHALL return the Verified_Student's Notifications ordered with the most recently created Notification first.
8. WHEN a Verified_Student marks a Notification as read, THE Notification_Service SHALL update the Notification's read state to read.
9. WHEN a Verified_Student selects a Notification, THE Notification_Service SHALL deep-link the Verified_Student to the related item referenced by the Notification, being a Listing, a message thread, or a NeedIt_Request.
10. THE Notification_Service SHALL exclude push notifications and deliver Notifications only within the CampusSwap application, using Supabase Realtime for live delivery.

### Requirement 16: Scalability and Multi-Campus Growth

**User Story:** As the system operator, I want the architecture to scale from a single-campus hackathon pilot to hundreds of thousands of users across many campuses, so that the same design supports startup growth without a re-platforming.

#### Acceptance Criteria

1. THE CampusSwap SHALL enforce campus isolation and record ownership through RLS_Policy on every multi-tenant PostgreSQL table so that isolation guarantees hold regardless of the number of Campuses or Verified_Students.
2. THE CampusSwap SHALL define database indexes on the Campus reference and on frequently queried columns for Listings, NeedIt_Requests, messages, and Notifications so that campus-scoped queries remain performant as row counts grow.
3. WHERE a new Campus is added by inserting its email domains into the Domain_Campus_Map, THE CampusSwap SHALL onboard the Campus through configuration data alone without changes to campus scoping code.
4. THE CampusSwap SHALL invoke Gemini 2.5 Flash only through Supabase Edge Functions so that AI credentials remain server-side as usage scales across Campuses.
5. WHEN campus-scoped data volume increases, THE Feed_Service SHALL return results using paginated, index-backed queries rather than full-table scans.
