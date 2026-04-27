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

## Milestone: v3.0 — Production Nav & Daily Wear Loop

**Shipped:** 2026-04-27
**Phases:** 7 (11, 12, 13, 14, 15, 16, 999.1) | **Plans:** 37 | **Tasks:** 56
**Timeline:** 5 days (2026-04-22 → 2026-04-26)
**Codebase:** 372 files changed, ~58k insertions / ~28k deletions, 21,311 LOC TypeScript, 178 commits

### What Was Built
- Schema + storage foundation: `wear_visibility` enum, `wear_events.photo_url`+`note`+`visibility`, `notifications` table with recipient-only RLS + dedup partial UNIQUE, `pg_trgm` + GIN indexes, `wear-photos` private bucket with three-tier RLS, SECURITY DEFINER helpers with revoked PUBLIC EXECUTE, DEBT-02 RLS audit
- Three-tier wear privacy ripple through DAL: `getWearEventsForViewer`, `getWearRailForViewer`, `getFeedForUser` (jsonb metadata gate), wishlist action; `worn_public` column dropped end-to-end
- Notifications system: fire-and-forget `logNotification` with opt-out + self-guard, 6-function DAL, `markAllNotificationsRead` + `markNotificationRead` Server Actions, cached `NotificationBell` SC, `/notifications` page with optimistic per-row read flip, Settings opt-out toggles
- Production navigation frame: mobile `BottomNav` (5-item with elevated Wear cradle), `SlimTopNav` / `DesktopTopNav` split, `MobileNav` deleted, `/explore` + `/search` stubs, `/insights` retired to profile tab, `UserMenu` consolidates Profile/Settings/Theme/Sign out, shared `PUBLIC_PATHS` predicate
- WYWT photo post flow: two-step `WywtPostDialog`, `CameraCaptureView` + `WristOverlaySvg`, `PhotoUploader` with HEIC Web Worker, canvas-reencoded JPEG ≤1080px with EXIF strip, client-direct upload, `logWearWithPhoto` SA with orphan-cleanup, `/wear/[id]` route with three-tier gate + uniform 404 + per-request signed URL, Sonner `<ThemedToaster />` bound to custom ThemeProvider
- People search: `/search` 4-tab page, `searchProfiles` DAL with two-layer privacy + batched `isFollowing` (anti-N+1), `useSearchState` hook with 250ms debounce + AbortController + URL sync, XSS-safe `HighlightedText`, pg_trgm Bitmap Index Scan evidence captured

### What Worked
- **Wave 0 RED-test discipline at phase start** (Plans 11-01, 12-01, 13-01, 16-01) — writing failing tests before any DAL/component code locked the contract early. Phase 16's Plan 01 created 5 RED test files covering every D-01..D-29 decision; subsequent plans turned them GREEN one by one.
- **Code-review-fix pipeline closed warnings inline** — Phase 15's WR-01..WR-05 were caught and fixed in one pipeline session (5 commits) before verification, not deferred. Pattern from v2.0 carried forward and got tighter.
- **Architectural prop-based component sharing prevented forks** — `NavWearButton` with `appearance: 'header' | 'bottom-nav'` prop kept exactly 2 `WatchPickerDialog` import sites in the tree (lazy in NavWearButton + WywtRail self-placeholder). Pitfall 10 enforced via grep gate in VALIDATION.md.
- **Stream-as-prop architectural enforcement** — `CameraCaptureView` accepts `MediaStream` as a prop instead of acquiring it internally, forcing the parent to call `getUserMedia` as the first await on the user-gesture handler. iOS Safari requires this; making it un-bypassable at the type level prevents regressions.
- **EXPLAIN ANALYZE forced-plan evidence as Pitfall closure** — Phase 11/16 captured `SET enable_seqscan = off; EXPLAIN ANALYZE` proving GIN trigram indexes are reachable, even though natural plan picks Seq Scan at <127 rows. Documented production trajectory inline.
- **`updateTag` vs `revalidateTag('max')` split for cache invalidation** — read-your-own-writes via `updateTag` (immediate); cross-user fan-out via `revalidateTag('max')` (SWR semantics, recipient sees within 30s TTL). Two distinct primitives mapped to two distinct semantic needs; documented in `src/app/actions/notifications.ts` header.

