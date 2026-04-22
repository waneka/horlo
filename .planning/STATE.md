---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Taste Network Foundation
status: executing
stopped_at: Completed 10-07-PLAN.md (CollectorsLikeYou + PersonalInsightsGrid + SuggestedCollectors + LoadMoreSuggestionsButton)
last_updated: "2026-04-22T00:46:02.675Z"
last_activity: 2026-04-22
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 21
  completed_plans: 19
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Collectors discover watches through other people's collections and taste — not algorithms, catalogs, or content feeds.
**Current focus:** Phase 10 — activity-feed

## Current Position

Phase: 10 (activity-feed) — EXECUTING
Plan: 8 of 9
Status: Ready to execute
Last activity: 2026-04-22

## Progress Bar

```
Phase  6 [          ] Not started
Phase  7 [          ] Not started
Phase  8 [          ] Not started
Phase  9 [          ] Not started
Phase 10 [          ] Not started
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 5 |
| Phases complete | 0 |
| Plans total | TBD |
| Plans complete | 0 |
| Requirements mapped | 31/31 |
| Phase 10 P01 | 18min | 3 tasks | 10 files |
| Phase 10 P02 | 10min | 3 tasks | 6 files |
| Phase 10 P03 | 5min | 2 tasks | 5 files |
| Phase 10 P10-04 | ~9 min | 4 tasks | 11 files |
| Phase 10 P05 | ~15 min | 3 tasks | 9 files |
| Phase 10 P06 | 14min | 4 tasks | 11 files |
| Phase 10 P07 | ~8 min | 3 tasks | 15 files |

## Accumulated Context

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
| Phase 10 Plan 04 wishlistGap — CANONICAL_ROLES defined locally | `CANONICAL_ROLES = [dive, dress, sport, field, pilot, chronograph, travel, formal, casual]` lives in `src/lib/wishlistGap.ts`, not `src/lib/constants.ts`. The existing `ROLE_TAGS` constant is a DIFFERENT vocabulary (use-case roles: daily, gada, travel, weekend, formal, beater...) and cannot be reused. `GAP_THRESHOLD = 0.10`. Array-order-first tiebreak on both gap and leansOn for stable output. |
| Phase 10 Plan 04 rationale templates — deterministic, no LLM | 5 priority-ordered templates (brand-match → popular-role(≥5 owners) → dominant-style(>50%) → top-role-pair → community-fallback); first match wins. Brand-match beats popular-role when both fire (Test 6 pins this). Zero Anthropic dependency per C-03; the home page is always rendereable without an API key. |
| Phase 10 Plan 04 Suggested Collectors keyset cursor | `SuggestionCursor = { overlap: number, userId: string }` with sort `(overlap DESC, userId ASC)` and strict-after filter `c.overlap < cursor.overlap \|\| (c.overlap === cursor.overlap && c.userId > cursor.userId)`. Guarantees disjoint pages. `overlap` bucket mapping: Strong=0.85, Some=0.55, Different=0.20 — representative midpoints of tasteOverlap's qualitative bands. `viewerId` flows as a function argument (never closure-captured) so Plan 07's `'use cache'` wrapper produces a correct cache key (Pitfall 7 / T-10-04-03). |
| Phase 10 Plan 05 aggregated-row verb — 'wishlisted {N} watches' for wishlist_added | UI-SPEC only documented the 'added {N} watches' variant. Kept symmetric because `wishlist_added` is a first-class `AggregatedRow` type in `feedTypes.ts` and asymmetric fallback would mislabel activity. Reviewer can flip in one line if the UI-SPEC author prefers the asymmetric form. |
| Phase 10 Plan 05 feed-row image hardening | All thumbnails routed through `getSafeImageUrl` before `next/image`, matching `ProfileWatchCard` (Phase 8). Activities `metadata.imageUrl` is user-supplied from Phase 7 URL imports; https-upgrade + protocol guard apply at the component level as a Rule 2 correctness addition even though T-10-05-05 was marked 'accept' in the plan's threat register. |
| Phase 10 Plan 05 F-03 dual link pattern | `absolute inset-0` Link overlay for profile nav + nested `relative z-10` Link for watch-name. Avoids invalid `<a>` inside `<a>` and keeps the row a pure Server Component. This is the canonical pattern for any future feed-row surface. |
| Phase 10 Plan 06 WywtRail is 'use client' (not a two-layer shell) | Rail receives already-computed `WywtRailData` as a prop from the parent Server Component (Plan 10-08), so there is no server-only data access it needs to do itself. The planner's <behavior> block offered a two-layer Server+Client option; collapsing to a single 'use client' file saves boilerplate with zero SSR loss. |
| Phase 10 Plan 06 WatchPickerDialog is a SINGLE shared component | Exported from `src/components/home/WatchPickerDialog.tsx` and consumed by BOTH the WYWT self-tile (Plan 06) and the nav `+ Wear` button (Plan 10-08). Pitfall 10 avoided. JSDoc at file top explicitly forbids forking; future call sites add a prop, never duplicate the component. |
| Phase 10 Plan 06 jsdom polyfills added to tests/setup.ts | Node 25's native `localStorage` global (no method implementations) shadows jsdom's functional storage; jsdom 25.0.1 also lacks IntersectionObserver + ResizeObserver which embla-carousel-react requires. Added MemoryStorage + stub observers to `tests/setup.ts` (same pattern as existing `matchMedia` stub), guarded on "API missing" so future Node/jsdom versions that restore them do not double-install. |
| Phase 10 Plan 06 WYWT overlay error UX is INLINE, not toast | Add-to-wishlist failure inside the focus-trapped overlay renders an inline `text-destructive` message + Retry button; markAsWorn failure inside the picker dialog renders an inline `role=alert` paragraph. Toasts would fire outside the focus trap and break WCAG focus management. Matches UI-SPEC error-placement intent. |
| Phase 10 Plan 07 CollectorsLikeYou 'use cache' with viewerId prop | First line of the async function body is `'use cache'`, second line is `cacheLife('minutes')` (5min stale / 1min revalidate / 1hr expire per Next.js docs). viewerId flows as a function argument so Next.js serializes it into the cache key (Pitfall 7 / T-10-07-01 mitigation). Grep-verified absence of `getCurrentUser` in the cached component file. |
| Phase 10 Plan 07 Sleeping Beauty ordering vs rendering split | `effectiveDays` (`+Infinity` for never-worn watches) is the ORDERING key in PersonalInsightsGrid; `lastWornDate` is the RENDER key passed to SleepingBeautyCard. The card branches on `lastWornDate === null` to render 'Never worn' literal instead of fabricating a day count. Avoids '999 days unworn' leaking into the UI. |
| Phase 10 Plan 07 LoadMoreSuggestionsButton mirrors Plan 05 LoadMoreButton byte-for-byte | Same state machine (cursor + appendedRows + error + useTransition), same error copy 'Couldn't load more. Tap to retry.', same aria-label cycle. Both Load More controls on the home therefore feel identical to the user. Plan 05's pattern is now the canonical Load More shape for Phase 10. |
| Phase 10 Plan 07 SuggestedCollectorRow reuses Phase 9 FollowButton without modification | `variant='inline'` + `initialIsFollowing={false}` always (DAL excludes followed users via notInArray, T-10-04-02). No Suggested-specific variant added. Row link + FollowButton click isolation via absolute-inset `<Link>` overlay + button `relative z-10` — same canonical pattern as Plan 05 ActivityRow F-03. |

### Critical Pitfalls (from research)

1. RLS enabled without all policies — existing data goes invisible. Enable + write policies in the same migration transaction.
2. Bare `auth.uid()` in policies — per-row function call blows up query plans. Always use `(SELECT auth.uid())`.
3. Missing `WITH CHECK` on UPDATE — users can inject data into other accounts. Every UPDATE needs both USING and WITH CHECK.
4. Privacy only in app layer — DAL WHERE clause alone is bypassed by direct DB queries. RLS is mandatory.
5. N+1 in activity feed — write feed DAL as a single JOIN query, verify with EXPLAIN ANALYZE.

### Todos

- [ ] Start Phase 6: `/gsd-plan-phase 6`
- [ ] Validate RLS migration workflow in staging before applying to prod (research flag)
- [ ] Confirm profile auto-creation mechanism (webhook vs. DB trigger) against current Supabase docs before Phase 7 planning (research flag)
- [ ] Define username assignment strategy for existing users before Phase 8 ships (gap from research)

### Blockers

None.

## Session Continuity

Last session: 2026-04-22T00:46:02.672Z
Stopped at: Completed 10-07-PLAN.md (CollectorsLikeYou + PersonalInsightsGrid + SuggestedCollectors + LoadMoreSuggestionsButton)
Resume file: None
Next action: `/gsd-plan-phase 6`
