# Mobile/Data Audit Notes

## Mobile-first pass findings

### Home
- Hero already uses stacked CTA layout on small screens, but several sections need tighter text rhythm and safer card widths.
- The right-side hero composition mixes tall imagery with side cards; this should be validated for narrower breakpoints and likely simplified with stronger stacking.

### Dashboard
- Multiple `grid-cols-12` + `md:col-span-*` sections are acceptable, but some header rows and CTA cards rely on horizontal balance that can feel dense on narrow viewports.
- The AI block contains a `md:min-w-[300px]` panel that is safe on mobile but should still be visually rebalanced.

### Product Tracker
- This page is still mostly demo-driven and has several dense information sections.
- It is the most important candidate for simultaneous mobile cleanup and real-data migration.
- Existing arrays cover composition, monthly output, deliveries, and origin steps; these should move to server procedures backed by database tables.

### Club Feed
- Feed cards are visually strong, but current content is entirely static.
- The filter tabs, events, members, and side modules should be driven by server data.
- Post-level local like/save interactions can remain client-only for now if the data source becomes real for content itself.

## Data-model implications
- Current schema only contains `users` and `animalPhotos`.
- Next step requires new tables for tracker and club content, likely including:
  - product batches / composition snapshots
  - deliveries
  - club posts
  - club events
  - optional members or featured families snapshot
- Router currently exposes only `auth` and `animalPhotos`; new `productTracker` and `clubFeed` procedures will be needed.

## Recommended execution order
1. Extend schema with minimal MVP tables for tracker + club.
2. Add db helpers and seed-friendly read functions.
3. Add tRPC public procedures for Product Tracker and Club Feed.
4. Refactor ProductTracker.tsx and ClubFeed.tsx to consume live query data.
5. Add/refresh vitest coverage and perform visual smoke-test.
