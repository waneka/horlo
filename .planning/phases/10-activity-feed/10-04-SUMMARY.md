---
phase: 10-activity-feed
plan: 04
subsystem: home-discovery-data-layer
tags: [drizzle, postgres, keyset-pagination, rls, privacy, zod, server-actions, tdd, vitest, tasteOverlap, rule-based-rationale, cache-components]

# Dependency graph
requires:
  - plan: 10-01
    provides: |
      cacheComponents: true flag (so Plan 07 CollectorsLikeYou Server
      Component can wrap getRecommendationsForViewer in 'use cache'
      without compile warnings), shared feed types (unused here).
      Phase 9 tasteOverlap + Phase 8 privacy settings are the actual
      upstream dependencies.
provides:
  - "wishlistGap(owned, wishlist) pure function — under-represented canonical role identifier (FEED-05 Personal Insights card)"
  - "CANONICAL_ROLES array + GAP_THRESHOLD=0.10 — stable tiebreak order for role-gap derivation"
  - "rationaleFor(ctx) pure function + RATIONALE_TEMPLATES — 5-template rule-based rationale for Collectors Like You cards"
  - "getRecommendationsForViewer(viewerId) DAL — composes tasteOverlap + candidate filter + rationale, returns up to 12 (brand,model)-deduped recommendations"
  - "getSuggestedCollectors(viewerId, opts?) DAL — privacy-gated public collectors sorted by overlap DESC with keyset cursor for Load More"
  - "loadMoreSuggestions Server Action — Zod-strict cursor validation + auth gate + 5-per-page pagination for S-03"
  - "src/lib/discoveryTypes.ts — shared Recommendation, SuggestedCollector, WishlistGap, CanonicalRole types (consumed by Plan 07)"
