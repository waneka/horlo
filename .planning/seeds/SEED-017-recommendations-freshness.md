---
id: SEED-017
status: shipped
shipped_in: v8.2
shipped: 2026-06-09
planted: 2026-05-30
planted_during: Between v8.1 and v9.0 — operator observation that "From Collectors Like You" home rail surfaces the same 2 watches across collection changes
trigger_when: as soon as the recurrence is operator-confirmed visually OR as a slot-in polish phase under v9.0 Catalog Expansion (cheap; sits well above the catalog work). Could also justify a small **v8.2 Discovery Freshness** polish milestone of its own.
scope: small (1 phase, 2 plans)
related_phases: [v2.0 Phase 10 Plan 04 + Plan 07 (current CollectorsLikeYou DAL + Server Component), v6.0 Phase 55 (revalidateTag pattern), v7.0 Phase 63 (viewer:counts tag pattern), SEED-002 (future hybrid recommender — this seed is the lightweight precursor), v8.2 Phase 75 (SHIPPED)]
---

# SEED-017: Recommendations Freshness — Cache Invalidation + Algorithm Variation

## The Problem (operator-observed 2026-05-30)

The "From Collectors Like You" rail on the home page is the **largest above-the-fold content slot** but feels stale and non-dynamic — same ~2 watches surface across multiple collection changes. Two compounding root causes diagnosed during the inspection:

### Root cause 1 — Cache invalidation gap

`src/components/home/CollectorsLikeYou.tsx:23-25` declares:
```tsx
'use cache'
cacheLife('minutes')  // 5 min stale / 1 min revalidate / 1 hr expire
// NO cacheTag(...)
```

With Next 16 Cache Components, a `'use cache'` segment is invalidated **only** by `revalidateTag()` matching a tag the segment itself registered. Because CollectorsLikeYou registers no tag, no watch mutation can invalidate it.

Meanwhile every watch mutation (`addWatch` / `editWatch` / `removeWatch` / `moveWishlistToCollection` in `src/app/actions/watches.ts`) revalidates only:
- `viewer:${recipientId}` (cross-user notification)
- `profile:${ownerProfile.username}`
- `explore`
- `revalidatePath('/')` — but this invalidates the **route segment cache**, NOT nested `'use cache'` components

**Practical effect:** after the viewer adds/edits/removes a watch, recs stay frozen for up to 1 hour. The SWR background refresh at 1 min only fires when someone re-hits the page, and even then the algorithm is deterministic so the same recs come out.

### Root cause 2 — Deterministic algorithm + sparse candidate pool

`src/data/recommendations.ts:53` `getRecommendationsForViewer` is fully deterministic:
- `SEED_POOL_SIZE = 15` (top 15 collectors by `sharedWatches × 10 + sharedTasteTags`)
- `REC_CAP = 12`
- Score = `ownershipCount × 100 + (50 if any rule template fired)`
- Sort DESC, alphabetical brand tiebreak
- Zero randomness, no recency bias, no rotation, no anti-repetition memory

At horlo.app's current small-user-base scale, after viewer-owned/wishlist/grail exclusion the candidate pool can collapse to a tiny number (operator sees 2). Even after the cache eventually expires and refreshes, the same 2 surface again because nothing in the algorithm forces variation.

## Scope

