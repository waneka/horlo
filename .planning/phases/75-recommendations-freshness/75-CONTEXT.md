# Phase 75: Recommendations Freshness — Cache Invalidation + Algorithm Variation - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning
**Source:** SEED-017 (`.planning/seeds/SEED-017-recommendations-freshness.md`) — full diagnosis + phase sketch + 5 pre-flagged decision points; v8.2 milestone REQUIREMENTS.md (`DISC-RECS-CACHE` + `DISC-RECS-VARIATION`); operator observation 2026-05-30 that the home "From Collectors Like You" rail surfaces the same ~2 watches across collection changes despite being the largest above-the-fold content slot.

<domain>
## Phase Boundary

Close v8.2's two requirements in a single phase. Two unrelated-but-bundled fixes against the home page's "From Collectors Like You" rail (`src/components/home/CollectorsLikeYou.tsx` + `src/data/recommendations.ts`):

1. **DISC-RECS-CACHE — Cache invalidation.** `CollectorsLikeYou.tsx:23-25` declares `'use cache' + cacheLife('minutes')` (5min stale / 1min revalidate / 1hr expire) but does NOT call `cacheTag(...)`. With Next 16 Cache Components, a `'use cache'` segment is invalidated **only** by `revalidateTag()` matching a tag the segment itself registered. Meanwhile every watch mutation in `src/app/actions/watches.ts` (`addWatch` line 82, `moveWishlistToCollection` line 382, `editWatch` line 529, `removeWatch` line 684) calls `revalidateTag('profile:${ownerProfile.username}', 'max')` + `revalidateTag('explore', 'max')` + `revalidatePath('/')` — but none of those tags match (untagged) CollectorsLikeYou, and `revalidatePath('/')` only invalidates the route-segment cache, NOT nested `'use cache'` components (separate invalidation system). Fix: register `cacheTag('viewer:${viewerId}:recs')` on the component + add `revalidateTag('viewer:${user.id}:recs')` in the 4 watch mutation actions. Pattern mirrors existing `viewer:${id}:counts` tag in `src/app/actions/comments.ts:167` from v7.0 Phase 63 D-12.

2. **DISC-RECS-VARIATION — Algorithm rotation + sparse-pool top-up.** `getRecommendationsForViewer` in `src/data/recommendations.ts:53` is fully deterministic: top 15 collectors by overlap score (`sharedWatches × 10 + sharedTasteTags`) → seed-owned watches deduped & viewer-excluded → score = `ownershipCount × 100 + (50 if rule fired)` → sort DESC → slice top 12. Zero randomness, no recency bias, no anti-repetition memory. At horlo.app's current small-user-base scale, after viewer-owned/wishlist/grail exclusion the candidate pool can collapse to 1-2 candidates; same 2 surface every refresh. Fix: bump `SEED_POOL_SIZE` 15→30, add deterministic-per-6h-window sampling (inline `mulberry32` PRNG seeded by `(viewerId, floor(Date.now() / 6h))` — same window = same recs = cache-stable; next window = different recs = rail rotates 4× daily); add `topUpFromCatalogPopularity` helper invoked when `candidateMap.size < 8` after viewer-exclusion (queries `watches_catalog` ordered by `ownersCount DESC`).

**Constraints inherited from v8.2 milestone scope:**
- Pure surgical defect-fix against shipped v2.0 Phase 10 code — no new features (REQUIREMENTS.md §Out of Scope).
- `npm run build` (exit 0) is the gate. NOT `tsc --noEmit` (~77 pre-existing test-file errors) and NOT `vitest run` (≥1 pre-existing CommentGateLocked font-medium failure) — these are baseline noise per `project_baseline_not_green_build_is_gate` memory.
- `workflow.use_worktrees = false` permanently (build-gated project; `.env.local` unavailable in worktrees per `feedback_execute_phase_no_worktree_when_db` memory).
- Per-phase regression test alongside the fix.
- **Only phase of v8.2.** Bundle the prod push as a standalone v8.2 deploy (no v8.1 carryover; v8.1 already shipped + verified 2026-05-30).
- No new UI surface — algorithm + cache wiring only. The rail's visual shape (`src/components/home/CollectorsLikeYou.tsx` render block) is unchanged.

