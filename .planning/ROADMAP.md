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
- ✅ **v7.0 Watch Photos & Detail Redesign** — Phases 59-65 (shipped 2026-05-28) — [archive](milestones/v7.0-ROADMAP.md)
- 🏗 **v8.0 Add-Watch Redesign** — Phases 66-71 (in progress — SEED-010)
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

- [x] Phase 48: User-Facing Bug Fixes (3/3 plans)
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

<details>
<summary>✅ v7.0 Watch Photos & Detail Redesign (Phases 59-65) — SHIPPED 2026-05-28</summary>

- [x] Phase 59: Unified Route (Variant C) (3/3 plans) — completed 2026-05-25
- [x] Phase 60: Multi-Photo Schema + DAL (4/4 plans) — completed 2026-05-25
- [x] Phase 61: Photo Upload + Carousel UI (6/6 plans) — completed 2026-05-26
- [x] Phase 62: Public Wear Pics on Watch Detail (5/5 plans) — completed 2026-05-27
- [x] Phase 63: Inline Grid Engagement (3/3 plans) — completed 2026-05-27
- [x] Phase 64: Detail Page IA Redesign (5/5 plans) — completed 2026-05-28
- [x] Phase 65: Follow-Scoped Owners Module (3/3 plans) — completed 2026-05-28

34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4). All 7 phases prod-verified via human UAT on horlo.app. Phase 65 final UAT 9 pass / 1 skip / 0 issues. Milestone closed without a formal `/gsd-audit-milestone`; 28 open artifact-audit items acknowledged as deferred (see STATE.md `## Deferred Items`). Phase 65 was a planted follow-on surfaced during the Phase 64 UAT, not an insertion.

Notable: React #419 soft-nav 404 family resolved via `connection()` static-shell opt-out (Phase 61 Plan 06). React #418 date-TZ hydration mismatch resolved via pinned `timeZone: 'UTC' + 'en-US'`. IDOR CR-02 (storage path prefix) fixed.

