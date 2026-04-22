# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-19
**Phases:** 5 (of 6 planned) | **Plans:** 26 | **Tasks:** 36
**Timeline:** 5 days (2026-04-10 → 2026-04-15 active dev, archived 2026-04-19)
**Codebase:** 222 files changed, ~45k insertions, 7,958 LOC TypeScript, 157 commits

### What Was Built
- Full visual polish pass with theme system, responsive layouts, and collection balance charts
- Preference-aware similarity engine with complicationExceptions, collectionGoal, and gap-fill scoring
- Wishlist intelligence: deal flags, target prices, Good Deals + Sleeping Beauties insight panels
- Cloud persistence via Supabase Postgres + Drizzle ORM, replacing localStorage entirely
- Authentication with Supabase Auth, proxy.ts enforcement, and double-verified DAL/Server Actions
- Server Component migration: all pages are async Server Components, Zustand demoted to 31-line filter-only store
- Production deployment at horlo.app with verified deploy runbook hardened by 6 real footguns

### What Worked
- **Wave-based parallel execution** reduced Phase 5 wall-clock time significantly — independent plans ran in parallel within waves
- **Grep gates in VALIDATION.md** caught structural regressions before verification; the 7-gate pattern was reliable
- **Runbook-then-execute pattern** (Plan 05-02 writes, 05-06 executes with checkpoint) caught 6 footguns that would have been undocumented tribal knowledge
- **Test suite grew organically** during feature phases (2-4) rather than being deferred to the end — 697 tests by Phase 5 without a dedicated test phase
- **Server Component conversion** was cleanest when done page-by-page with explicit grep gates validating each migration

### What Was Inefficient
- **ROADMAP Progress table** was never maintained by executor agents — `roadmap update-plan-progress` subcommand doesn't exist in gsd-tools, so the table said "0/Not started" for every phase
- **SUMMARY.md one-liner extraction** produced garbage for most plans (literal "One-liner:" text) — the template field was rarely filled meaningfully by executors
- **Phase 6 scoped too early** — TEST-04/05/06 requirements were written before the test suite existed; by Phase 5, 697 tests were already passing and the success criteria partially overlapped with work already done
- **IPv6-only Supabase direct-connect** was not documented anywhere and cost debugging time; this is a Supabase platform change that their own docs don't flag prominently

### Patterns Established
- `proxy.ts` + DAL double-verification as the auth enforcement pattern (Next.js 16 specific)
- `filterWatches()` as a pure function extracted from store state — pattern for keeping computation testable when migrating from client to server
- `CollectionView` / `PreferencesClient` as the Server Component → client handoff wrappers
- Session-mode pooler URL for both migrations and runtime (avoids IPv6-only direct-connect)
- Checkpoint plans (`autonomous: false`) for prod-touching operations

### Key Lessons
1. **Run the runbook yourself before shipping it.** Plan 05-02 wrote a correct-looking runbook; Plan 05-06 found 6 real problems by actually executing it. The runbook doubled in size from the fixes.
2. **grep gates > unit tests for migration verification.** When converting pages from client to server, a grep for `'use client'` in `src/app/` catches regressions that type-checking misses.
3. **Supabase free-tier email is essentially unusable for signup flows** — 2/hour rate limit, domain MX validation rejects throwaways. Either disable confirmation or configure custom SMTP before smoke testing.
4. **`vercel link` overwrites `.env.local`** — back up before running on an existing project.

### Cost Observations
- Model mix: ~70% Sonnet (executor agents), ~30% Opus (orchestration, verification, code review)
- Sessions: ~5 active development sessions across 5 days
- Notable: Phase 5 execution (6 plans) completed in a single Opus session including the prod deploy checkpoint

---

## Milestone: v2.0 — Taste Network Foundation

**Shipped:** 2026-04-22
**Phases:** 5 (Phase 6-10; Phase 999.1 carried as backlog) | **Plans:** 21 | **Tasks:** 54
**Timeline:** 3 days (2026-04-20 → 2026-04-22)
**Codebase:** 2070+ tests passing, 35/35 v2.0 requirements shipped, 2 quick-task fixes during UAT

### What Was Built
- RLS foundation: defense-in-depth row-level security with `(SELECT auth.uid())` InitPlan optimization on all existing tables plus 5 new social tables
- Social schema + profile auto-creation: profiles, follows, activities, wear_events, profile_settings — activity logging DAL integrated into `addWatch` + `markAsWorn`
- Self-profile + 4 privacy controls (PRIV-01..06): `/u/[username]/[tab]` with 5 tabs, optimistic settings toggles, per-note visibility, LockedTabCard pattern for cross-user views
- Follow system + Common Ground taste overlap: follow/unfollow Server Actions with Zod `.strict()`, FollowButton with 3 variants, batched no-N+1 joins, server-computed taste-overlap hero band on collector profiles
- 5-section Network Home: WYWT rail (48h rolling window, one tile per actor), Network Activity feed with F-08 time-window aggregation, cached Collectors Like You recommendations (`'use cache'` + `cacheLife('minutes')`), Personal Insights (4 cards), Suggested Collectors with keyset pagination
- End-to-end privacy verification: `tests/integration/home-privacy.test.ts` exercises the full DAL chain against seeded Postgres with 5 scenarios