**Not this phase:**
- Personal Insights / Suggested Collectors freshness — separate components, same cache-tag pattern likely applies but verify per-component if pursued (open question deferred per REQUIREMENTS.md §Out of Scope).
- LLM-based rationale generation, CF / content / graph recommender layers — SEED-002 future work (Hybrid Recommender, v6.0+ candidate).
- Persistent `viewer_rec_history` table for anti-repetition — out of scope; the 6h-window stability is the lightweight substitute.
- Catalog content expansion — v9.0 Catalog Expansion (SEED-009) handles that; this phase works against the catalog as-it-is.
- Cache invalidation on viewer **follows/unfollows** — follows don't directly affect the recs algorithm (which is keyed on collection overlap, not follow graph); declined for this phase. If a future audit shows follow changes should trigger recs refresh, add another `revalidateTag('viewer:${user.id}:recs')` site to follow/unfollow actions.

</domain>

<decisions>
## Implementation Decisions

### DISC-RECS-CACHE — Cache invalidation

- **D-01 (cacheTag value — per-viewer scope):** Register `cacheTag(\`viewer:${viewerId}:recs\`)` on `CollectorsLikeYou.tsx`. Per-viewer (not global `'recs'`) because each viewer's recs are an independent cache entry keyed on viewerId already; a global tag would over-invalidate (mutation by user A would clear user B's cached recs). Matches the existing `viewer:${id}:counts` pattern from v7.0 Phase 63 D-12 (`src/app/actions/comments.ts:167`). Rationale: tight blast radius; predictable cost.

- **D-02 (revalidateTag semantics — default, NOT 'max'):** In each of the 4 watch mutation actions, call `revalidateTag(\`viewer:${user.id}:recs\`)` WITHOUT the `'max'` second argument. Default semantics = immediate invalidation = the user who just mutated sees fresh recs on the very next render. `'max'` semantics = stale-while-revalidate (recipient sees stale value, refresh happens in background, takes ≥1 render to materialize). For read-your-own-write — which DISC-RECS-CACHE explicitly calls out as "no stale-up-to-1-hour gap" + "next home-page render" — default is correct. Rejected: `'max'` — would still show stale recs on the immediate next render, contradicting the SC#1 read-your-own-write semantic. Distinct from v7.0 Phase 63's `viewer:${id}:counts` which uses `'max'` because counts are cross-user fan-out, not read-your-own-write.

- **D-03 (4 wiring sites — addWatch, moveWishlistToCollection, editWatch, removeWatch):** Add `revalidateTag(\`viewer:${user.id}:recs\`)` to each action AFTER the existing `revalidatePath('/')` line and BEFORE the existing `revalidateTag('explore', 'max')` line. Specifically:
  - `src/app/actions/watches.ts:320` (`addWatch` after `revalidatePath('/')`)
  - `src/app/actions/watches.ts:508` (`moveWishlistToCollection` after `revalidatePath('/')`)
  - `src/app/actions/watches.ts:648` (`editWatch` after `revalidatePath('/')`)
  - `src/app/actions/watches.ts:696` (`removeWatch` after `revalidatePath('/')`)
  - Line numbers are CURRENT as of v8.1 close (commit `cdd2db16`); planner should re-verify before editing.
  Rationale: colocate cache invalidation with other invalidations (`revalidatePath`/`revalidateTag` cluster) for grep-ability; preserves existing comment annotations about Pitfall 4 / fan-out semantics.