### What Was Inefficient
- **31 deferred human-verification UAT items by milestone close** — Phases 12, 13, 14, 15 each accumulated 3-9 UAT items that require live device / multi-session / browser-first-paint verification and cannot be automated under jsdom. Verification reports correctly flagged these as `human_needed` rather than `passed`, but the milestone shipped with all 31 outstanding. Either run UAT batches at phase close (not milestone close) or accept that `human_needed` is the natural close state for socially-aware features.
- **WristOverlaySvg geometry shipped wrong** — UAT identified the arm spacing, hand lengths, and 10:10 positioning as off; user took ownership of the redesign. The plan's geometric spec was self-consistent but didn't match the canonical "watch on wrist" Figma reference. Visual-spec phases need a Figma node-locked test fixture, not just text descriptions.
- **`worn_public` test fixture cleanup deferred** — Phase 12 dropped the column but left 9 test files referencing the old shape. They compile under TS strict because the test fixtures use `as` casts; runtime is unaffected; but `npx tsc --noEmit` reports errors in those files. Should have been a final task in Phase 12 or a follow-up quick-task.
- **WYWT post-submit auto-navigation discarded `wearEventId`** — `logWearWithPhoto` returns `{ wearEventId }` but `ComposeStep.handleSubmit` doesn't pass it back to `WywtPostDialog`, which only closes the dialog with a toast. Toast-only confirmation is a defensible UX choice but the integration check flagged this as a partial wiring. Either intentional + documented, or a missed `router.push`.
- **Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21` reproduced across 5 phases** — surfaced in Phase 14, 15, 16, and 999.1 deferred-items lists. Each phase correctly scoped it out as pre-existing on base commit `ed1dc1d`; no phase took ownership. Should have been a Phase 14 quick-task since it touched a layout that phase already modified.
- **Nyquist VALIDATION.md drafts didn't reach `nyquist_compliant: true`** — every v3.0 phase has a draft VALIDATION.md but only Phase 13 + 14 set `nyquist_compliant: true` in frontmatter, and even those have `wave_0_complete: false`. The Wave 0 testing happened (lots of RED→GREEN cycles); the frontmatter just wasn't kept in sync. Either the validation phase tool should auto-update on Wave completion, or executors need a checklist reminder.

### Patterns Established
- **Three-tier privacy enum + per-row visibility column** for any feature that needs mixed public/followers/private granularity. Boolean tab-level toggles don't compose well; per-row scales to any future feed/grid/detail surface.
- **Inline `cacheTag` + `cacheLife` on cached Server Components** with `viewerId` as an explicit prop (never closure-captured from `getCurrentUser()` inside the `'use cache'` scope). Pattern from v2.0 hardened in v3.0 NotificationBell.
- **Architectural prop-acquisition for browser APIs** — components that need browser permissions (camera, geolocation) accept the resource as a prop instead of acquiring it internally. Forces the parent to handle the user-gesture sequence correctly. Type-level enforcement of iOS Safari constraints.
- **Lazy import of heavy WASM/JS in Web Workers** — `heic2any` lazy-loaded inside a worker keeps the main route bundle small and isolates conversion CPU. Verifiable via Network tab chunk inspection (manual UAT).
- **Stream-of-truth file paths as the canonical convention** — `wear-photos/{userId}/{wearEventId}.jpg` for storage, mirrored in RLS path-prefix policies. Predictable + auditable + cleanup-friendly.
- **Forced-plan EXPLAIN ANALYZE for index-existence proof** at small DB sizes where the planner picks Seq Scan naturally.

### Key Lessons
1. **Visual specs need a node-locked reference, not just text.** WristOverlaySvg shipped wrong because the plan described geometry in coordinates without a Figma image diff. For UI-heavy work, the test fixture should include a screenshot or vector import, not just `viewBox` math.
2. **`human_needed` is the natural close state for social/UI features.** Phase 13/14/15 each shipped with `human_needed` verification status; pretending these can pass purely on automated verification under-counts what shipping actually requires. Build the UAT batch into the milestone close, not the phase close.
3. **Pre-existing TS errors don't get owned automatically.** A pre-existing error noted in deferred-items.md across 5 phases is a signal that the workflow doesn't promote orphans to action. Add a "deferred-items review" step at milestone-audit time.
4. **`wearEventId` returned but discarded is a wiring smell.** When a Server Action returns data but the caller doesn't use it, either the data is dead (remove) or the wiring is incomplete (add). Don't leave it ambiguous.
5. **Cache-tag invalidation primitive choice is semantic, not stylistic.** `updateTag` and `revalidateTag('max')` aren't interchangeable — they have different freshness contracts. Pick based on read-your-own-writes vs SWR fan-out.

### Cost Observations
- Model mix: ~65% Sonnet (executor agents + verification), ~35% Opus (orchestration, planner, code reviewer, integration checker)
- Sessions: 5-6 major sessions across 5 days, with parallel sub-agents for code review + verification + audit
- Notable: Phase 14 (9 plans across 2 waves) and Phase 15 (5 plans across 4 waves with iOS UAT) each completed in 1-2 hours of wall-clock with Sonnet executors. Phase 15 Plan 05 (~50min) was the longest single plan execution due to the iOS gesture/EXIF/permission UAT scope.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 5/6 | First milestone — established GSD workflow patterns |
| v2.0 | 3 days | 5/5 | Added wave-based parallelization, two-layer privacy pattern, cacheComponents, integration-gated test strategy |
| v3.0 | 5 days | 7/7 | Added Wave 0 RED-test discipline, code-review-fix pipeline at phase close, architectural prop-acquisition for browser APIs, three-tier privacy enum pattern, EXPLAIN ANALYZE forced-plan evidence for index proofs |

### Cumulative Quality

| Milestone | Tests | Coverage | Carried Debt |
|-----------|-------|----------|-------------|
| v1.0 | 697 | Not configured | TEST-04/05/06 deferred |
| v2.0 | 2070+ (unit + integration-gated) | Not configured | Phase 999.1 backlog (v1.0 code review follow-ups); UAT automation |
| v3.0 | 2813+ (87+ test files; 152 env-gated) | Not configured | 31 deferred human-verification UAT items; WristOverlaySvg redesign (user owns); 9 test files with stale `wornPublic` references; pre-existing `LayoutProps` TS error; Nyquist VALIDATION.md frontmatter drift |

### Top Lessons (Verified Across Milestones)

1. Run production runbooks manually before declaring them verified — the gap between "looks correct" and "actually works" is always larger than expected.
2. Two-layer defenses (RLS + DAL, hooks + tests, grep gates + types) consistently catch what single-layer defenses miss. Cost of the second layer is small; cost of a single-layer breach is large.
3. Scope expansions should land with their requirement entry in the same phase. Deferring the REQUIREMENTS.md update creates traceability drift that audits then have to reconcile.
4. `human_needed` verification status is the natural close state for UI/social features. Build UAT batching into the milestone-close ritual rather than treating these as exceptions.
5. Pre-existing errors in deferred-items.md across multiple phases need an explicit owner. The audit workflow should promote orphans to action items rather than letting them recur.
