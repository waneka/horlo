# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- ✅ **v5.0 Discovery North Star** — Phases 32-42 (shipped 2026-05-16) — [archive](milestones/v5.0-ROADMAP.md)
- ✅ **v5.1 Explore Page Redesign** — Phases 43-47 (shipped 2026-05-19) — [archive](milestones/v5.1-ROADMAP.md)
- ✅ **v5.2 Polish + Taxonomy** — Phases 48-50 + 49.1 + 50.1 (shipped 2026-05-20) — [archive](milestones/v5.2-ROADMAP.md)
- ✅ **v6.0 Social Interaction** — Phases 53-58 + 56A + 57.1 (shipped 2026-05-24) — [archive](milestones/v6.0-ROADMAP.md)
- 🚧 **v7.0 Watch Photos & Detail Redesign** — Phases 59-64 (in progress)
- 📋 **v8.0 Add-Watch Redesign** — planted (SEED-010)
- 💤 **Catalog Expansion** — unscheduled; catalog strategy under review (SEED-009)
- 💤 **Market Value** — future, after v8.0 (SEED-005; needs the SEED-007 pricing spike first)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-19</summary>

- [x] Phase 1: Visual Polish & Security Hardening (6/6 plans)
- [x] Phase 2: Feature Completeness & Test Foundation (5/5 plans)
- [x] Phase 3: Data Layer Foundation (3/3 plans)
- [x] Phase 4: Authentication (6/6 plans)
- [x] Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap (6/6 plans)
- [ ] Phase 6: Test Suite Completion — deferred to v1.1 (TEST-04/05/06)

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 Taste Network Foundation (Phases 6-10) — SHIPPED 2026-04-22</summary>

- [x] Phase 6: RLS Foundation (1/1 plans)
- [x] Phase 7: Social Schema & Profile Auto-Creation (3/3 plans)
- [x] Phase 8: Self Profile & Privacy Controls (4/4 plans)
- [x] Phase 9: Follow System & Collector Profiles (4/4 plans)
- [x] Phase 10: Network Home (9/9 plans)

35/35 requirements shipped. Cross-phase integration verified. End-to-end privacy flows audited.