- **D-04 (preserve existing revalidations — additive only):** Do NOT remove or modify any existing `revalidateTag` / `revalidatePath` calls in the 4 actions. The new `viewer:${id}:recs` invalidation is purely additive. `revalidatePath('/')` still needed for route-segment cache (unrelated server data on `/`); `revalidateTag('explore', 'max')` still needed for the explore page surfaces; `revalidateTag('profile:${username}', 'max')` still needed for profile pages. Rationale: minimum-surface diff; no risk of regressing the existing invalidation contracts.

- **D-05 (Pitfall 7 preservation — viewerId stays in cache key):** `CollectorsLikeYou.tsx` already receives `viewerId` as a prop (not via `getCurrentUser()` inside the cached scope) per the file's existing comment `Pitfall 7 / T-10-07-01`. D-01's `cacheTag('viewer:${viewerId}:recs')` is ADDITIVE — does not change the cache key composition. Verified intact via SC#5 acceptance criterion.

### DISC-RECS-VARIATION — Algorithm rotation + sparse-pool top-up

- **D-06 (SEED_POOL_SIZE bump 15 → 30):** Constant `SEED_POOL_SIZE` in `src/data/recommendations.ts:20` changes from `15` to `30`. The current 15 is the SET of top collectors by overlap; the new 30 is the POOL from which we deterministically sample 15 per 6h window. Rationale: doubles the rotation surface area without doubling Postgres query cost (the existing `Promise.all` overlap scoring scales linearly with public-profile count, which is the dominant cost — bumping the slice from 15 to 30 is free; only the in-memory sort + sample changes).

- **D-07 (rotation window — 6 hours):** Sampling seed = `floor(Date.now() / (6 * 60 * 60 * 1000))`. New constant `ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000`. Same window = same recs (cache-stable within `cacheLife('minutes')` — 1hr expire; deterministic across the entire window); next window = different recs (rail rotates 4× per day). Rationale: per SEED-017 recommendation. Faster rotation (e.g., 1h) would invalidate the cache more frequently with no UX benefit; slower (24h) feels stale. Rejected: pure per-render randomness — would defeat the cache (every render would produce different results, blocking cache reuse). Rejected: hour-aligned windows (e.g., `floor(Date.now() / 1h) / 6` rounded) — adds complexity without behavior change.

- **D-08 (PRNG — inline mulberry32):** Embed `mulberry32(seed: number) => () => number` as a local helper in `src/data/recommendations.ts`. ~5 lines, no external dependency, deterministic, fast, well-distributed for sampling. Use `(viewerId, ROTATION_WINDOW_MS bucket)` to derive the 32-bit seed via cheap hash:
  ```ts
  function seedFor(viewerId: string, windowBucket: number): number {
    let h = windowBucket >>> 0
    for (let i = 0; i < viewerId.length; i++) {
      h = ((h << 5) - h + viewerId.charCodeAt(i)) >>> 0
    }
    return h
  }
  ```
  Rationale: same-viewer-same-window → same seed → same sample order; different viewer or different window → different seed → different sample. Rejected: `seedrandom` package — overkill for 5-line need; new dep surface. Rejected: `crypto.randomUUID()`-derived — not deterministic per window.

- **D-09 (sample 15 from top-30):** After `.sort((a, b) => b.score - a.score).slice(0, SEED_POOL_SIZE)` (now top 30), Fisher-Yates shuffle the slice using the seeded PRNG, then take first 15. The "ranked 30" → "shuffled 30" → "first 15" pipeline means the highest-overlap collectors STILL bias toward selection (because shuffle is uniform across 30, top-15 hits ~50% of the top-15 by rank on average) but rotation surfaces collectors 16-30 too. Rationale: gentle bias toward overlap quality, strong bias toward rotation. Rejected: weighted reservoir sampling — more complex; the simpler top-30-shuffle-take-15 covers the case.

