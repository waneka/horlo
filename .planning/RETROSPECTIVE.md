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

## Milestone: v4.0 — Discovery & Polish

**Shipped:** 2026-05-03
**Phases:** 12 (17, 18, 19, 19.1, 20, 20.1, 21, 22, 23, 24, 25, 26) | **Plans:** 65
**Timeline:** 6 days (2026-04-27 → 2026-05-02)
**Codebase:** 472 files changed, +97,147 / −1,959 lines, 62,322 LOC TypeScript, 430 commits

### What Was Built
- Catalog Foundation laid silently underneath per-user `watches` with `pg_trgm` GIN indexes, NULLS-NOT-DISTINCT natural-key UNIQUE, public-read RLS, idempotent batched backfill, two upsert helpers, daily SECDEF pg_cron count refresh + daily snapshots
- LLM-derived taste enrichment: 8 columns on `watches_catalog` via Anthropic Sonnet strict tool-use, fire-and-forget enrichment from both write paths, optional reference-photo upload to new bucket, vocab validation with console.warn drops, first-write-wins semantics
- /explore discovery surface with sparse-network welcome hero + 3 cached rails (Popular Collectors per-viewer, Trending global, Gaining Traction with three-window logic)
- /search Watches + Collections populated with anti-N+1 single-batch viewer-state hydration and two-layer-privacy AND-locked Collections; All-tab union with three independent sub-effects each with own AbortController
- Collection Fit verdict reframe: pure-renderer `<CollectionFitCard>` (engine no-import static guard), 12-template composer with confidence gating reading Phase 19.1 taste attrs via Drizzle aggregate, eliminated `/evaluate` route
- Add-Watch Flow Rethink: URL paste → verdict preview → 3-button decision (wishlist / owned / skip) as one coherent gesture with state machine + atomic flow leaves; deep-link from `/search?tab=watches` and `/catalog/[catalogId]` short-circuits to form-prefill
- Custom Resend SMTP on `mail.horlo.app` with DKIM/SPF/DMARC verified, D-07 round-trip gate (Invite + real Gmail Inbox-not-Spam) before Confirm-email toggle flip; all three Auth email templates standardized on canonical `/auth/callback?token_hash=…&type=…&next=…` PKCE+SSR pattern
- Settings restructured into `@base-ui/react` vertical-tabs shell with hash-driven state via `pushState` (NOT `router.push`); Account section ships email change with pending banner + password change with 24h staleness re-auth dialog
- Schema-driven knobs surfaced: `collectionGoal` + `overlapTolerance` Selects (Brand Loyalist option), per-note `notesPublic` pill, `isChronometer` Checkbox/Certification row
- Notification stub cleanup via rename+recreate enum (with T-24-PARTIDX partial-index surgery for enum-bound dependents); 4 wornPublic test fixtures rewritten; three v1.0-carryover test suites finally landed (TEST-04/05/06)
- Profile Nav Prominence with avatar dual-affordance (avatar Link + chevron dropdown) on TopNav surfaces; 4 empty-state CTAs across collection/wishlist/worn/notes (Collection has API-key-aware "Add manually" fallback)
- 5-category URL-extract error taxonomy with locked copy + lucide icons; hybrid Sonner + `aria-live="polite"` form feedback rolled across 7 forms via shared `useFormFeedback` + `<FormStatusBanner>`
- WYWT auto-nav with Suspense-wrapped photo render + retry-with-cache-buster onError + `useRef`-based setTimeout cleanup

### What Worked
- **Inline gap-closure plans for UAT findings (20.1-06/07/08, 26-inline 4212a08, 20-inline 9796b32)** — when verifier or UAT surfaced gaps, the answer was always "close inline before the phase exits" rather than "defer to next phase." 20.1's three-plan gap-closure pass closed 5 user-reported bugs from a single upstream cause in one sitting.
- **`tests/no-evaluate-route.test.ts` + `tests/static/CollectionFitCard.no-engine.test.ts` static guards** — preventing reintroduction of deleted code via filesystem assertion is cheap and catches regressions that grep alone misses (e.g., a future plan adding `/evaluate` back even with a stub `page.tsx`).
- **D-07 round-trip gate for Phase 21 caught 2 latent auth bugs** — forgot-password redirectTo silent-drop + apex/www allowlist mismatch were both pre-existing pre-Phase-21 but only surfaced when running an end-to-end signup against live SMTP. The "verify ordering BEFORE flipping the toggle" pattern paid off.
- **Architectural prop-borne `collectionRevision`** — passing the revision as a prop instead of reading it from a hook inside `'use cache'` scope kept the verdict cache invalidation correct across `<AddWatchFlow>`, `<WatchSearchRowsAccordion>`, and `<CatalogPageActions>`. Same pattern as v2.0 viewerId prop discipline.
- **Locked-copy contracts in PLAN.md / UI-SPEC.md** — Phase 22 had verbatim copy locks like "Confirmation sent to **old@** and **new@**" reproduced in the test as exact strings, not regexes. Caught one mid-phase paste-error where a developer typed "Confirmation sent to old@ AND new@" (capitalized AND); test failed; fixed in the same commit.
- **Phase 23 + 24 parallelization via worktrees** — Phase 23 ran 6 plans in 2 waves with parallel worktrees on independent files; Phase 24 had 8 plans across 4 waves with the prod-apply checkpoint cleanly serialized via `autonomous: false`. Wall-clock cost was a fraction of sequential.
- **Code-review → REVIEW-FIX inline pipeline** — Phase 22's CR-01 (StatusToastHandler reading querystring instead of hash) was caught and fixed in commit `89d6322` before the phase exited; comment-only `useSearchParams` reference left as a paper trail. Same hygiene for Phase 20 viewerTasteProfile import.

### What Was Inefficient
- **Phase 23 + Phase 24 shipped without phase-level VERIFICATION.md** — both phases have implementation evidence in plan-level SUMMARY files, but no goal-backward verifier audit was run. The milestone audit caught this as `tech_debt`. Pattern: when a phase's last plan is a "verify-only doc" (like 23-06), executors sometimes treat the sub-plan VERIFICATION as the phase verification. Workflow should require an explicit `/gsd-verify-work {N}` step OR auto-derive a phase-level VERIFICATION from sub-plan evidence at phase close.
- **Phase 23 Plan 5 worktree reset** — Plan 5 implementation (notesPublic Zod + revalidatePath) was lost to a worktree reset; the bug was caught by 23-REVIEW.md (CR-01 critical) and the fix shipped via commit `4d362ff`, but the structured plan SUMMARY.md was never produced. Plan 6 explicitly documents this: "leftover work from a parallel-executor plan that did not commit its work before the worktree reset."
- **Phase 20 build-blocker (TS2459 viewerTasteProfile import) slipped past every plan's self-check** — vitest doesn't run tsc; `npm run build` does. Plan-level `<verify>` scripts only ran `npx vitest run` and never `npm run build` or full-project `npx tsc --noEmit`. Should be a milestone-wide convention: every plan's verify block must include `npm run build` (or some structural-typecheck equivalent) before declaring success.
- **Computer crash mid-Phase-20 Wave 3 surfaced a workflow `git reset --soft` bug** — the orchestrator's worktree-base detection produced a 43k-line destructive first commit on the 20-05 branch when the recovery attempted to extract the intended files. Caught and rolled back; intended files extracted surgically into `411339a`. Workflow has a known recovery hole.
- **20.1 had 5 UAT debug entries from a single upstream cause** — `verdict-empty-collection-message` + `wishlist-textarea-not-prefilled` + `recently-evaluated-rail-missing` were all consequences of `state.verdict === null` (silent catalog upsert failure or empty `collectionRevision`). The diagnosis-only mode caught the shared root cause, but if the verifier had run a fuller end-to-end test against a live DB instead of relying on mocks, this single root cause might have surfaced before user UAT instead of through it.
- **REQUIREMENTS.md traceability table drift** — same issue as v2.0 + v3.0. Phase-complete updates only the current phase's rows; sister-phase rows stay "Pending" through subsequent phases. Audit caught it; `/gsd-complete-milestone` regenerates. Three milestones in a row, this is a workflow gap not a phase miss.
- **Phase 999.1 directory carried from v3.0** — leftover in `.planning/phases/` instead of archived to `milestones/v3.0-phases/`. Cosmetic, but suggests `/gsd-complete-milestone` should explicitly handle leftover phase directories during phase archival decision.
- **Nyquist `nyquist_compliant: true + wave_0_complete: true` only reached by 3/12 phases** — most have draft VALIDATION.md files. Phases 25 + 26 have no VALIDATION.md at all. The Wave 0 testing happened (lots of RED→GREEN); the frontmatter just wasn't kept in sync. Same pattern as v3.0.

### Patterns Established
- **Catalog as silent infrastructure pattern** — separate per-user authoritative data (`watches`) from canonical-spec data (`watches_catalog`); join at display time; `analyzeSimilarity()` byte-locked across the entire milestone. Establishes the path for v5.0+ engine rewire.
- **First-write-wins LLM enrichment with `--force` re-run script** — `updateCatalogTaste` skips rows with non-null confidence by default; explicit `reenrich-taste.ts --force` flag + `--dry-run` preview for operator-controlled re-enrichment. Prevents accidentally clobbering hand-curated taste signals.
- **3-button verdict gesture** (wishlist / owned / skip) as canonical evaluation surface — replaces "navigate to /evaluate" with "verdict-as-step in the existing add-watch flow." Skip path covers the lightweight evaluate-only use case.
- **`useFormFeedback` hook + `<FormStatusBanner>` primitive** for hybrid Sonner toast + `aria-live="polite"` banner. Standardizes pending state, success message, error message, and dialogMode flag across 7 forms. Pattern is reusable for any future Server Action surface.
- **Locked categorical error copy** (5-category URL-extract taxonomy) with `CONTRACT_BY_CATEGORY` map + parameterized tests. Specific recovery CTAs per category beat generic "extraction failed" copy.
- **`@base-ui/react` vertical-tabs with `window.history.pushState`** — hash-driven SPA tab state without re-running the page Server Component loader. URL fragment shareable, back-button friendly. Replaces `router.push` for tab switching.
- **Email-template + auth-callback PKCE+SSR standardization** — all auth flows route through one canonical `/auth/callback?token_hash=…&type=…&next=…` shape with `verifyOtp({ type, token_hash })` server-side. Eliminated 3 different template patterns into 1.
- **`isSessionStale` + chained `signInWithPassword` → `updateUser`** for sensitive-op re-auth. 24h threshold + 401 catch reopen-dialog as defense-in-depth.
- **Postgres enum cleanup via rename+recreate (with partial-index surgery for enum-bound dependents)** — `ALTER TYPE … DROP VALUE` does not exist; the costly path is the only path. T-24-PARTIDX documented in deploy runbook as canonical pattern.

