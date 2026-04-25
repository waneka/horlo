---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Production Nav & Daily Wear Loop
status: executing
stopped_at: Completed 16-01-tests-first-PLAN.md (Wave 0 RED baseline)
last_updated: "2026-04-25T16:14:01.745Z"
last_activity: 2026-04-25
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 36
  completed_plans: 32
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 16 — people-search

## Current Position

Phase: 16 (people-search) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-04-25

## Progress Bar

```
Phase 11 [ ] Schema + Storage Foundation
Phase 12 [ ] Visibility Ripple in DAL
Phase 13 [ ] Notifications Foundation
Phase 14 [ ] Nav Shell + Explore Stub
Phase 15 [ ] WYWT Photo Post Flow
Phase 16 [ ] People Search

[░░░░░░░░░░░░░░░░░░░░] 0/6 phases complete
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 6 |
| Phases complete | 0 |
| Plans total | TBD |
| Plans complete | 0 |
| Requirements mapped | 51/51 |
| Phase 10 P01 | 18min | 3 tasks | 10 files |
| Phase 10 P02 | 10min | 3 tasks | 6 files |
| Phase 10 P03 | 5min | 2 tasks | 5 files |
| Phase 10 P10-04 | ~9 min | 4 tasks | 11 files |
| Phase 10 P05 | ~15 min | 3 tasks | 9 files |
| Phase 10 P06 | 14min | 4 tasks | 11 files |
| Phase 10 P07 | ~8 min | 3 tasks | 15 files |
| Phase 10 P08 | ~5 min | 3 tasks | 4 files |
| Phase 10 P09 | 14min | 3 tasks | 4 files |
| Phase 999.1 P01 | 4min | 3 tasks | 5 files |
| Phase 16-people-search P01 | 8min | 6 tasks | 7 files |

## Accumulated Context

### Key Decisions (v3.0)

| Decision | Rationale |
|----------|-----------|
| Phase numbering continues from 11 | v2.0 ended at Phase 10; sequential numbering maintained across milestones |
| Default wear visibility: Public | Overrides researcher recommendation of Private default; explicitly chosen by user |
| D1: Client-direct upload pipeline | Browser → Supabase Storage using user's session; Server Action validates storage key and inserts row; avoids doubling bandwidth and Next.js 4MB body limit |
| D2: cache()-wrapped ownedWatches | getWatchesByUser wrapped with React cache() so Header and BottomNav share one request-scoped result (same pattern as getTasteOverlapData) |
| D3: Single private bucket + signed URLs | Single wear-photos bucket, private, signed URLs for all reads; images.unoptimized: true already in next.config.ts so signed URLs work correctly |
| D4: worn_public deprecated in v3.0 | Migration backfills wear_events.visibility from worn_public (true → 'public', false → 'private'); worn_public column removed from profile_settings after backfill verified |
| D5: Hybrid wear detail nav | WYWT rail keeps Reels-style overlay (Phase 10 pattern); all other entry points (notifications, feed, search) navigate to /wear/[wearEventId] |
| One wear per (user, watch, calendar day) preserved | Phase 10 constraint carried forward; user CAN log multiple different watches same day |
| Phase 12 separate from Phase 11 | Highest-risk phase in milestone; integration tests must be written before any function is touched; privacy-first UAT rule from v2.0 retrospective |
| Phase 13 can parallelize with 12 | No data dependency between notifications write path and the visibility ripple; both depend only on Phase 11 schema |
| DEBT-02 in Phase 11 | RLS audit pairs naturally with the schema phase since both are RLS-heavy; resolves MR-03 |
| DEBT-01 in Phase 14 | PreferencesClient error surfacing is a UI concern that fits the nav overhaul phase |
| Explore stub in Phase 14 | /explore is a nav dependency; BottomNav Explore tab links to /explore; one file, ships with nav shell |
| Phase 999.1 — MR-01 surfaces save errors without rollback | Local mirror state intentionally NOT rolled back on save failure; review called rollback "optional" and revalidatePath in savePreferences reconciles on next nav. Inline role=alert banner is sufficient visibility |
| Phase 999.1 — MR-02 import hygiene only | Did NOT migrate Server Actions to err instanceof UnauthorizedError discriminator; that distinguishes Unauthorized vs infra errors and is a separately-tracked larger refactor. Existing catch-all preserved verbatim |
| Phase 999.1 — MR-03 paperwork closure | Phase 6 enabled RLS (20260420000000_rls_existing_tables.sql); Phase 11 audited it (20260423000005_phase11_debt02_audit.sql). Phase 999.1 adds zero SQL — re-adding RLS would duplicate live policies |

### Key Decisions (v2.0)

| Decision | Rationale |
|----------|-----------|
| Start at Phase 6 | v1.0 ended at Phase 5; sequential numbering continues |
| RLS before all social features | Hard prerequisite: no multi-user visibility is safe without DB-level access control |
| Social schema before app code | Five new tables must exist before any social DAL functions can reference them |
| Self-profile before other-profile | Surfaces privacy assumptions in controlled context before affecting real user data |
| Follow before feed | Feed query JOINs `follows` to assemble personalized event stream |
| Common Ground in Phase 9 | Depends on collector profile page (Phase 9) being stable; runs server-side using existing `analyzeSimilarity()` logic |
| No Supabase Realtime | Free tier: 200 concurrent WS limit; server-rendered + `router.refresh()` is sufficient at MVP scale |
| No watch linking | Per-user independent entries; canonical DB deferred to future data strategy phase |
| Two-layer privacy enforcement | RLS at DB level AND DAL WHERE clause — direct anon-key fetches must be blocked at both layers |
| Phase 10 root layout uses inline theme script | Next 16 Cache Components (`cacheComponents: true`) forbids `cookies()` in the layout body; canonical shadcn/next-themes inline `<script>` in `<head>` is the zero-FOUC escape hatch. `<Header />` and `<main>` wrapped in `<Suspense>` so per-page DAL reads stream correctly. |
| Phase 10 activities RLS widened to own-or-followed | Outer gate admits rows from followed users using `(SELECT auth.uid())` subquery pattern; per-event privacy (`collection_public` / `wishlist_public` / `worn_public`) stays at the DAL layer per F-06. Widens the outer gate, preserves the two-layer model. |
| Phase 10 feed DAL returns `RawFeedPage`, not `FeedPage` | DAL emits `RawFeedRow[]`; aggregation happens in `aggregateFeed`. Splitting the types prevents the wider post-aggregation union from leaking into the DAL contract and lets SSR callers pick raw or aggregated rendering at their boundary. |
| Phase 10 feed integration tests gate on local Supabase env vars | 11 privacy/keyset integration cases live in `tests/data/getFeedForUser.test.ts` but only activate when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; mirrors `tests/data/isolation.test.ts` so the default suite stays green in CI. |
| Phase 10 WYWT DAL — dropped `as never` cast on createWatch | Providing all required Watch fields explicitly (brand/model/status/movement/complications/styleTags/designTraits/roleTags + optional imageUrl) satisfies `Omit<Watch, 'id'>` without an escape hatch; only a narrow `row.movement as MovementType` remains because Drizzle's inferred enum type isn't the domain alias. |
| Phase 10 WYWT Server Action — duplicate wishlist rows tolerated by design | CONTEXT.md `<specifics>` says one-tap-no-friction conversion; per-user-independent-entries model already expects duplicates. No server-side dedupe. UI (Plan 06) may add a success toast with undo, but never a pre-confirm dialog. |
| Phase 10 WYWT privacy gate — identical 'Wear event not found' on missing vs private | Both absent-row and actor-not-viewer-with-worn_public=false return the same error string (T-10-03-03). Avoids leaking existence of private wear events to callers who can't read them. Mirrors Phase 8 notes-IDOR mitigation precedent. |
| Phase 10 Plan 09 WYWT DAL privacy hardening | Non-self branch of `getWearRailForViewer` now requires BOTH `profile_public=true` AND `worn_public=true` (was `worn_public` only). Caught by the E2E privacy test — an actor with `profile_public=false` + `worn_public=true` (legal via settings UI) would leak wear events to followers. Rule 2 critical correctness fix. Self-include branch unchanged (viewer always sees own wear). |

### Critical Pitfalls (v3.0)

1. Storage RLS is a SEPARATE system from table RLS — write explicit storage.objects policies for wear-photos bucket and test in incognito.
2. Three-tier visibility ripple must audit ALL 8+ wear-reading DAL functions before migration — missing one leaks followers-only wears publicly.
3. `'use cache'` without viewerId as explicit argument leaks data across users — grep gate before shipping.
4. Bottom nav outside Suspense boundary breaks cacheComponents builds — wrap in its own Suspense.
5. EXIF stripping required on ALL upload paths (camera AND file) — verify with exiftool on a stored file.
6. Backfill maps worn_public = false to 'private' NOT 'followers' — post-migration count of 'followers' rows must be 0.
7. Notification generation must be fire-and-forget — failure never rolls back a follow or watch-add.

### Critical Pitfalls (v2.0)

1. RLS enabled without all policies — existing data goes invisible. Enable + write policies in the same migration transaction.
2. Bare `auth.uid()` in policies — per-row function call blows up query plans. Always use `(SELECT auth.uid())`.
3. Missing `WITH CHECK` on UPDATE — users can inject data into other accounts. Every UPDATE needs both USING and WITH CHECK.
4. Privacy only in app layer — DAL WHERE clause alone is bypassed by direct DB queries. RLS is mandatory.
5. N+1 in activity feed — write feed DAL as a single JOIN query, verify with EXPLAIN ANALYZE.

### Todos

- [ ] Start Phase 11: `/gsd-plan-phase 11`
- [ ] Resolve EXIF orientation research flag before Phase 15 planning: does `createImageBitmap` correct EXIF orientation on iOS Safari 15+, or is `exifr` required?
- [ ] Phase 12 requires integration tests written BEFORE touching any DAL function — privacy-first UAT rule

### Blockers

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260421-rdb | Fix 404 on watch detail pages for watches owned by other users — viewer-aware DAL with privacy gating | 2026-04-22 | 0604e09 | [260421-rdb-fix-404-on-watch-detail-pages-for-watche](./quick/260421-rdb-fix-404-on-watch-detail-pages-for-watche/) |
| 260421-srx | Wrap follower/following counts in `<Link>` on ProfileHeader + LockedProfileState (Phase 9 UAT gap) | 2026-04-22 | 3919d9e | [260421-srx-wrap-follower-following-counts-in-link-o](./quick/260421-srx-wrap-follower-following-counts-in-link-o/) |
| 260424-nk2 | Fix Phase 15 UAT bug: WYWT rail and overlay show watch catalog photo instead of wrist shot | 2026-04-24 | 19a7b32 | [260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl](./quick/260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl/) |

## Session Continuity

Last session: 2026-04-25T16:14:01.741Z
Stopped at: Completed 16-01-tests-first-PLAN.md (Wave 0 RED baseline)
Resume file: None
Next action: `/gsd-plan-phase 11`
