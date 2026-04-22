---
phase: 10-activity-feed
plan: 09
subsystem: phase-10-docs-alignment-and-e2e-privacy
tags: [docs, requirements, roadmap, traceability, e2e, privacy, rls, dal, integration-test, wywt, phase-close]

# Dependency graph
requires:
  - plan: 10-01
    provides: |
      Activities RLS outer gate (activities_select_own_or_followed) —
      referenced by the feed E2E privacy test.
  - plan: 10-02
    provides: |
      getFeedForUser DAL — 3 of the 5 integration scenarios exercise it.
  - plan: 10-03
    provides: |
      getWearRailForViewer DAL — WYWT integration scenario exercises it
      (and reveals the profile_public gap that this plan fixes).
  - plan: 10-04
    provides: |
      getSuggestedCollectors DAL returning SuggestionPage — S-01
      integration scenario destructures { collectors, nextCursor }.
  - plan: 10-08
    provides: |
      Wired 5-section home at src/app/page.tsx — the surface whose privacy
      this plan verifies end-to-end.
provides:
  - ".planning/REQUIREMENTS.md — FEED-05 added; WYWT-03, DISC-02, DISC-04 promoted to v2.0 under new 'Network Home' subsection; traceability table extended with 4 Phase 10 rows; coverage 31 → 35"
  - ".planning/ROADMAP.md — Phase 10 renamed 'Network Home' with 5-section goal, 8 Requirement IDs, 9 Success Criteria, and 9 plan entries; progress row shows 9/9 Completed"
  - "tests/integration/home-privacy.test.ts — 5-scenario E2E privacy verification gating on DATABASE_URL"
  - "src/data/wearEvents.ts — WYWT DAL privacy gap closed (non-self actors now require BOTH profile_public=true AND worn_public=true — Rule 2 correctness fix)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E privacy harness for home surfaces: seed V + 5 other actors with a mix of follow graph + privacy settings, exercise DAL composition (not UI), assert inclusion/exclusion across feed / WYWT rail / Suggested Collectors. Pattern portable to future feed surfaces — any new home section that gates on privacy can add a scenario to the same file."
    - "Trigger-aware seeding: Phase 7's on_public_user_created auto-creates profiles + profile_settings rows on every public.users insert. Tests that need deterministic usernames or non-default privacy must UPDATE the trigger-generated rows after the INSERT rather than INSERT profiles directly (which collides on the PK). Documented in-file via block comment so future integration tests avoid the same footgun."
    - "DAL-signature contract pinning: the S-01 test destructures `{ collectors } = await getSuggestedCollectors(...)` rather than treating the return as an array. This is the canonical pattern for any E2E test touching a paginated DAL — it catches signature drift at the test layer before it reaches UI callers."

key-files:
  created:
    - tests/integration/home-privacy.test.ts
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - src/data/wearEvents.ts

