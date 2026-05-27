# Requirements: Horlo — v7.0 Watch Photos & Detail Redesign

**Defined:** 2026-05-25
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

**Milestone goal:** Give every watch real, owned photography on a redesigned detail page — built once on a unified `/w/[ref]` route.

**Sources:** SEED-013 (multi-photo + carousel + wear-pic surfacing), SEED-015 (inline grid engagement), SEED-016 (`/watch` detail redesign), and the Phase 50 watch-detail architecture spike (Variant C).

---

## v7.0 Requirements

### Unified Route (Variant C) — `ROUTE`

> Merge `/catalog/[catalogId]` (cross-user spec) + `/watch/[id]` (owner per-user) into one canonical route. Tackled **first** so the carousel and all downstream surfaces land once. Route + URL dispatch only — no schema change, no new viewer-state handling (the routes split on ref-identity, not viewer audience).
>
> **Hard cutover, not redirect (operator decision 2026-05-25).** Legacy routes are removed rather than redirected, so any un-migrated internal link fails loudly instead of being silently papered over. This is safe: notification deep-links are computed from IDs at render time (`NotificationRow.resolveHref`), not stored, so no URL data needs migrating; `/wear/[id]` is unaffected by the merge. The only breakage is external bookmarks to old URLs — accepted for a personal auth-gated app. The completeness guarantee lives in CI (ROUTE-03), not in manual click-through across the ~55 link literals / ~36 files.

- [x] **ROUTE-01**: A watch is viewable at a single canonical `/w/[ref]` route that resolves either a per-user watch id or a catalog id server-side
- [x] **ROUTE-02**: The legacy `/watch/[id]` and `/catalog/[catalogId]` routes are removed (no redirect) — visiting them 404s, so any un-migrated internal link surfaces immediately rather than silently working
- [x] **ROUTE-03**: A static guard test fails the build if any internal href or link literal still targets a legacy `/watch/[…]` or `/catalog/[…]` watch path — enforcing ROUTE-04 completeness in CI rather than by manual click-through
- [x] **ROUTE-04**: Every internal link to a watch (grid cards, search rows, discovery rails, add-watch deep-links, computed notification deep-links) points at `/w/[ref]`
- [x] **ROUTE-05**: The unified route preserves the two-layer privacy gate and per-viewer framing (owner vs cross-user) with no regression
- [x] **ROUTE-06**: Owner-only write surfaces (edit, delete, mark-worn) remain available only to the owner on the unified route

### Multi-Photo Model + Carousel — `PHOTO`

> Replace the single `imageUrl` with a real multi-photo model. In-place ALTER (`watches_catalog` is NOT wipeable). Reuse the v3.0 `wear-photos` upload pipeline.

- [x] **PHOTO-01**: A watch can hold multiple photos (replacing the single image field)
- [x] **PHOTO-02**: A user can upload one or more photos to a watch they own
- [x] **PHOTO-03**: A watch's photos display in a carousel showing one photo at a time, navigable by arrows and swipe
- [x] **PHOTO-04**: The first/cover photo serves as the watch's card thumbnail across grids and rails
- [x] **PHOTO-05**: A user can reorder a watch's photos by drag-and-drop; reordering sets the cover/thumbnail
- [x] **PHOTO-06**: A user can delete an individual photo from a watch they own
- [x] **PHOTO-07**: A watch enforces a cap of ~10 photos; the upload affordance is blocked at the cap with clear messaging
- [x] **PHOTO-08**: Uploaded photos pass through the EXIF-strip / ≤1080px JPEG re-encode pipeline before storage
- [x] **PHOTO-09**: The add-watch flow strongly encourages photo upload via a prominent (not buried) affordance

### Public Wear Pics → Watch Detail — `WPIC`

> Public-visibility wear photos auto-surface on the watch (public = consent), with an owner per-pic hide control. Wear pics persist in the Wears tab; the Home rail stays ephemeral.

- [x] **WPIC-01**: A wear photo set to "public" visibility automatically surfaces on its watch's detail page
- [x] **WPIC-02**: The owner can hide a specific surfaced wear pic from the watch detail page (per-pic control)
- [x] **WPIC-03**: Wear photos persist in the owner's Wears tab, showing the actual wear photo rather than the generic catalog image
- [x] **WPIC-04**: The Home wear rail stays ephemeral (wears appear only within the 24/48h window) — detail surfacing does not change rail behavior
- [x] **WPIC-05**: A non-public (followers-only / private) wear pic never surfaces on watch detail
- [x] **WPIC-06**: Surfaced public wear pics carry the v6.0 likes/comments interaction layer