### Key Lessons
1. **Static guards that assert filesystem absence are cheap and reliable.** `tests/no-evaluate-route.test.ts` (3 lines, asserts the route doesn't exist) is more durable than a grep across `src/`.
2. **Plan-level `<verify>` scripts must include the production build step.** Vitest passing is necessary but not sufficient. The Phase 20 build-blocker would have been caught by any plan's verify block running `npm run build`.
3. **Inline gap-closure beats deferring to a next phase.** Phase 20 (1 fix), Phase 26 (1 fix), Phase 20.1 (3 plans = 5 bugs) all chose to close inline before exiting. The cost is a single re-verification round; the benefit is no carry-over debt to next milestone.
4. **D-07 ordering gates pay for themselves.** Verifying DKIM/SPF/DMARC + round-trip end-to-end before flipping the Confirm-email toggle caught 2 latent bugs and gave the operator decision authority to STOP if anything looked off. Pattern transfers to any external-dependency rollout.
5. **Phase-level VERIFICATION.md needs explicit ownership in the workflow.** Two phases (23 + 24) shipped without one this milestone. Either the workflow should auto-prompt `/gsd-verify-work` at phase close, or the executors need a checklist gate.
6. **Worktree-based parallelization is a 4-6x wall-clock win** when plans target independent files. 12 phases / 65 plans / 6 days is only possible with aggressive parallelization. The cost is recovery complexity when worktrees fail (Phase 23 Plan 5 reset).
7. **REQUIREMENTS.md traceability drift is a workflow problem, not a phase problem.** Three milestones in a row this has been audit-time cleanup. The phase-complete tool should auto-update sister-phase rows when their evidence appears in another phase's SUMMARY.

### Cost Observations
- Model mix: ~70% Sonnet (executor agents + verification + code review), ~30% Opus (orchestration, planner, integration checker, audit)
- Sessions: 6-7 major sessions across 6 days, with parallel sub-agents for code review + verification + audit + UAT
- Notable: Phase 19 (6 plans / 116 tests / 2 live-DB integration tests) and Phase 25 (6 plans / 11 requirements / 4 UAT items) both completed in single Sonnet sessions with Opus orchestration, including code review and verification cycles. Phase 17 (6 plans + prod migration apply) and Phase 21 (2 plans + DNS lead-time + D-07 gate + 4 toggle flip) had operator-attested checkpoint pauses for prod-touching ops.

---

## Milestone: v4.1 — Polish & Patch

**Shipped:** 2026-05-05
**Phases:** 5 (27, 28, 29, 30, 31) | **Plans:** 21 + 1 quick task + 1 post-ship hotfix
**Timeline:** 2 days (2026-05-04 → 2026-05-05)
**Codebase:** 71 source files changed (excl. `.planning/`), +5,044 / −190 lines, 152 commits since v4.0 tag

### What Was Built
- Reorderable wishlist via `watches.sort_order` column + `watches_user_sort_idx` composite index, `bulkReorderWishlist` DAL with three-layer owner enforcement (Zod `.strict` + session-userId + DAL WHERE+count+set-completeness), `reorderWishlist` Server Action with dynamic-segment `revalidatePath`, full @dnd-kit DnD wiring (mouse 150ms / touch 250ms / keyboard sensors, optimistic + Sonner rollback, symmetric drop indicator, `aria-roledescription="sortable"`)
- Mobile `grid-cols-2` on Collection + Wishlist (both owner + non-owner branches); status-driven price line on ProfileWatchCard (Owned/Sold→Paid→Market; Wishlist/Grail→Target→Market; hidden when null)
- Add-Watch flow lands users back where they started: Sonner action-slot success toast across 4 commit sites with literal "View" → `/u/{viewerUsername}/{matching-tab}`, D-05/D-06 suppress carve-out via `canonicalize` (`/u/me/` rewrite + query strip + trailing slash + null-username early return); `?returnTo=` validated round-trip across 8 entry-point callsites; server-side validator at `/watch/new` reuses auth-callback regex byte-identically (proven by source-equality test); AddWatchFlow.handleWishlistConfirm: `router.refresh()` removed (D-15) but retained at /search and /catalog inline-commit sites per D-05 carve-out
- 25 literal copy strings rewritten verb-led (≥6 words, period-terminated); speech-act-split verdict bundle: `rationalePhrasings` (1st-person, required field on VerdictBundleFull, filled lockstep with contextualPhrasings) for wishlist auto-fill; `contextualPhrasings` (verdict-to-user) for verdict display; WishlistRationalePanel reads `verdict.rationalePhrasings[0]`
- UserMenu Profile DropdownMenuItem deleted (avatar Link is sole profile entry per Phase 25 dual-affordance, both surrounding separators preserved per UI-SPEC D-01 wording precision); ProfileTabs locked to horizontal-only scroll; `tabs.tsx` primitive UNCHANGED
- Add-Watch flow three-layer reset: Layer 1 — per-request `crypto.randomUUID()` nonce as `<AddWatchFlow key={flowKey}>`; Layer 2 — `useLayoutEffect` cleanup-on-hide with StrictMode-safe ref-guarded skip cases (initial idle + form-prefill survives Next.js 16 dev StrictMode mount/cleanup/mount); Layer 3 — explicit reset BEFORE `router.push(dest)` in handleWishlistConfirm
- Module-scope migration of `useWatchSearchVerdictCache` (smallest-blast-radius variant of "survive remount") + new `useUrlExtractCache` (Quick Task FORM-04 Gap 3, keyed on URL → `{catalogId, extracted, catalogIdError}`) so re-paste skips `/api/extract-watch` round-trip
- Test infra hardened: `tests/setup.ts` → `tests/setup.tsx` with global `<StrictMode>` wrapper around RTL `render()` so this regression class is caught in CI
- WYWT WYSIWYG capture math: `CameraCaptureView.tsx` wrapperRef + aspect-square wrapper + `computeObjectCoverSourceRect` named export (4/4 pure-math fixtures GREEN at delta=(0,0)) + extended readiness guard + 9-arg `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)`; locked files (`WristOverlaySvg.tsx`, `ComposeStep.tsx`, `src/lib/exif/strip.ts`) UNTOUCHED
- Post-ship hotfix `2dd7377`: added `h-full` to `<video>` so object-cover engages on iPhone — initial ship had `<video class="block w-full object-cover">` without `h-full`, the element kept its intrinsic 16:9 aspect inside the aspect-square wrapper, object-cover had nothing to crop, and the WYSIWYG capture math assumed a crop that never happened
- v4.0 verification asymmetry resolved: phase-level `23-VERIFICATION.md` + `24-VERIFICATION.md` backfilled to `.planning/milestones/v4.0-phases/`; `## Closure` section appended to `v4.0-MILESTONE-AUDIT.md` with byte-equality invariant intact (17 insertions, 0 deletions); bidirectional `closes_audit_items:` cross-references between audit and backfilled VERIFICATION.md files

### What Worked
- **Three-layer defense for FORM-04** — Each layer covered a navigation class JSDOM cannot replay (Layer 1 per-request mount, Layer 2 Activity-preservation back-nav, Layer 3 post-commit forward-nav). When UAT round 1 surfaced 2 regressions (verdict cache died on remount; deep-link prefill cleared by StrictMode), the layered architecture made the fixes localized — Plan 29-05 only touched the verdict cache primitive, Plan 29-06 only touched useLayoutEffect cleanup. Defense-in-depth paid off literally.
- **Module-scope as smallest-blast-radius variant of "survive remount"** — `useState`-backed caches die on `key={flowKey}` remount; module scope is one-line migration that doesn't require re-architecting state ownership. Public API of `useWatchSearchVerdictCache` stayed byte-identical (`{revision, get, set}`); both consumers were zero-diff. Quick Task Gap 3 reused the same pattern for URL extract cache.
- **StrictMode test-infra wrapper as a regression-class catch** — `tests/setup.tsx` wrapping every RTL `render()` in `<StrictMode>` would have caught the Plan 04 cleanup regression in CI before UAT round 2. Going forward, this is a permanent CI gate for any useLayoutEffect/useEffect cleanup logic.
- **Auth-callback regex parity test for `?returnTo=` validator** — `expect(RETURN_TO_REGEX.source).toBe('^\\/(?!\\/)[^\\\\\\r\\n\\t]*$')` — comparing the regex source string directly forces both validators to share one threat model. Eliminates open-redirect attack surface drift between two validators.
- **Speech-act-split verdict bundle** — Forcing `rationalePhrasings` to be a required field on `VerdictBundleFull` (not optional) means template authors cannot ship a label without considering both display contexts (verdict-to-user vs 1st-person rationale). The type system carries the contract.
- **Append-only audit edit pattern with byte-equality invariant** — Audits are historical artifacts; rewriting them muddies provenance. `git diff ... | grep -E '^-[^-]' | wc -l` returning 0 is a one-line CI-friendly assertion that the original audit body is byte-equal pre/post `## Closure` append.
- **Inline post-ship hotfix workflow** — Phase 30 shipped Tuesday morning; UAT failed Tuesday afternoon (black bar in preview, wrist at bottom of saved JPEG); root cause diagnosed as missing `h-full` on `<video>`; hotfix `2dd7377` shipped same day; owner re-tested and approved. Total cycle: ~6 hours from UAT failure to UAT pass. Critical-path UI bug fixed without scoping a follow-up phase.
- **Phase 31 found a real Phase 23-era regression** — DEBT-09 (notesPublic Zod field + revalidatePath absent on main despite SUMMARY-claimed implementation) is exactly the kind of finding that retroactive verification catches. Implementation evidence in SUMMARY ≠ implementation evidence in shipped code; Phase 31's audit work proved this empirically.

### What Was Inefficient
- **UI-SPEC 6-pillar checker missed CSS chain on `<video>`** — Phase 30 UI-SPEC declared the wrapper as `aspect-square` and `<video>` as `object-cover w-full block`. The 6-pillar checker validated all declared tokens individually but did not assert the full CSS chain produced the claimed visual contract (square preview, no black bar). The `h-full` requirement on `<video>` was non-obvious from any single utility; only the chain-as-a-whole produced the WYSIWYG behavior. Saved as feedback memory `feedback_ui_spec_css_chain_blind_spot.md`.
- **Plan 29-04 hoisting decision was wrong** — Plan 04 picked Option B (accept verdict cache reset on remount; rely on collectionRevision-keyed re-fetch). UAT proved Option B literally cannot honor D-15 cache-survives-entry contract because the cache is keyed on `catalogId`, which is only known AFTER `/api/extract-watch` returns — the user observes the network round-trip in DevTools regardless of verdict cache state. Plan 29-05 had to revise the hoisting decision and migrate to module scope. Two-day re-spin from a Wave 2 hoisting choice.
- **REQUIREMENTS.md checkbox lag** — 7 of 12 v4.1 requirements stayed `[ ]` in REQUIREMENTS.md even after their phase shipped and verified. Same workflow gap as v4.0. Phase-level verification flips status correctly but the master traceability table doesn't auto-update.
- **Stale ROADMAP checkbox on Phase 30** — Phase 30 line stayed `- [ ]` even after Phase 30 was complete and verified. The progress table at the bottom showed "Complete 2026-05-05" — two sources of truth in the same file disagreed.

### Patterns Established
- **Three-layer defense for cross-route remount contracts** — When a contract spans multiple navigation surfaces (per-request mount + back-nav + post-commit), defense-in-depth across Layer 1 (server) + Layer 2 (cleanup) + Layer 3 (commit-time) prevents single-layer regressions from breaking the contract end-to-end. Each layer is independently verifiable; together they cover JSDOM-untestable navigation classes.
- **Module-scope Map for cross-remount cache survival** — One-line migration when `useState`-backed caches die on `key={flowKey}` remount. Public API stays byte-identical; consumers zero-diff. Caveat: signOut invalidation is the user's responsibility to wire (not handled automatically).
- **Speech-act split via type-required field** — When the same data feeds two surfaces with different speech acts (verdict-to-user vs 1st-person rationale), separate the data at type level (required field, not optional) so template authors cannot ship without considering both contexts.
- **Append-only audit edit with byte-equality invariant** — Audits are historical artifacts; preserve them byte-for-byte and append `## Closure` sections that link forward to backfilled artifacts. CI-friendly assertion: `git diff <range> -- <file> | grep -E '^-[^-]' | wc -l` should return 0 (zero deletion lines outside the diff header).
- **Auth-callback regex source-equality test** — Two validators sharing the same threat model should share regex source via direct `.source` comparison. Forces drift to surface as a test failure rather than a security gap.
- **Test-infra `<StrictMode>` wrapper as regression-class CI gate** — Wrapping every RTL `render()` in `<StrictMode>` catches useLayoutEffect/useEffect cleanup regressions in CI. One-time setup; permanent guardrail.
- **Post-ship hotfix workflow** — When UAT fails on a critical-path UI bug post-deploy, ship a same-day fix commit rather than scoping a follow-up phase. Update phase VERIFICATION.md frontmatter with `post_ship_hotfix:` block + `human_verification` status flip rather than re-opening the phase.
- **Phase audit surfaces real production regressions** — Goal-backward verification of historical phases catches gaps that plan-level SUMMARY evidence misses. Implementation evidence in SUMMARY ≠ implementation evidence in shipped code. DEBT-09 is the proof.

### Key Lessons
1. **CSS chains aren't validated by per-token checks.** UI-SPEC 6-pillar checker validates declared tokens individually; visual contracts (square preview, no black bar) require chain-as-a-whole assertions. On any phase touching aspect-ratio + object-fit, demand explicit CSS chain assertions in UI-SPEC.
2. **Hoisting decisions for cross-remount caches need to be tested against the user-observable bottleneck, not just the cache primitive.** Phase 29-04 picked Option B (accept reset) because the cache primitive could repopulate; UAT proved the network round-trip the cache was supposed to skip dominates user perception, not the cache hit. Test the bottleneck the user sees.
3. **Defense-in-depth localizes regressions.** Three-layer FORM-04 architecture meant each UAT-surfaced regression touched exactly one layer. Layer 2 fix (29-06 StrictMode-safe cleanup) didn't require re-architecting Layer 1 (key prop) or Layer 3 (commit-time reset). Each fix was independently verifiable.
4. **Retroactive phase verification is expensive but catches real regressions.** Phase 31's audit of Phase 23 surfaced DEBT-09 (notesPublic + revalidatePath absent from `main`) — a HIGH-severity functional regression that nobody caught for ~2 weeks. The implementation commit (`4d362ff`) was cited in Phase 23 SUMMARY but never reached HEAD. Pattern: distrust SUMMARY claims; trust grep + ancestry checks against current HEAD.
5. **Workflow gap: REQUIREMENTS.md auto-update at phase close.** Four milestones in a row — v2.0 + v3.0 + v4.0 + v4.1 — have shipped with stale REQUIREMENTS.md checkboxes that audit-time has to reconcile. The phase-complete tool should auto-flip checkboxes when their phase verifies.
6. **Append-only edits to audits preserve provenance.** When a milestone audit needs amendment (e.g., closure note for backfilled artifacts), append rather than rewrite. Byte-equality invariant on the original body is a one-line CI assertion.
7. **Post-ship hotfix is a valid recovery path for critical-path UI bugs.** Phase 30 UAT failure → root cause diagnosis → hotfix commit → UAT pass cycle in ~6 hours, no follow-up phase scoped. Phase VERIFICATION.md frontmatter `post_ship_hotfix:` block + `human_verification` status flip is the appropriate accounting.
8. **Quick Tasks are appropriate for "single regression class" follow-ups.** FORM-04 Gap 3 (useUrlExtractCache) was scoped as a Quick Task rather than a Plan because it addressed exactly one user-observable regression class (re-paste round-trip) with one new primitive. Don't manufacture phase scope when a Quick Task closes the gap.

### Cost Observations
- Model mix: ~75% Sonnet (executor agents + verification + UAT triage), ~25% Opus (orchestration, audit, integration check)
- Sessions: 3-4 sessions over 2 days, with parallel sub-agents for audit + integration check + verification
- Notable: Phase 29 had 3 UAT rounds across 2 days; the iterative fix-chain (Plans 29-05 + 29-06 + Quick Task Gap 3) added ~50% to phase duration but closed all UAT-surfaced regressions inline rather than carrying to v5.0. Phase 30 ship-to-hotfix cycle was ~6 hours. Phase 31 audit-only phase completed in single Sonnet session including byte-equality invariant verification + DEBT-09 surfacing.

---

## Milestone: v5.0 — Discovery North Star

**Shipped:** 2026-05-16
**Phases:** 14 (32, 33, 33b, 34, 35, 36, 37, 38, 39, 39b, 39c, 40, 41, 42) | **Plans:** 64 | **Tasks:** 97
**Timeline:** 11 days (2026-05-06 → 2026-05-16)
**Codebase:** 533 files changed (incl. `.planning/`), +92,757 / −30,489 lines, 433 commits since v4.1 tag; `src/` at ~38,600 LOC

### What Was Built
- Falsifiable discovery audit: a 136-row click-path table across 13 surfaces (Phase 33) and a 42-cell Rdio drift-vector matrix scoring each discovery vector ship/partial/missing (Phase 33b), with 4 product verdicts gating all downstream polish
- Catalog 5-level hierarchy, Layers A–D: `brands` + `watch_families` (A); `watch_lineage_edges` junction with a BEFORE-INSERT cycle-detection trigger + recursive-CTE `CYCLE` guards, a structured `movement_type` enum, era/material columns (B); `watch_variants` + a clean-slate catalog wipe-and-relink + the `watches.catalog_id` NOT NULL flip (C); 7 provenance columns + the `divestments` table (D)
- CAT-13 engine rewire: `analyzeSimilarity()` reads catalog taste as an additive 9th scoring dimension gated on `confidence >= 0.5`; static guards written and passing before `similarity.ts` was touched
- Audit-driven discovery polish closing the entire Phase 33b high-leverage dead-end backlog (NSV-01/02/06/08/12/14/15/16/18/20): mostSimilar Link wraps, common-ground walk-back fallback, fresh-account ReferenceIdentityCard, 8-row Collector Profile sub-cluster, catalog other-owners roster with two-layer privacy, inline Same-family + Lineage rails — backed by a 100-watch / 32-family / 52-edge prod catalog bootstrap
- Profile layout Next 16 conformance: `/u/[username]` refactored to a thin Suspense shell over a cached `ProfileShellResolver` + viewer-dependent `ProfileGate`, replacing 8 uncached top-level fetches and yielding Partial Prerender
- Search & verdict polish (three faceted filters + mobile bottom-sheet on `/search`; pairwise drill-down in CollectionFitCard); Account Danger Zone + 3 branded react-email auth templates; Nyquist hardening sweep + ~33 deferred UAT items triaged; the DEBT-09 `notesPublic` regression fixed

### What Worked
- **Audit-first ordering with row-ID citation** — Phase 33 shipped a 136-row click-path table as an immutable research substrate; every later phase cited DISC-AUDIT-NN / NSV-NN ids rather than vibes. Falsifiable Pass/Fail criteria were written before the audit ran.
- **Engineering-vs-product audit split (Phase 33 → 33b)** — separating the click-path enumeration (engineering) from the north-star verdict authoring (product) let each phase ship a clean artifact; the 4 verdicts cleanly gated Phases 34/35/38/39.
- **Self-idempotent Drizzle migrations + journal-in-same-commit** — `CREATE TABLE IF NOT EXISTS` + `DO`-block FK guards survived `supabase db push` and `drizzle-kit migrate` running in either order; appending the `_journal.json` idx entry in the SAME commit as the SQL file closed the Phase 34 silent-skip footgun. Held verbatim across Phases 34–37.
- **Static guards before implementation (CAT-13)** — `tests/static/similarity.taste-*.test.ts` were written and GREEN before `similarity.ts` changed, so the engine rewire was a guarded transformation, not a leap.
- **Worktree-parallelized waves** — Phases 39b and 39c ran multi-plan waves in parallel git worktrees; dependency-ordered (Wave 0 blocking → Waves 1–4).
- **`vi.mock` discipline triple-confirmed** — any new DAL imported by `/catalog/[catalogId]/page.tsx`'s `Promise.all` must be `vi.mock`'d in `catalog-page.test.ts`; the shallow `@/db` mock cannot cover `.leftJoin/.groupBy/.execute` chains. Established in 39b-04, reconfirmed in 39b-05.

### What Was Inefficient
- **`unstable_instant = { prefetch: 'static' }` on a dynamic route caused a prod 404.** Phase 39c shipped behind a false-positive D-39c-09 sign-off; UAT immediately after the push found a ~98% profile-link 404 rate plus infinite-skeleton-on-mobile. Root cause: Next 16 treated click-time RSC fetches as resolvable from a tree-only static prefetch. Removed in `cf250b1`; recovery (cached resolver shared by layout+page + narrow skeleton) in `61706b7`. A real recovery cycle that a correct verification would have prevented.
- **`font-medium` → `font-semibold` UI-SPEC-vs-lint contradiction fired 3× in Phase 39b alone.** Every UI-SPEC drafting `font-medium` collides with `tests/no-raw-palette.test.ts`; each occurrence cost a Rule-1 auto-fix round-trip (39b-02, 39b-03, 39b-05).
- **REQUIREMENTS.md + ROADMAP checkbox lag — now 5 milestones running.** All 16 in-scope requirements stayed `[ ]` post-ship; 5 ROADMAP phase checkboxes stayed unchecked despite disk-complete; Phase 39c was missing from the ROADMAP phase list entirely. Milestone close had to reconcile all of it.
- **Prod-push operator checkpoints stalled serial progress** — Phase 34 Plan 03 and Phase 36 Plan 05 Task 2 both blocked on `checkpoint:human-action` prod pushes; STATE.md body carried stale "BLOCKED on operator" notes well after the pushes resolved.
- **Turbopack `.next` cache served stale CSS during a light-mode debug** — a dev-server restart alone didn't invalidate `.next/`; `rm -rf .next` was required before the CSS fix could be confirmed (saved as memory `project_turbopack_next_cache_stale_css.md`).

### Patterns Established
- **Self-idempotent migration + journal-same-commit** — the canonical shape for any schema phase that ships both a Supabase migration and a Drizzle twin; the Drizzle `_journal.json` idx entry must land in the same commit as the `.sql` file or `drizzle-kit migrate` silently skips it in prod.
- **Two-layer privacy + separate `count(DISTINCT)` totalCount with an IDENTICAL `WHERE` clause** — the canonical "top-N + total label" DAL shape for cross-user catalog reads; the `WHERE` block intentionally appears twice to defend against future refactor drift introducing a privacy hole.
- **B1 server-tree sibling composition** — for surfaces that delegate rendering to a `'use client'` island (e.g. `WatchDetail.tsx`), new Server Components mount as SIBLINGS at the `page.tsx` level — never imported INTO the client component. `npm run build` is the Next 16 server/client boundary regression guard.
- **Bootstrap (one-shot SQL transaction) ≠ Curation (iterative `seed-lineage.ts`)** — choose the path by scale: empty prod → bootstrap; ongoing additions → curation script once UUIDs are known.
- **Cache Components conformance for viewer-dependent routes** — thin Suspense shell + a `'use cache'` resolver + a viewer-dependent gate with `getCurrentUser` resolved OUTSIDE the cached scope and `notFound()` bubbled before any post-suspending `await`.

### Key Lessons
1. **`unstable_instant` with `prefetch: 'static'` is unsafe on dynamic routes.** It tells Next 16 the page resolves from a tree-only static prefetch; click-time RSC fetches then 404. Dynamic pages need declared `samples` and accept that build-time validation may need `unstable_disableBuildValidation` when a `'use cache'` component queries the DB.
2. **Verification must run against the actually-shipped state, not a claimed one.** Phase 39c's D-39c-09 sign-off was a false positive; the codebase only genuinely delivered the goal after the `cf250b1`/`61706b7` recovery. A VERIFICATION.md verified against a false-positive state is worse than no verification.
3. **Pre-empt the `font-medium` lint collision in UI-SPEC.** When a UI-SPEC drafts a font weight for any component under `src/`, spec `font-semibold` — `tests/no-raw-palette.test.ts` forbids `font-medium`. Three round-trips in one phase is three too many.
4. **Turbopack `.next` cache outlives a dev-server restart.** Before concluding a CSS fix failed, `rm -rf .next`. A restart alone does not invalidate the cache.
5. **Checkbox lag is now a chronic 5-milestone workflow gap.** REQUIREMENTS.md and ROADMAP checkboxes have required audit-time reconciliation in every milestone since v2.0. The phase-complete tooling should flip both when a phase verifies.
6. **Closing a milestone without `/gsd-audit-milestone` trades cross-phase-integration confidence for speed.** Acceptable at single-user scale with all phases disk-complete, but the formal audit is the only thing that systematically checks the seams between 14 phases.

### Cost Observations
- Model mix: ~70% Sonnet (executor + verifier + UAT-triage agents), ~30% Opus (orchestration, audit, planning, integration checks)
- Sessions: many across 11 days; heavy worktree parallelization on Phases 39b/39c
- Notable: the longest milestone by phase count (14) and commit volume (433); the Phase 39c false-positive sign-off + recovery cycle was the single largest avoidable cost — a correct verification gate would have caught the prod 404 before the push.

---

## Milestone: v5.1 — Explore Page Redesign

**Shipped:** 2026-05-19
**Phases:** 5 (43, 44, 45, 46, 47) | **Plans:** 27
**Timeline:** 3 days (2026-05-16 → 2026-05-19)
**Codebase:** 508 files changed (incl. `.planning/`), +44,199 / −3,368 lines, 269 commits since v5.0 tag; `src/` at ~46,900 LOC

### What Was Built
- Polish pass: `/search` filter sheet → swipe/backdrop-dismissable `FilterDrawer`, wishlist cards drop wear UI, equal-height watch cards + add-CTA above the grid, device avatar upload into a new `avatars` Storage bucket, Claude model ID → `claude-sonnet-4-6`
- Catalog enrichment: enrichment script hardened (two-turn `web_search`, rate-limit retry/backoff, per-`catalog_id` logging), a confidence + photo-existence downgrade guard, human-reviewed factual propose/apply scripts, and a full ~100-row production enrichment run
- In-app admin CMS: 5-table migration with two-layer-defended RLS, owner-gated `/admin/lists` + `/admin/paths` with `assertOwner()` in every Server Action, full list/path CRUD, 6 seed paths
- `/explore` five-module shell: Browse the Catalog (brand/era/genre indices + A–Z nav), Collector Archetypes chip rail, and the editorial half — Curated Lists Rail + quality-gated Hero + Where Collections Go — with the old Phase 18 Explore surface retired
- Two end-of-milestone follow-ups closed as quick tasks before close: FU-01 (`/search` facet drawer) and FU-02 (`/explore/brands` smooth scroll)

### What Worked
- **Hard data-dependency phase ordering held.** Enrichment (44) before Browse/Archetypes (46), CMS model (45) before Rail/Hero (47) — every dependent phase had real data to render against; no empty-state guesswork.
- **Inline UAT gap-closure, again.** Phase 43 absorbed 3 gap-closure plans and Phase 46 absorbed 2, all within the phase — zero gap carry-over to the next phase. The pattern is now milestone-routine.
- **Two-layer RLS + `assertOwner()` for the CMS.** A net-new write surface (`/admin/*`) shipped without a draft leak or an ungated Server Action — the v2.0 follower-privacy posture transferred cleanly to editorial content.
- **End-of-milestone follow-ups closed as quick tasks, not deferred.** FU-01/FU-02 were scoped, executed, deployed, and operator-verified the same day — v5.1 closed self-contained.

### What Was Inefficient
- **REQUIREMENTS.md + ROADMAP checkbox lag — now 6 milestones running.** All of ENRH-01..06, CMS-01..10, and EXPL-02/04 stayed `[ ]` and the traceability table stayed `Pending` despite the phases being disk-complete and verified. Milestone close had to reconcile all 18.
- **`milestone.complete` extracted garbage "accomplishments".** The CLI pulled the first noisy line of each SUMMARY.md (`"One-liner:"`, `"FilterDrawer"`, `"Test suite results:"`) into the MILESTONES.md entry; the entire entry had to be hand-rewritten. SUMMARY.md files do not carry a clean `one_liner` field the extractor can trust.
- **`origin/main` drifted ~70 commits behind during the session**, and a first-deploy status check was misread as "in sync" when it was actually listing unpushed commits. CLI deploys (`vercel --prod`) ship the local tree, which masked the drift until an explicit push.

### Patterns Established
- **In-app admin CMS pattern** — owner-gated `/admin/*` routes + `assertOwner()` at the head of every Server Action + two-layer RLS (`USING (status='published')` + explicit DAL `WHERE`) for any future operator-authored content surface.
- **Enrich-before-expand for catalog data** — enrich existing rows so dependent surfaces render real data immediately; defer breadth expansion to its own milestone.
- **Tag-scoped cache invalidation for editorial surfaces** — `revalidateTag('explore:hero', 'max')` in every write path; `revalidatePath` does not invalidate `'use cache'` tag scopes.

### Key Lessons
1. **Checkbox lag is a 6-milestone-running workflow gap.** Every milestone since v2.0 has reconciled REQUIREMENTS.md + ROADMAP checkboxes at close. The phase-complete tooling should flip both when a phase verifies — overdue as a fix.
2. **The `milestone.complete` accomplishment extractor needs a real source.** Until SUMMARY.md files carry a trustworthy `one_liner`, the auto-generated MILESTONES.md entry is unusable and must be hand-written. Treat the CLI entry as a stub.
3. **Verify git remote state explicitly before declaring "in sync."** `git log @{u}..HEAD` listing commits means you are *ahead*, not even. CLI deploys hide remote drift because they ship the local tree.
4. **Closing without `/gsd-audit-milestone` is now the established single-user-scale pattern** — acceptable, but the pre-close artifact audit is doing the load-bearing work, and its false-positive rate (23 items flagged, 0 real) argues for tuning the audit, not the close.

### Cost Observations
- Model mix: ~70% Sonnet (executors), ~30% Opus (orchestration, planning, milestone close)
- Sessions: a single continuous session for the close (deploy → FU quick tasks → verification sign-off → milestone close)
- Notable: shortest milestone since v4.1 (3 days, 5 phases); the largest avoidable cost was the hand-rewrite of the CLI-mangled MILESTONES.md entry.

---

## Milestone: v5.2 — Polish + Taxonomy

**Shipped:** 2026-05-20
**Phases:** 5 (48, 49, 49.1, 50, 50.1) | **Plans:** 21
**Timeline:** 2 days (2026-05-19 → 2026-05-20)
**Codebase:** ~46,900 LOC `src/` baseline; net delta ~minimal (taxonomy removal + redirect addition + dead-code cleanup all roughly offset)
**Audit:** PASSED (initial `tech_debt` → `passed` after closeout)

### What Was Built
- BUG-01 fix at the source: `findViewerWatchByCatalogId` scoped to `status='owned'` so wishlist/sold/grail rows stop triggering the "you own this" framing flip on `/catalog/[catalogId]`
- BUG-02 fix: dark-mode `/search` chip legibility via a shared `text-foreground` token across all 7 chip groups
- Genre vs style taxonomy spike (TAX-01) → written recommendation to retire the genre/archetype surface and consolidate on `style_tags`
- Genre/archetype taxonomy surface removed (TAX-02): `primary_archetype` column dropped from `watches_catalog`, `GenreChips`/`ArchetypeChips`/`/explore/genres`/`archetype-config` deleted, `filters.genre`/`filters.archetype` removed from `CatalogSearchFilters`, similarity weights rebalanced (0.04 archetypeMatch redistributed; engine TASTE_WEIGHT 0.20 envelope + verdict thresholds unchanged), enricher chain stripped of archetype writes, `/explore` CollectorArchetypes rail repointed to derive from `unnest(style_tags)` with `?style=` deep-link
- Watch-detail architecture spike (ARCH-01) → written verdict to keep `/catalog/[catalogId]` and `/watch/[id]` separate; Variant B (URL canonicalization) ships now, Variant C (unified `/w/[ref]`) deferred to v7.0
- URL canonicalization (ARCH-02): page-layer `redirect()` from `next/navigation` on the catalog page when the viewer owns the ref; SC#4 regression-locked via `tests/proxy.test.ts` static assertion; v7.0 TODO planted at `OtherOwnersRoster`
- Milestone-close cleanup: dead `self-via-cross-user` framing surface removed across 6 files (D-DEBT-01); REQUIREMENTS.md checkbox drift fixed (D-DRIFT-01)

### What Worked
- **Spike-then-execute chain pattern reused twice in one milestone (49 → 49.1, 50 → 50.1).** Decision phases stayed clean (no implementation), inserted execution phases inherited a ROADMAP-blessed Ship-Now: YES verdict. The "SPIKE §9 → mid-milestone phase insert" handoff is now a load-bearing convention.
- **Researcher caught a misleading ROADMAP success criterion.** SC#2 in Phase 50.1 said the `status='owned'` filter "is gone" — the researcher noticed that dropping it would re-introduce BUG-01 in a new shape and recommended Option B (keep the filter). The planner adopted it with explicit in-plan rationale. This is the kind of catch a less-deep research pass would have missed.
- **Audit-driven inline closeout produced a `passed` milestone.** Initial audit returned `tech_debt` with 4 items; D-DRIFT-01 (4 checkboxes) and D-DEBT-01 (6-file dead-code cleanup) both closed within the audit cycle. Total closeout time ~45 minutes. The pattern: when the audit enumerates tightly-scoped items, close them rather than carry them.
- **The `feedback_proxy_router_cache_poisoning` memory paid off.** ARCH-02's design constraint ("page-layer only, never proxy.ts") came directly from the v5.1-era memory documenting why proxy redirects break Next 16's Router Cache on RSC prefetches. The memory turned a non-obvious "why not just redirect in proxy.ts" objection into the locked design constraint that birthed the SC#4 regression guard.
- **First v5.x close with a formal `/gsd-audit-milestone`.** v5.0 and v5.1 both closed without it; v5.2's audit caught the dead-code cleanup and checkbox drift that an unaudited close would have shipped silently.

### What Was Inefficient
- **Worktree base-drift on Plan 50.1-01.** Claude Code's `isolation="worktree"` created Plan 01's worktree off an older commit (`8f2924a` instead of the captured `EXPECTED_BASE=828ddd3`). The HEAD-assertion gate in the executor prompt didn't trip because `merge-base HEAD 828ddd3` returned the older ancestor cleanly. The 3-way merge resolved fine (disjoint paths), and the workflow's STATE/ROADMAP backup-restore protected orchestrator-owned files — but this is the kind of race that could matter at higher parallelism.
- **`milestone.complete` accomplishment extractor garbage, again.** Same failure mode as v5.1: `"One-liner:"` / `"File:"` / `"Plan:"` placeholders pulled into the MILESTONES.md entry. Plus it counted Phase 999.1 (a v3.0 phase still living in `.planning/phases/` due to v3.0's missed archival) as a v5.2 phase, inflating the count from 5 → 6. Same hand-rewrite cost as v5.1. The CLI extractor needs a real `one_liner` field on SUMMARY frontmatter and a way to scope phase enumeration to ROADMAP milestone definitions instead of directory listing.
- **`gsd-sdk query commit --files` didn't capture rename source-side.** The safety commit listed destination paths only; the source-side deletes for `.planning/phases/{48,49,49.1,50,50.1}/*` were left staged and required a second commit. Not catastrophic (the renames are still detectable via `git log --follow`), but the workflow's "one safety commit" intent was violated.
- **One round of orchestrator shell-path drift.** During Wave 1 execution, the orchestrator's Bash `pwd` ended up inside Plan 01's worktree (`.claude/worktrees/agent-a84a7e1...`) instead of the project root. Discovered when `git rev-parse --abbrev-ref HEAD` returned a worktree branch name. Fixed by `cd /Users/tylerwaneka/Documents/horlo`. Cost: one cycle of confused debugging; benefit: a clear signal that the orchestrator should always anchor pwd before doing git/file operations after subagent return.

### Patterns Established
- **Spike-then-execute as the dominant v5.x mid-milestone pattern.** v5.0 (33 → 33b, 39 → 39b → 39c) was the first; v5.2 extended it to two parallel chains in one milestone (49 → 49.1, 50 → 50.1). The trigger is the SPIKE's `## Ship-Now Eligibility` section returning YES per ROADMAP SC#4.
- **Audit-driven inline closeout.** When `/gsd-audit-milestone` returns `tech_debt` with tightly-scoped items, close them inline within the audit cycle and re-audit, rather than spawning a follow-up phase or carrying them to the next milestone.
- **Misleading ROADMAP SCs get reframed in-plan with explicit rationale.** When researcher/planner judgment sees that a ROADMAP SC's literal wording would cause regression, the planner writes the rationale in the plan and downstream verification follows the binding constraint (SC#3 + SC#6 here), not the literal wording (SC#2). Don't silently override; document the override.
- **`feedback_*` memories as load-bearing design constraints.** `feedback_proxy_router_cache_poisoning` was cited in the Phase 50 spike, the Phase 50.1 plan, AND the audit's integration check. Memories that document why something was forbidden are the cheapest way to keep "never do X" rules honored across milestones.

### Key Lessons
1. **The `gsd-sdk milestone.complete` CLI extractor needs a real source.** This is the second milestone running where the auto-generated MILESTONES.md entry was unusable. Plumb `one_liner` cleanly through SUMMARY.md frontmatter, or replace the CLI extraction with a planner-authored entry as a workflow step.
2. **Phase enumeration must scope to the milestone ROADMAP, not the directory.** Phase 999.1 has lived in `.planning/phases/` since v3.0; it inflated v5.1 and v5.2 counts and shows up in every pre-close audit as noise. The CLI's `phases.list` should respect milestone boundaries from ROADMAP.md.
3. **Worktree base capture should be sticky across the wave dispatch.** Capturing `EXPECTED_BASE=$(git rev-parse HEAD)` once and passing it into every Agent spawn isn't enough if Claude Code's worktree creator races with orchestrator HEAD updates. Either the worktree should be created from a pinned ref (not the orchestrator's current HEAD) or the executor's HEAD-assertion block needs to fail closed when `merge-base` returns an older ancestor.
4. **Two-layer audit catches what verify-only misses.** Phase 50.1's verifier returned PASSED on 7/7 SCs — clean. The audit then caught the orphaned dead-code surface (D-DEBT-01) and the checkbox drift (D-DRIFT-01). Verifier validates "did the phase deliver?"; auditor validates "is the milestone shippable?" Both gates are load-bearing.
5. **Inline audit-driven cleanup beats deferred cleanup.** D-DEBT-01 was an 6-file, ~30-minute refactor with a tightly scoped test surface. Closing it inline cost less than the next milestone's planning overhead for the same work. The threshold for "close inline vs defer" is roughly: scoped + mechanical + ≤1 hour → close inline; non-scoped or research-required → defer.
6. **`/gsd-audit-milestone` at every milestone close, full stop.** v5.2 is the first v5.x close to run it, and it caught real items in both `passed`-direction (D-DRIFT-01) and `tech_debt`-direction (D-DEBT-01). The v5.0 and v5.1 closes shipped without it and are presumably carrying analogous debt that hasn't surfaced yet. Make this a hard ritual gate, not an option.

### Cost Observations
- Model mix: ~70% Sonnet (executors), ~30% Opus (planner, plan-checker, milestone orchestration, audit-driven cleanup)
- Sessions: 1 continuous session for plan-phase → execute-phase → audit → closeout
- Notable: shortest milestone since v4.1 (2 days, 5 phases) — the spike-then-execute pattern made each chain very cheap; the largest avoidable cost was the second-time `milestone.complete` extractor hand-rewrite. v5.2 was also the first milestone where audit-driven cleanup converted a `tech_debt` close into a `passed` close inline, saving the next-milestone overhead of carrying D-DEBT-01.

---

## Milestone: v6.0 — Social Interaction

**Shipped:** 2026-05-24
**Phases:** 8 (53, 54, 55, 56, 56A, 57, 57.1, 58) | **Plans:** 37
**Timeline:** 3 days (2026-05-22 → 2026-05-24), 257 commits (58 feat, 27 test, 26 fix)
**Codebase:** ~51,300 LOC `src/` (+~4,436 / −484 across 51 files)
**Audit:** PASSED (`/gsd-audit-milestone` — 34/34 reqs, 7/7 integration flows, 0 critical blockers)

### What Was Built
- A scoped likes-and-comments layer on individual watches and wears — explicitly *not* "Instagram for watches" (likes are count-only, never hit the feed; wishlist comments are mutual-follow gated)
- Per-target `watch_likes`/`wear_likes` + shared `comments` tables with two-layer privacy (RLS `TO authenticated` + DAL gate), FK `ON DELETE CASCADE`, UNIQUE like-dedup, 500-char/non-blank CHECKs, and a non-transactional 4-value `notification_type` enum extension (Phase 53)
- A DAL with a bidirectional `isMutualFollow` wishlist-comment gate, integration-tested against direct DAL calls (Phase 54)
- Zod-`.strict()` Server Actions with anti-IDOR auth re-verification, notification fan-out, and DB-enforced like-dedup via partial UNIQUE indexes + raw-SQL `ON CONFLICT DO NOTHING` (Phase 55)
- An optimistic `LikeButton` on watch + wear detail (Phase 56)
- Unification of the two disconnected wear-viewing experiences into routed `/wears/[username]` (full-screen stories lane) + `/wear/[id]` (permalink) sharing one `WearCard`/`LikeButton`/`WearCommentHost`; legacy `WywtOverlay`/`WywtSlide` modal deleted (Phase 56A)
- A shared `src/components/comment/` family with gate-aware locked-state UI, comment feed activities (gated, no leak), and batched profile-grid counts (Phase 57); prod-UAT polish + own-watch compose suppression (Phase 57.1)
- Bell/inbox rendering for the 4 new types with like-grouping + per-type `notifyOnLike`/`notifyOnComment` Settings opt-out (Phase 58)

### What Worked
- **Bottom-up vertical layering (schema → DAL → actions → UI) with explicit cross-layer contracts.** Each phase shipped a clean interface the next consumed: Phase 53's tables/enum, Phase 54's gate predicate + `CommentGateError`, Phase 55's cache-tag contract + `code:'gate'` discriminant. The UI phases (56/57/58) attached matching `cacheTag()`s to consumers that the action phases declared. Almost no rework across the seam.
- **Inserting Phase 56A *before* the comment UI.** The legacy WYWT client overlay stranded likes/comments on an orphan permalink with the URL stuck on `/`; unifying into routed surfaces with a shared `WearCommentHost` seam first meant Phase 57 had one comment host to fill, not two divergent ones. Sequencing the restructure ahead of the feature it enabled paid off.
- **CR-01 carry-forward discipline.** Phase 53's code review surfaced that the comments RLS gate fails closed for non-owners (its `watches.status` subquery runs under the caller's RLS) — safe but not a working mutual-follow gate. Rather than patch RLS under time pressure, it was carried as a high-priority todo and resolved cleanly in Phase 54 by making the service-role DAL the load-bearing gate. The defect was understood, parked with an owner, and closed at the right layer.
- **Prod-UAT-driven polish phases stayed scoped.** Phase 57.1 (drawer centering, inline controls, optimistic badge, own-watch suppression) came straight from Phase 57's on-prod UAT; out-of-scope ideas were captured as SEED-015/016 rather than scope-creeping the insert. 5/5 prod UAT.
- **Worktrees off for the whole milestone.** Set `workflow.use_worktrees=false` globally up front because every phase is DB-touching and build-gated (`npm run build` needs `.env.local` for DB-backed RSC routes, which gitignored-`.env.local` worktrees omit). Zero env-less build failures — a class of failure that bit prior milestones.
- **Mobile/visual UAT verified on prod, batched per phase.** Local e2e skips on the empty test DB, so UI behavior was classified `human_needed`, bundled, build-gated, and verified on the Vercel deploy. All 5 UI phases passed.

### What Was Inefficient
- **`milestone.complete` accomplishment extractor garbage — third milestone running.** Same failure as v5.1/v5.2: the auto-generated MILESTONES.md entry was full of `"One-liner:"`, `"Task 1 —"`, and bare filenames, and it counted 9 phases (it directory-globs, sweeping in the out-of-milestone 999.1 / double-counting decimal phases) instead of 8. Hand-rewritten again. This is now a standing workflow tax.
- **Nyquist VALIDATION docs left at `draft` across phases 54–58.** The described tests exist and pass (per each VERIFICATION.md), but the tracking docs were never reconciled to `nyquist_compliant: true` post-execution. The milestone audit flagged this as `partial` Nyquist coverage — a doc-reconciliation gap, not a coverage gap, but it muddies the audit signal and requires a `/gsd-validate-phase N` pass to clean.
- **The Router Cache stale-instance bug cost ~4 debug rounds in Phase 56A.** Next 16 restores the *same* stale client-component instance on revisited dynamic URLs; key-remount doesn't reset refs/guards. The fix (reset one-shot state on `onPointerDown`, not on mount) is now a durable memory, but rediscovering it was expensive.
- **The CR-01 RLS-vs-DAL gate confusion took a phase to clarify.** Phase 53 shipped an RLS gate that *looks* like a mutual-follow gate but isn't (fails closed for non-owners). It was safe, but the "which layer is load-bearing" question wasn't fully resolved until Phase 54. Stating "the service-role DAL is the gate; RLS is the anon-block only" in the Phase 53 plan would have saved the ambiguity.

### Patterns Established
- **Per-target tables over a polymorphic interaction table** when you need real FK cascade + per-table UNIQUE constraints; the discriminator lives in the table name, not a nullable-target CHECK. (Comments stayed single-table with an XOR CHECK because they need one author-scoped read path.)
- **DAL-as-load-bearing-privacy-layer when an RLS subquery would read an owner-only table.** An RLS policy whose subquery reads a table the caller can't see fails closed (safe) but is not a working cross-user gate. Put the real gate in the service-role DAL and document loudly that RLS is the anon-block only.
- **DB-enforced dedup via partial UNIQUE index + raw-SQL `ON CONFLICT DO NOTHING`** for notification spam control — makes ≤1-row a database invariant, not an application race.
- **Uncached gated threads** (dynamic read in Suspense) to close a per-viewer cache-leak vector without per-viewer cache-tag bookkeeping.
- **Restructure-before-feature phase sequencing** (56A before 57) when a feature would otherwise be built twice across divergent surfaces.
- **Worktrees off as the default for DB-touching / build-gated milestones** — now the global config default.

### Key Lessons
1. **An RLS policy subquery that reads an owner-only table is not a cross-user gate.** It fails closed (no leak, safe) but never grants access to the legitimate non-owner case — so it's not the mutual-follow gate it appears to be. The Drizzle service-role `db` bypasses RLS anyway, so the real gate must live in the app-layer DAL. RLS's job here is the anon-block; the DAL's job is the relationship gate. (Durable — captured in memory.)
2. **Next 16's Router Cache restores the same stale client-component instance on revisited dynamic URLs.** Key-remount won't reset refs/guards; reset one-shot state on interaction (`onPointerDown`), not on mount. Cost 4 debug rounds in Phase 56A before the pattern was found. (Durable — `project_router_cache_stale_instance`.)
3. **`gsd-sdk milestone.complete` extractor is broken three milestones running** and directory-globs phases (sweeping 999.1, miscounting decimals). Either plumb a real `one_liner` SUMMARY field + scope phase enumeration to the ROADMAP milestone, or make a planner-authored MILESTONES entry a formal workflow step and stop pretending the CLI output is usable.
4. **Reconcile Nyquist VALIDATION docs at phase close, not at milestone audit.** Leaving them at `draft` while the tests pass turns a green test suite into a `partial` audit signal. A one-line `nyquist_compliant: true` flip per phase at close would have made v6.0's Nyquist coverage read `compliant` instead of `partial`.
5. **Product guardrails encoded as decisions keep scope honest.** "Likes never hit the feed," "count-only, no liker list," "no threaded replies/moderation," and the wishlist-comment asymmetry were all operator decisions logged up front — they prevented the social layer from drifting into an Instagram-style attention machine across 8 phases.
6. **Carry-forward-with-an-owner beats patch-under-pressure.** CR-01 was understood at Phase 53, parked as a high-priority todo tied to Phase 54, and closed at the correct layer. A defect that's understood and assigned is not the same as deferred debt.

### Cost Observations
- Model mix: ~70% Sonnet (executors), ~30% Opus (planner, plan-checker, milestone orchestration + audit)
- Sessions: multiple across 3 days (plan → execute → prod-UAT-verify per phase, with two prod-UAT-driven inserts)
- Notable: the largest avoidable costs were the third-running `milestone.complete` extractor hand-rewrite and the Phase 56A Router-Cache debug spiral. Worktrees-off up front and the bottom-up layered contracts kept execution friction low for an 8-phase milestone; first v6.x close run through a formal audit.

---

## Milestone: v7.0 — Watch Photos & Detail Redesign

**Shipped:** 2026-05-28
**Phases:** 7 (59, 60, 61, 62, 63, 64, 65) | **Plans:** 29
**Timeline:** 4 days (2026-05-25 → 2026-05-28), 244 commits since v6.0 close (46 feat, 39 fix, 27 test, 123 docs)
**Codebase:** ~55,320 LOC `src/` (+5,057 / −628 across 65 files; +3,982 / −502 across 33 tests files)
**Audit:** Closed WITHOUT a formal `/gsd-audit-milestone` (mirrors v5.0/v5.1 close decision); 34/34 v7.0 requirements checked off in REQUIREMENTS.md; STATE.md reported `status: milestone_complete`; pre-close artifact audit's 28 open items acknowledged as deferred

### What Was Built
- A unified canonical `/w/[ref]` route via Variant C **hard cutover** — legacy `/watch/[id]` + `/catalog/[catalogId]` removed without a redirect; ROUTE-03 build-failing Vitest static guard catches any surviving `/watch/${` or `/catalog/[…]` literal in `prebuild`; per-viewer framing (owner vs cross-user) and the two-layer privacy gate preserved (Phase 59)
- A real multi-photo model: `watch_photos` table with ordering + ~10/watch cap; in-place ALTER on `watches_catalog` + lossless `image_url` backfill→drop (NOT a wipe); first-photo cover thread across all 3 read paths via a cover subquery returning raw `storagePath` (URL signing at the page layer outside `'use cache'` scope); EXIF strip + ≤1080px JPEG pipeline; prod migration via `supabase db push --linked` (Phase 60)
- Photo upload + carousel UI: storage path prefixed `{userId}/` per IDOR CR-02; embla v8 one-at-a-time carousel with arrow + swipe nav; drag-reorder filmstrip with cover badge in edit-mode only; per-photo delete with `useOptimistic` Undo (aborted-signal pattern); add-watch flow's prominent `WatchPhotoStep`. Bug-fix sweep: React #419 soft-nav 404 family on `/w/[ref]` + `/wear/[id]` resolved via `await connection()` static-shell opt-out; React #418 date-TZ hydration via pinned `timeZone: 'UTC' + 'en-US'`; catalog-photo placeholder gap closed inline via migration `20260526120000` (31 prod `watch_photos` rows backfilled) (Phase 61)
- Public wear pics surfacing to watch detail with dual-layer ownership enforcement (server action + DAL `sql\`\`` subquery — defense in depth for T-62-04 IDOR); v6.0 likes/comments layer per surfaced slide using the `wp` loop var so every slide is independently interactive; eye/hide toggle uses `onPointerDown` (Router Cache stale-instance mitigation) (Phase 62)
- Inline like + lightweight comment composer on profile grid cards with optimistic `♥ N · 💬 M` counts via `getBatchedWatchCounts` extension (single `inArray` query for viewer-liked set, no N+1); full thread still clicks through (compose-only inline by design); GATE-03 wishlist mutual-follow gate enforced per card; D-12 cache fix in both `toggleLikeAction` + `addCommentAction` (Phase 63)
- `/w/[ref]` IA recompose into carousel-forward + elevated-verdict + deliberate-comment-placement hierarchy; mobile brand+model hoist above the carousel via `lg:hidden`/`hidden lg:block` JSX dup (NOT CSS `order-`) with `WatchPageSkeleton` mirror; Phase 51/52 Cache Components structure intact (CommentThread stays an uncached Suspense sibling; `unstable_instant = false` on `/u/[username]/[tab]` not disturbed); PPR guard pattern repaired with `MAX_LOOKAHEAD = 70` for Branch 1 (Phase 64)
- A compact "people you follow who own this" module in the hero right column — hide-if-empty; one-way "viewer → owner" direction (taste-discovery framing per the UAT 2026-05-27 product call); pure RSC chip stack with `@vitest-environment node` static tripwire; `FollowedOwner` type-only across the client/server boundary so the prop threads through `WatchDetailHero` ('use client' island) without dragging server-only DAL across (Phase 65)

### What Worked
- **Variant C as a hard cutover with CI as the completeness guarantee.** Removing legacy routes without a redirect made every un-migrated internal link fail loudly. Manual click-through across ~55 link literals across ~36 files would have been brittle; the ROUTE-03 build-failing Vitest static guard (`prebuild` hook → Vercel build) is the durable verification. The v5.2 ARCH-02 Variant B page-layer redirect was unwound rather than left as a parallel safety net — fewer moving parts, no Router Cache poisoning landmine.
- **Restructure before feature, again.** Tackling the route merge (Phase 59) *first* meant the carousel (Phase 61), public wear pics (Phase 62), inline grid engagement (Phase 63), and the IA redesign (Phase 64) all landed once on the canonical URL — not twice across diverged surfaces. Same pattern that paid off in v6.0 Phase 56A → 57.
- **Phase 61 as a single bug-fix sweep on the heels of the upload UI.** Rather than spawning Phase 61.x or carrying the #419 / #418 / IDOR / catalog-placeholder / WatchForm-toast / embla-rename items into Phase 62, they were folded into Plan 06 as a coordinated sweep. Six bugs closed cleanly, the durable static guard for the PPR ordering rule landed alongside, and Phase 62 started clean.
- **`await connection()` as the durable #419 family fix.** Four prior fixes (proxy, Router Cache, Cache Components, instant-nav) had failed on this bug class; the static-shell opt-out is the structural pattern that finally holds — opt out of the prerendered static shell that aborts on soft-nav resume, then sign URLs via the admin client (not the cookie client, which fails in cached context). Static guard locks the ordering. The fix also resolves the bug class on `/wear/[id]`, which had been silently affected.
- **Phase 65 as a planted follow-on instead of a Phase 64 expansion.** Surfaced during the Phase 64 UAT, the follow-scoped owners module would have muddied Phase 64's recompose-only contract. Capturing it as its own DAL + component + integration trio (3 plans / 2 waves) kept Phase 64 clean and let the module ship with its own static RSC guard. Mirrors the v6.0 Phase 57.1 polish-insert pattern but with a clearer bound (a new requirement family, not a polish refinement).
- **In-place ALTER on `watches_catalog` honored without exception.** The `watches_catalog` no-wipe rule was a known constraint (v3.0–v5.1 LLM/factual/photo enrichment investment); Phase 60 shipped backfill + lossless assert + DROP COLUMN + RLS + storage-bucket in one authoritative Supabase migration and pushed via `supabase db push --linked`. Zero data lost; ids stayed stable across local and prod.
- **Mobile UAT verified on prod, batched per phase.** Same v6.0 pattern: build-gated structural code locally, classify device behavior `human_needed`, bundle into one push, verify on the Vercel deploy. All 7 phases passed on-prod human UAT.

### What Was Inefficient
- **Phase 64 UAT surfaced two scope gaps that needed Plan 64-05 + Phase 65 as gap-closures.** The mobile brand+model below-fold issue (Plan 64-05) was a missed responsive case in the Wave 2 recompose; the follow-scoped owners module (Phase 65) was a genuinely new requirement, but the UAT round was the discovery point. Better up-front mobile-first thinking in Wave 2 would have caught the first; the second was a legitimate product surfacing. Net: one extra plan + one extra phase in a 7-phase milestone — not a disaster, but a signal that the recompose contract under-specified the mobile case.
- **ROADMAP.md ended up truncated during v7.0 execution.** At close, `/Users/tylerwaneka/Documents/horlo/.planning/ROADMAP.md` was only 44 lines: just Phase 64 + Phase 65 + a Progress table missing Phase 65's row, with no `# Roadmap`, no `## Milestones`, no `## Phases`. The collapsed-prior-milestones structure that v7.0 inherited from kickoff (`7cad9c79`) had been overwritten somewhere during execution-phase docs commits. Recoverable from git history (the kickoff blob had the right structure), but a structural artifact that should not have degraded. The close cycle rewrote it from scratch.
- **`gsd-sdk milestone.complete` extractor garbage — fourth milestone running.** Same failure as v5.1/v5.2/v6.0: the auto-generated MILESTONES.md entry would have been junk (`"One-liner:"`, `"Task 1 —"`, miscounted phases). Hand-rewrote again — now a standing workflow tax that should be replaced with planner-authored entries as the formal workflow step. (Memory `project_next_clear_operational_debt` already flags this.)
- **Pre-close artifact audit's 28 items were mostly false-positives + dormant seeds.** 2 false-positive UAT statuses (Phase 59 [passed], Phase 62 [resolved] both reporting 0 pending but flagged as gaps), 1 false-positive verification status (Phase 61 [human_needed] despite being prod-verified per memory `project_phase_61_complete`), 13 dormant seeds (5 of which actually shipped). The audit signal is noisy; either the audit query needs to read statuses (PASSED/RESOLVED/COMPLETE/SHIPPED) or seeds need a `shipped:` field that closes them automatically. As is, every milestone-close has the same "acknowledge 20+ items" ritual.
- **Phase dir archival required hand-verification per the `feedback_milestone_close_phase_dir_archival_miss` memory.** Prior `/gsd-complete-milestone` runs (v6.0 kickoff caught it for v6.0 + the stray v3.0 999.1) historically archived only top-level docs, leaving `.planning/phases/` dirs in place — which `/gsd-new-milestone`'s `phases.clear --confirm` would then DELETE without recovery. This milestone close moved them inline (`git mv .planning/phases/{59..65}-* .planning/milestones/v7.0-phases/`) before the next-milestone tooling could run. The close workflow's `Archive Phases` AskUserQuestion exists for this; the gap is the memory's recurring caveat — the workflow shouldn't *ask*, it should default to archiving.

### Patterns Established
- **CI link-audit static guard as the completeness guarantee for hard cutovers.** When a hard-cutover removal would otherwise require manual click-through across many literals, build-fail the `prebuild` hook on any forbidden literal. ROUTE-03's `prebuild` Vitest static scan catches JSX hrefs, template literals, *and* computed deep-link constructors like `NotificationRow.resolveHref`. The cost is one test file; the benefit is the manual audit is replaced by CI.
- **`await connection()` static-shell opt-out for per-viewer-dynamic PPR routes.** The pattern that finally resolves the React #419 soft-nav 404 family. Put `await connection()` ABOVE the page/layout Suspense — opts out of the prerendered static shell that aborts on soft-nav resume. Pair with admin-client URL signing (cookie client fails in cached context). Static guard with `@vitest-environment node` encodes the durable ordering rule.
- **Date-only fields in client components need pinned `timeZone: 'UTC' + 'en-US'`.** Bare/undefined-locale `toLocaleDateString()` causes React #418 hydration text mismatch (server UTC vs browser local zone/locale). Triage pattern: grep `toLocaleDateString` without `timeZone` on the route.
- **In-place ALTER for non-wipeable canonical tables, with data migrations keyed by natural key (not id).** `watches_catalog` ids diverge local vs prod (per the `project-catalog-id-divergence` memory), so id-keyed data migrations are no-ops cross-DB. Key by `(brand, model, reference)` for catalog data migrations.
- **Type-only imports across the client/server boundary preserve 'use client' island integrity.** `FollowedOwner` is `import type` only in the FollowedOwnersModule — the component never imports `getFollowedOwnersForCatalog` (server-only DAL). Lets the prop thread through a 'use client' island (`WatchDetailHero`) without dragging server-only modules across the boundary.
- **Mobile-only JSX dup (`lg:hidden` / `hidden lg:block`) over CSS `order-` for layout hoists.** When a desktop 2-col layout collapses to a single column on mobile and one element needs to move above another, JSX dup keeps the layout contract intact and renders visually-identical duplicated nodes. CSS `order-` would require restructuring the grid contract.
- **Defense in depth via dual-layer ownership (server action + DAL `sql\`\`` subquery).** For per-owned-item write paths, re-check ownership in both the Server Action (`watchDAL.getWatchById`) AND in the DAL update query (`WHERE watch_id IN (SELECT id FROM watches WHERE user_id = ?)`). Either layer failing alone is still caught.
- **Planted follow-on phases for UAT-surfaced new requirements, not Phase X.1 polish inserts.** When the UAT surfaces a genuinely new requirement family (not polish on the current scope), capture it as Phase X+1 with its own requirement IDs and DAL/component/integration plans. Phase 65 (FOLL family) was a follow-on, not a 64.1 polish insert.

### Key Lessons
1. **Hard cutovers + CI guards beat parallel safety nets.** Keeping the v5.2 ARCH-02 Variant B redirect alive as a fallback during Phase 59 would have created two correct routing paths and obscured the v5.2 → v7.0 transition. The hard cutover (legacy removed, no redirect) plus the ROUTE-03 build-failing guard is the cleaner posture; un-migrated links fail loudly; the CI guard is the durable completeness verification. (Memory candidate.)
2. **`await connection()` is the structural fix for the React #419 soft-nav 404 family, not call-ordering / per-route Suspense.** Four prior fixes failed because they treated the bug as a cache-fill ordering or Suspense placement issue. The real cause is the prerendered static shell aborting on soft-nav resume — opt out of the static shell with `await connection()` above the page/layout Suspense. Pair with admin-client URL signing. Build can't confirm (`◐` stays); verify on prod AFTER cache fills (cold read = false positive). (Memory: `project_ppr_dynamic_before_use_cache`.)
3. **The pre-close artifact audit's signal-to-noise ratio is poor and recurring.** Every milestone-close acknowledges 20+ items, most of which are false-positive UAT/verification statuses (passed-but-flagged) or dormant-seeds-that-shipped. The audit query needs to read status fields (PASSED/RESOLVED/COMPLETE/SHIPPED) and seeds need a `shipped:` field. As is, the close ritual has a fixed-cost "acknowledge all" step that adds friction without surfacing real risk.
4. **The phase-dir archival step should default to archive, not ask.** The `feedback_milestone_close_phase_dir_archival_miss` memory has recurred enough that the close workflow's `Archive Phases` AskUserQuestion should default to archiving rather than offering "Skip — keep phases in place." The destructive failure mode (`/gsd-new-milestone`'s `phases.clear --confirm` deleting un-archived phase dirs) is much worse than the benign failure mode (extra `git mv` runs).
5. **ROADMAP.md is fragile to mid-milestone execution edits.** At v7.0 close, the file was truncated to 44 lines (Phase 64 + 65 + partial Progress table only) — the collapsed-prior-milestones structure inherited from kickoff had been overwritten. The close cycle rewrote it from scratch using the git history of the kickoff commit (`7cad9c79`). Pattern: treat ROADMAP.md as a structured document with a stable header skeleton, not as an append-target.
6. **Type-only client/server imports are a strict architectural lock, not a stylistic preference.** Phase 65's `FollowedOwner` type-only import preserved the 'use client' island's ability to receive a server-resolved prop without dragging the server-only DAL across the boundary. Static guard with `@vitest-environment node` encodes the lock. Pattern transfers to any RSC-resolved data threaded into a client component.

### Cost Observations
- Model mix: ~70% Sonnet (executors), ~30% Opus (planner, plan-checker, milestone orchestration)
- Sessions: multiple across 4 days (plan → execute → prod-UAT-verify per phase, with Plan 64-05 + Phase 65 as UAT-surfaced inserts)
- Notable: the largest avoidable cost was the truncated ROADMAP.md recovery at close (~30 min reconstructing structure from the kickoff commit); the largest unavoidable cost was the Phase 61 bug-fix sweep (six bugs in one plan — but consolidated, not spread across follow-up phases). Worktrees-off (permanent project posture) and the route-merge-first sequencing kept execution friction low for a 7-phase / 29-plan milestone.

---

## Milestone: v8.1 — Add-Watch Polish

**Shipped:** 2026-05-30
**Phases:** 3 (72, 73, 74) | **Plans:** 5 | **Tasks:** 11
**Source:** v8.0 post-deploy human UAT on prod (`418f0515`) captured 6 distinct defects across 3 issue clusters

### What Was Built

The 6 v8.0-captured defects all closed in 1 day across 3 surgical phases:

- **Phase 72 — Search Composition Fixes** (SRCH-01/02/03): `searchCatalogForAddFlow` DAL WHERE rewritten from single-substring OR to AND-of-ORs per whitespace-split token (multi-token match for "Brut Datejust" / "Timex Weekender"); two surgical SearchEntry edits restored base-ui Combobox keyboard nav (`isItemEqualToValue` prop + `index={i}` removal); footer button relocated outside `Combobox.List` as a Popup sibling (click survives list blur).
- **Phase 73 — Owned-Redirect Route Fix** (ROUTE-01): `handleSearchPick` owned branches swapped slug source from `result.reference` (model number, failed `/w/[ref]` UUID guard → 404) to `result.catalogId` (UUID always present); both owned branches collapsed to a single early-return `router.push`; receiver route untouched.
- **Phase 74 — DupeBanner Gate + Mobile Polish** (DUPE-04 + MOB-01): additive `bannerActive?: boolean` on ConfirmStep — Section 6 primary CTA early-returns null when banner is mounted (the banner IS the choice surface); AddWatchFlow OR-gate reverted to pure `pending` per Phase 68 D-03 contract. Global `@layer base { input,textarea,select { font-size: 1rem; } }` + 3 className rewrites `text-sm` → `text-base md:text-sm` in CommentCompose/CommentItem/SearchEntry. Two new fs-walking static guards lock the viewport meta + className invariants (both declare `// @vitest-environment node` per `project_vitest_static_node_env`).

Single bundled prod push (`9eaa94de`) → single iPhone Safari UAT walk on horlo.app: **6/6 items passed** (3 SRCH + 1 ROUTE + 1 DUPE + 1 MOB — pinch-zoom preserved, no desktop visual regressions).

### What Worked

- **Pure subtraction-of-defects scope** held — no scope creep into v9.0 catalog or SEED-014 cache components. Each phase shipped its own targeted regression test alongside the fix.
- **Bundled deploy + single UAT walk** (CONTEXT D-15) collapsed 3 phases × 6 items into one push + one prod walk. Operator-stated preference (per `feedback_mobile_ui_verify_on_prod`) — saved 2 separate UAT walks vs phase-by-phase verification.
- **Additive prop extension** kept Phase 68 D-03 ConfirmStep contract intact while solving DUPE-04. The `bannerActive?` prop reads at the call site exactly like `pending?` (same shape, default false). Rejected: conditional `{!state.dupeContext && <ConfirmStep />}` would have unmounted the entire form on dupe-context toggle, flickering focus + resetting WAI-ARIA radiogroup state (Phase 68 recurrence-4 pattern).
- **Disappearance-paired assertion discipline** (per `feedback_test_assert_disappearance_too` recurrence-3) ported cleanly from Phase 73 ROUTE-01 to Phase 74 DUPE-04: every "X disappears" assertion is paired with "Y appears" in jsdom. Caught the test-vs-prod-discrepancy class that bit Phase 72 SRCH-03b earlier in the milestone.
- **`@layer base` as the right cascade level for the iOS auto-zoom floor** — specificity 0,0,1 means utilities still win; shadcn primitives (already `text-base md:text-sm`) untouched; admin tooling (`text-sm` overrides intentional in those admin-only contexts) unaffected; no `!important` needed.

### What Was Inefficient

- **5th recurrence of `phase.complete` extractor garbage + progress-counter inflation** hit again at close. The progress-counter bug fires even when `is_last_phase: true` (no `next_phase` corruption this round, but `completed_phases: 4 / total_phases: 3 / percent: 133` still landed in STATE.md frontmatter). Hand-corrected back to 3/3/100%. 5 milestones running of the same extractor pattern.
- **5th recurrence of JSDoc-prose grep-collision** preempted in the D-12 guard. Initial SCOPE LIMIT comment cited `src/components/admin/*` verbatim and would have tripped the AC `grep -c "src/components/admin" returns 0`. Reworded to "the admin/ subtree" — clears the grep while preserving doc intent. The same pattern across Phases 64 / 69 / 70 / 74-01 / 74-02 says: AC greps targeting literal tokens false-positive on JSDoc-prose using that token; paraphrase in prose, keep the literal in code/strings only.
- **Pre-close artifact audit signal-to-noise still poor** (v7.0 lesson #24 re-confirmed). 3 v8.1 UAT files flagged as "gaps" — all `status: passed` with 0 pending (false positive). 13 dormant seeds listed — 5 of them actually shipped earlier (SEED-008 v5.1, SEED-010 as v8.0/v8.1, SEED-012 v6.0, SEED-013 v7.0, SEED-015 v7.0) and need re-classification. The "acknowledge all" step continues to be fixed-cost ritual friction rather than risk-surfacing signal.
- **No `/gsd-audit-milestone` ran** — mirrors v5.0/v5.1/v7.0/v8.0 close decisions but extends the audit-skip streak. The polish-milestone pattern (small N of req-IDs, all UAT-verified) makes the audit cost feel high relative to risk; consider whether polish milestones need a lighter-weight close ritual that still proves req-coverage.

### Patterns Established

- **Bundled-deploy polish pattern**: when multiple polish phases ship in one session against a single deployment target, bundle the prod push and run ONE UAT walk covering all items. Add a "bundle preference" note in CONTEXT and a "verified_in_bundle" field in each phase's HUMAN-UAT.md so the lineage is grep-able.
- **Disappearance-paired test discipline as milestone-routine** — 3 phases (72, 73, 74) all used the pattern; now a default expectation for any UI-gating change. Encoded in memory `feedback_test_assert_disappearance_too`.
- **Additive optional prop with default-false as the ConfirmStep extension idiom** — Phase 68 D-03 + Phase 70 D-17 + Phase 74 D-02 all used this shape (`movement?`, `caseSizeMm?`, `dialColor?`, `bannerActive?`). Now the established pattern for orchestrator → presenter feature gates without breaking the prop contract.
- **fs-walking static guard with `// @vitest-environment node` pragma as a default file-1 declaration** — Phase 71 retrofitted 8 pre-existing guards with the pragma; Phase 74 added 2 more (D-11 + D-12) with the pragma declared on line 1. Vercel prebuild gate now exercises 19 static-guard test files.

### Key Lessons

28. **(v8.1)** The `phase.complete` progress-counter bug is independent of the next-phase-id bug. The next-phase-id bug (`project_phase_complete_999_1_misset`) is suppressed correctly when `is_last_phase: true`, but the progress-counter inflation fires anyway (`completed_phases` increments past `total_phases` → percent > 100%). Both bugs require hand-correction at every phase close, and the assumption that "last phase = no STATE corruption" is wrong. Treat STATE.md frontmatter as needing inspection after EVERY `phase.complete`, not just the non-final ones.

29. **(v8.1)** The JSDoc-prose grep-collision pattern is now load-bearing knowledge across 5 phases. Any AC of the form `grep -c "<literal>" <file>` returns N` will false-positive on JSDoc/inline comments using the literal. The mitigation is uniform: paraphrase in prose, keep the literal in code/strings only. Worth a planner-side lint rule: when a plan declares an AC of this shape, flag any JSDoc body in the same file that contains the literal token.

30. **(v8.1)** Bundled deploys + single UAT walks dominate phase-by-phase prod verification for polish milestones. v8.1 ran 3 phases / 6 items into one Vercel push + one iPhone walk; the alternative (3 separate pushes + 3 walks) would have ~3× the operator overhead with no risk reduction. The `verified_in_bundle` field on HUMAN-UAT.md makes the bundle lineage grep-able. Pattern applies whenever (a) phases share a deploy target, (b) phase items are independent enough to verify in any order, and (c) operator is available for the walk.

31. **(v8.1)** Additive optional props with default-false are the right shape for orchestrator → presenter feature gates. They preserve the existing prop contract, compose at the call site without breakage, and avoid the unmount-on-toggle hazard of conditional rendering. Phase 68 D-03 / Phase 70 D-17 / Phase 74 D-02 all used this shape; now an established pattern for incremental presenter evolution without contract churn.

32. **(v8.1)** The `@layer base` cascade level is the right home for app-wide native-element defaults (font-size floor, focus ring, etc.). Specificity 0,0,1 means utility classes (specificity 0,1,0) still win, so component-level overrides remain in control. shadcn primitives that already encode the right value need no change; admin-only utility classes that intentionally diverge stay diverged. No `!important` needed, no specificity wars.

### Cost Observations

- Model mix: ~100% opus 4.7 (planning + execution + verification)
- Sessions: 1 (full milestone in a single GSD chain — plan-phase → execute-phase → verify → ship → close)
- Notable: smallest milestone since v4.1 (2 days / 5 phases) — and v8.1 was 1 day / 3 phases. The bundled-deploy pattern + 47 commits (28 docs, 8 test, 5 feat, 3 fix, 3 chore) shows a healthy docs-to-code ratio for a polish milestone. Zero rework cycles; zero verification-to-replan loops; zero hotfix-after-deploy follow-ups.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 5/6 | First milestone — established GSD workflow patterns |
| v2.0 | 3 days | 5/5 | Added wave-based parallelization, two-layer privacy pattern, cacheComponents, integration-gated test strategy |
| v3.0 | 5 days | 7/7 | Added Wave 0 RED-test discipline, code-review-fix pipeline at phase close, architectural prop-acquisition for browser APIs, three-tier privacy enum pattern, EXPLAIN ANALYZE forced-plan evidence for index proofs |
| v4.0 | 6 days | 12/12 | Added inline gap-closure pattern (3 phases used it), filesystem-absence static guards, D-07-style ordering gates for external-dependency rollouts, hybrid form-feedback (`useFormFeedback` + `FormStatusBanner`), worktree-based plan parallelization at scale (65 plans / 6 days), catalog-as-silent-infrastructure separation, LLM-derived structured taste enrichment with first-write-wins semantics, Postgres enum rename+recreate for cleanup, `@base-ui/react` vertical-tabs with `pushState` hash-routing |
| v4.1 | 2 days | 5/5 | Added three-layer defense for cross-route remount contracts, module-scope Maps for cross-remount cache survival, speech-act split via type-required field, append-only audit edits with byte-equality invariant, auth-callback regex source-equality test, test-infra `<StrictMode>` wrapper as regression-class CI gate, post-ship hotfix workflow (no follow-up phase scoped), retroactive phase audit as DEBT-surfacing tool (DEBT-09 caught) |
| v5.0 | 11 days | 14/14 | Added audit-first ordering with row-ID citation, engineering-vs-product audit split (33 → 33b), self-idempotent migrations + journal-in-same-commit, static-guards-before-implementation for engine rewires, two-layer-privacy + count(DISTINCT)-totalCount DAL shape, B1 server-tree sibling composition, bootstrap-vs-curation path distinction, Cache Components conformance for viewer-dependent routes (thin Suspense shell + `'use cache'` resolver + viewer gate). Largest milestone by phase count + commit volume; cost the one avoidable Phase 39c false-positive-sign-off recovery cycle |
| v5.1 | 3 days | 5/5 | Added the in-app admin CMS pattern (owner-gated routes + `assertOwner()` + two-layer RLS), enrich-before-expand catalog sequencing, and tag-scoped cache invalidation for editorial surfaces. Shortest milestone since v4.1; closed without `/gsd-audit-milestone`; REQUIREMENTS/ROADMAP checkbox lag now 6 milestones running |
| v5.2 | 2 days | 5/5 | First v5.x close with a formal `/gsd-audit-milestone`; audit-driven inline closeout converted `tech_debt` → `passed` (D-DRIFT-01 + D-DEBT-01 dead-code cleanup closed in audit cycle). Spike-then-execute pattern reused twice in one milestone (49 → 49.1, 50 → 50.1). Researcher caught misleading ROADMAP SC wording in Plan 50.1; planner reframed with explicit rationale. Worktree base-drift on Plan 50.1-01 tolerated via 3-way merge — pattern identified for follow-up |
| v6.0 | 3 days | 8/8 | Largest milestone since v5.0. Bottom-up vertical layering (schema → DAL → actions → UI) with explicit cross-layer cache-tag/gate contracts; per-target tables + DAL-as-load-bearing-privacy-layer (RLS = anon-block only); DB-enforced notification dedup via partial UNIQUE + `ON CONFLICT DO NOTHING`; restructure-before-feature sequencing (56A before 57); worktrees off globally for the whole DB+build-gated milestone (config default flipped). Two prod-UAT-driven inserts (56A gap-closure, 57.1 polish). CR-01 carried from Phase 53 → resolved at the correct layer in Phase 54. Second formal `/gsd-audit-milestone` close (passed). Nyquist VALIDATION docs left at `draft` → `partial` audit signal (doc-reconciliation gap) |
| v7.0 | 4 days | 7/7 | Hard-cutover Variant C with the CI link-audit static guard as the completeness guarantee (no parallel safety-net redirect); restructure-before-feature reused (route merge first, then carousel + wear pics + grid + IA + follow module all land once); `await connection()` static-shell opt-out as the structural fix for the React #419 soft-nav 404 family (resolves what 4 prior fixes couldn't); in-place ALTER on `watches_catalog` with `(brand, model, reference)` data-migration keys; type-only client/server imports as a strict architectural lock (Phase 65); planted follow-on phases for UAT-surfaced new-requirement families (Phase 65 not as 64.1). Mobile-only JSX dup (`lg:hidden`/`hidden lg:block`) over CSS `order-` for layout hoists. Closed WITHOUT `/gsd-audit-milestone` (mirrors v5.0/v5.1 close decision; 28 pre-close items acknowledged). `milestone.complete` extractor garbage now four milestones running. ROADMAP.md found truncated at close — reconstructed from kickoff commit |
| v8.0 | 2 days | 6/6 | Search-first add-watch flow replacing the URL-paste-then-status-lock add path with an Omega-style typeahead + structured-LLM-fallback + lighter status-picker confirm; DUPE-01/02/03 wired end-to-end (owned auto-redirect, "Add another copy", `moveWishlistToCollection` UPDATE-not-INSERT with activity-feed + cross-user overlap notification fan-out); module-scope cache hygiene closing pre-existing CLNP-07 tech debt; ~926 LOC of legacy verdict-flow code deleted; widened Vercel prebuild from one static test to the full `tests/static/` directory and retrofitted 8 pre-existing fs-walking guards with `// @vitest-environment node`. Phase 70 gap_found → manual re-verification after Plans 06/07/08 fixes; 6 distinct prod-UAT defects captured + promoted to v8.1 polish scope. `milestone.complete` extractor garbage 4th milestone running. Worktrees disabled (config default for DB+build-gated project) |
| v8.1 | 1 day | 3/3 | Pure subtraction-of-defects polish — closed all 6 v8.0-captured prod-UAT defects in 47 commits / 11 tasks across 3 surgical phases. Bundled-deploy pattern (single Vercel push + single iPhone UAT walk covering 6 items across 3 phases) — 6/6 passed first walk. Additive optional `bannerActive?` prop preserved Phase 68 D-03 ConfirmStep contract while closing DUPE-04. `@layer base` font-size floor for input/textarea/select as the right cascade level for app-wide native-element defaults (utilities still win, no `!important`). 5th recurrence of JSDoc-prose grep-collision pattern preempted in D-12 guard. 5th recurrence of `phase.complete` extractor garbage AND progress-counter inflation (the progress-counter bug fires even when `is_last_phase: true` — confirms the two bugs are independent). Closed without `/gsd-audit-milestone` (extends the v5.0/v5.1/v7.0/v8.0 audit-skip streak; polish-milestone close-ritual question reopened). 27 pre-close audit items acknowledged + recorded in STATE.md; 5 dormant seeds in that list actually shipped earlier and need re-classification |

### Cumulative Quality

| Milestone | Tests | Coverage | Carried Debt |
|-----------|-------|----------|-------------|
| v1.0 | 697 | Not configured | TEST-04/05/06 deferred |
| v2.0 | 2070+ (unit + integration-gated) | Not configured | Phase 999.1 backlog (v1.0 code review follow-ups); UAT automation |
| v3.0 | 2813+ (87+ test files; 152 env-gated) | Not configured | 31 deferred human-verification UAT items; WristOverlaySvg redesign (user owns); 9 test files with stale `wornPublic` references; pre-existing `LayoutProps` TS error; Nyquist VALIDATION.md frontmatter drift |
| v4.0 | ~3000+ (unit + RTL + integration-gated; TEST-04/05/06 finally landed; live-DB tests across phase 17/19/19.1/20/22/24) | Not configured | 2 phases without phase-level VERIFICATION.md (23, 24 — both backfilled in v4.1 Phase 31); ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23; Nyquist coverage partial (3/12 fully compliant; Phases 25 + 26 have no VALIDATION.md); REQUIREMENTS.md DISC-08/NAV-14 wording drift; pre-existing `LayoutProps` + tests/no-raw-palette + tests/app/explore failures |
| v4.1 | ~3000+ (zero new failures introduced; 50/4187 pre-existing on `main`) | Not configured | DEBT-09 (NEW HIGH-severity Phase 23-era regression: `notesPublic` Zod field + `revalidatePath('/u/...')` absent on `main`); Nyquist 4/5 partial (only Phase 29 COMPLIANT); `useWatchSearchVerdictCache` not invalidated on signOut; cancel mid-flow doesn't honor `?returnTo=` (by spec); REQUIREMENTS.md checkbox lag (4 milestones running); ROADMAP Phase 30 stale `[ ]` checkbox |
| v5.0 | ~3000+ (zero net new failures vs the ~48-51 pre-existing `main` baseline; v5.0 plans tracked net regression delta per plan) | Not configured | DEBT-12 (prod `drizzle.__drizzle_migrations` journal repair — opportunistic, unscheduled); Phase 39c UAT Issue 2 (stale `removeWatch` rail/projection); Phase 39c VERIFICATION.md stale vs post-recovery codebase; 4 verification + 2 human-UAT gaps operator-approved at close (not formally audited); milestone closed without `/gsd-audit-milestone`; REQUIREMENTS.md + ROADMAP checkbox lag (5 milestones running); 31 v3.0 + Phase-35/41 human-verification UAT items still open |
| v5.1 | ~3000+ (zero net new failures vs the ~48-51 pre-existing `main` baseline) | Not configured | DEBT-12 + v5.0 carryover still open (Phase 39c UAT Issue 2; 31 v3.0 + Phase 35/41 human-verification UAT items); 23 pre-close artifact-audit items acknowledged non-blocking; REQUIREMENTS.md + ROADMAP checkbox lag (6 milestones running); milestone closed without `/gsd-audit-milestone` |
| v5.2 | 5244 pass / 325 skip (1 fewer than pre-D-DEBT-01 cleanup = removed self-owned callout test); zero net new failures | Not configured | DEBT-12 still open; v5.0 carryover (Phase 39c UAT Issue 2; 31 v3.0 + Phase 35/41 UAT) still open; v5.2 closeout cleared D-DEBT-01 (dead-code) and D-DRIFT-01 (checkbox sync) inline; D-DEBT-02 (5 Phase 49.1 prod/visual gates) + D-DEBT-03 (1 Phase 48 dark-mode UAT) carry as post-deploy operational items; first v5.x close with formal `/gsd-audit-milestone` (status `passed`); 23 pre-close artifact-audit items acknowledged non-blocking |
| v6.0 | ~5490 pass (Phase 57 high-water); 5 pre-existing unit failures unchanged; full suite green per phase; 15 unit + 9 integration (54), dedup integration tests (55) | Not configured | DEBT-12 + v5.0 carryover (Phase 39c UAT Issue 2; 31 v3.0 + Phase 35/41 UAT) cleared earlier or still open per PROJECT.md Active; v6.0 NEW non-blocking debt: Nyquist VALIDATION docs `draft` across 54–58 (tests pass; reconcile via `/gsd-validate-phase`), ~6 cosmetic doc/impl mismatches (stale JSDoc, benign null-compose race, DragOverlay ghost-card counts), pre-existing `wornPublic` test-fixture `tsc` noise across 9 files; 24 pre-close artifact-audit items acknowledged non-blocking; audit status `passed` (34/34 reqs, 7/7 flows, 0 blockers); REQUIREMENTS/ROADMAP checkbox lag NOT an issue this milestone (traceability filled, all `[x]`) |
| v7.0 | Full suite green per phase; pre-existing ~5 unit failure baseline unchanged; new static guards landed: `tests/static/ppr-dynamic-before-use-cache.test.ts` (Phase 61 — `@vitest-environment node`), `tests/static/followed-owners-module-rsc.test.ts` (Phase 65 — `@vitest-environment node`), ROUTE-03 `prebuild` link-audit guard (Phase 59) | Not configured | DEBT-12 cleared (was open in v5.x carryover); v5.0 carryover (Phase 39c UAT Issue 2; 31 v3.0 + Phase 35/41 UAT) still open per PROJECT.md Active; v7.0 NEW non-blocking debt: Phase 61's PPR-ordering static guard pinned to two routes — broader sweep is SEED-014 (dormant); Phase 65 "and N more" overflow caption untested at prod scale (no v7.0 catalog has >5 followed owners); 5 backlog seeds shipped (SEED-004, SEED-008, SEED-012, SEED-013, SEED-015, SEED-016 — some prior-milestone) need re-classification by `/gsd-new-milestone` housekeeping; 28 pre-close artifact-audit items acknowledged non-blocking (mostly stale noise from prior milestones); closed WITHOUT `/gsd-audit-milestone`; REQUIREMENTS.md 34/34 `[x]` (traceability filled) |

### Top Lessons (Verified Across Milestones)

1. Run production runbooks manually before declaring them verified — the gap between "looks correct" and "actually works" is always larger than expected.
2. Two-layer defenses (RLS + DAL, hooks + tests, grep gates + types, ordering gates + verification) consistently catch what single-layer defenses miss. Cost of the second layer is small; cost of a single-layer breach is large.
3. Scope expansions should land with their requirement entry in the same phase. Deferring the REQUIREMENTS.md update creates traceability drift that audits then have to reconcile. **Workflow gap: this is now a 5-milestone-running issue (v2.0/v3.0/v4.0/v4.1/v5.0 all required milestone-close reconciliation of REQUIREMENTS.md AND ROADMAP checkboxes).**
4. Verification gates must run against the actually-shipped state. v5.0's Phase 39c shipped behind a false-positive sign-off and a prod 404 reached users; the fix was only confirmed after a recovery cycle. A verification verified against a wrong state is a liability, not an asset.
5. `'use cache'` / Cache Components features (`unstable_instant`, `prefetch: 'static'`) interact non-obviously with dynamic routes — validate cache behavior on a real deploy, not just a local build, before declaring a cache-conformance phase done.
4. `human_needed` verification status is the natural close state for UI/social features. Build UAT batching into the milestone-close ritual rather than treating these as exceptions.
5. Pre-existing errors in deferred-items.md across multiple phases need an explicit owner. The audit workflow should promote orphans to action items rather than letting them recur.
6. **(v4.0)** Plan-level verify scripts must include the production build step, not just vitest. The cost is one extra command; the benefit is catching tsc-only errors before phase exit.
7. **(v4.0)** Inline gap-closure (a follow-up plan within the same phase) beats deferring to next phase. Three phases used this pattern in v4.0 (Phase 20, 20.1, 26) and all closed cleanly. The cost is one re-verification round; the benefit is zero carry-over.
8. **(v4.0)** Static guards that assert filesystem absence (e.g., "this route doesn't exist") are cheaper and more durable than greps over `src/`. Use them whenever a deletion needs to be enforced going forward.
9. **(v4.1)** Defense-in-depth localizes regressions. Three-layer FORM-04 architecture meant each UAT-surfaced regression touched exactly one layer; fixes were independently verifiable. Pattern transfers to any cross-route or cross-render-cycle contract.
10. **(v4.1)** CSS chains require chain-as-a-whole assertions, not per-token validation. UI-SPEC 6-pillar checker can pass on declared tokens (each utility valid) while missing required token interactions (`object-cover` requires `h-full` to engage). On any phase touching aspect-ratio + object-fit, demand explicit CSS chain assertions in UI-SPEC.
11. **(v4.1)** Retroactive phase audits surface real production regressions. Phase 31's audit of Phase 23 caught DEBT-09 (HIGH-severity `notesPublic`/`revalidatePath` regression that never reached `main` despite SUMMARY-claimed implementation). Implementation evidence in SUMMARY ≠ shipped code; trust grep + ancestry against current HEAD.
12. **(v4.1)** Post-ship hotfix workflow is a valid recovery path for critical-path UI bugs. Phase 30's iOS Safari black-bar bug → root cause diagnosis → hotfix commit → UAT pass cycle in ~6 hours, no follow-up phase scoped. Update phase VERIFICATION.md frontmatter with `post_ship_hotfix:` block rather than re-opening the phase.
13. **(v4.1)** Append-only edits to audits preserve provenance. When a milestone audit needs amendment (closure note for backfilled artifacts, drift summaries, etc.), append rather than rewrite. Byte-equality invariant on the original body is a one-line CI assertion: `git diff <range> -- <file> | grep -E '^-[^-]' | wc -l` should return 0.
14. **(v5.2)** Researcher catches that contradict ROADMAP success criteria should be reframed in-plan with explicit rationale, not silently overridden. Plan 50.1's SC#2 (drop the `status='owned'` filter) would have re-introduced BUG-01; the researcher caught it, the planner adopted Option B with in-line rationale, and downstream verification followed the binding constraints (SC#3 + SC#6 — BUG-01 invariance), not SC#2's literal wording. Pattern: when ROADMAP and reality diverge, the planner is the reconciliation point and the rationale belongs in the plan body.
15. **(v5.2)** `/gsd-audit-milestone` is a hard ritual gate, not an option. v5.0 and v5.1 both closed without it and are presumably carrying analogous debt that hasn't surfaced. v5.2's audit caught D-DEBT-01 (dead `self-via-cross-user` framing surface across 6 files — explicitly deferred by Phase 50.1 RESEARCH but never closed without the audit nudge) AND D-DRIFT-01 (REQUIREMENTS.md checkbox lag — the 6-milestone-running issue finally surfaced as a structural gap). Audit at every close, full stop.
16. **(v5.2)** Audit-driven inline closeout is the right default for tightly-scoped audit findings. When the audit enumerates ≤2-hour mechanical items, close them within the audit cycle and re-audit — don't carry to next milestone or spawn a phase. v5.2 converted a `tech_debt` close into a `passed` close in ~45 minutes (D-DRIFT-01: 4 checkbox ticks; D-DEBT-01: 6-file dead-code refactor with 5244/5245 vitest verification). The threshold for "close inline vs defer" is roughly: scoped + mechanical + ≤1 hour → close inline; non-scoped or research-required → defer.
17. **(v5.2)** Spike-then-execute pattern is now milestone-routine and supports multiple chains in parallel. v5.0 established it (33 → 33b, 39 → 39b → 39c); v5.2 ran two chains in one milestone (49 → 49.1, 50 → 50.1). The trigger is the SPIKE's `## Ship-Now Eligibility` section returning YES per ROADMAP SC#4 (mid-milestone phase insertion escape hatch). Cost per chain: 1 spike phase + 1 execution phase; benefit: decision phases stay clean while their recommendations ship in the same milestone.
18. **(v6.0)** An RLS policy subquery that reads an owner-only table is not a cross-user gate. It fails closed (safe — no leak) but never admits the legitimate non-owner case, so it only looks like a relationship gate. The service-role DAL bypasses RLS anyway, so the real gate must live in the DAL; RLS's job is the anon-block. Phase 53 shipped such a gate and it took until Phase 54 to nail down which layer was load-bearing — state "DAL is the gate, RLS is the anon-block" in the schema plan to skip the ambiguity. (Durable memory.)
19. **(v6.0)** Sequence the restructure before the feature it enables. Phase 56A unified two divergent wear-viewing surfaces into routed pages with a shared comment-host seam *before* Phase 57 built the comment thread — so the feature was built once against one seam, not twice against two. When a feature would otherwise land in two places that should converge, converge them first.
20. **(v6.0)** Worktrees must be off for DB-touching / build-gated phases. Claude Code worktrees omit gitignored `.env.local`, so `npm run build` of DB-backed RSC routes fails with `DATABASE_URL` undefined. v6.0 set `workflow.use_worktrees=false` globally up front and hit zero env-less build failures — the config default is now off for this project. (Memory: `feedback_execute_phase_no_worktree_when_db`.)
21. **(v6.0)** `gsd-sdk milestone.complete`'s accomplishment extractor is unusable three milestones running (v5.1/v5.2/v6.0) and directory-globs phases (sweeping the out-of-milestone 999.1, miscounting decimal phases → 9 instead of 8). Stop treating its MILESTONES.md output as a draft to edit; make a planner-authored entry a formal workflow step, or fix the CLI to read a real `one_liner` SUMMARY field and scope enumeration to the ROADMAP milestone.
22. **(v7.0)** Hard cutovers + CI link-audit static guards beat parallel safety-net redirects. Keeping a v5.2-style `redirect()` alive during v7.0's route merge would have created two correct routing paths and obscured the transition. Removing legacy routes without a redirect makes every un-migrated link fail loudly; the build-failing `prebuild` Vitest scan is the durable completeness verification. Pattern transfers to any deletion that needs to be enforced going forward.
23. **(v7.0)** `await connection()` static-shell opt-out is the structural fix for the React #419 soft-nav 404 family on per-viewer-dynamic PPR routes — not call-ordering, not per-route Suspense placement. Put it ABOVE the page/layout Suspense to opt out of the prerendered static shell that aborts on soft-nav resume; pair with admin-client URL signing (not the cookie client, which fails in cached context). Build can't confirm (`◐` stays); verify on prod AFTER cache fills (cold read = false positive). Four prior fixes failed because they treated the symptom; this addresses the cause. (Memory: `project_ppr_dynamic_before_use_cache`.)
24. **(v7.0)** The pre-close artifact audit's signal-to-noise is poor and recurring across milestones. False-positive UAT statuses (passed-but-flagged), false-positive verification flags (human_needed despite being prod-verified), and dormant-seeds-that-shipped together make ~80% of every milestone's audit output. The audit query needs to read status fields and seeds need a `shipped:` field; until then, the "acknowledge all" step is fixed-cost ritual friction that doesn't surface real risk.
25. **(v7.0)** The phase-dir archival step should default to archive, not ask. The `feedback_milestone_close_phase_dir_archival_miss` memory has recurred enough (v6.0 kickoff caught it for v6.0 + the stray v3.0 999.1; v7.0 close handled inline) that the close workflow's `Archive Phases` AskUserQuestion should default to archiving rather than offering "Skip — keep phases in place." The destructive failure mode (`/gsd-new-milestone`'s `phases.clear --confirm` deleting un-archived phase dirs) is much worse than the benign failure mode (extra `git mv` runs).
26. **(v7.0)** ROADMAP.md is fragile to mid-milestone execution edits. At v7.0 close it was truncated to 44 lines with the prior-milestones structure overwritten; recovery required reading the kickoff commit (`7cad9c79`) to reconstruct the skeleton. Treat ROADMAP.md as a structured document with a stable header skeleton, not as an append-target. (Candidate: the `milestone.complete` CLI should validate ROADMAP.md structure before reorganizing.)
27. **(v7.0)** Type-only imports across the client/server boundary are a strict architectural lock, not a stylistic preference. Phase 65's `FollowedOwner` type-only import preserved the 'use client' island's ability to receive a server-resolved prop without dragging the server-only DAL across the boundary. Static guard with `@vitest-environment node` encodes the lock. Pattern transfers to any RSC-resolved data threaded into a client component.