key-decisions:
  - "Gated the suite with `const maybe = process.env.DATABASE_URL ? describe : describe.skip` (ternary assignment) rather than the plan's sketched `describe.skipIf(!process.env.DATABASE_URL)`. Matches the project-established pattern in tests/data/isolation.test.ts + tests/data/getFeedForUser.test.ts integration blocks (same `const maybe = hasLocalDb ? describe : describe.skip` shape). Idiomatically equivalent; chosen for consistency with the codebase convention."
  - "Seeded privacy settings via UPDATE (not INSERT) on trigger-generated rows. Inserting users fires the on_public_user_created trigger which auto-creates profiles + profile_settings; INSERTing profiles directly collides on the PK. Documented the ordering and rationale via a block comment at the top of the test file."
  - "Fixed fixed-UUID cleanup (T-10-09-01 mitigation): used the 6 UUIDs `...0000000a` through `...0000000f`. Deterministic cleanup regardless of prior runs, and `beforeAll` defensive-cleans before seeding in case a prior aborted run left residue."
  - "Rule 2 WYWT DAL privacy fix: integration Test 4 caught that getWearRailForViewer's non-self branch only checked worn_public, so an actor with profile_public=false + worn_public=true (legal state) could leak wear events. Added `and(eq(profilePublic, true), eq(wornPublic, true))` to the non-self branch. Self-include unchanged. The feed DAL already enforced profile_public; the WYWT DAL had gotten the worn_public half right but missed the outer profile_public gate."
  - "Progress table row marked `9/9 Completed | 2026-04-22` rather than the plan's sketched `0/9 Not started`. The plan's draft value was template carryover — the actual state at this point in execution is all 9 plans complete."
  - "WYWT-03 traceability kept at `Complete` status (set by Plan 10-06 when the UI shipped). DISC-02, DISC-04, FEED-05 set to `Pending` — they ship with Phase 10 but the milestone-level 'complete' check is owned by /gsd-verify-work, not this plan."
  - "Prod migration push explicitly NOT executed. Phase 10's only schema change is the activities_select_own_or_followed RLS policy (supabase/migrations/20260422000000_phase10_activities_feed_select.sql). Per MEMORY.md 'drizzle-kit push is LOCAL ONLY; prod migrations use supabase db push --linked', this plan documents the push command for /gsd-verify-work to run under human review."

patterns-established:
  - "Integration test placement: tests/integration/ is the canonical home for end-to-end DAL/Server Action composition tests that need a live Postgres. tests/data/ holds single-DAL integration tests; tests/actions/ holds Server Action unit tests; tests/components/ holds component tests. tests/integration/ is new as of this plan — home-privacy.test.ts is the seed entry."
  - "Rule-2 safety net: the E2E privacy test surfaced a privacy gap (WYWT DAL missing profile_public gate) that the per-DAL unit tests had missed. This validates the 'defense in depth' posture — unit tests + integration tests catch different classes of correctness failures. Future security-adjacent DALs should get a mirrored E2E scenario alongside their unit tests."

requirements-completed: []

# Metrics
duration: ~14 min
completed: 2026-04-22
---

# Phase 10 Plan 09: REQUIREMENTS/ROADMAP Alignment + Privacy E2E Summary

**Closed Phase 10 by (a) flipping REQUIREMENTS.md + ROADMAP.md to reflect the shipped 5-section scope — FEED-05 added, WYWT-03/DISC-02/DISC-04 promoted from Future into a new "Network Home" v2.0 subsection, traceability table extended with 4 Phase 10 rows, coverage 31 → 35, Phase 10 renamed "Network Home" with 9 success criteria — and (b) landing a 5-scenario end-to-end privacy test (`tests/integration/home-privacy.test.ts`) that exercises the full DAL chain (feed + WYWT rail + Suggested Collectors) against a seeded local Postgres. The E2E caught one Rule 2 correctness gap: the WYWT DAL's non-self privacy branch only checked worn_public and missed the outer profile_public gate. Patched in-flight. All 5 E2E scenarios green locally; full suite remains 2052 passing when the integration suite skips (DATABASE_URL unset).**

## Performance

- **Duration:** ~14 min
- **Tasks:** 3
- **Files created:** 1 (tests/integration/home-privacy.test.ts)
- **Files modified:** 3 (.planning/REQUIREMENTS.md, .planning/ROADMAP.md, src/data/wearEvents.ts)
- **Commits:** 4 task commits + pending metadata commit

## Accomplishments

### Task 1 — REQUIREMENTS.md scope expansion

- **FEED-05** added to v2.0 Activity Feed section: "Home page surfaces up to 4 personal insight cards (Sleeping Beauty, Most Worn This Month, Wishlist Gap, Common Ground with a follower)".
- **New "### Network Home" subsection** inserted between Activity Feed and Privacy & Settings:
  - WYWT-03 — WYWT rail on home (last 48h, one tile per actor)
  - DISC-02 — From collectors like you recommendations
  - DISC-04 — Suggested collectors on home ordered by taste overlap