**In scope:**
- Wire cache invalidation so collection mutations refresh recs immediately
- Add algorithm-level variation so the rail visibly rotates day-to-day even when the candidate pool is small or stable
- Keep the rule-based template family (no LLM, per v2.0 CONTEXT C-03 — the LLM hybrid recommender is SEED-002 future work)
- Targeted regression tests alongside the fix (Horlo's per-phase test discipline)

**Out of scope (intentionally — fold into SEED-002 hybrid recommender if pursued later):**
- LLM-based rationale generation
- Collaborative filtering (CF), content-based, or graph layers
- Persistent recommendation history beyond a lightweight anti-repetition window
- Cross-device user-state sync for "seen recs"
- Personal Insights / Suggested Collectors freshness audits — separate ask; same cache-tag pattern probably applies but verify per-component (Suggested Collectors uses a separate DAL + LoadMore state machine)

## Phase Sketch

### Suggested phase definition (drop into ROADMAP.md)

```
### Phase N: Recommendations Freshness — Cache Invalidation + Algorithm Variation
**Goal**: The "From Collectors Like You" home rail refreshes when the viewer's collection changes AND visibly rotates across days/sessions even when the underlying candidate pool is small or stable
**Depends on**: Nothing
**Requirements**: DISC-XX-RECS-CACHE, DISC-XX-RECS-VARIATION (assign IDs at promote-time)
**Success Criteria** (what must be TRUE):
  1. Adding, editing, or removing a watch refreshes the "From Collectors Like You" rail on the next home-page render — no manual hard refresh; no waiting for cacheLife('minutes') to expire
  2. Moving a watch from wishlist to collection refreshes the rail (the just-moved watch must NOT continue to appear as a recommendation)
  3. Across two sessions ≥6h apart (no collection change between), the rail surfaces a visibly different watch order or candidate set (>=30% of cards distinct between renders) — variation must come from the algorithm itself, not from candidate-pool churn
  4. With a small candidate pool (e.g., 2-3 unique candidates after viewer-exclusion), the rail still renders multiple cards; if the rule-based pool is genuinely <8, the rail tops up with a popularity-based fallback from `watches_catalog` so the rail never looks "broken" with 1-2 cards
  5. No new cross-user cache-key leakage (Pitfall 7 from v2.0 Phase 10 remains intact — viewerId stays in the cache key)
**Plans**: 2 plans (wave 1 parallel — different files)
- 01-PLAN.md — Cache invalidation: add `cacheTag('viewer:${viewerId}:recs')` to CollectorsLikeYou; wire `revalidateTag('viewer:${user.id}:recs', 'max')` into the 4 watch mutation actions; mirror the `viewer:${id}:counts` pattern already in `src/app/actions/comments.ts:167`; regression test in `tests/app/actions/watches-recs-invalidation.test.ts` asserts the tag fires on each mutation path
- 02-PLAN.md — Algorithm variation: bump SEED_POOL_SIZE 15 → 30, add deterministic-per-time-window sampling (seed = `floor(Date.now() / 6h)`), add candidate-pool-floor fallback (when pool <8 after exclusion, top up from catalog popularity); rationale templates unchanged; unit tests in `src/data/__tests__/recommendations.test.ts` add 4 cases (small-pool top-up, time-window rotation, no-mutation determinism within a window, anti-leakage of viewer-owned)
**UI hint**: no (algorithm + cache wiring; no new UI surface)
```

### Plan 01 — Cache invalidation (sketch)

Files modified:
- `src/components/home/CollectorsLikeYou.tsx` — add `cacheTag(\`viewer:${viewerId}:recs\`)` immediately after `cacheLife('minutes')`
- `src/app/actions/watches.ts` — add `revalidateTag(\`viewer:${user.id}:recs\`, 'max')` to `addWatch`, `moveWishlistToCollection`, `editWatch`, `removeWatch` (4 sites; pattern matches existing `revalidateTag('explore', 'max')` calls already in each function)
- `tests/app/actions/watches-recs-invalidation.test.ts` (NEW) — vi.mock('next/cache'), assert revalidateTag called with the right tag for each action

Key decisions to lock at discuss-phase:
- **Tag granularity**: per-viewer (`viewer:${id}:recs`) vs global (`recs`). Per-viewer matches the `viewer:${id}:counts` pattern + avoids over-invalidation across users when one user mutates. **Recommendation: per-viewer.**
- **Tag semantics**: `'max'` (stale-while-revalidate) vs default (immediate). Read-your-own-write semantics here say **default** (immediate) — the user who just added a watch wants to see the rec change THIS render, not next-render. **Recommendation: default (omit 'max').**
- **`revalidatePath('/')` already in each action**: keep — it invalidates the route segment cache for unrelated server data on `/`. The new `revalidateTag` only handles the nested `'use cache'` segment.

### Plan 02 — Algorithm variation (sketch)

Files modified:
- `src/data/recommendations.ts` — bump `SEED_POOL_SIZE` 15 → 30; introduce `ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000`; add `getTimeWindowSeed()` helper; sample 15 from the top-30 using a deterministic PRNG seeded by `(viewerId, floor(Date.now() / ROTATION_WINDOW_MS))` — same window = same seeds (cache-stable); next window = different seeds (rotation); add `topUpFromCatalogPopularity(candidatesByOwnerCount, excluded, viewerId, needed)` when `candidateMap.size < 8` (queries `watches_catalog` ordered by `view_count` or `recent_add_count` — verify the column exists post-v4.0; if not, fall back to `watches_catalog.count` from the v4.0 refresh-counts pg_cron job)
- `src/data/__tests__/recommendations.test.ts` — add 4 cases per success-criteria #3/#4

Key decisions to lock at discuss-phase:
- **PRNG choice**: `mulberry32` (lightweight, deterministic, tree-shakeable) vs reach for `seedrandom` (full dep). **Recommendation: inline mulberry32 — keep dependency surface tight.**
- **Rotation window**: 6h, 12h, 24h. Faster rotation = more "feels alive" but cheaper for the SWR refresh (multiple hits within one window still get same recs). **Recommendation: 6h — rail rotates 4× per day, balances freshness with cache hit rate.**
- **Top-up source**: `watches_catalog.count` (refreshed daily by v4.0 pg_cron) vs a fresh COUNT query. **Recommendation: `watches_catalog.count` — already-computed, no extra query.**
- **Top-up rationale string**: "Popular in the community" (existing community-fallback template) vs new "Trending in the catalog" string. **Recommendation: reuse existing — no new copy surface.**
- **What if top-up still <8?**: degrade silently to whatever's available (no fake-popular padding). The hide-section-when-zero behavior (`if (recs.length === 0) return null`) already handles the truly-empty case.

## Where it lands

Three viable promotion paths:

1. **v8.2 Discovery Freshness polish milestone** (cheap, one-phase). Mirrors v4.1 / v5.2 / v8.1 polish pattern. Pro: closes the operator-observed defect fast, doesn't entangle with v9.0 catalog scope. Con: another milestone close ritual (5th-recurrence extractor garbage to hand-rewrite again — see `project_phase_complete_999_1_misset`).

2. **Slot into v9.0 Catalog Expansion** as Phase 1 of v9.0. Pro: zero milestone overhead; rec freshness benefits from a richer catalog so this is sequential-friendly. Con: makes v9.0 Phase 1 "not-actually-catalog-work" which muddles milestone intent.

3. **Plant for v10.0 + SEED-002 hybrid recommender bundling**. Pro: clean separation. Con: leaves the high-viz home defect open for another full milestone cycle.

**Recommendation: option 1 (v8.2 polish)** — small enough to close in a session, high-viz fix worth the milestone-close ritual, and lets v9.0 stay catalog-pure.

## Related

- **SEED-002 (Hybrid recommender)** — this seed is the lightweight precursor. SEED-002 replaces the rule-based template family with a 3-layer hybrid (CF + content + graph). After SEED-002 lands, the cache-tag wiring from Plan 01 here remains; the algorithm-variation work from Plan 02 either folds in or gets superseded.
- **v6.0 Phase 55 + v7.0 Phase 63** — established the `viewer:${id}:counts` tag pattern and `revalidateTag(tag, 'max')` semantics this seed mirrors.
- **Memory `project_phase_complete_999_1_misset`** — guaranteed recurrence at milestone close (if option 1 chosen).

## Open questions for discuss-phase

- Does the home rail rotation actually need to be deterministic-per-time-window, or is per-render randomness fine? (Determinism plays well with the cache; pure randomness would defeat the cache entirely.)
- Should the cache invalidation also trigger on **viewer follows/unfollows**? Follows don't change the recs algorithm directly but they DO change the "Suggested Collectors" rail. Audit Suggested Collectors at the same time, or scope this phase to recs only and follow-up?
- For the candidate-pool top-up: does the `watches_catalog.count` column exist and is it kept fresh by the v4.0 pg_cron job, or has the refresh fallen off since? (Per `feedback_execute_phase_no_worktree_when_db` — verify against local DB before planning.)
