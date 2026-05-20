# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- ✅ **v5.0 Discovery North Star** — Phases 32-42 (shipped 2026-05-16) — [archive](milestones/v5.0-ROADMAP.md)
- ✅ **v5.1 Explore Page Redesign** — Phases 43-47 (shipped 2026-05-19) — [archive](milestones/v5.1-ROADMAP.md)
- 🚧 **v5.2 Polish + Taxonomy** — Phases 48-50 (in progress)
- 📋 **v6.0 Social Interaction** — planted (SEED-012)
- 📋 **v7.0 Watch Photos** — planted (SEED-013)
- 📋 **v8.0 Add-Watch Redesign** — planted (SEED-010)
- 💤 **Catalog Expansion** — unscheduled; catalog strategy under review (SEED-009)
- 💤 **Market Value** — future, after v8.0 (SEED-005; needs the SEED-007 pricing spike)

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

### v5.2 Polish + Taxonomy (Phases 48-50 + 49.1)

- [x] **Phase 48: User-Facing Bug Fixes** - Fix wishlist ownership mislabel and dark-mode chip contrast (completed 2026-05-19)
- [x] **Phase 49: Genre vs Style Taxonomy Spike** - Audit overlap and produce written recommendation (completed 2026-05-19)
- [ ] **Phase 49.1: Remove Genre Surface** (INSERTED) - Implement spike recommendation: drop `primary_archetype` + chips + `/explore/genres`, rebalance similarity
- [ ] **Phase 50: Watch-Detail Architecture Spike** - Compare two-view vs merged-view and produce written decision

### 📋 v6.0 Social Interaction (Planted)

Not yet roadmapped — seeded as SEED-012. A scoped social layer on the existing Rdio-style discovery: open likes on collections/wishlists/wears; comments on wears + collections for any authed user, wishlist comments gated to mutual followers. Explicitly not "Instagram for watches."

### 📋 v7.0 Watch Photos (Planted)

Not yet roadmapped — seeded as SEED-013. Multi-photo carousel per watch (replacing the single `imageUrl`); public wear pics surface on watch detail; wear pics persist in the Wears tab (Home rail stays ephemeral); add-watch flow encourages photos with a per-person cap.

### 📋 v8.0 Add-Watch Redesign (Planted)

Not yet roadmapped — seeded as SEED-010. Search-first add-watch flow. The catalog-depth dependency is under review now that Catalog Expansion is unscheduled.

### 💤 Catalog Expansion (Unscheduled)

Seeded as SEED-009 — catalog breadth expansion past the ~100-row bootstrap. Unscheduled: the catalog-growth strategy is being rethought (decision 2026-05-19).

### 💤 Market Value (Future)

Seeded as SEED-005 — Watch Charts integration + total-value insights. Sits after v8.0; needs the SEED-007 market-pricing API spike first. (No longer numbered v6.0 — that slot is now Social Interaction.)

## Phase Details

### Phase 48: User-Facing Bug Fixes
**Goal**: Both live production bugs are resolved — wishlist watches are correctly labeled, and `/search` filter chips are legible in dark mode
**Depends on**: Nothing (first phase of v5.2)
**Requirements**: BUG-01, BUG-02
**Success Criteria** (what must be TRUE):
  1. A watch on the user's wishlist, reached via `/catalog/[catalogId]` from search, displays a wishlisted state label — never "you own this watch"
  2. All `/search` filter chip groups (movement, size, style, brand, era, genre, archetype) render with legible text contrast in dark mode — no black text on dark backgrounds
  3. The ownership-state fix does not regress the "you own this watch" label for watches the user actually owns
**Plans**: 3 plans
- [x] 48-01-PLAN.md — BUG-01 catalog ownership query fix + regression tests (status=owned filter, 3 new test cases, profiles mock)
- [x] 48-02-PLAN.md — Shared CVA Chip primitive (src/components/ui/chip.tsx) with BUG-02 token fix baked in + unit tests
- [x] 48-03-PLAN.md — Migrate all 8 chip surfaces to primitive (7 drawer chips + SearchPageClient) + manual dark-mode UAT
**UI hint**: yes