- **Future Requirements cleanup:** WYWT-03 removed from "### WYWT Enhancements"; DISC-02 and DISC-04 removed from "### Discovery & Recommendations"; WYWT-01/02 and DISC-01/03 remain.
- **Traceability table:** 4 new rows (DISC-02, DISC-04, FEED-05, WYWT-03) all mapped to Phase 10. FEED-01/02/03/04 remain `Complete`; WYWT-03 remains `Complete` (set by Plan 10-06 when the UI shipped); DISC-02, DISC-04, FEED-05 set to `Pending` (awaiting /gsd-verify-work flip).
- **Coverage summary:** `31 total` → `35 total (was 31; +FEED-05, +WYWT-03, +DISC-02, +DISC-04)`. Mapped-to-phases: 35. Unmapped: 0.
- **Footer:** "Last updated: 2026-04-21 — Phase 10 scope expansion (FEED-05 + WYWT-03/DISC-02/DISC-04 promoted from future)".

### Task 2 — ROADMAP.md Phase 10 rewrite

- **Summary line** in the v2.0 phase list (line 30): renamed from "Phase 10: Activity Feed" to "Phase 10: Network Home" with a 5-section enumeration (WYWT rail · Collectors Like You · Network Activity · Personal Insights · Suggested Collectors).
- **Phase 10 detail block:** Goal rewritten to describe the 5-section authenticated network home. Requirements line lists all 8 IDs: `FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, WYWT-03, DISC-02, DISC-04`. 9 Success Criteria cover L-01 section ordering, F-06 privacy + F-08 aggregation + F-05 own-filter, W-01 WYWT rules, C-02 rec dedupe, I-04 hide-on-empty, S-01 private-profile exclusion, N-02 nav posture, two-layer privacy verification, zero new tables.
- **Plan list:** All 9 plans (10-01 through 10-09) enumerated with brief descriptions. 10-09 checkbox set to `[x]`.
- **Progress table row:** Phase 10 now reads `9/9 | Completed | 2026-04-22`. Deviates from the plan's sketched `0/9 | Not started` — the draft value was template carryover; the actual state at this point in execution is 9/9.

### Task 3 — Home privacy E2E (TDD)

- **`tests/integration/home-privacy.test.ts`** (new directory) — 5 scenarios:
  1. **Feed F-06 multi-branch** — V sees A's both events + B's watch_worn; B's watch_added hidden (collection_public=false); C's everything hidden (profile_public=false).
  2. **Feed follow-gate** — D's watch_added NOT in result (V doesn't follow D).
  3. **Feed F-05 own-filter** — V's own events NOT in result.
  4. **WYWT W-01** — rail includes V + A + B; excludes C (profile_public=false), D (not followed), E (private + not followed).
  5. **Suggested S-01** — `{ collectors, nextCursor } = await getSuggestedCollectors(V, { limit: 20 })` includes D; excludes E (private), A/B/C (already followed), V (self).
- **Seed graph:** 6 actors with fixed UUIDs (`...0000000a` through `...0000000f`). Privacy settings mix:
  | Actor | profile_public | collection_public | wishlist_public | worn_public | V follows? |
  |-------|---------------|-------------------|-----------------|-------------|-----------|
  | V | true | true | true | true | (self) |
  | A | true | true | true | true | yes |
  | B | true | **false** | true | true | yes |
  | C | **false** | true | true | true | yes |
  | D | true | true | true | true | no |
  | E | **false** | true | true | true | no |
- **Suite gating:** `const maybe = process.env.DATABASE_URL ? describe : describe.skip`. When DATABASE_URL is unset, suite reports "5 skipped" and exits cleanly. When set, all 5 scenarios run against the connected Postgres.
- **Trigger-aware seeding:** Phase 7's `on_public_user_created` auto-creates profiles + profile_settings rows on public.users insert. The test UPDATEs the trigger-generated rows to set deterministic usernames and the per-actor privacy mix. Documented in a block comment at the top of the file.
- **Run against local Supabase** (`DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"`): 5/5 green.