### What Worked
- **Two-layer privacy enforcement** (RLS + DAL WHERE) caught one real gap in WYWT DAL during the Phase 10 E2E — the outer `profile_public` check was missing from the non-self branch. RLS alone would have leaked; DAL alone would have been bypassable. Either layer catching the other's failure is the point.
- **Wave-based execution with files_modified overlap detection** correctly serialized Plans 10-01 / 10-02 on `src/data/activities.ts` while parallelizing the rest. The orchestrator's detection algorithm worked as designed.
- **Planner produces plans that survive reality** — Phase 10 plans held up except for one architectural surprise (cacheComponents + layout cookies), which surfaced at a clean checkpoint, not mid-implementation.
- **Scope expansion captured in-phase** — FEED-05, WYWT-03, DISC-02, DISC-04 were added to REQUIREMENTS.md *during* Plan 10-09 rather than left as a post-milestone cleanup task; kept requirement traceability honest.
- **Code review → auto-fix pipeline** caught 4 warnings (cursor finite-guard, Common Ground privacy leak on home, WywtSlide double-submit, cursor docs) and closed them in one quick pipeline. Zero regressions.

### What Was Inefficient
- **cacheComponents architectural surprise mid-execution** — Phase 10 Plan 01 assumed `cookies()` in the layout body would be allowed with `cacheComponents: true`; it was not. Cost one checkpoint round-trip and a layout refactor. The planner read the migration guide; the *subtle part of it* (layouts are dynamic but `cookies()` still errors in prerender) wasn't captured.
- **REQUIREMENTS.md traceability drift** — phase-complete only updates the current phase's requirement rows, so Phase 6-9 traceability rows sat as "Pending" through five phases despite being verified. Surfaced by the milestone audit; fixed in this session but should be auto-resolved by a workflow update.
- **`gsd-tools commit --files X` doesn't strictly scope the commit** — during the code-review-fix step, a previously-staged set of archived phase 01-05 deletions got swept into the REVIEW-FIX.md commit. Cosmetic but the commit message is misleading. Either the tool needs `git commit -o` semantics or the workflow needs to `git reset` unrelated staged changes first.
- **Phase 9 HUMAN-UAT was a known non-regression gap** carried across two phases. Eventually surfaced by the milestone audit. Running UAT earlier (either inline in the phase or nightly) would have caught the missing follower-count link sooner and sized the fix the same way — but in Phase 9, not Phase 10+.

### Patterns Established
- **Viewer-aware DAL pattern**: `getWatchByIdForViewer(viewerId, watchId)` coexists with the owner-only `getWatchById(userId, watchId)` — the two names signal intent to readers. Mirror this for any future cross-user read surface.
- **Uniform null return on missing-or-private**: privacy gates return the same "not found" result for "doesn't exist" and "exists but private" so there's no information leak by response differential. Precedent in `getFeedForUser` (Phase 10) and `getWearRailForViewer` (Phase 10); formalized via quick-260421-rdb for watch detail.
- **Inline theme script in `<head>` for cacheComponents**: `document.cookie` read + `classList` set before paint is the canonical shadcn pattern that satisfies both zero-FOUC and Next 16 Cache Components. Root layout becomes fully static.
- **Cache-key safety for `'use cache'`**: `viewerId` passed as a function argument, never closure-captured from `getCurrentUser()` inside the cached scope. Violating this leaks data across users.
- **Integration tests gated on local Supabase env**: 50+ integration tests live alongside unit tests but activate only when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set. CI stays green without Supabase infra; local runs catch real DB behavior.

### Key Lessons
1. **Two-layer privacy isn't redundant — it's the design.** Every social DAL that depends on privacy settings must enforce at both RLS and the DAL WHERE clause. One layer will eventually have a bug; the other layer catches it.
2. **When a quick task is truly quick, skip the planner.** `/gsd-quick` for a 4-line `<Link>` wrapping wastes more context on orchestration overhead than the fix takes. The workflow doesn't prevent skipping; judgment should.
3. **Code review finds what tests don't.** Phase 10 had 2059 tests passing but missed the Common Ground home-card privacy leak. Static code review caught it in WR-02 because the reviewer was looking for *cross-component privacy invariants*, not just per-function correctness.
4. **Scope-expansion mid-phase is fine if the REQUIREMENTS entry lands with it.** Don't let new requirements pile up as "add to REQUIREMENTS.md after shipping" — do it as a task in the final plan of the phase. Plan 10-09 got this right.

### Cost Observations
- Model mix: ~60% Sonnet (executor agents), ~40% Opus (orchestration, planner, verifier, code reviewer)
- Sessions: 3-4 major sessions across 3 days, with parallel sub-agents for code review + verification
- Notable: Phase 10 (9 plans, 3 waves, 54+ commits) completed in roughly 90 minutes of wall-clock with Sonnet executors and one Opus orchestrator

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 5/6 | First milestone — established GSD workflow patterns |
| v2.0 | 3 days | 5/5 | Added wave-based parallelization, two-layer privacy pattern, cacheComponents, integration-gated test strategy |

### Cumulative Quality

| Milestone | Tests | Coverage | Carried Debt |
|-----------|-------|----------|-------------|
| v1.0 | 697 | Not configured | TEST-04/05/06 deferred |
| v2.0 | 2070+ (unit + integration-gated) | Not configured | Phase 999.1 backlog (v1.0 code review follow-ups); UAT automation |

### Top Lessons (Verified Across Milestones)

1. Run production runbooks manually before declaring them verified — the gap between "looks correct" and "actually works" is always larger than expected.
2. Two-layer defenses (RLS + DAL, hooks + tests, grep gates + types) consistently catch what single-layer defenses miss. Cost of the second layer is small; cost of a single-layer breach is large.
3. Scope expansions should land with their requirement entry in the same phase. Deferring the REQUIREMENTS.md update creates traceability drift that audits then have to reconcile.
