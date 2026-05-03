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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 5/6 | First milestone — established GSD workflow patterns |
| v2.0 | 3 days | 5/5 | Added wave-based parallelization, two-layer privacy pattern, cacheComponents, integration-gated test strategy |
| v3.0 | 5 days | 7/7 | Added Wave 0 RED-test discipline, code-review-fix pipeline at phase close, architectural prop-acquisition for browser APIs, three-tier privacy enum pattern, EXPLAIN ANALYZE forced-plan evidence for index proofs |
| v4.0 | 6 days | 12/12 | Added inline gap-closure pattern (3 phases used it), filesystem-absence static guards, D-07-style ordering gates for external-dependency rollouts, hybrid form-feedback (`useFormFeedback` + `FormStatusBanner`), worktree-based plan parallelization at scale (65 plans / 6 days), catalog-as-silent-infrastructure separation, LLM-derived structured taste enrichment with first-write-wins semantics, Postgres enum rename+recreate for cleanup, `@base-ui/react` vertical-tabs with `pushState` hash-routing |

### Cumulative Quality

| Milestone | Tests | Coverage | Carried Debt |
|-----------|-------|----------|-------------|
| v1.0 | 697 | Not configured | TEST-04/05/06 deferred |
| v2.0 | 2070+ (unit + integration-gated) | Not configured | Phase 999.1 backlog (v1.0 code review follow-ups); UAT automation |
| v3.0 | 2813+ (87+ test files; 152 env-gated) | Not configured | 31 deferred human-verification UAT items; WristOverlaySvg redesign (user owns); 9 test files with stale `wornPublic` references; pre-existing `LayoutProps` TS error; Nyquist VALIDATION.md frontmatter drift |
| v4.0 | ~3000+ (unit + RTL + integration-gated; TEST-04/05/06 finally landed; live-DB tests across phase 17/19/19.1/20/22/24) | Not configured | 2 phases without phase-level VERIFICATION.md (23, 24); ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23; Nyquist coverage partial (3/12 fully compliant; Phases 25 + 26 have no VALIDATION.md); REQUIREMENTS.md DISC-08/NAV-14 wording drift; pre-existing `LayoutProps` + tests/no-raw-palette + tests/app/explore failures |

### Top Lessons (Verified Across Milestones)

1. Run production runbooks manually before declaring them verified — the gap between "looks correct" and "actually works" is always larger than expected.
2. Two-layer defenses (RLS + DAL, hooks + tests, grep gates + types, ordering gates + verification) consistently catch what single-layer defenses miss. Cost of the second layer is small; cost of a single-layer breach is large.
3. Scope expansions should land with their requirement entry in the same phase. Deferring the REQUIREMENTS.md update creates traceability drift that audits then have to reconcile. **Workflow gap: this is now a 4-milestone-running issue.**
4. `human_needed` verification status is the natural close state for UI/social features. Build UAT batching into the milestone-close ritual rather than treating these as exceptions.
5. Pre-existing errors in deferred-items.md across multiple phases need an explicit owner. The audit workflow should promote orphans to action items rather than letting them recur.
6. **(v4.0)** Plan-level verify scripts must include the production build step, not just vitest. The cost is one extra command; the benefit is catching tsc-only errors before phase exit.
7. **(v4.0)** Inline gap-closure (a follow-up plan within the same phase) beats deferring to next phase. Three phases used this pattern in v4.0 (Phase 20, 20.1, 26) and all closed cleanly. The cost is one re-verification round; the benefit is zero carry-over.
8. **(v4.0)** Static guards that assert filesystem absence (e.g., "this route doesn't exist") are cheaper and more durable than greps over `src/`. Use them whenever a deletion needs to be enforced going forward.