See [v7.0-ROADMAP.md](milestones/v7.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>🏗 v8.0 Add-Watch Redesign (Phases 66-71) — IN PROGRESS</summary>

- [ ] **Phase 66**: API Route Extension — `/api/extract-watch` structured mode
- [ ] **Phase 67**: Server Action + DAL Extensions — `searchCatalogForAddFlow`, `addWatch` catalogId, DAL helper
- [ ] **Phase 68**: ConfirmStep Component — segmented status picker incl. grail, lighter confirm screen
- [ ] **Phase 69**: SearchEntry + StructuredEntryPanel + Cache Hygiene — typeahead, 4-field form, cache signOut cleanup
- [ ] **Phase 70**: AddWatchFlow State Machine Rewrite + DUPE Wiring — all four flow branches wired
- [ ] **Phase 71**: Dead Code Cleanup + Static Guards — VerdictStep + WishlistRationalePanel + PasteSection deleted

39/39 requirements planned. Phases 66+67 parallelizable; Phases 68+69 parallelizable; Phase 70 and Phase 71 sequential.

</details>

## Phase Details

### Phase 66: API Route Extension
**Goal**: The `/api/extract-watch` route can accept structured watch identity (brand + model + optional reference/year) without a URL, short-circuiting all HTML scraping stages, and produce a consistent `ExtractedWatchData` response via LLM
**Depends on**: Nothing (first phase, backend-only, parallelizable with Phase 67)
**Requirements**: EXTR-01, EXTR-02, EXTR-03, EXTR-04, EXTR-08
**Success Criteria** (what must be TRUE):
  1. A POST to `/api/extract-watch` with `{ mode: 'structured', brand: 'Omega', model: 'Speedmaster' }` returns extracted watch data without making any cheerio / HTML-scraping call
  2. A POST with `{ mode: 'url', url: '...' }` continues to behave identically to the pre-v8.0 route — no regression
  3. Brand and model are required; omitting either returns a 4xx validation error
  4. The structured branch creates any new catalog row via `upsertCatalogFromUserInput` (ON CONFLICT DO NOTHING), not `upsertCatalogFromExtractedUrl` — an integration test asserts this distinction on a known catalog row
  5. An integration test asserts no `cheerio` call fires when `mode === 'structured'`
**Plans**: 2 plans
- [x] 66-01-PLAN.md — Create `src/lib/extractors/llm-structured.ts` (Anthropic strict tool-use) + extend `EnrichmentSource` union + export `validateAndCleanData` + unit tests (EXTR-04)
- [x] 66-02-PLAN.md — Extend `route.ts` with Zod discriminated body + structured-branch dispatch + mode-branched D-06 copy + integration tests (EXTR-01, EXTR-02, EXTR-03, EXTR-08)

### Phase 67: Server Action + DAL Extensions
**Goal**: The server-side seams that UI components will consume are in place — a new `searchCatalogForAddFlow` Server Action, `addWatch` with optional `catalogId` passthrough, and a `getWatchIdByCatalogId` DAL helper
**Depends on**: Nothing (parallelizable with Phase 66)
**Requirements**: CONF-11, DUPE-01 (DAL part), DUPE-03 (DAL part)
**Success Criteria** (what must be TRUE):
  1. Calling `searchCatalogForAddFlow('speedmaster')` returns catalog rows sorted with exact-reference matches first, each row including a `viewerState` badge field (`owned` / `wishlist` / null), with no N+1 queries
  2. `addWatch(data)` with `catalogId` supplied skips `upsertCatalogFromUserInput` and binds the new watch row to the existing catalog row via `getCatalogById`
  3. `getWatchIdByCatalogId(userId, catalogId)` returns the user's watch `id` for a catalog row they own, or `null` if they don't — verified by a unit test
**Plans**: TBD

### Phase 68: ConfirmStep Component
**Goal**: A `ConfirmStep` pure presenter component exists that renders a cover photo, read-only watch identity, a segmented status picker (owned / wishlist / grail, no sold), status-gated price field, "Edit details" escape, and a primary CTA whose label reflects the chosen status
**Depends on**: Nothing (parallelizable with Phase 69; consumes data from Phases 66+67 when wired in Phase 70)
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, CONF-08, CONF-09, CONF-10
**Success Criteria** (what must be TRUE):
  1. The confirm screen shows the catalog cover photo, then extracted `imageUrl`, then a watch-icon placeholder — in that fallback order
  2. Choosing "Owned" in the picker shows a "Price paid" field; choosing "Wishlist" or "Grail" shows a "Target price" field; "Sold" does not appear as an option
  3. The "Grail" picker option renders a lucide `Star` icon inline; its visual weight matches the other options
  4. The primary CTA label updates dynamically: "Add to Collection", "Add to Wishlist", or "Save as Grail" per the selected status
  5. Clicking "Start over" returns the user to the search idle state without persisting any partial data; clicking "Edit details" opens `WatchForm` with all extracted/catalog data pre-filled and status unlocked
**Plans**: TBD
**UI hint**: yes

### Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene
**Goal**: The two entry surfaces (typeahead search and 4-field structured-input form) are built as components with their own module-scope caches, and all four module-scope caches (including the two pre-existing ones) clear on user signOut via a shared `lastUserId` check
**Depends on**: Phase 67 (`searchCatalogForAddFlow` Server Action)
**Requirements**: SRCH-17, SRCH-18, SRCH-19, SRCH-20, SRCH-21, SRCH-22, SRCH-23, SRCH-24, SRCH-25, SRCH-26, EXTR-05, EXTR-06, EXTR-07, CLNP-07
**Success Criteria** (what must be TRUE):
  1. Typing "speedmaster" in the search input fires results after ~250 ms debounce (not on every keystroke) and only when the query is 2+ characters; results show brand, model, reference, cover photo, and a viewer-state badge ("In collection" / "On wishlist") for owned/wishlist watches
  2. Matched text substrings in result rows are highlighted via `HighlightedText`; each row shows an owners count (e.g., "47 collectors")
  3. Keyboard Up/Down arrows move focus through results; Enter selects the focused result; the combobox uses `role="listbox"` + `role="option"` ARIA
  4. When query length ≥ 3 and no results are found, a no-match empty state renders with a structured-input CTA and a "Have a URL for this watch?" backup link; a persistent "Not finding it?" footer row appears below results when results > 0
  5. Signing out clears all four module-scope caches (`useCatalogSearchCache`, `useStructuredExtractCache`, `useWatchSearchVerdictCache`, `useUrlExtractCache`) — the pre-existing `useWatchSearchVerdictCache` tech-debt leak is closed in the same change
**Plans**: TBD
**UI hint**: yes

### Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring
**Goal**: `AddWatchFlow` is rewritten with a new `FlowState` discriminated union that wires all four flow branches (search-first, structured-input, URL-backup, manual-entry), handles owned/wishlist DUPE redirects, preserves `?manual=1` priority and `?returnTo=` round-trip, and extends the Phase 29 three-layer reset to new caches
**Depends on**: Phase 66, Phase 67, Phase 68, Phase 69
**Requirements**: DUPE-01 (UI part), DUPE-02, DUPE-03 (UI part), CLNP-05, CLNP-06
**Success Criteria** (what must be TRUE):
  1. Clicking a search result whose `viewerState === 'owned'` navigates directly to `/w/[ref]` (no add-flow confirm screen shown); clicking one with `viewerState === 'wishlist'` opens the confirm screen with status defaulting to wishlist and an "Move to Collection" affordance that updates the existing watch row (UPDATE, not INSERT)
  2. An "Add another copy" affordance on the confirm screen lets a user bypass the owned-redirect for legitimate duplicates (e.g., two different references of the same model)
  3. Navigating to `/watch/new?manual=1` bypasses search and lands directly on the structured-input / manual-entry screen, preserving v4.1 Phase 29 priority behavior
  4. The `?returnTo=` URL parameter round-trips correctly — after adding a watch the user is returned to the originating page (e.g., the wishlist empty-state CTA)
  5. Revisiting `/watch/new` after a previous session does not poison state from the prior search or extract — the Phase 29 three-layer reset is extended to the new `useCatalogSearchCache` and `useStructuredExtractCache` caches
**Plans**: TBD
**UI hint**: yes

### Phase 71: Dead Code Cleanup + Static Guards
**Goal**: `VerdictStep`, `WishlistRationalePanel`, and `PasteSection` (and their test files) are deleted from the codebase; two `@vitest-environment node` static guards prevent their reintroduction; `RecentlyEvaluatedRail` disposition is resolved; `FlowState` obsolete variants are removed
**Depends on**: Phase 70 (new flow prod-verified before subtracting legacy code)
**Requirements**: CLNP-01, CLNP-02, CLNP-03, CLNP-04
**Success Criteria** (what must be TRUE):
  1. `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, and `PasteSection.tsx` (plus their test files) are absent from the codebase; `npm run build` exits 0; no remaining callers in `AddWatchFlow.tsx` or elsewhere
  2. `tests/static/AddWatchFlow.no-verdict-step.test.ts` (with `// @vitest-environment node`) fails CI if any of the three deleted component names reappear as imports in `AddWatchFlow.tsx`
  3. `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (with `// @vitest-environment node`) fails CI if `CollectionFitCard` is imported by any file in the add-flow component tree
  4. The `FlowState` discriminated union in `flowTypes.ts` contains only active states (`search-idle`, `search-results`, `structured-input`, `extracting-structured`, `confirming`, plus surviving `form-prefill`, `manual-entry`, `photos-pending`); the old `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist` variants are gone
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 66. API Route Extension | 2/2 | Complete    | 2026-05-28 |
| 67. Server Action + DAL Extensions | 0/? | Not started | - |
| 68. ConfirmStep Component | 0/? | Not started | - |
| 69. SearchEntry + StructuredEntryPanel + Cache Hygiene | 0/? | Not started | - |
| 70. AddWatchFlow State Machine Rewrite + DUPE Wiring | 0/? | Not started | - |
| 71. Dead Code Cleanup + Static Guards | 0/? | Not started | - |

_Phases 51 (Profile Route PPR Opt-Out) + 52 (Cache Components canonical pattern — recurrence-4/5 React #419 fix) were post-v5.2 hotfix phases off main, not part of a numbered milestone; full record in `.planning/milestones/v6.0-phases/` (archived alongside v6.0) and PROJECT.md._
