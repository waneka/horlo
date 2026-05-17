# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- ✅ **v5.0 Discovery North Star** — Phases 32-42 (shipped 2026-05-16) — [archive](milestones/v5.0-ROADMAP.md)
- 🚧 **v5.1 Explore Page Redesign** — Phases 43-47 (in progress — SEED-008)
- 📋 **v5.2 Catalog Expansion** — planted (SEED-009)
- 📋 **v5.3 Add-Watch Redesign** — planted (SEED-010)
- 📋 **v6.0 Market Value** — planted (SEED-005)

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

### 🚧 v5.1 Explore Page Redesign (In Progress — SEED-008)

- [x] **Phase 43: Polish Pass** — Fix filter-sheet dismiss, wishlist card wear-UI gate, card height consistency, avatar upload, and deprecated Claude model ID (4 plans shipped 2026-05-17; gap closure in progress — 3 UAT gaps) (completed 2026-05-17)
- [ ] **Phase 44: Catalog Enrichment** — Extend backfill script with rate-limit retry/logging, run prod enrichment, verify archetype coverage across all ~100 catalog rows
- [ ] **Phase 45: CMS Data Model + Admin Routes** — 5-table migration with RLS, owner-gated `/admin/*` routes, list/path CRUD, 10 seed paths authored
- [ ] **Phase 46: Explore Shell + Browse + Archetypes** — New `/explore` 5-module shell, Browse the Catalog with 4 indices, Collector Archetypes chip rail
- [ ] **Phase 47: Curated Lists Rail + Hero + Where Collections Go** — Curated Lists Rail + detail pages, Hero with quality gate + manual pin, Collection Paths module

### 📋 v5.2 Catalog Expansion (Planted)

Not yet roadmapped — seeded as SEED-009. Catalog breadth expansion beyond the ~100 existing rows. Runs after v5.1.

### 📋 v5.3 Add-Watch Redesign (Planted)

Not yet roadmapped — seeded as SEED-010. Add-Watch flow redesign. Runs after v5.1.

### 📋 v6.0 Market Value (Planted)

Not yet roadmapped — seeded as SEED-005. Watch Charts integration + total-value insights. Requires the SEED-007 market-pricing API spike first.

---

## Phase Details — v5.1 Explore Page Redesign

### Phase 43: Polish Pass
**Goal**: Users experience a polished, consistent UI before new surfaces are added — existing UX bugs resolved and avatar upload live
**Depends on**: Nothing (standalone, no new DB tables required)
**Requirements**: PLSH-01, PLSH-02, PLSH-03, PLSH-04, PLSH-05, PLSH-06, PLSH-07
**Success Criteria** (what must be TRUE):
  1. User can dismiss the `/search` filter bottom-sheet by swiping down or tapping outside — close is never blocked when a filtered query is in flight
  2. Wishlist watch cards show no wear information ("Never worn" label, wear badges, last-worn line) — those details appear only on owned watch cards
  3. Watch cards in the collection and wishlist grids have a consistent height regardless of the watch's metadata completeness or whether it has a photo
  4. A button above the watch grid lets the user add a watch to their collection or wishlist — the end-of-grid AddWatchCard is removed
  5. User can upload a profile photo from their device; it is stored in Supabase Storage and displayed on profile surfaces, replacing the URL text field
  6. The watch-extraction LLM call uses the current non-deprecated Claude model ID (`claude-sonnet-4-6`)
**Plans**: 7 plans (4 original + 3 gap-closure from UAT)
- [x] 43-01-PLAN.md — FilterDrawer migration (swipe/backdrop dismiss) + Claude model ID fix
- [x] 43-02-PLAN.md — ProfileWatchCard restructure (equal-height) + wishlist wear-UI suppression
- [x] 43-03-PLAN.md — Add-watch button relocation in collection + wishlist tabs
- [x] 43-04-PLAN.md — Device avatar upload with circular crop + Supabase Storage bucket
- [x] 43-05-PLAN.md — GAP CLOSURE: tighten ProfileWatchCard height (GAP-43-01) + outline-variant add buttons (GAP-43-02)
- [x] 43-06-PLAN.md — GAP CLOSURE: avatar bucket SELECT-policy migration (GAP-43-03, [BLOCKING] schema push)
- [x] 43-07-PLAN.md — GAP CLOSURE: square watch-card image (GAP-43-04) + functional Settings profile-edit section (GAP-43-05)
**UI hint**: yes

### Phase 44: Catalog Enrichment
**Goal**: All ~100 `watches_catalog` rows have populated taste attributes and filter metadata so Browse and Archetypes can return non-empty results
**Depends on**: Phase 43 (can run in parallel with 43 if needed, but logically follows polish)
**Requirements**: ENRH-01, ENRH-02, ENRH-03, ENRH-04, ENRH-05, ENRH-06
**Success Criteria** (what must be TRUE):
  1. Re-running the enrichment script on an already-enriched high-confidence (vision-derived) row does not downgrade it — a confidence-threshold guard and photo-existence check block force re-enrichment
  2. A full ~100-row enrichment run completes without silent failures — rate-limited requests are retried with backoff and each row's `catalog_id` is logged as success or failure
  3. All ~100 `watches_catalog` rows have populated `primary_archetype`, `era_signal`, and taste columns after the production enrichment run
  4. Every `/search` filter dimension (movement type, case size, style tags) is populated for all catalog rows; factual fields remain human-reviewed and are not auto-written by LLM output
  5. Every Collector Archetype (all 8) resolves to at least one catalog row — verified by a `GROUP BY primary_archetype` query before the Archetypes module ships