### Inline Grid Engagement (SEED-015) — `GRID`

> Like + lightweight inline comment composer directly from profile collection/wishlist grid cards. Full thread still clicks through.

- [ ] **GRID-01**: A viewer can like a watch directly from a profile collection/wishlist grid card (one tap, optimistic)
- [ ] **GRID-02**: A viewer can post a comment from a grid card via a lightweight inline composer without opening detail
- [ ] **GRID-03**: A grid card's `♥ N · 💬 M` counts update optimistically after an inline like or comment
- [ ] **GRID-04**: Viewing the full comment thread still requires opening the detail page (inline is compose-only)
- [ ] **GRID-05**: The GATE-03 wishlist mutual-follow comment gate is enforced per card; gated cards do not expose the inline composer

### Detail Page IA Redesign (SEED-016) — `PAGE`

> An intentional information hierarchy for the unified `/w/[ref]` page, absorbing the carousel + verdict + like + comments + rails rather than appending at the bottom.

- [ ] **PAGE-01**: The watch detail page presents an intentional information hierarchy (carousel, verdict, like, comments, rails, footer), not stacked append-order
- [ ] **PAGE-02**: Comments occupy a deliberate, reachable position — not buried at the bottom of the page
- [ ] **PAGE-03**: The redesign preserves the Phase 51/52 Cache Components structure (CommentThread stays an uncached Suspense sibling; `unstable_instant`/cache rules intact)
- [ ] **PAGE-04**: The redesign integrates the photo carousel as a primary visual element of the page

---

## Future Requirements

Deferred — tracked, not in this milestone's roadmap.

### Photos

- **PHOTO-F1**: Per-account photo cap / storage quota (v7.0 caps per-watch only)
- **PHOTO-F2**: In-app photo editing (crop / filters / rotate beyond the existing capture crop)
- **PHOTO-F3**: Multi-photo extraction from a URL import (add-watch URL extract still pulls a single image; multi-photo is manual upload)

### Route

- **ROUTE-F1**: Variant D / E route consolidations (Variant C is the chosen merge; D/E are not pursued)

---

## Out of Scope

Explicitly excluded for v7.0. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Video on watches | Storage/bandwidth cost; photos-only for v7.0 |
| Cross-user shared photo gallery (pooling all collectors' photos onto one catalog page) | Photos are per-user/owned; surfacing is the owner's public wear pics on their own watch, not a communal pool |
| AI photo tagging / recognition / auto-cover-selection | Out of scope; cover is first photo + manual reorder |
| Full comment thread inline in the grid card | Compose-only inline by design (GRID-04); reading the thread clicks through |
| Threaded/nested replies, moderation, public liker lists, Realtime | Out per the v6.0 social scope (unchanged) |
| Photo migration tooling for the single→multi `imageUrl` change beyond a one-time backfill | One-time in-place backfill only; no ongoing migration UX |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 59 | Complete |
| ROUTE-02 | Phase 59 | Complete |
| ROUTE-03 | Phase 59 | Complete |
| ROUTE-04 | Phase 59 | Complete |
| ROUTE-05 | Phase 59 | Complete |
| ROUTE-06 | Phase 59 | Complete |
| PHOTO-01 | Phase 60 | Complete |
| PHOTO-04 | Phase 60 | Complete |
| PHOTO-07 | Phase 60 | Complete |
| PHOTO-08 | Phase 60 | Complete |
| PHOTO-02 | Phase 61 | Complete |
| PHOTO-03 | Phase 61 | Complete |
| PHOTO-05 | Phase 61 | Complete |
| PHOTO-06 | Phase 61 | Complete |
| PHOTO-09 | Phase 61 | Complete |
| WPIC-01 | Phase 62 | Complete |
| WPIC-02 | Phase 62 | Complete |
| WPIC-03 | Phase 62 | Complete |
| WPIC-04 | Phase 62 | Complete |
| WPIC-05 | Phase 62 | Complete |
| WPIC-06 | Phase 62 | Complete |
| GRID-01 | Phase 63 | Pending |
| GRID-02 | Phase 63 | Pending |
| GRID-03 | Phase 63 | Pending |
| GRID-04 | Phase 63 | Pending |
| GRID-05 | Phase 63 | Pending |
| PAGE-01 | Phase 64 | Pending |
| PAGE-02 | Phase 64 | Pending |
| PAGE-03 | Phase 64 | Pending |
| PAGE-04 | Phase 64 | Pending |

**Coverage:**
- v7.0 requirements: 30 total (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4)
- Mapped to phases: 30/30 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 — traceability table populated after roadmap creation*