### Phase 49: Genre vs Style Taxonomy Spike
**Goal**: A written recommendation exists — backed by code evidence — on whether `genre` and `style` should be consolidated, one removed, or kept as-is
**Depends on**: Phase 48
**Requirements**: TAX-01
**Success Criteria** (what must be TRUE):
  1. A spike document maps every consumer of `genre` and `style` (filters, similarity engine, `/explore` Browse indices, watch cards) — showing what each field actually does at each callsite
  2. The document identifies where the fields overlap, diverge, or produce redundant UI/data
  3. The document delivers a clear recommendation (consolidate / remove one / keep both) with rationale strong enough to act on
  4. No consolidation or removal implementation is shipped in this phase unless the spike specifically flags it as cheap and strongly favored — in which case a new requirement is added mid-milestone
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 49-01-PLAN.md — Consumer audit: write Domain + Consumer Map + Overlap & Divergence Matrix (§1-3) covering all 9 D-01 surfaces

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 49-02-PLAN.md — Live-catalog evidence: run 5 D-07 SQL queries against prod/mirror and embed results in §4

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 49-03-PLAN.md — Synthesis: write Options + Decision Matrix + Recommendation + Cost Estimate + Ship-Now Eligibility (§5-9)

### Phase 49.1: Remove Genre Surface (INSERTED)
**Goal**: The genre/archetype taxonomy surface is removed: `primary_archetype` column dropped from `watches_catalog`, `GenreChips` + `ArchetypeChips` + `/explore/genres` + `archetype-config.ts` deleted, catalog DAL and similarity engine updated. Single source of truth for the functional-category axis becomes `style_tags`.
**Depends on**: Phase 49
**Requirements**: TAX-02
**Inserted**: 2026-05-19 mid-milestone per Phase 49 spike §9 Ship-Now: YES verdict (ROADMAP SC#4 escape hatch)
**Source**: `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` §7 (Primary recommendation: `remove-genre`) + §8 (Cost row B) + §9 (Ship-Now eligibility)
**Success Criteria** (what must be TRUE):
  1. `watches_catalog.primary_archetype` column no longer exists in `src/db/schema.ts` and the drop has been pushed to prod via `supabase db push --linked` (one drizzle migration + one supabase migration)
  2. `src/components/search/GenreChips.tsx`, `src/components/search/ArchetypeChips.tsx`, `src/app/explore/genres/page.tsx`, and `src/lib/archetype-config.ts` are deleted; `FilterDrawer.tsx` no longer imports/renders either chip group; `BrowseModule.tsx` no longer links to `/explore/genres`
  3. `CatalogSearchFilters` in `src/data/catalog.ts` no longer has `genre` or `archetype` fields; the archetype-wins tiebreaker at line 446 is removed; `getBrowseGenreCounts()` is deleted from `src/data/browse.ts`
  4. The 0.04 `TASTE_SUB_WEIGHTS.archetypeMatch` weight in `src/lib/similarity.ts` is redistributed across the remaining taste sub-budget (sub-weights sum to 1.0 invariant preserved); the archetype categorical-match block at line 125 is removed
  5. The enricher in `src/lib/taste/vocab.ts` no longer writes `primary_archetype` (the column is gone)
  6. `/explore/genres` returns 404 (route removed); no internal links to it remain (grep `grep -r "/explore/genres" src/` returns zero matches)
  7. Existing tests still pass; new tests cover the simplified search filter surface and the rebalanced similarity weights
**Plans**: 8 plans

Plans:
**Wave 0** *(test scaffolds — must complete before Wave 1)*
- [x] 49.1-01-PLAN.md — Wave 0 test scaffolds (migration-drop integration test, /explore/genres 404 smoke test, CollectionFitCompareTable component test)

**Wave 1** *(4 parallel sub-plans — Plans 03 and 04 depend on 49.1-01 Wave 0 tests; Plans 02 and 05 have no Wave 0 dependency)*
- [x] 49.1-02-PLAN.md — Verdict engine pivot to era axis (templates + composer + viewerTasteProfile + types + fit-delta + verdict tests)
- [x] 49.1-03-PLAN.md — /explore rail rewire + chip+route deletions (browse.ts unnest(style_tags) + GenreChips/ArchetypeChips/explore-genres deletions + BrowseModule tile + FilterDrawer + CollectorArchetypes deep-link repoint + tests)
- [x] 49.1-04-PLAN.md — Direct-UI archetype drops (ReferenceIdentityCard era-only headline + CompareTable 5-row + SearchPageClient slim header + searchSchema Zod + tests)
- [x] 49.1-05-PLAN.md — Similarity engine rebalance (algorithmic 1.25× RESCALE on TASTE_SUB_WEIGHTS + archetype categorical block delete + invariant tests)

**Wave 2** *(blocked on Wave 1 — type-system unification + enricher chain)*
- [x] 49.1-06-PLAN.md — Type unification + DAL cleanup + enricher chain (types.ts CatalogTasteAttributes + catalog page projection + watches.ts LEFT JOIN + catalog.ts filters/tiebreaker/mapper/UPSERT + enricher.ts + prompt.ts + vocab.ts + 5 affected test files)

**Wave 3** *(blocked on Wave 2 — schema drop on local DB)*
- [x] 49.1-07-PLAN.md — schema.ts column removal + drizzle/0012 migration authored; `drizzle-kit push` deferred to user (worktree lacks DATABASE_URL)

**Wave 4** *(blocked on Wave 3 — autonomous:false; runs ONLY after prod deploy of Plans 02-07)*
- [x] 49.1-08-PLAN.md — supabase/migrations/20260520070000_phase49_1_drop_primary_archetype.sql authored + `supabase db push --linked` applied 2026-05-20; migration `20260520070000` recorded on prod (Remote = Local in migration list)

### Phase 50: Watch-Detail Architecture Spike
**Goal**: A written decision exists on whether to keep `/catalog/[catalogId]` and `/watch/[id]` as separate views or merge them into a single adaptive detail surface
**Depends on**: Phase 48
**Requirements**: ARCH-01
**Success Criteria** (what must be TRUE):
  1. The decision document describes what each route currently does and who reaches it (owner, wishlist-holder, anonymous visitor, cross-user browse)
  2. The document lays out the concrete pros and cons of keeping separate views vs merging, with the v7.0 Watch Photos milestone explicitly considered (multi-photo carousel + wear-pic surfacing)
  3. The document delivers a clear decision (keep separate / merge) with enough specificity that `/gsd-plan-phase` for Phase 50 can execute against it
  4. No merge implementation is shipped in this phase unless the spike strongly favors it and it is cheap — in which case a new requirement is added mid-milestone
**Plans**: 4 plans

Plans:
**Wave 1**
- [ ] 50-01-PLAN.md — Scaffold 50-SPIKE.md + write §1 Domain + §2 Audience Matrix (viewer-state × ref-identity per D-AUDIENCE-01) + §3 Route Reality Today (12 /watch + 7 /catalog entry-point map + BUG-01 evidence)

**Wave 2** *(blocked on Wave 1 — same file)*
- [ ] 50-02-PLAN.md — §4 Variants A-E (5 subsections including proxy.ts router-cache landmine for Variant B) + §7 Cost Estimate per Variant table

**Wave 3** *(blocked on Wave 2 — section splice between §4 and §7)*
- [ ] 50-03-PLAN.md — §5 v7.0 Watch Photos Lens (4 sub-points × 5 variants per D-V7-LENS-01) + §6 Decision Matrix (5 variants × 7 locked criteria from D-VARIANTS-02)

**Wave 4** *(blocked on Wave 3 — synthesis)*
- [ ] 50-04-PLAN.md — §8 Recommendation (definitive primary variant verdict) + §9 Ship-Now Eligibility (verbatim format from 49-SPIKE.md §9)

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 48. User-Facing Bug Fixes | 3/3 | Complete    | 2026-05-19 |
| 49. Genre vs Style Taxonomy Spike | 3/3 | Complete    | 2026-05-19 |
| 49.1. Remove Genre Surface (INSERTED) | 7/8 | In Progress|  |
| 50. Watch-Detail Architecture Spike | 0/4 | Planned     | - |

## Next Up

v5.2 Polish + Taxonomy is active (Phases 48-50, 4 requirements). Phase 48 is planned (3 plans, 2 waves). Execute with `/gsd-execute-phase 48`.