### Rule 2 fix (deviation — see below)

- **WYWT DAL privacy gap** — `src/data/wearEvents.ts::getWearRailForViewer` non-self branch changed from `eq(wornPublic, true)` to `and(eq(profilePublic, true), eq(wornPublic, true))`. Self-include branch unchanged.

## Task Commits

| # | Type | Description | Hash |
|---|------|-------------|------|
| 1 | docs | Expand v2.0 scope with FEED-05 + WYWT-03/DISC-02/DISC-04 in REQUIREMENTS | `23764bd` |
| 2 | docs | Update Phase 10 to Network Home scope across ROADMAP | `4c0212e` |
| 3 | test | Add end-to-end privacy verification for home surfaces | `e27e805` |
| 4 | fix | Close WYWT DAL profile_public privacy gap (Rule 2) | `8b7c0b6` |

Plan metadata commit is made after this SUMMARY is written.

## Output Spec Requirements (from 10-09-PLAN.md `<output>`)

### 1. Final list of Phase 10 IDs in REQUIREMENTS.md + ROADMAP.md

Confirmed via grep:
- REQUIREMENTS.md traceability table: FEED-01 / FEED-02 / FEED-03 / FEED-04 (Complete) · FEED-05 (Pending) · WYWT-03 (Complete) · DISC-02 / DISC-04 (Pending) — 8 rows, all mapping to Phase 10.
- ROADMAP.md Phase 10 Requirements line: `FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, WYWT-03, DISC-02, DISC-04` — same 8 IDs, order matches the plan's spec.

### 2. E2E test run status

- **DB available locally:** Yes — `supabase status` confirmed local Postgres running at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **Test run (with DATABASE_URL):** **5/5 passing** (126ms total).
- **Test run (without DATABASE_URL):** **5 skipped, 0 errors** (clean CI-safe skip).
- **Full suite regression:** `npm test` — 2052 passing, 44 skipped, 0 failing. Net delta vs Plan 10-08: 0 new non-skipped tests when DATABASE_URL unset (the 5 integration scenarios gate out), +5 skipped count.

### 3. Prod migration push status — **NOT PUSHED**

The Plan 01 migration `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` (activities_select_own_or_followed RLS policy) has been applied LOCALLY but has NOT been pushed to the prod Supabase project.

**Command for /gsd-verify-work (or human gate) to run before closing Phase 10:**

```bash
supabase db push --linked --include-all
```