- **D-10 (sparse-pool top-up — threshold <8):** After the candidate map is built in `getRecommendationsForViewer` (current line ~145-163, post-`for (const seed of seeds)` loop), check `candidateMap.size < 8`. If true, invoke a new helper `topUpFromCatalogPopularity(viewerId, excluded, needed)` that queries `watches_catalog` rows ordered by `(ownersCount DESC, brand ASC)` LIMIT 20, filters out already-excluded `(brand|model)` keys + already-in-candidateMap entries, and appends up to `(8 - candidateMap.size)` synthetic candidates with `ownershipCount: 0` (so rationale → community-fallback "Popular in the community" via existing `rationaleFor`). Rationale: never let the rail render with <8 cards even on the sparsest data. The synthetic rows reuse the existing rationale template family (no new copy surface).

- **D-11 (top-up uses `ownersCount`, NOT `ownersCount + wishlistCount`):** The `watches_catalog.ownersCount` column (refreshed daily by pg_cron per Phase 17 D-15 / `supabase/migrations/20260427000001_phase17_pg_cron.sql`) is the right popularity signal. Adding `wishlistCount` would conflate aspirational interest with actual ownership — recs are "what collectors LIKE YOU own," so ownership is the truth. Rationale: matches the semantic of the rail's title. Rejected: composite score `(ownersCount * 2 + wishlistCount)` — adds complexity without clear UX benefit.

- **D-12 (top-up shape — `Recommendation` type, owned-by source unknown):** The top-up rows synthesize a `Recommendation` with `representativeOwnerId: null` (no individual owner — these are catalog-derived). Existing `Recommendation` type in `src/lib/discoveryTypes.ts` has `representativeOwnerId: string` (required). D-12 requires extending the type to `representativeOwnerId: string | null`. Verify RecommendationCard.tsx handles `null` gracefully (likely renders without an owner-attribution link); if not, add a small fallback render path. Rationale: catalog-popularity recs don't have a single "this person owns it" framing; the type must reflect that. NOT a breaking change since all existing call sites already populate a string and would continue to.

- **D-13 (top-up rationale string — reuse "Popular in the community"):** Existing `rationaleFor` template `community-fallback` returns "Popular in the community" when nothing else matches. Top-up rows naturally trigger this fallback because their `viewerOwnershipCount` is 0 (no rule template fires; falls through to fallback). No new rationale template; no new copy surface. Rationale: matches user mental model ("we're showing this because it's popular generally"); avoids translation surface + new-string-review overhead.

- **D-14 (top-up determinism — share the 6h window):** The `topUpFromCatalogPopularity` query results are stable within a 6h window because `ownersCount` only updates once daily (pg_cron at 03:00 UTC). The top-N rows from `watches_catalog` ordered by `(ownersCount DESC, brand ASC)` won't change mid-day except via the pg_cron refresh boundary. No need to seed the top-up with the PRNG. Rationale: cheap determinism; cache-stable.

### Regression tests

- **D-15 (DISC-RECS-CACHE test — vi.mock + assertion):** Create `src/app/actions/__tests__/watches-recs-invalidation.test.ts` (NEW file). `vi.mock('next/cache')` and assert `revalidateTag` was called with `\`viewer:${userId}:recs\`` (default semantics, NOT `'max'`) for each of: `addWatch`, `moveWishlistToCollection`, `editWatch`, `removeWatch`. 4 test cases. Auth + DAL mocks follow the existing `src/app/actions/__tests__/moveWishlistToCollection.test.ts` pattern (already mocks `next/cache` per the grep hit earlier in v8.1 close).