**Plans**: TBD

### Phase 45: CMS Data Model + Admin Routes
**Goal**: The owner can author and publish curated lists and collection paths through admin routes, with all content correctly gated behind RLS
**Depends on**: Phase 43
**Requirements**: CMS-01, CMS-02, CMS-03, CMS-04, CMS-05, CMS-06, CMS-07, CMS-08, CMS-09, CMS-10
**Success Criteria** (what must be TRUE):
  1. The five new tables (`curated_lists`, `curated_list_items`, `collection_paths`, `collection_path_nodes`, `cms_settings`) exist with RLS that exposes only published content to non-owners — verified by querying as a non-owner authenticated user
  2. The `/admin/lists` and `/admin/paths` routes are unreachable by any non-owner — both a route guard and an `assertOwner()` call at the start of every CMS Server Action enforce this independently
  3. Owner can create, edit, delete, and reorder curated lists; each list has title, curator name, cover image, and markdown intro copy; per-item editorial commentary can be written for each catalog watch in a list
  4. Owner can save a curated list as draft or publish/unpublish it; a list with zero watches cannot be published; unpublished lists never appear on public-facing pages
  5. Owner can create, edit, and delete collection paths (seed watch + up to 3 follow-ons with rationale and path-type label); owner can pin a list as the hero with an optional expiry date and can clear the pin
  6. Deleting a catalog watch referenced by a published list or path is blocked at the database layer; the admin UI warns before attempting such a delete
  7. Ten seed collection paths are authored through the admin UI and are in published state
**Plans**: TBD
**UI hint**: yes

### Phase 46: Explore Shell + Browse + Archetypes
**Goal**: `/explore` renders as a 5-module shell and users can browse the catalog by brand, era, genre, and price band, and deep-link into archetype-filtered search results
**Depends on**: Phase 44 (enrichment data must be verified in prod), Phase 45 (shell structure must exist before editorial modules are added, though Browse and Archetypes have no editorial dependency)
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05
**Success Criteria** (what must be TRUE):
  1. `/explore` renders a five-module page (Hero, Collector Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) — stacked on mobile, grid on desktop; any module with no available content hides itself entirely (no empty containers)
  2. Browse the Catalog presents brand, era, genre, and price-band indices with accurate counts; price bands use the fixed editorial buckets (Under $500 / $500–2K / $2K–10K / $10K–50K / $50K+); tapping a grouping opens `/search` prefiltered by that facet
  3. The Brands index includes A–Z jump navigation allowing the user to jump to any letter section
  4. Collector Archetypes renders a chip rail with all 8 archetypes, each showing a watch-count badge; tapping a chip opens prefiltered search results with an archetype header; all 8 chips resolve to at least one result
**Plans**: TBD
**UI hint**: yes

### Phase 47: Curated Lists Rail + Hero + Where Collections Go
**Goal**: The editorial half of `/explore` is live — users can discover curated lists, see the hero feature, and explore collection paths authored by the curator
**Depends on**: Phase 45 (published CMS content must exist), Phase 46 (Explore shell must be stable)
**Requirements**: EXPL-06, EXPL-07, EXPL-08, EXPL-09
**Success Criteria** (what must be TRUE):
  1. The Curated Lists Rail shows up to 12 published lists (cover image, title, curator name, watch count, freshness indicator) with a "View all" link to `/explore/lists`; a curated list detail page renders the list's intro copy and per-item editorial commentary
  2. The Hero shows a single full-bleed image with title and curator name from a quality-gated published list (minimum 3 watches + cover image + intro copy); it auto-selects unless a manual pin overrides it; when no eligible content exists the Hero hides itself entirely
  3. Pinning and unpublishing a list causes the Hero to update without waiting for cache TTL — manual pin changes propagate immediately via `revalidateTag('explore:hero')`
  4. Where Collections Go shows rotating published collection paths (seed watch plus follow-on watches, each with editorial rationale and a path-type label); tapping any watch opens its detail page; "Explore all paths" links to `/explore/paths`
  5. The Where Collections Go module renders correctly at 360px mobile width — progression through the path is legible with a numbered indicator and vertical stacking
**Plans**: TBD
**UI hint**: yes

---

## Progress — v5.1 Explore Page Redesign

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 43. Polish Pass | 7/7 | Complete   | 2026-05-17 |
| 44. Catalog Enrichment | 0/TBD | Not started | - |
| 45. CMS Data Model + Admin Routes | 0/TBD | Not started | - |
| 46. Explore Shell + Browse + Archetypes | 0/TBD | Not started | - |
| 47. Curated Lists Rail + Hero + Where Collections Go | 0/TBD | Not started | - |

## Next Up

Run `/gsd-execute-phase 43 --gaps-only` to execute the Phase 43 gap-closure plans (43-05, 43-06).