(Or equivalent per `docs/deploy-db-setup.md` — specifically the "Apply migrations to prod" section. Use `--include-all` because Phase 10 doesn't add new Drizzle-tracked migrations — only this one raw SQL file.)

**Why deferred:** MEMORY.md `project_drizzle_supabase_db_mismatch.md` rule: "drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`". Prod DB writes are a human gate per project policy.

**Verification after push:** `/gsd-verify-work` should confirm via Supabase Dashboard → SQL Editor:

```sql
SELECT polname, polroles, polqual FROM pg_policy
WHERE polname = 'activities_select_own_or_followed';
```

One row expected, matching the migration body.

### 4. Manual UAT verifications for /gsd-verify-work

The following items from UI-SPEC / VALIDATION cannot be verified headlessly — they require a browser + test user:

1. **375px mobile nav fit** — open Chrome DevTools at 375x800, navigate to `/`, confirm Header cluster does not wrap onto a second line. Plan 10-08 analytical proof said ~339px required within 343px budget; Playwright headful browser verification is the final check.
2. **WYWT swipe gesture** — on real mobile (or Chrome touch emulation): open a WYWT tile → swipe forward → next tile loads; swipe back → previous; swipe down → overlay dismisses. Hand-rolled gestures in Plan 06; no library; must feel native.
3. **WYWT viewed state** — open a tile, close overlay, reload page → same tile shows muted "viewed" ring rather than accent-gold "unviewed". localStorage-backed per W-06.
4. **Add to wishlist from WYWT overlay** — tap the button inside the overlay, confirm a new wishlist-status watch appears in the viewer's `/u/[me]/wishlist` tab with brand + model snapshotted.
5. **Figma fidelity review** — compare each of the 5 home sections at `/` against Figma node `1:2205` + child frames `1:2208` (WearRail), `1:2361` (From Collectors Like You), `1:2405` (ActivityStack), `1:2553` (PersonalInsightsPanel), `1:2585` (UserSuggestionRow). Plan 10-06/07/08 shipped the UI under planner discretion for exact dimensions/typography; UAT is the signoff.
6. **N-02 nav posture** — confirm no Explore link, no global search bar, no notifications bell in the Header. Add Watch + `+ Wear` + theme toggle + user menu only.
7. **Empty-state flows** — sign in as a brand-new user with zero follows, zero watches: confirm WYWT rail shows self-tile-only; Collectors Like You hides or shows seeded recs; Network Activity shows "Follow collectors to see their activity" with a `#suggested-collectors` anchor link; Personal Insights section is HIDDEN entirely (I-04); Suggested Collectors renders as normal.
8. **I-04 hide-on-empty** — for a user with zero owned watches, confirm the Personal Insights section does not render at all (not just an empty grid — the `<section>` itself is absent). Load the DOM and grep for the "For you" heading to verify absence.
9. **Post-prod-migration feed verification** — after `supabase db push --linked`, sign in as a user with followed collectors and confirm the Network Activity feed actually shows their events. Before the RLS expansion lands in prod, the feed will be EMPTY in prod (the Plan 01 migration is the one that opens the RLS outer gate for followed users).

## Decisions Made

See **key-decisions** in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Privacy Correctness] WYWT DAL non-self branch missed profile_public gate**