See [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) for full phase details and [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v3.0 Production Nav & Daily Wear Loop (Phases 11-16 + 999.1) — SHIPPED 2026-04-27</summary>

- [x] Phase 11: Schema + Storage Foundation (5/5 plans)
- [x] Phase 12: Visibility Ripple in DAL (7/7 plans)
- [x] Phase 13: Notifications Foundation (5/5 plans)
- [x] Phase 14: Nav Shell + Explore Stub (9/9 plans)
- [x] Phase 15: WYWT Photo Post Flow (5/5 plans)
- [x] Phase 16: People Search (5/5 plans)
- [x] Phase 999.1: Phase 5 Code Review Follow-ups (1/1 plan, inserted)

51/51 requirements shipped at code level. Cross-phase integration verified. Audit status `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory tech-debt items, none blocking.

See [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full phase details and [v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.0 Discovery & Polish (Phases 17-26 + 19.1 + 20.1) — SHIPPED 2026-05-03</summary>

- [x] Phase 17: Catalog Foundation (6/6 plans)
- [x] Phase 18: /explore Discovery Surface (5/5 plans)
- [x] Phase 19: /search Watches + Collections (6/6 plans)
- [x] Phase 19.1: Catalog Taste Enrichment (6/6 plans, inserted)
- [x] Phase 20: Collection Fit Surface Polish + Verdict Copy (6/6 plans)
- [x] Phase 20.1: Add-Watch Flow Rethink + Verdict-as-Step (8/8 plans incl. gap-closure 06/07/08, inserted)
- [x] Phase 21: Custom SMTP via Resend (2/2 plans)
- [x] Phase 22: Settings Restructure + Account Section (5/5 plans)
- [x] Phase 23: Settings Sections + Schema-Field UI (6/6 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 24: Notification Stub Cleanup + Test Fixture/Carryover (8/8 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 25: Profile Nav Prominence + Empty States + Form Polish (6/6 plans, UAT approved on prod)
- [x] Phase 26: WYWT Auto-Nav (2/2 plans, gap closed inline)

75/75 actionable requirements satisfied + 1 deferred (SMTP-06 staging-prod sender split). Audit status `tech_debt` — 2 phases without phase-level VERIFICATION.md (closed in v4.1), ~33 deferred human UAT items, Nyquist coverage partial. None blocking.

See [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) for full phase details and [v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.1 Polish & Patch (Phases 27-31) — SHIPPED 2026-05-05</summary>

- [x] Phase 27: Watch Card & Collection Render Polish (5/5 plans)
- [x] Phase 28: Add-Watch Flow & Verdict Copy Polish (5/5 plans)
- [x] Phase 29: Nav & Profile Chrome Cleanup (6/6 plans + 1 quick task)
- [x] Phase 30: WYWT Capture Alignment Fix (2/2 plans + 1 post-ship hotfix)
- [x] Phase 31: v4.0 Verification Backfill (3/3 plans)

12/12 requirements satisfied at code level. Cross-phase integration verified (7/7 seams pass). E2E flows trace cleanly (4/4). Audit status `tech_debt` — 1 NEW finding (DEBT-09: Phase 23-era `notesPublic` / `revalidatePath` regression discovered by Phase 31 audit) deferred to v4.2 / v5.0; Nyquist 4/5 partial. None blocking.

See [v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md) for full phase details and [v4.1-MILESTONE-AUDIT.md](milestones/v4.1-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v5.0 Discovery North Star (Phases 32-42) — SHIPPED 2026-05-16</summary>

- [x] Phase 32: DEBT-09 notesPublic Fix (1/1 plans) — completed 2026-05-06
- [x] Phase 33: Discovery Audit (4/4 plans) — completed 2026-05-08
- [x] Phase 33b: Discovery North-Star Audit (3/3 plans, inserted) — completed 2026-05-09
- [x] Phase 34: Layer A — Brand + Family Entities (4/4 plans) — completed 2026-05-09
- [x] Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material (7/7 plans) — completed 2026-05-10
- [x] Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL (5/5 plans) — completed 2026-05-11
- [x] Phase 37: Layer D — Provenance Fields + Divestments Table (5/5 plans) — completed 2026-05-11
- [x] Phase 38: CAT-13 Engine Rewire (4/4 plans) — completed 2026-05-12
- [x] Phase 39: Audit-Driven Discovery Polish — Cheap Patches (3/3 plans) — completed 2026-05-12
- [x] Phase 39b: Audit-Driven Discovery Polish — Heavier UX (5/5 plans) — completed 2026-05-13
- [x] Phase 39c: Profile Layout Next 16 Conformance (7/7 plans, inserted) — completed 2026-05-14
- [x] Phase 40: Search & Verdict Polish (7/7 plans) — completed 2026-05-14
- [x] Phase 41: Account Danger Zone + Branded Auth Emails (4/4 plans, parallel track) — completed 2026-05-16
- [x] Phase 42: Nyquist Hardening Sweep + UAT Triage (5/5 plans, parallel track) — completed 2026-05-16

16/16 in-scope v5.0 requirements shipped. DEBT-12 (prod drizzle journal repair) carried to v5.x as opportunistic housekeeping. Phase 33b and 39c were inserted phases (north-star audit reframe; Profile Layout Next 16 conformance bugfix). Milestone closed without a formal `/gsd-audit-milestone`; 4 verification gaps (Phases 35/38/40/41) + 2 human-UAT gaps (Phases 35/41) operator-approved at close.

See [v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v5.1 Explore Page Redesign (Phases 43-47) — SHIPPED 2026-05-19</summary>

- [x] Phase 43: Polish Pass (7/7 plans) — completed 2026-05-17
- [x] Phase 44: Catalog Enrichment (4/4 plans) — completed 2026-05-18
- [x] Phase 45: CMS Data Model + Admin Routes (6/6 plans) — completed 2026-05-18
- [x] Phase 46: Explore Shell + Browse + Archetypes (6/6 plans) — completed 2026-05-19
- [x] Phase 47: Curated Lists Rail + Hero + Where Collections Go (4/4 plans) — completed 2026-05-19

32/32 v5.1 requirements shipped. Two operator-raised end-of-milestone follow-ups (FU-01 `/search` facet menu, FU-02 `/explore/brands` smooth scroll) were closed as quick tasks before close. Milestone closed without a formal `/gsd-audit-milestone`; the pre-close artifact audit's 23 open items were all cosmetic flags or expected backlog, acknowledged as non-blocking.

See [v5.1-ROADMAP.md](milestones/v5.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v5.2 Polish + Taxonomy (Phases 48-50 + 49.1 + 50.1) — SHIPPED 2026-05-20</summary>

- [x] Phase 48: User-Facing Bug Fixes (3/3 plans) — completed 2026-05-19
- [x] Phase 49: Genre vs Style Taxonomy Spike (3/3 plans) — completed 2026-05-19
- [x] Phase 49.1: Remove Genre Surface (8/8 plans, inserted) — completed 2026-05-20
- [x] Phase 50: Watch-Detail Architecture Spike (4/4 plans) — completed 2026-05-20
- [x] Phase 50.1: URL Canonicalization (3/3 plans, inserted) — completed 2026-05-20

6/6 v5.2 requirements shipped (BUG-01, BUG-02, TAX-01, TAX-02, ARCH-01, ARCH-02). Two spike-then-execute chains landed: TAX-01 → TAX-02 (retired genre/archetype taxonomy surface; `style_tags` becomes single SoT for the functional-category axis); ARCH-01 → ARCH-02 (page-layer `redirect()` from `/catalog/[catalogId]` to `/watch/[id]` for owner viewer; Variant C unified `/w/[ref]` deferred to v7.0). Milestone-close audit closed D-DEBT-01 inline (dead `self-via-cross-user` framing surface removed across 6 files); status promoted `tech_debt` → `passed`. Operational gates D-DEBT-02 (5 Phase 49.1 prod/visual gates) + D-DEBT-03 (1 Phase 48 dark-mode UAT) remain as post-deploy verification.

See [v5.2-ROADMAP.md](milestones/v5.2-ROADMAP.md) for full phase details and [v5.2-MILESTONE-AUDIT.md](milestones/v5.2-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v6.0 Social Interaction (Phases 53-58 + 56A + 57.1) — SHIPPED 2026-05-24</summary>

- [x] Phase 53: Schema + RLS + Enum Extension (3/3 plans) — completed 2026-05-22
- [x] Phase 54: DAL — Reactions, Comments + Gate Logic (3/3 plans) — completed 2026-05-22
- [x] Phase 55: Server Actions + Notification Dedup (6/6 plans) — completed 2026-05-22
- [x] Phase 56: Like UI (3/3 plans) — completed 2026-05-23
- [x] Phase 56A: Wear View Unification (9/9 plans, inserted) — completed 2026-05-23
- [x] Phase 57: Comment Thread UI + Feed Extension + Grid Counts (6/6 plans) — completed 2026-05-24
- [x] Phase 57.1: Comment UI Polish + Own-Watch Suppression (3/3 plans, inserted) — completed 2026-05-24
- [x] Phase 58: Notification UI + Settings Opt-Out (3/3 plans) — completed 2026-05-24

34/34 v6.0 requirements shipped. Cross-phase integration verified (7/7 E2E flows wired). All 5 UI phases passed on-prod human UAT. Audit status `passed` — zero critical blockers; non-blocking tech debt = Nyquist VALIDATION-doc reconciliation + ~6 cosmetic doc/impl mismatches.

See [v6.0-ROADMAP.md](milestones/v6.0-ROADMAP.md) for full phase details and [v6.0-MILESTONE-AUDIT.md](milestones/v6.0-MILESTONE-AUDIT.md) for the audit report.

</details>

### 🚧 v7.0 Watch Photos & Detail Redesign (Phases 59-64)

**Milestone Goal:** Give every watch real, owned photography on a redesigned detail page — built once on a unified `/w/[ref]` route.

**Sources:** SEED-013 (multi-photo + carousel + wear-pic surfacing), SEED-015 (inline grid engagement), SEED-016 (`/w/[ref]` detail redesign), Phase 50 architecture spike (Variant C verdict).

- [x] **Phase 59: Unified Route (Variant C)** — Merge `/catalog/[catalogId]` + `/watch/[id]` into `/w/[ref]`; remove legacy routes; add CI link-audit guard (completed 2026-05-25)
- [x] **Phase 60: Multi-Photo Schema + DAL** — In-place ALTER on `watches_catalog`; per-user watch photo tables; backfill migration; DAL for CRUD + ordering (completed 2026-05-25)
- [x] **Phase 61: Photo Upload + Carousel UI** — Upload pipeline (EXIF-strip / ≤1080px JPEG); carousel; drag-reorder; delete; add-watch encouragement (completed 2026-05-25)
- [x] **Phase 62: Public Wear Pics on Watch Detail** — Surface public wear photos on watch page; per-pic hide control; v6.0 likes/comments layer on surfaced pics (completed 2026-05-27)
- [ ] **Phase 63: Inline Grid Engagement** — Like + inline comment composer from profile grid cards; GATE-03 enforcement; optimistic counts
- [ ] **Phase 64: Detail Page IA Redesign** — Intentional information hierarchy on `/w/[ref]`; deliberate comment placement; Cache Components structure preserved

## Phase Details

### Phase 59: Unified Route (Variant C)
**Goal**: Every watch is reachable at a single canonical `/w/[ref]` URL; legacy routes are removed and a CI guard prevents any un-migrated internal link from surviving undetected
**Depends on**: Phase 58 (v6.0 complete)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, ROUTE-06
**Success Criteria** (what must be TRUE):
  1. Visiting `/w/[ref]` resolves correctly whether the ref is a per-user watch id or a catalog id, and shows the appropriate owner vs cross-user framing
  2. Visiting `/watch/[id]` or `/catalog/[catalogId]` returns a 404 (no redirect), so any un-migrated link fails loudly
  3. The CI build fails if any internal href or link literal still targets a legacy `/watch/[…]` or `/catalog/[…]` watch path
  4. All internal surfaces — grid cards, search rows, discovery rails, add-watch deep-links, computed notification deep-links — point at `/w/[ref]`
  5. Owner-only actions (edit, delete, mark-worn) remain available only to the authenticated owner on the unified route
**Plans**: 3 plans (3 waves)
- [x] 59-01-PLAN.md — DAL extraction (findViewerWatchByCatalogId) + CI guard + integration scaffold + prebuild hook (Wave 1)
- [x] 59-02-PLAN.md — Unified /w/[ref] page + /w/[ref]/edit route (Wave 2)
- [x] 59-03-PLAN.md — Re-point 26 link literals + delete 3 legacy pages + prove build-gate (Wave 3)

### Phase 60: Multi-Photo Schema + DAL
**Goal**: The database can store multiple ordered photos per watch and the DAL exposes clean CRUD + ordering operations; `watches.image_url` is losslessly backfilled into `watch_photos` then dropped (per phase-60 discussion D-10, `watches_catalog` is NOT touched)
**Depends on**: Phase 59
**Requirements**: PHOTO-01, PHOTO-04, PHOTO-07, PHOTO-08
**Success Criteria** (what must be TRUE):
  1. A watch in the DB can hold multiple photo rows with explicit ordering; the single-image field is superseded
  2. The first/lowest-order photo is used as the watch's cover thumbnail across grids and rails (observable at the data layer before any UI lands)
  3. The DAL enforces a per-watch cap of ~10 photos and rejects inserts beyond it
  4. The photo upload pipeline strips EXIF and re-encodes to ≤1080px JPEG before storage (verifiable via file metadata on uploaded test images)
  5. The in-place migration runs cleanly on local and prod without wiping existing `watches_catalog` LLM/factual/photo investment (D-11: satisfied trivially — catalog untouched; the real lossless assertion is the `watches.image_url` backfill→drop)
**Plans**: 4 plans (3 waves)
- [x] 60-01-PLAN.md — watch_photos schema + authoritative Supabase migration (backfill→drop) + bucket/RLS + Wave 0 test stub + local push (Wave 1)
- [x] 60-02-PLAN.md — watch-photos storage helper + SC4 EXIF/≤1080px JPEG verification test (Wave 1)
- [x] 60-03-PLAN.md — DAL cover resolution (3 paths) + cap/reorder/delete + repoint all image_url readers + storage purge hook (Wave 2)
- [x] 60-04-PLAN.md — [BLOCKING] prod migration push (supabase db push --linked) + prod verification (Wave 3, operator-run)

### Phase 61: Photo Upload + Carousel UI
**Goal**: A watch owner can upload, view, reorder, and delete photos from the watch detail page; the add-watch flow prominently surfaces photo upload as a first-class step
**Depends on**: Phase 60
**Requirements**: PHOTO-02, PHOTO-03, PHOTO-05, PHOTO-06, PHOTO-09
**Success Criteria** (what must be TRUE):
  1. An owner can upload one or more photos to a watch they own and see them appear on the detail page
  2. Photos display in a one-at-a-time carousel with arrow and swipe navigation
  3. An owner can drag-reorder photos; dragging a photo to the first position makes it the card thumbnail across grids
  4. An owner can delete an individual photo; the cap affordance is visibly blocked with clear messaging when the ~10-photo limit is reached
  5. The add-watch flow presents a prominent (not buried) photo upload affordance that is not easily skipped
**Plans**: 6 plans (gap closure: 61-05, 61-06 added after UAT)
- [x] 61-01-PLAN.md — getWatchPhotosForWatch DAL + 3 photo server actions + Wave 0 test scaffolds (Wave 1)
- [x] 61-02-PLAN.md — RSC signed-photo fetch + carousel/filmstrip/upload UI + WatchDetail wiring (Wave 2)
- [x] 61-03-PLAN.md — add-watch "Add your photos" step (FlowState + WatchForm onWatchCreated + WatchPhotoStep) (Wave 2)
- [x] 61-04-PLAN.md — sign owner-photo covers across home/profile/search RSCs so reorder cover shows on grids (Wave 3)
- [x] 61-05-PLAN.md — gap closure: carousel/filmstrip/dropzone polish (gaps #2–#8; D-07 edit-mode-only Cover badge) (Wave 1)
- [x] 61-06-PLAN.md — gap closure: add-watch photos-step fix (gap #9 / PHOTO-09) + P61-BUG-01 #419 regression guard (gap #1) (Wave 1)
**UI hint**: yes

### Phase 62: Public Wear Pics on Watch Detail
**Goal**: Public wear photos automatically appear on the watch's detail page, the owner can hide individual surfaced pics, and all surfaced pics carry the full v6.0 social interaction layer
**Depends on**: Phase 61
**Requirements**: WPIC-01, WPIC-02, WPIC-03, WPIC-04, WPIC-05, WPIC-06
**Success Criteria** (what must be TRUE):
  1. A wear photo with "public" visibility automatically appears in the wear-pics section of its watch's detail page without any additional owner action
  2. The owner can hide a specific public wear pic from the detail page via a per-pic control; the pic remains in the Wears tab
  3. Non-public (followers-only or private) wear photos never appear on the watch detail page, regardless of who is viewing
  4. The Home wear rail's 24/48h ephemeral behavior is unchanged — surfacing on watch detail does not alter rail display
  5. Surfaced public wear pics have working like and comment interactions via the v6.0 layer
**Plans**: 5 plans (3 waves + gap closure)
- [x] 62-01-PLAN.md — schema hidden_from_detail column + local push + prod migration + Wave 0 test scaffolds (Wave 1)
- [x] 62-02-PLAN.md — getPublicWearPicsForWatch union DAL + hide/unhide DAL + server actions (Wave 2)
- [x] 62-03-PLAN.md — Wears tab actual-photo repoint (sign wear-photos + WornTimeline/WornCalendar prefer event.photoUrl) (Wave 2)
- [x] 62-04-PLAN.md — carousel wear-pic union + Worn badge + inline like/comment sheet + Edit-mode eye/hide (Wave 3)
- [x] 62-05-PLAN.md — gap closure (UAT Test 4 / WPIC-06): relocate wear-pic like/comment to bottom-right on-photo overlay
**UI hint**: yes

### Phase 63: Inline Grid Engagement
**Goal**: A viewer can like a watch and post a short comment directly from a profile collection or wishlist grid card without opening the detail page; count badges update optimistically and the GATE-03 wishlist comment gate is enforced per card
**Depends on**: Phase 59
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, GRID-05
**Success Criteria** (what must be TRUE):
  1. A viewer can like a watch from a profile grid card in one tap with optimistic state update
  2. A viewer can open a lightweight inline composer on a grid card and submit a comment without navigating to the detail page
  3. The card's like and comment counts update optimistically after an inline like or comment action
  4. The inline composer is compose-only — the full comment thread is only accessible by opening the detail page
  5. Grid cards for wishlist watches where the viewer does not have mutual-follow status do not expose the inline comment composer
**Plans**: 3 plans (2 waves)
- [x] 63-01-PLAN.md — Extend WatchCounts (liked/canComment) + Q6 viewer-liked query + close D-12 cache-tag gap in both actions + test cases (Wave 1)
- [ ] 63-02-PLAN.md — New compose-only WatchCommentSheet (Sheet + watch identity + CommentCompose; no thread) (Wave 1)
- [ ] 63-03-PLAN.md — Thread viewerId/liked/canComment through page+tab contents + overlay ♥/💬 chips on ProfileWatchCard (non-owner, gated 💬, chip-tap≠navigate) (Wave 2)
**UI hint**: yes

### Phase 64: Detail Page IA Redesign
**Goal**: The `/w/[ref]` page presents an intentional information hierarchy — carousel, verdict, like, comments, rails, footer — rather than append-order stacking; comments have a deliberate, reachable position; the Phase 51/52 Cache Components structure is fully preserved
**Depends on**: Phase 61, Phase 62, Phase 63
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04
**Success Criteria** (what must be TRUE):
  1. The watch detail page presents carousel, verdict, like, comments, rails, and footer in a deliberate visual hierarchy rather than chronological-append order
  2. Comments appear at a reachable scroll position — not buried below all rails and metadata
  3. The photo carousel functions as the primary visual element at the top of the page
  4. CommentThread remains an uncached Suspense sibling and the `unstable_instant = false` lock on related routes is not disturbed; Cache Component rules are intact
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 59. Unified Route (Variant C) | 3/3 | Complete    | 2026-05-25 |
| 60. Multi-Photo Schema + DAL | 4/4 | Complete    | 2026-05-25 |
| 61. Photo Upload + Carousel UI | 6/6 | Complete   | 2026-05-26 |
| 62. Public Wear Pics on Watch Detail | 5/5 | Complete   | 2026-05-27 |
| 63. Inline Grid Engagement | 1/3 | In Progress|  |
| 64. Detail Page IA Redesign | 0/TBD | Not started | - |

_Phases 51 (Profile Route PPR Opt-Out) + 52 (Cache Components canonical pattern — recurrence-4/5 React #419 fix) were post-v5.2 hotfix phases off main, not part of a numbered milestone; full record in `.planning/phases/51-*` / `52-*` and PROJECT.md Current State._