- **D-16 (DISC-RECS-VARIATION test — extend existing test file):** Extend existing `src/data/__tests__/recommendations.test.ts` (file exists per Phase 10 — confirm presence and structure during planning) with 4 new cases:
  1. **Determinism within window:** Mock `Date.now()` to return two values 1h apart but in the same 6h bucket; assert identical recommendation IDs in same order.
  2. **Rotation across windows:** Mock `Date.now()` to return two values 7h apart (crosses bucket boundary); assert ≥1 different rec OR different ordering. (SC#3's "≥30% distinct" is hard to assert deterministically with small fixture pools; an "any difference" assertion is the test-friendly proxy + the prod UAT carries the 30% claim.)
  3. **Sparse-pool top-up activates:** Seed a fixture where `candidateMap.size < 8` after exclusion; assert `recs.length >= 8` and at least one rec has `representativeOwnerId === null` (synthetic top-up marker).
  4. **No regression on full pool:** Existing test for "viewer with healthy collection + many public collectors returns 12 recs" must still pass with the new sample-from-top-30 logic. May require fixture tweak; bake the test in.

- **D-17 (test config unchanged):** Vitest config + jsdom default unchanged. Both new tests are jsdom-friendly (no fs walking, no `// @vitest-environment node` pragma needed — distinct from D-11/D-12 in Phase 74).

- **D-18 (no static guard for the cacheTag wiring):** Unlike Phase 74's MOB-01 guards, the cache-invalidation contract here is captured fully by the unit tests in D-15. A static guard could assert "any new mutation action in `watches.ts` must call `revalidateTag('viewer:${id}:recs')`" but is overengineering for a 4-call-site contract. If future actions are added and forget the call, the recs-staleness symptom is visible to operators — encode the lesson in the file comment (D-19) instead.

- **D-19 (inline file-level comment in `watches.ts`):** Add a short header comment to `src/app/actions/watches.ts` (above the `import { revalidatePath, revalidateTag } from 'next/cache'` line) noting: "Any new mutation that affects the viewer's collection state MUST call `revalidateTag(\`viewer:${user.id}:recs\`)` to invalidate the home rail (per Phase 75 D-03)." Rationale: invisible-rule discoverable at the import site; cheap durability without static guard overhead.

### Deploy

- **D-20 (standalone v8.2 prod push):** Single Vercel deploy for v8.2 — Phase 75 lands on top of v8.1 (commit `bd80a169`+; v8.1 tag pushed `cdd2db16`). No bundle with future v9.0 work. After deploy, single UAT walk on horlo.app covers:
  - **DISC-RECS-CACHE (1 walk):** Add a watch (any new model not already in your collection) → navigate back to `/` → assert the rail re-computes (either shows new candidates if your taste shifted, or definitively does NOT include the watch you just added — that watch is now in your collection so it's excluded by the algorithm).
  - **DISC-RECS-VARIATION (2 walks):** Walk 1 = note the rail's order on first visit. Walk 2 = wait ≥6h, return to `/`, assert at least one card or ordering differs.
  - **Sparse-pool top-up (1 walk):** Visit `/` from a fresh test account (or one with very limited public-collector overlap); assert the rail renders ≥multiple cards (not 1-2).
  - Per `feedback_ppr_cache_fill_no_longer_call_out` — do NOT layer #419 / PPR / cache-fill checks into this UAT script.

### Claude's Discretion

- **Exact mulberry32 implementation source-order in `src/data/recommendations.ts`** — append at file bottom vs inline above `getRecommendationsForViewer`. Planner picks.
- **`seedFor(viewerId, windowBucket)` hash function variant** — D-08 sketches one; planner can use a different cheap deterministic hash (e.g., simple `viewerId.charCodeAt` XOR fold) as long as same-input-same-output property holds.
- **Whether `topUpFromCatalogPopularity` is a separate exported function** vs inlined into `getRecommendationsForViewer`. Separate function is more testable + easier to mock; inline is fewer surface points. Planner picks; both acceptable.
- **D-15 file location** — `src/app/actions/__tests__/watches-recs-invalidation.test.ts` (separate file, focused) vs extending an existing watches test file. Planner picks; separate file recommended for grep-ability.
- **D-16 fixture builders** — reuse existing test fixtures in `src/data/__tests__/recommendations.test.ts` vs add new fixtures. Planner picks based on what's already there.
- **D-19 comment wording** — short header note vs JSDoc-style block. Planner picks; both fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements

- `.planning/ROADMAP.md` §"Phase 75: Recommendations Freshness" — goal, success criteria #1-5, depends-on (nothing), plans (2)
- `.planning/REQUIREMENTS.md` §DISC-RECS-CACHE + §DISC-RECS-VARIATION + §Out of Scope — full requirement text + scope guardrails
- `.planning/PROJECT.md` §"Current Milestone: v8.2 Discovery Freshness" — milestone framing
- `.planning/seeds/SEED-017-recommendations-freshness.md` — source seed (full diagnosis, decision points pre-flagged, plan sketches; STILL CANONICAL — planner should read for the SEED-017 context the operator approved before milestone kickoff)

### Cross-phase coordination (READ BEFORE PLANNING)

- `.planning/milestones/v6.0-phases/57-comment-ui-feed-grid-counts/` (specifically the comments DAL `revalidateTag` patterns) — v6.0 Phase 57 established the `viewer:${id}:reactions` and `revalidateTag(...,'max')` semantics this phase mirrors (with the inverse — default-not-`'max'` per D-02).
- `.planning/milestones/v7.0-phases/63-grid-engagement/` — Phase 63 D-12 added `revalidateTag('viewer:${user.id}:counts','max')` inside `if(ownerProfile?.username)` block in both `toggleLikeAction` and `addCommentAction`. The closest analog for THIS phase's wiring shape (per-viewer scope), though THIS phase uses default semantics not `'max'`.
- `.planning/milestones/v2.0-phases/10-network-home/` (or equivalent path under `.planning/milestones/`) — Phase 10 Plan 04 + Plan 07 originally built `getRecommendationsForViewer` + `CollectorsLikeYou.tsx`. Pitfall 7 / T-10-07-01 cache-key safety lives there.

### Source files being modified

- `src/components/home/CollectorsLikeYou.tsx:23-25` — D-01 adds `cacheTag('viewer:${viewerId}:recs')` immediately after `cacheLife('minutes')`. Pitfall 7 viewerId-as-prop pattern preserved.
- `src/app/actions/watches.ts:320,508,648,696` — D-03 adds 4 × `revalidateTag(\`viewer:${user.id}:recs\`)` calls (default semantics, per D-02).
- `src/app/actions/watches.ts` (header) — D-19 short comment noting the new mutation-must-invalidate-recs rule.
- `src/data/recommendations.ts` — D-06 (`SEED_POOL_SIZE` 15→30), D-07/D-08/D-09 (rotation window + mulberry32 + sample-15-from-top-30), D-10/D-14 (topUpFromCatalogPopularity + 6h-window stability).
- `src/lib/discoveryTypes.ts` — D-12 extends `Recommendation.representativeOwnerId: string` to `string | null`.

### Files created by this phase

- `src/app/actions/__tests__/watches-recs-invalidation.test.ts` — D-15 cache-invalidation regression (4 test cases).

### Files read but NOT modified

- `src/app/actions/comments.ts:167` — reference pattern for `viewer:${id}:counts` cacheTag wiring (D-01 mirrors the shape).
- `src/components/home/RecommendationCard.tsx` — verify D-12 `representativeOwnerId: null` handling; modify only if it currently assumes non-null.
- `src/lib/recommendations.ts` — rationale templates UNCHANGED (D-13 reuses existing community-fallback path).
- `src/db/schema.ts:482` — `watchesCatalog.ownersCount` column reference (D-11 source); table definition unchanged.
- `supabase/migrations/20260427000001_phase17_pg_cron.sql` — confirms `ownersCount` is refreshed daily; no migration changes this phase.

### Memories that constrain this phase

- `project_baseline_not_green_build_is_gate` — `npm run build` is the only gate; ignore pre-existing `tsc --noEmit` test-file errors + `CommentGateLocked font-medium` vitest failure during D-15 / D-16 verification.
- `feedback_execute_phase_no_worktree_when_db` — `workflow.use_worktrees=false` permanently. Plans MUST NOT request worktree isolation.
- `project_phase_complete_999_1_misset` — at phase close, hand-correct STATE.md `completed_phases` + `percent` fields after `gsd-sdk query phase.complete 75` (Bug 2 progress-counter fires even on `is_last_phase: true` — confirmed at v8.1 Phase 74 close).
- `feedback_decision_coverage_gate_citations` — cite D-NN identifiers in `truths` AND `must_haves` so the decision-coverage gate finds them; don't bury in XML prose.
- `feedback_test_assert_disappearance_too` — pattern documented for v8.1; NOT applicable here (no mount/unmount toggle to assert; this phase's tests are pure-function unit tests + Server Action vi.mock assertions).
- `feedback_mobile_ui_verify_on_prod` — D-20 UAT walk happens on horlo.app; rail visible on desktop AND mobile, but the variation/invalidation behavior is functional-not-visual so mobile-specific testing isn't required (vs MOB-01 which was mobile-only).
- `feedback_ppr_cache_fill_no_longer_call_out` — do NOT bake PPR / #419 / cache-fill checks into the D-20 UAT script.
- `project_v8_1_complete` (just landed 2026-05-30) — milestone-close pattern reminder: 5th-recurrence-and-counting `phase.complete` STATE corruption + `milestone.complete` extractor garbage will fire at v8.2 close; hand-correct + hand-rewrite per the documented pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`viewer:${id}:counts` cacheTag wiring** (`src/app/actions/comments.ts:167` from v7.0 Phase 63 D-12) — established the per-viewer cache-tag pattern this phase mirrors. Read both `addCommentAction` + `toggleLikeAction` to see the shape: tag named `viewer:${user.id}:counts`, called after the DAL mutation completes but before the action returns.
- **CollectorsLikeYou Pitfall 7 viewerId-as-prop** (`src/components/home/CollectorsLikeYou.tsx:6-22` JSDoc) — already explains why viewerId MUST flow as a prop; D-05 verification follows the documented pattern.
- **`watches_catalog.ownersCount` + pg_cron daily refresh** (`src/db/schema.ts:482` + `supabase/migrations/20260427000001_phase17_pg_cron.sql`) — denormalized count column refreshed by `refresh_watches_catalog_counts_daily` cron job at 03:00 UTC; the truth source for D-10 popularity top-up.
- **Existing rationale templates** (`src/lib/recommendations.ts`) — 5-template family; D-13 reuses the community-fallback path for synthetic top-up rows without new copy surface.
- **Existing `vi.mock('next/cache')` pattern** (`src/app/actions/__tests__/moveWishlistToCollection.test.ts`) — D-15 follows the same mock-then-assert shape.

### Established Patterns

- **Per-viewer `cacheTag` + corresponding `revalidateTag` in mutation Server Actions** (v7.0 Phase 63 D-12) — this phase follows the pattern with the inverse semantic (default-not-`'max'` per D-02; v7.0 used `'max'` for cross-user fan-out, this phase needs read-your-own-write).
- **Additive Server Action surface — never modify existing revalidations** (Phase 68 D-03-style additive-extension pattern, applied here to actions instead of components per D-04) — minimum-surface diff; no risk of regressing existing invalidation contracts.
- **Deterministic-per-time-window seeded sampling** — novel pattern in this codebase; D-07/D-08/D-09 establish it. Future seeds (e.g., "personalized explore page rotation") can reuse the `seedFor(viewerId, windowBucket)` helper.
- **Catalog-popularity fallback for sparse user-state** — novel pattern; D-10 establishes it via `topUpFromCatalogPopularity`. Future seeds in similar shape (e.g., "Suggested Collectors" sparse-pool top-up) can reuse the query pattern.

### Integration Points

- **`src/app/page.tsx:75`** — renders `<CollectorsLikeYou viewerId={user.id} />`. Pass-through unchanged; this phase doesn't touch the page composition.
- **Existing watch mutation action wiring** — `addWatch` / `moveWishlistToCollection` / `editWatch` / `removeWatch` all already call `revalidatePath('/')`, so the home page surface is already invalidating its route-segment cache; D-03 layers on the nested `'use cache'` invalidation cleanly.
- **`RecommendationCard.tsx`** — consumer of `Recommendation` type; D-12 verifies `representativeOwnerId: null` handling. If RecommendationCard renders an owner-attribution link, add a null-guard render path.

</code_context>

<specifics>
## Specific Ideas

- **Operator's exact observation:** "I've been noticing that it's basically the exact same two watches that are always surfaced for me, despite changes to my collection. It's a pretty high-viz spot, basically the largest content above the fold on home page and it feels a little stale and not very dynamic." Both halves of this complaint map cleanly to one root cause each (cache + algorithm), addressed independently by DISC-RECS-CACHE and DISC-RECS-VARIATION.
- **The 1-hour stale window** is the operator-perceived gap that DISC-RECS-CACHE closes. The cacheLife('minutes') profile expires after 1hr; without cacheTag wiring, the only invalidation path is time-based.
- **The "2 watches always" symptom** maps to the candidate-pool size after viewer-exclusion. With small horlo.app user base + small public-collector overlap → tiny candidate set → deterministic algorithm produces same 2 cards.
- **6h rotation window** is a balance: faster = more "alive" but defeats cache; slower = stale feel. 6h means 4 distinct render-sets per day per viewer, ~16 distinct render-sets per week.
- **`ownersCount` rather than `(ownersCount + wishlistCount)`** for top-up — ownership is the truth signal that matches the rail's "collectors LIKE YOU OWN" semantic.

</specifics>

<deferred>
## Deferred Ideas

- **Personal Insights freshness audit** — separate component (`src/components/home/PersonalInsights.tsx` if it exists), likely has the same `'use cache'` + no-cacheTag bug pattern. Out of scope for v8.2; pick up in a future polish phase OR fold into SEED-002 hybrid recommender work.
- **Suggested Collectors freshness audit** — separate DAL (`src/data/suggestedCollectors.ts` or similar) + LoadMore state machine. Out of scope; same future-polish or SEED-002 candidate.
- **Follow/unfollow → recs revalidation** — currently DECLINED (recs algorithm keyed on collection overlap, not follow graph). If a future audit shows follow changes should rotate recs, add `revalidateTag(\`viewer:${user.id}:recs\`)` to follow/unfollow actions.
- **Persistent `viewer_rec_history` table** for cross-session anti-repetition memory — out of scope; the 6h-window stability is the lightweight substitute. Revisit if SEED-002 hybrid recommender lands.
- **Spotify-style "you've seen these" deprioritization** — folds into SEED-002.
- **LLM-based rationale generation** — SEED-002 territory; explicitly out of scope per v2.0 CONTEXT C-03 + REQUIREMENTS.md.
- **Catalog content expansion** to enrich the candidate pool — v9.0 Catalog Expansion (SEED-009).
- **A/B-testing the rotation cadence** (6h vs 12h vs 24h) — out of scope; no A/B infrastructure in the codebase. Pick a value (D-07: 6h), ship, observe via operator feedback.
- **Composite popularity score `(ownersCount × 2 + wishlistCount)`** for D-11 top-up — rejected for semantic clarity; can revisit if the top-up surfaces feel off.

### Reviewed Todos (not folded)

None — no pending todos exist in `.planning/todos/pending/` (per `/gsd-new-milestone` v8.2 todo-link step).

</deferred>

---

*Phase: 75-recommendations-freshness*
*Context gathered: 2026-05-30 — derived from SEED-017 + REQUIREMENTS.md + verified schema state*
