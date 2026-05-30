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
- ✅ **v8.0 Add-Watch Redesign** — Phases 66-71 (shipped 2026-05-29) — [archive](milestones/v8.0-ROADMAP.md)
- 🔄 **v8.1 Add-Watch Polish** — Phases 72-74 (in progress)
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
<summary>✅ v8.0 Add-Watch Redesign (Phases 66-71) — SHIPPED 2026-05-29</summary>

- [x] Phase 66: API Route Extension (2/2 plans) — completed 2026-05-28
- [x] Phase 67: Server Action + DAL Extensions (3/3 plans) — completed 2026-05-29
- [x] Phase 68: ConfirmStep Component (1/1 plans) — completed 2026-05-29 (shipped dormant; wired in Phase 70)
- [x] Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene (6/6 plans) — completed 2026-05-29
- [x] Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring (8/8 plans, 5 shipped + 3 gap-closure) — completed 2026-05-29
- [x] Phase 71: Dead Code Cleanup + Static Guards (2/2 plans) — completed 2026-05-29

39/39 v8.0 requirements shipped (EXTR 8, SRCH 10, CONF 11, DUPE 3, CLNP 7). All 6 phases prod-deployed in a single bundled push (`418f0515`). Phase 70's 8 + Phase 69's 4 human_verification items walked on prod 2026-05-29 — 9/12 passed, 6 defects captured (SRCH-01/02/03, ROUTE-01, DUPE-04, MOB-01) and promoted to v8.1 polish milestone scope. Phase 70 verifier initially returned `gaps_found` (4/6); plans 70-06/07/08 closed all 4 named code defects (CR-01, CR-02, WR-01, WR-02) before re-verification flipped to `passed` (6/6).

Notable: 70-VERIFICATION.md required manual re-verification after gap-closure plans — `phase.complete` flow doesn't re-run the verifier. Phase 71 widened Vercel prebuild from one static test to the full `tests/static/` directory; 8 pre-existing fs-walking guards retrofitted with `// @vitest-environment node` (commit `418f0515`) to close the Phase 59 landmine class structurally.

See [v8.0-ROADMAP.md](milestones/v8.0-ROADMAP.md) for full phase details.

</details>

<details open>
<summary>🔄 v8.1 Add-Watch Polish (Phases 72-74) — IN PROGRESS</summary>

- [ ] **Phase 72: Search Composition Fixes** — SRCH-01, SRCH-02, SRCH-03
- [ ] **Phase 73: Owned-Redirect Route Fix** — ROUTE-01
- [ ] **Phase 74: DupeBanner Gate Refinement + Mobile Polish** — DUPE-04, MOB-01

**Milestone constraints:**
- `npm run build` (exit 0) is the gate — not `tsc --noEmit` (pre-existing test-file errors) and not `vitest run` (pre-existing CommentGateLocked font-medium failure)
- `workflow.use_worktrees = false` permanently (build-gated project; `.env.local` unavailable in worktrees)
- Each phase ships its own targeted regression test alongside the fix

</details>

## Phase Details

### Phase 72: Search Composition Fixes
**Goal**: Users can find watches using multi-token queries and navigate search results with the keyboard or footer affordance
**Depends on**: Nothing
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. Typing "Brut Datejust" or "Timex Weekender" returns the matching catalog row (same row that appears when typing "Brut" or "Timex" alone)
  2. Pressing Down/Up arrow keys in the combobox moves visual focus through result rows one at a time; pressing Enter on a focused row fires `onPick` (same as clicking that row)
  3. Clicking the "Not finding it? Add manually" footer row — when results are present — expands the inline StructuredEntryPanel with brand/model/reference pre-seeded from the current query
  4. Keyboard navigation does not trap focus; Tab and Escape exit the popup cleanly
**Plans**: 2 plans
- [x] 72-01-PLAN.md — SRCH-01 DAL token-AND fix + regression test (catalog.ts + new catalog-search-tokens.test.ts)
- [x] 72-02-PLAN.md — SRCH-02 isItemEqualToValue + SRCH-03 footer relocation + regression tests (SearchEntry.tsx + SearchEntry.test.tsx)
**UI hint**: yes

### Phase 73: Owned-Redirect Route Fix
**Goal**: Users can navigate to an owned watch from the search results and arrive at a working watch detail page
**Depends on**: Nothing
**Requirements**: ROUTE-01
**Success Criteria** (what must be TRUE):
  1. Clicking an "In collection" result in the search combobox navigates to `/w/[ref]` and the watch detail page renders (not a 404)
  2. The redirect works for any owned watch regardless of whether its catalog row has a non-empty reference field (edge case: null/empty ref handled gracefully — either navigates to the collection or surfaces a recoverable error, not a blank 404)
  3. No change to the redirect behavior for non-owned results (confirm screen still appears for new additions)
**Plans**: TBD

### Phase 74: DupeBanner Gate Refinement + Mobile Polish
**Goal**: Users understand why the ConfirmStep CTA is unavailable when a DupeBanner is shown, and iOS Safari does not auto-zoom inputs across the app
**Depends on**: Nothing
**Requirements**: DUPE-04, MOB-01
**Success Criteria** (what must be TRUE):
  1. When DupeBanner is mounted on the confirm screen, the ConfirmStep primary CTA is either hidden entirely or renders copy that clearly communicates "use the banner above" — not "Saving..."
  2. Focusing any input field (search box, form fields, comment composer, etc.) on iOS Safari does not auto-zoom the page
  3. Intentional pinch-zoom still works after the fix — `maximum-scale=1` is NOT used in the viewport meta tag
  4. The font-size fix does not introduce visual regressions in other form contexts (WatchForm, comment composer, filters)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 72. Search Composition Fixes | 2/2 | Complete   | 2026-05-30 |
| 73. Owned-Redirect Route Fix | 0/? | Not started | - |
| 74. DupeBanner Gate Refinement + Mobile Polish | 0/? | Not started | - |

_Phases 51 (Profile Route PPR Opt-Out) + 52 (Cache Components canonical pattern — recurrence-4/5 React #419 fix) were post-v5.2 hotfix phases off main, not part of a numbered milestone; full record in `.planning/milestones/v6.0-phases/` (archived alongside v6.0) and PROJECT.md._