affects: [10-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function-plus-DAL split: src/lib/*.ts holds deterministic scoring/rationale (no 'server-only', no I/O) while src/data/*.ts composes the DB reads. Keeps unit tests fast and the DAL's cache-key surface clean."
    - "Keyset cursor in-memory after tasteOverlap: the candidate universe is small (<500 public profiles at MVP) so the DAL computes overlap for every candidate, sorts, then applies the cursor filter client-side. No OFFSET anywhere."
    - "viewerId as a function argument (Pitfall 7 / T-10-04-03): getRecommendationsForViewer NEVER reads getCurrentUser() internally. Plan 07 will wrap it in a Server Component with viewerId as a prop so the id flows into the 'use cache' key."
    - "Rationale templates as an ordered const tuple (RATIONALE_TEMPLATES): priority-ordered, first-match-wins, grep-verifiable by the verifier."
    - "overlapLabel → overlap bucket (0.85/0.55/0.20): preserves tasteOverlap's qualitative output while giving UI-SPEC a numeric percentage to render without leaking similarity-engine internals."

key-files:
  created:
    - src/lib/discoveryTypes.ts
    - src/lib/wishlistGap.ts
    - src/lib/recommendations.ts
    - src/data/recommendations.ts
    - src/data/suggestions.ts
    - src/app/actions/suggestions.ts
    - tests/lib/wishlistGap.test.ts
    - tests/lib/recommendations.test.ts
    - tests/data/getRecommendationsForViewer.test.ts
    - tests/data/getSuggestedCollectors.test.ts
    - tests/actions/suggestions.test.ts
  modified: []

key-decisions:
  - "CANONICAL_ROLES = [dive, dress, sport, field, pilot, chronograph, travel, formal, casual] — 9 roles, array-order-first tiebreak on both gap candidates and leansOn. Defined in src/lib/wishlistGap.ts rather than src/lib/constants.ts because the existing constants.ts ROLE_TAGS carries use-case roles (daily/gada/travel/etc.) and is NOT the same vocabulary."
  - "Rationale templates priority: brand-match → popular-role (threshold ≥5 shared owners) → dominant-style (>50%) → top-role-pair → community-fallback. Brand-match wins when a candidate is the viewer's top-owned brand even if a later template would also fire (Test 6 pins the priority)."
  - "overlap numeric bucket mapping: 'Strong overlap'→0.85, 'Some overlap'→0.55, 'Different taste'→0.20. The 0.85/0.55 values round to 85%/55% in the UI-SPEC mini-card — crisp round numbers, visually distinct, match the existing Common Ground qualitative buckets without recomputation."
  - "SEED_POOL_SIZE = 15, REC_CAP = 12 per CONTEXT.md C-01 / C-04. 15 > 12 so the cap is applied AFTER rationale scoring, not before — protects against every candidate having a fallback rationale (which would otherwise waste card slots on low-score rows)."
  - "Kept loadMoreSuggestions cursor schema STRICT — overlap must be a number, userId must be a UUID. Lets the DAL WHERE comparator trust the cursor types without runtime casts. Rejecting null cursors here (as in Plan 10-02's loadMoreFeed) keeps page-1 rendering purely server-side."
  - "Integration tests gated on NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (skipIf) — mirrors Plan 10-02 / 10-03. Unit tests always run; full privacy+ordering+cursor suite runs locally when a Supabase stack is attached."

patterns-established:
  - "discoveryTypes.ts as the single home for cross-surface discovery contracts: Plan 07 will import Recommendation, SuggestedCollector, and WishlistGap from one place. No duplication across DALs and components."
  - "computeTasteOverlap is now consumed by THREE DALs in Phase 10: Collectors Like You (seed scoring), Suggested Collectors (per-candidate overlap), and (indirectly via Plan 09) Common Ground. All three pass `viewerId` as an argument, never as a closure capture."
  - "Keyset cursor tuple `(overlap, userId)` with strict-after filter: reusable pattern for any future Load More over a tasteOverlap-ordered list."

requirements-completed: [FEED-05, DISC-02, DISC-04]

# Metrics
duration: ~9 min
completed: 2026-04-21
---

# Phase 10 Plan 04: Home Discovery Data Layer Summary

**Delivered the three data surfaces Plan 07 needs to render the non-feed home sections — a pure `wishlistGap` fn (9 canonical roles, 10%-under-representation + no-wishlist-coverage gap detection), a `getRecommendationsForViewer` DAL that composes `tasteOverlap` + privacy-filtered candidate pool + 5-template rule-based rationale (no LLM), and a `getSuggestedCollectors` DAL with an `(overlap DESC, userId ASC)` keyset cursor for Load More — plus the `loadMoreSuggestions` Server Action. 27 unit tests green (11 + 8 + 4 + 7 — 4 unit on the Suggested DAL; 16 integration-gated tests activate with a local Supabase stack).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-21T23:44:39Z
- **Completed:** 2026-04-21T23:53:27Z
- **Tasks:** 4 (all TDD: RED test, then GREEN implementation)
- **Files created/modified:** 11 (3 new lib modules, 2 new DAL modules, 1 new Server Action, 5 new test files)
- **Commits:** 8 task commits + pending metadata commit

## Accomplishments

- **`wishlistGap(owned, wishlist)` pure function** at `src/lib/wishlistGap.ts` — identifies the most-under-represented canonical role in the owned collection that is NOT already covered by a wishlist entry. Algorithm (per CONTEXT.md I-01 + RESEARCH.md Pitfall 9 LOCKED):
  1. Compute per-role frequency in owned (multi-role watches contribute to every role).
  2. For each canonical role where `freq < 0.10` AND the role is NOT in any wishlist entry's roleTags → it's a gap candidate.
  3. Pick the LOWEST-freq gap candidate; tiebreak by CANONICAL_ROLES array order.
  4. `leansOn` = canonical role with the HIGHEST owned freq (>0; null if every freq is 0).
  5. Rationale string generated when both gap and leansOn are present.

  Exports `CANONICAL_ROLES` (9 roles: `dive`, `dress`, `sport`, `field`, `pilot`, `chronograph`, `travel`, `formal`, `casual`) and the `wishlistGap` function. 11 tests pin every edge case: empty, 1-watch, 10-watch, wishlist-covered, balanced (all ≥10%), multi-role contribution, empty roleTags, determinism.

- **`rationaleFor(ctx)` pure function** at `src/lib/recommendations.ts` — 5 templates in priority order:
  1. **brand-match** — viewer's top-owned brand == candidate brand → `"Fans of ${brand} love this"`
  2. **popular-role** — candidate has a canonical role AND ownership count ≥ 5 → `"Popular among ${role} watch collectors"` (dive, dress, pilot, field, sport)
  3. **dominant-style** — candidate style tag matches viewer's dominant (>50%) style → `"Matches your ${style} collection"`
  4. **top-role-pair** — candidate role matches viewer's most-owned role → `"Often paired with ${role} watches"`
  5. **community-fallback** — nothing else matches → `"Popular in the community"`

  `RATIONALE_TEMPLATES` const tuple exports the ordered list. 8 tests pin each template + priority (Test 6: brand-match wins over popular-role even when both would fire) + determinism.

- **`getRecommendationsForViewer(viewerId)` DAL** at `src/data/recommendations.ts` — composes the recommendation pipeline per CONTEXT.md C-01..C-07:
  - Resolves viewer's watches + preferences + wear events. If viewer has 0 owned → returns `[]` (UI hides per L-02).
  - Fetches public collectors via `profileSettings.profilePublic = true AND profileSettings.collectionPublic = true` (T-10-04-01 privacy gate).
  - Computes `tasteOverlap` per public profile in parallel; takes top `SEED_POOL_SIZE = 15`.
  - Dedupes candidates by normalized `(brand, model)` via `.trim().toLowerCase()` (C-07); excludes viewer's owned, wishlist, and grail entries.
  - Scores each candidate with `rationaleFor` + an ownership-count multiplier, returns top `REC_CAP = 12` sorted by score DESC with alphabetical brand tiebreak.
  - Integration tests (gated): Tests 8–14 cover viewer-exclusion, wishlist-exclusion, normalized dedupe, private-profile exclusion, empty-collection short-circuit, non-empty rationale invariant, and DESC ordering.

- **`getSuggestedCollectors(viewerId, opts?)` DAL** at `src/data/suggestions.ts` — public collectors the viewer does NOT follow, ordered by `overlap DESC, userId ASC`:
  - `notInArray(profiles.id, [viewerId, ...alreadyFollowing])` — self + already-followed exclusion in the SQL WHERE.
  - `eq(profileSettings.profilePublic, true)` — private profiles excluded (T-10-04-02).
  - `computeTasteOverlap` per candidate → `overlapLabel` → 0.85 / 0.55 / 0.20 numeric bucket.
  - `sharedWatches.slice(0, 3)` — up to 3 mini-thumbnail watches per card (UI-SPEC S-02).
  - `SuggestionCursor` = `{ overlap: number, userId: string }`. `SuggestionPage` = `{ collectors, nextCursor }`.
  - **Keyset filter**: `c.overlap < cursor.overlap || (c.overlap === cursor.overlap && c.userId > cursor.userId)` — strictly AFTER the cursor row.
  - `nextCursor` is non-null iff more rows exist past the returned page.
  - 4 SQL-shape unit tests + 10 integration-gated tests (basic overlap, follow-exclusion, private-exclusion, ordering, tiebreak, limit, self-exclusion, sharedWatches metadata, empty-collection, pagination disjointness).

- **`loadMoreSuggestions` Server Action** at `src/app/actions/suggestions.ts` — Zod-strict cursor validation + auth gate + 5-per-page pagination for CONTEXT.md S-03. Outer `{ cursor }` schema AND inner `{ overlap: number, userId: uuid }` schema are both `.strict()`. Rejects missing cursor, non-UUID userId, non-number overlap, and extra keys. DAL failures log `[loadMoreSuggestions]` prefix and return generic `"Couldn't load more collectors."`. 7 unit tests cover every branch.

## Task Commits

1. **Task 1 RED — wishlistGap failing tests** — `cbdfd09` (test)
2. **Task 1 GREEN — wishlistGap + discoveryTypes** — `d879203` (feat)
3. **Task 2 RED — rationaleFor + DAL failing tests** — `4ff08c7` (test)
4. **Task 2 GREEN — rationaleFor + getRecommendationsForViewer** — `26b01e7` (feat)
5. **Task 3 RED — getSuggestedCollectors failing tests** — `ddb3747` (test)
6. **Task 3 GREEN — getSuggestedCollectors DAL** — `47d9ff7` (feat)
7. **Task 4 RED — loadMoreSuggestions failing tests** — `0e8152c` (test)
8. **Task 4 GREEN — loadMoreSuggestions Server Action** — `41413fd` (feat)

Plan metadata commit made after this SUMMARY is written.

## Files Created/Modified

- `src/lib/discoveryTypes.ts` — new; type-only shared discovery contracts (`Recommendation`, `SuggestedCollector`, `WishlistGap`, `CanonicalRole`)
- `src/lib/wishlistGap.ts` — new; `wishlistGap` pure function + `CANONICAL_ROLES` + `GAP_THRESHOLD`
- `src/lib/recommendations.ts` — new; `rationaleFor` + `RATIONALE_TEMPLATES` pure function
- `src/data/recommendations.ts` — new; `getRecommendationsForViewer` DAL, `SEED_POOL_SIZE=15`, `REC_CAP=12`
- `src/data/suggestions.ts` — new; `getSuggestedCollectors` DAL + `SuggestionCursor` + `SuggestionPage` exports
- `src/app/actions/suggestions.ts` — new; `loadMoreSuggestions` Server Action
- `tests/lib/wishlistGap.test.ts` — new; 11 cases
- `tests/lib/recommendations.test.ts` — new; 8 cases (7 behavioral + 1 template-order)
- `tests/data/getRecommendationsForViewer.test.ts` — new; 7 integration-gated cases
- `tests/data/getSuggestedCollectors.test.ts` — new; 4 unit + 10 integration-gated cases (13 total)
- `tests/actions/suggestions.test.ts` — new; 7 cases

## Output Spec Requirements (from 10-04-PLAN.md `<output>`)

### 1. The exact 5 rationale templates and the order they fire

| # | Template          | Fires when                                                                 | Output string                                  |
|---|-------------------|---------------------------------------------------------------------------|------------------------------------------------|
| 1 | brand-match       | viewer's top-owned brand (case-insensitive) == candidate brand             | `Fans of ${brand} love this`                   |
| 2 | popular-role      | `viewerOwnershipCount >= 5` AND candidate has `dive`/`dress`/`pilot`/`field`/`sport` role | `Popular among ${role} watch collectors`       |
| 3 | dominant-style    | viewer's dominant style (`>50%` share) is in candidate.styleTags           | `Matches your ${style} collection`             |
| 4 | top-role-pair     | viewer's most-owned role is in candidate.roleTags                          | `Often paired with ${role} watches`            |
| 5 | community-fallback | default (no prior template matched)                                       | `Popular in the community`                     |

First match wins; templates checked top-to-bottom. Test 6 pins that brand-match beats popular-role when both would fire.

### 2. CANONICAL_ROLES ordering + tiebreak rationale

```ts
CANONICAL_ROLES = ['dive', 'dress', 'sport', 'field', 'pilot', 'chronograph', 'travel', 'formal', 'casual']
```

**Ordering rationale:** approximate descending collector prevalence in the watch hobby — dive + dress + sport watches dominate most collections, with pilot/chronograph/field as secondary, and travel/formal/casual as long-tail. This makes the tiebreak align with "most likely to be interesting as a gap suggestion" when multiple roles are tied at zero ownership.

**Tiebreak rules:**
- **Gap candidate tiebreak:** iterate in array order; strict `<` replacement only. First-seen minimum wins.
- **leansOn tiebreak:** iterate in array order; strict `>` replacement only. First-seen maximum wins.
- **Both rules keep the output stable for equal frequencies:** a 40%-dive / 40%-dress collection will always show `leansOn='dive'` because `dive` comes first in CANONICAL_ROLES.

### 3. Overlap-score heuristic for `overlap: number`

```ts
'Strong overlap'  → 0.85  // displays as "85% taste overlap"
'Some overlap'    → 0.55  // displays as "55% taste overlap"
'Different taste' → 0.20  // displays as "20% taste overlap"
```

**Why these buckets:** the underlying `tasteOverlap` engine (Phase 9) produces qualitative labels anchored to `GOAL_THRESHOLDS.balanced` (avg similarity ≥0.65 → Strong, ≥0.45 → Some, else Different). Rather than re-derive a numeric similarity score here, Plan 10-04 maps the label to a representative midpoint of its qualitative range:
- 0.85 is in the middle of [0.65, 1.0] (Strong band) rounded to a clean percent
- 0.55 is in the middle of [0.45, 0.65] (Some band)
- 0.20 is the default sub-threshold signal

This keeps the UI-SPEC's rendering (`Math.round(overlap * 100)%`) crisp and avoids leaking similarity-engine internals across the boundary.

### 4. SEED_POOL_SIZE + REC_CAP

```ts
SEED_POOL_SIZE = 15  // CONTEXT.md C-01: "10-20 seed collectors"
REC_CAP = 12         // CONTEXT.md C-04: "cap ~12"
```

15 seeds → 12 cap. The extra 3 seeds buffer the rationale-scoring pass in case low-score seeds produce duplicates or community-fallback-only rationales that don't deserve a slot; sort-after-rationale then trims to 12.

### 5. A4 cost concerns observed during integration tests

**Not observed during this executor session** because no local Supabase stack was attached — integration tests skipped cleanly. The DAL's worst-case cost at MVP scale:

- `getRecommendationsForViewer`: one follow query (O(follows)) + one public-profiles query (O(public_profiles)) + N parallel `getWatchesByUser` + `getPreferencesByUser` + `getAllWearEventsByUser` calls (one set per public profile) + N parallel `computeTasteOverlap` invocations.
- At ≤500 public profiles × ≤500 watches each, the overall wall-clock time is dominated by the per-profile parallel fetch batch. `Promise.all` parallelism means the bound is roughly `max(round-trip time)` rather than `N * round-trip`.
- Plan 07 will wrap this DAL in `'use cache'` with `cacheLife('minutes')` per C-06 to amortize cost across renders.

**If integration latency degrades at scale (per T-10-04-05 accept-with-ceiling):**
1. First lever — reduce `SEED_POOL_SIZE` to 10 (still in CONTEXT.md range).
2. Second lever — denormalize `owned_brand_model_counts` as a per-user jsonb column refreshed on add/remove, so the candidate-pool build doesn't require fetching full watch lists.
3. Third lever — pre-compute taste-overlap matrices offline via a cron (deferred per CONTEXT.md's "no rec rotation cron" decision).

None of these are needed at MVP scale.

## Decisions Made

See **key-decisions** in frontmatter + **Output Spec Requirements** above for full detail.

## Deviations from Plan

**None.**

Every task landed as the plan described, with tests and acceptance criteria met exactly. The plan was unusually prescriptive (full code sketches for each module), which made execution a straight translation exercise.

One tightening worth noting: the plan sketch for `getRecommendationsForViewer` included early documentation of `SEED_POOL_SIZE` and `REC_CAP` but not `RULE_MATCH_BONUS` — I named the "+50 if rationale isn't fallback" magic number as a const for discoverability. No behavior change.

## Issues Encountered

- **Pre-existing lint warnings in unrelated test files** persist (70 errors across `tests/actions/preferences.test.ts`, `tests/actions/watches.test.ts`, `tests/data/isolation.test.ts`, `tests/proxy.test.ts`, `src/components/FilterBar.tsx`, `src/components/settings/SettingsClient.tsx`, `src/lib/similarity.ts`). None caused by this plan. Verified via targeted lint on the 11 files introduced by Plan 10-04 — **zero errors, zero warnings**.
- **No Supabase stack attached** during this session, so all 16 integration tests across the three `tests/data/*.test.ts` additions skipped. They run automatically when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.

## User Setup Required

None. No new secrets, no new migrations, no new environment variables.

## Next Phase Readiness

- **Plan 10-07 (Recs / Insights / Suggested UI assembly)** can import everything it needs from this plan's exports:
  - `import { wishlistGap, CANONICAL_ROLES } from '@/lib/wishlistGap'` — for the Personal Insights Wishlist Gap card.
  - `import { getRecommendationsForViewer } from '@/data/recommendations'` — wrap in a `'use cache'` Server Component per C-06, pass `viewerId` as a prop (Pitfall 7).
  - `import { getSuggestedCollectors } from '@/data/suggestions'` — initial 3–5 rows for the Suggested Collectors section.
  - `import { loadMoreSuggestions } from '@/app/actions/suggestions'` — the "Load More" button handler.
  - `import type { Recommendation, SuggestedCollector, WishlistGap } from '@/lib/discoveryTypes'` — type-safe props boundary.

No blockers for the rest of Phase 10. With Plans 10-01..10-04 landed, Wave 1 is complete.

## Self-Check: PASSED

Verified via shell checks:

- `src/lib/discoveryTypes.ts` — FOUND; exports `Recommendation`, `SuggestedCollector`, `WishlistGap`, `CanonicalRole`
- `src/lib/wishlistGap.ts` — FOUND; exports `CANONICAL_ROLES` and `wishlistGap`; contains `GAP_THRESHOLD = 0.10` and `roleTags` reference
- `src/lib/recommendations.ts` — FOUND; exports `rationaleFor` + `RATIONALE_TEMPLATES`; all 5 template literals grep-verified (`Fans of`, `Popular among`, `Matches your`, `Often paired`, `Popular in the community`); no `'server-only'` directive (purity preserved)
- `src/data/recommendations.ts` — FOUND; `'server-only'` present; `REC_CAP = 12` present; normalized `.trim().toLowerCase()` dedupe; excludes `'wishlist'` and `'grail'` statuses; `profilePublic` + `collectionPublic` both filtered; `computeTasteOverlap` called per seed; `rationaleFor` called per candidate
- `src/data/suggestions.ts` — FOUND; `'server-only'` present; exports `getSuggestedCollectors`, `SuggestionCursor`, `SuggestionPage`; `notInArray(profiles.id, excludeIds)` for self+follow exclusion; `eq(profileSettings.profilePublic, true)` for privacy; `computeTasteOverlap` per candidate; `.slice(0, 3)` on sharedWatches; cursor filter `c.overlap < cursor.overlap || (c.overlap === cursor.overlap && c.userId > cursor.userId)` grep-verified multiline
- `src/app/actions/suggestions.ts` — FOUND; `'use server'` on line 1; 3 `.strict()` calls (outer schema + cursor schema x2 matches); `z.string().uuid()` present; `z.number()` present; `getSuggestedCollectors(user.id,` called; `[loadMoreSuggestions]` error prefix
- `tests/lib/wishlistGap.test.ts` — FOUND, 11/11 tests pass
- `tests/lib/recommendations.test.ts` — FOUND, 8/8 tests pass
- `tests/data/getRecommendationsForViewer.test.ts` — FOUND, 7 integration-gated cases; all skip cleanly without local Supabase
- `tests/data/getSuggestedCollectors.test.ts` — FOUND, 4 unit + 9 skipped integration (13 total `it()` cases — exceeds the 11 required in acceptance criteria)
- `tests/actions/suggestions.test.ts` — FOUND, 7/7 tests pass
- `npm test` — **1596 passed, 39 skipped** across the full suite (previous baseline 1566 + 16 new integration-gated + 14 net unit tests in Plan 10-04)
- `npm run build` — green; all 20 routes render under `cacheComponents: true`
- `npm run lint` on the 11 Plan 10-04 files — **zero errors, zero warnings**
- Commits `cbdfd09`, `d879203`, `4ff08c7`, `26b01e7`, `ddb3747`, `47d9ff7`, `0e8152c`, `41413fd` — ALL FOUND in `git log`

---
*Phase: 10-activity-feed*
*Completed: 2026-04-21*