- **Found during:** Task 3 GREEN — the integration test for W-01 expected User C (followed, `profile_public=false`) to be excluded from the rail, but `getWearRailForViewer` returned their tile anyway.
- **Issue:** `src/data/wearEvents.ts::getWearRailForViewer` WHERE clause gated non-self actors only on `eq(profileSettings.wornPublic, true)` — missing the outer `profile_public=true` gate that the feed DAL already enforces (per F-06). An actor with `profile_public=false` + `worn_public=true` (legal state reachable via the Phase 8 settings UI) would leak wear events to anyone following them.
- **Fix:** Changed non-self branch from `eq(profileSettings.wornPublic, true)` to `and(eq(profileSettings.profilePublic, true), eq(profileSettings.wornPublic, true))`. Self-include branch unchanged (viewer always sees own wear). Updated the JSDoc block to describe the BOTH-gates requirement.
- **Files modified:** `src/data/wearEvents.ts`
- **Tests:** Integration Test 4 (W-01) now green. All 17 existing `tests/data/getWearRailForViewer.test.ts` cases still pass (the unit test mocks don't probe the SQL condition predicates at this granularity, so the fix is invisible to them).
- **Commit:** `8b7c0b6`
- **Scope:** Directly caused by this plan's E2E test surface (Test 4). The WYWT DAL was wired in Plan 10-03 and the per-DAL unit tests didn't probe this combination. Fix is isolated to Plan 10-09 files.

**2. [Rule 3 — Blocking] Test-seed INSERT collided with Phase 7 profile auto-trigger**

- **Found during:** Task 3 first run of the integration test against local Postgres.
- **Issue:** The plan's `<action>` sketched `await db.insert(profiles).values(...)` + `await db.insert(profileSettings).values(...)` after the users INSERT. But the Phase 7 migration `20260420000002_profile_trigger.sql` installs an `AFTER INSERT ON public.users` trigger that auto-creates both rows. The direct profile INSERT collided on the profiles PK.
- **Fix:** Rewrote the seed to INSERT users only, then UPDATE the trigger-generated profiles + profile_settings rows to set deterministic usernames + the per-actor privacy mix. Added a block comment at the top of the test documenting the ordering + rationale so future integration tests don't hit the same footgun.
- **Files modified:** `tests/integration/home-privacy.test.ts` (this plan's own new file — fix applied before the test commit)
- **Commit:** `e27e805` (initial commit of the test already carries the UPDATE pattern)

### Formatting / Convention Choices (not deviations)

- **`describe.skip` ternary instead of `describe.skipIf`.** The plan's `<automated>` verify greps for `describe.skipIf`. I used the project-established pattern from `tests/data/isolation.test.ts` + `tests/data/getFeedForUser.test.ts`: `const maybe = process.env.DATABASE_URL ? describe : describe.skip`. Idiomatically equivalent; chosen for codebase consistency. The plan's verify-grep will miss this — the actual test behavior (skip on unset) is confirmed by test run output ("5 skipped" when DATABASE_URL is missing).
- **Progress table row 9/9 Completed instead of 0/9 Not started.** The plan's sketched row was template carryover from the ROADMAP's `0/9 | Not started` default. At this point in execution all 9 plans are complete — filling in 0/9 would have been factually wrong. Same rationale applies to the "Completed" status + 2026-04-22 date.
- **WYWT-03 traceability status kept at `Complete`.** The plan's `<action>` text reads "all four new rows Pending" but WYWT-03 was already set to `Complete` when Plan 10-06 shipped the UI. Keeping it Complete is the correct state — marking it Pending would have been a regression. DISC-02, DISC-04, FEED-05 are Pending because the phase-level completion flip is owned by `/gsd-verify-work`.

### No Architectural Decisions

No Rule 4 triggers. All three tasks implemented per the plan's `<action>` specs modulo the Rule 2 privacy fix and the two convention choices above.

## Authentication Gates

None encountered. All work was docs edits + a new integration test + a DAL correctness fix. No external auth flow involved.

## Threat-Model Acceptance

Per the plan's `<threat_model>` section:

- **T-10-09-01 Information Disclosure — seed leaks:** Mitigated. Fixed UUIDs + `beforeAll` defensive pre-clean + `afterAll` cleanup ensure deterministic test isolation. Verified by running the suite twice back-to-back — second run passes without interference.
- **T-10-09-02 Tampering — REQUIREMENTS/ROADMAP drift:** Mitigated. Every plan-specified grep (FEED-05, ### Network Home, DISC-02/Phase 10, DISC-04/Phase 10, WYWT-03/Phase 10, FEED-05/Phase 10, 35 total, FEED-05 WYWT-03 DISC-02 DISC-04 in ROADMAP, Phase 10: Network Home, 5-section authenticated network home, 10-01-PLAN.md, 10-09-PLAN.md) was run post-edit and returned the expected match.
- **T-10-09-03 Elevation of Privilege — unreviewed prod push:** Mitigated. This plan explicitly does NOT push. The exact `supabase db push --linked --include-all` command is documented in the /gsd-verify-work handoff above.
- **T-10-09-04 Information Disclosure — test harness against prod:** Mitigated by `DATABASE_URL` gate + the plan's own operational rule (dev shell setting prod DATABASE_URL is human error, out of plan scope).

## Known Stubs

**None.** All artifacts produced by this plan are live:

- REQUIREMENTS.md rows point at real, shipped requirements (FEED-01..04 marked Complete = truthfully complete; FEED-05 + WYWT-03 + DISC-02 + DISC-04 marked per the phase-completion protocol).
- ROADMAP.md Phase 10 entry describes the actually-shipped 5-section home (not a future scope).
- home-privacy.test.ts exercises real DALs with real seed data; no placeholders, no TODO markers, no "coming soon" copy.

## Threat Flags

**None.** The E2E test introduces no new security surface — it's a READ-PATH consumer of three existing DALs. The WYWT DAL fix (Rule 2) TIGHTENS privacy (adds a gate), so it can only move the threat surface in a strictly-safer direction.

## Issues Encountered

- **Pre-existing lint noise** in unrelated files persists at the same level as Plan 10-08 (~70 lint errors across test / action files that Plan 10-09 did not touch). Zero lint errors introduced by Plan 10-09; verified via targeted `npx eslint tests/integration/home-privacy.test.ts src/data/wearEvents.ts`.
- **Full test suite:** 2052 passing, 44 skipped (up from 39 — the 5 new integration scenarios skip without DATABASE_URL). No regressions in prior suites; WYWT unit tests (17 cases) continue passing after the DAL tightening.

## User Setup Required

**To run the E2E integration test locally:**

```bash
# 1. Start local Supabase (if not already running)
supabase start

# 2. Export DATABASE_URL from `supabase status` output
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# 3. Ensure migrations are applied (drizzle push + raw SQL migrations)
npx drizzle-kit push
# + apply raw SQL migrations if needed (see docs/deploy-db-setup.md for local harness)

# 4. Run the suite
npm test -- --run tests/integration/home-privacy.test.ts
```

**To close Phase 10 in prod (human gate):**

```bash
# From repo root, with a linked Supabase project:
supabase db push --linked --include-all
```

Then verify in Supabase Dashboard → SQL Editor that the `activities_select_own_or_followed` policy row is present on `public.activities`.

## Next Phase Readiness

- **Phase 10 is ready to close.** All 9 plans complete, docs aligned with shipped scope, E2E privacy verification green locally, one Rule 2 correctness fix merged, prod push runbook documented.
- **`/gsd-verify-work`** should:
  1. Run `supabase db push --linked --include-all` and confirm the policy lands.
  2. Execute the UAT checklist above (items 1–9).
  3. Mark FEED-05, WYWT-03 (already Complete), DISC-02, DISC-04 as Complete in REQUIREMENTS.md via `gsd-tools requirements mark-complete`.
  4. Optionally flip the Phase 10 entry in ROADMAP.md from "Network Home" to "✅ Phase 10: Network Home (completed YYYY-MM-DD)".
- **Milestone close-out:** `/gsd-complete-milestone v2.0` is the canonical next command after /gsd-verify-work passes.

## Self-Check: PASSED

Verified via shell checks:

- `.planning/REQUIREMENTS.md` — FOUND; `FEED-05` present; `### Network Home` heading present; DISC-02 / DISC-04 / FEED-05 / WYWT-03 all in Phase 10 traceability rows; `35 total` coverage; "Phase 10 scope expansion" footer
- `.planning/ROADMAP.md` — FOUND; `Phase 10: Network Home` heading; 5-section scope language; `FEED-05, WYWT-03, DISC-02, DISC-04` in Requirements line; 9 Success Criteria; all 9 plan entries (10-01 through 10-09) listed; progress row `9/9 | Completed | 2026-04-22`
- `tests/integration/home-privacy.test.ts` — FOUND; `const maybe = process.env.DATABASE_URL ? describe : describe.skip` gating; imports getFeedForUser + getWearRailForViewer + getSuggestedCollectors; destructures `{ collectors, nextCursor }` from getSuggestedCollectors; includes `profilePublic: false` + `collectionPublic: false` seed cases
- `src/data/wearEvents.ts` — FOUND; non-self branch now includes `eq(profileSettings.profilePublic, true)` AND `eq(profileSettings.wornPublic, true)` inside an `and(...)`; self-include branch unchanged
- Commits `23764bd`, `4c0212e`, `e27e805`, `8b7c0b6` — ALL FOUND in `git log`
- `DATABASE_URL=postgres://… npm test -- --run tests/integration/home-privacy.test.ts` — **5/5 passed** (126ms)
- `npm test` (without DATABASE_URL) — **2052 passed, 44 skipped, 0 failed** (5 new skipped = the integration scenarios)
- `npm run build` — **green** across all 20 routes under `cacheComponents: true`
- `npx eslint tests/integration/home-privacy.test.ts src/data/wearEvents.ts` — **0 errors, 0 warnings**

---
*Phase: 10-activity-feed*
*Completed: 2026-04-22*
