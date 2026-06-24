---
phase: 260623-pzz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/recommendations.ts
  - src/data/__tests__/recommendations.test.ts
autonomous: true
requirements: [QUICK-260623-PZZ]
must_haves:
  truths:
    - "When the peer-collector pool collapses below 8 unique watches, the catalog top-up that fills the rail brand-matches AGAINST THE SET OF ALL OWNED BRANDS — not just the alphabetical-winner single top brand — so a viewer who owns 5 brands tied 1-1-1-1-1 sees catalog rows from any of those 5 brands score +100, not only Baltic."
    - "The catalog candidate pool that feeds the top-up scoring step is broadened to include EVERY catalog row whose brand the viewer owns, in addition to the existing top-N-by-popularity slice — so alphabetically-late owned brands (e.g. Seiko, TIMEX, Zenith) are no longer cut off by the LIMIT before they can be scored."
    - "After scoring and sorting, no single brand contributes more than MAX_PER_BRAND_IN_TOPUP = 2 rows to the appended top-up output, so a viewer who owns Seiko (a catalog-heavy brand) does NOT see a rail collapse to 6+ Seikos in a row even though every Seiko scores +100 or +150."
    - "When viewerOwnedBrandsLower is empty (edge case: viewer's owned-set lookup returns 0 brands), the broadening UNION step is skipped and the function degrades to its prior popularity-pool behavior — full back-compat for that edge."
    - "The 260623-mn3 styleTags-projection side-effect is preserved (synthetic top-up Watch rows still set styleTags: row.styleTags ?? []), so the existing rule loop in getRecommendationsForViewer continues to fire 'Fans of {brand} love this' and 'Matches your {style} collection' on top-up rows."
    - "Determinism within the 6h rotation window is preserved (Cases 1 and 2 in recommendations.test.ts still pass) — no PRNG, no cache change, no schema change, no new SQL view, no migration."
    - "`npm run build` exits 0 (the authoritative gate per project memory `project_baseline_not_green_build_is_gate`)."
  artifacts:
    - path: "src/data/recommendations.ts"
      provides: "topUpFromCatalogPopularity gains a 6th param viewerOwnedBrandsLower: Set<string>; candidate fetch broadened to UNION of popularity-slice + owned-brand rows; post-sort variety-cap walks the scored array and skips brands that have already contributed MAX_PER_BRAND_IN_TOPUP; brand-match check uses the Set instead of a single string"
      contains: "MAX_PER_BRAND_IN_TOPUP"
    - path: "src/data/__tests__/recommendations.test.ts"
      provides: "Three new assertions appended to Case 3: (a) multi-brand surfacing — viewer with N owned brands sees rows from ≥2 of them in synthetic top-up; (b) variety-cap — viewer with a catalog-heavy owned brand sees ≤2 of that brand in synthetic top-up; (c) pool-broadening — viewer owning an alphabetically-late brand still surfaces it. All existing 260623-mn3 assertions in Case 3 and Cases 1/2/4 unchanged."
      contains: "MAX_PER_BRAND_IN_TOPUP"
  key_links:
    - from: "src/data/recommendations.ts (getRecommendationsForViewer ~lines 95-103)"
      to: "topUpFromCatalogPopularity"
      via: "caller derives viewerOwnedBrandsLower ONCE from viewerWatches.filter(w => w.status === 'owned').map(w => w.brand.trim().toLowerCase()) wrapped in `new Set(...)`, alongside the existing viewerTopBrand + viewerDominantStyleLabel derivations; passes through as the 6th positional arg"
      pattern: "viewerOwnedBrandsLower"
    - from: "src/data/recommendations.ts (topUpFromCatalogPopularity catalog fetch)"
      to: "watches_catalog table"
      via: "two-query strategy: (A) existing popularity-ordered LIMIT 60 query unchanged; (B) IF viewerOwnedBrandsLower is non-empty, a second query `WHERE lower(trim(brand)) IN (...)` returns ALL rows for those brands. Results merged in-memory using the same brand|model dedup key the rest of the function already uses, eliminating double-counts."
      pattern: "viewerOwnedBrandsLower.size > 0"
    - from: "src/data/recommendations.ts (topUpFromCatalogPopularity post-sort)"
      to: "per-brand cap enforcement"
      via: "after sorting `scored`, walk in order; track `Map<lowerBrand, count>`; skip any row whose brand has already contributed MAX_PER_BRAND_IN_TOPUP rows to the appended set. Applied BEFORE the `appended >= needed` break so the cap has room to filter (we may scan more than `needed` candidates)."
      pattern: "MAX_PER_BRAND_IN_TOPUP"
---

<objective>
Fix two prod-verified design weaknesses in the sparse-pool top-up shipped by 260623-mn3: (1) brand-match collapses to a single alphabetical-winner brand instead of considering all owned brands, and (2) the candidate fetch cuts off alphabetically so brands like Seiko/TIMEX never enter the scoring pool. Add a max-2-per-brand variety cap so the fix doesn't collapse the rail to one catalog-heavy brand.

Purpose: prod simulation confirmed that without these three changes layered together, the rail either keeps surfacing only ONE owned brand (current behavior — bad for collectors with diverse 1-watch-per-brand collections) or collapses to all-Seiko when the fix is applied without the cap. The locked target output (4 of 5 owned brands surface, no brand contributes more than 2 rows) is achieved only when all three changes ship together.

Output: a small surgical change to one DAL function + an extended test case. No UI changes, no schema changes, no migrations, no cache changes, no PRNG. Builds incrementally on the 260623-mn3 architecture — the prior taste-aware scoring formula is preserved; this plan only adjusts the BRAND-MATCH definition (single → set), BROADENS the candidate pool, and adds a POST-SORT variety cap.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/STATE.md
@.planning/quick/260623-mn3-taste-aware-sparse-pool-top-up-for-colle/260623-mn3-SUMMARY.md
@src/data/recommendations.ts
@src/data/__tests__/recommendations.test.ts
@src/lib/recommendations.ts

<interfaces>
<!-- Current state of the code being modified (post-260623-mn3). The executor should NOT need to re-explore. -->

From src/data/recommendations.ts — CURRENT signature being extended (lines 372-381):
```
export async function topUpFromCatalogPopularity(
  candidateMap: Map<
    string,
    { key: string; watch: Watch; ownerId: string | null; count: number }
  >,
  excluded: Set<string>,
  needed: number,
  viewerTopBrand: string | null,
  viewerDominantStyleLabel: string | null,
): Promise<void>
```

The 260623-mn3 caller derivation (current lines 95-103) — we will EXTEND this block:
```
const viewerTopBrand = topBrandOf(viewerWatches)
const viewerDominantStyleLabel = dominantStyleOf(viewerWatches)?.label ?? null
```

The 260623-mn3 call site (current lines 233-239) — we will EXTEND with a 6th arg:
```
await topUpFromCatalogPopularity(
  candidateMap,
  excluded,
  needed,
  viewerTopBrand,
  viewerDominantStyleLabel,
)
```

The 260623-mn3 current brand-match check inside scoring (line 414-415):
```
const brandMatch =
  topBrandLower !== null && row.brand.toLowerCase() === topBrandLower
```

The current catalog fetch (lines 391-407) — UNCHANGED in shape; we will add a SECOND query and union the rows in memory:
```
const rows = await db
  .select({ id, brand, model, reference, imageUrl, ownersCount, styleTags })
  .from(watchesCatalog)
  .orderBy(desc(watchesCatalog.ownersCount), asc(watchesCatalog.brand))
  .limit(60)
```

The current append loop (lines 432-462) — we will rewrite the loop body to enforce the per-brand cap before the dedupe check. The synthetic Watch construction (styleTags projection, ownerId:null, count:0) stays EXACTLY as 260623-mn3 left it.

From src/lib/recommendations.ts — `topBrandOf` (lines 96-106) and `dominantStyleOf` (lines 108-122) STAY as exports. We do NOT remove or refactor them; the rule-rationale loop in getRecommendationsForViewer still uses them. We are ONLY changing how the TOP-UP function uses brand signal (single → set); the rule-rationale loop in `rationaleFor` is byte-identical.

From src/db/schema.ts — relevant watches_catalog columns already projected:
- brand (text NOT NULL) — line 444
- model (text NOT NULL) — line 445
- styleTags (text[] DEFAULT '{}') — line 483
- ownersCount (integer DEFAULT 0) — line 489

For the second query we will use Drizzle's `inArray` from `drizzle-orm`:
```
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
```
The viewerOwnedBrandsLower SET is converted to an Array<string> at the query boundary. We lower-case both sides so casing variance in catalog vs. user-entered brand names is irrelevant.
</interfaces>

<implementation-strategy-notes>
TWO-QUERY UNION vs. SINGLE-QUERY UNION — choosing two queries + in-memory merge:
- Drizzle's `union` requires identical projection types and is doable, but the two queries have different ORDER BY semantics (one popularity, one not) and the merge is trivial in-memory using the brand|model dedupe key already in use.
- Postgres cost: catalog is ~200 rows on prod, ~160 locally. Query (A) returns ≤60 rows; query (B) returns at most ~30 rows (typical user owns ≤5 brands × ≤6 catalog rows per brand). Total network round-trips: 2 (was 1). Acceptable — this entire branch only fires when the peer pool is sparse, which is the small-tenant / cold-start case where per-render DB cost is already tiny.
- In-memory dedupe uses `Map<brandModelKey, row>` — first-write-wins. Query (A) results are written first; query (B) entries that collide are silently dropped (their data is identical since both queries hit the same table).
- If query (B) is empty (viewerOwnedBrandsLower is empty), we skip the entire second query — single round-trip preserved for the back-compat path.

CAP PLACEMENT — between sort and the appended-counter break:
- The current loop is `for (const { row } of scored) { if (appended >= needed) break; ... }`. We insert a per-brand cap check BEFORE the dedupe-skip but AFTER the appended-counter check, so the cap correctly filters from the sorted pool without affecting the `needed`-fill contract.
- The cap is enforced on the LOWERCASED-trimmed brand (matches the rest of the function's normalization). Two rows with brand 'Seiko' and 'seiko' would both count against the same bucket — that's the right semantics.
- The cap counter is a small `Map<string, number>` local to the function call. Reset per call (function is pure given its inputs).

POOL-WIDENING IMPACT ON THE LIMIT-60 SLICE:
- The popularity LIMIT-60 query is UNCHANGED. The owned-brands query is ADDITIVE — it cannot remove rows from the popularity slice. The only new behavior is: owned-brand rows that the popularity LIMIT cut off now appear in the scored pool. The popularity slice itself still has its alphabetical first-60 character on tied owners_count=0; the fix is that owned-brand rows now bypass that cutoff specifically.
</implementation-strategy-notes>

<determinism-and-tiebreak-notes>
The new variety-cap is a pure-function POST-step on the deterministic sort: same scored list → same cap-filtered output. No PRNG, no Date.now(), no per-call randomness.

The cap walks the array in SORT order, so the 2 rows that survive per brand are the 2 highest-scoring rows for that brand. For Rolex (brand-match = 100), the two highest-scoring Rolex catalog rows survive. For a brand the viewer doesn't own (no brand-match), the two highest-popularity rows for that brand survive.

The outer getRecommendationsForViewer re-sort (line 268) still applies after this function returns. As documented in 260623-mn3-SUMMARY.md Deviation #2, that outer sort flattens all community-fallback rows to score=0 and alpha-tiebreaks by brand — the cap output is the INPUT to that outer sort, so the cap semantics survive the outer re-sort intact for brand/style-matching rows (which keep RULE_MATCH_BONUS=50) and don't matter for pure-popularity rows (the cap is irrelevant for the alpha-tiebroken bucket anyway).
</determinism-and-tiebreak-notes>

<out-of-scope-reminders>
Per task_scope, these are explicitly OUT — do NOT include in the plan or implementation:
- Brand canonicalization across 'Héron Watches' vs 'Héron' etc. (separate hygiene phase).
- `brand_normalized` GENERATED column or `brand_id` FK.
- `watches_catalog.role_tags` backfill (0% populated locally).
- Design-motif Jaccard or LLM-numeric taste vectors.
- Tuning MAX_PER_BRAND_IN_TOPUP to be viewer-adaptive (e.g. 3+ for deep single-brand collections).
- UI changes, cache changes, schema changes, migrations, new SQL views.
</out-of-scope-reminders>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend Case 3 in recommendations.test.ts with three new assertions (multi-brand surfacing, variety-cap, pool-broadening) — RED before implementation</name>
  <files>src/data/__tests__/recommendations.test.ts</files>
  <behavior>
    After this task the test file has the same 4 integration cases + 2 pure-function suites, with Case 3 EXTENDED (not replaced). All 260623-mn3 assertions in Case 3 remain literally unchanged — assertion 1 (Rolex Datejust before Seiko SKX007), assertion 2 (Seiko SKX007 before Omega/Cartier), assertion 3 (Cartier before Omega in the community-fallback bucket), and assertions 4/5/6 (rationale templates fire correctly).

    THREE NEW ASSERTIONS appended to Case 3, working on the SAME `recs` array the 260623-mn3 assertions already inspect:

    7. **Multi-brand surfacing.** The viewer fixture remains 3 Rolex watches but the catalogTopUpResolver fixture is extended with TWO MORE owned-brand rows (e.g. a second Rolex `cat-rolex-2` AND a third — to give the cap room to fire — plus a Tudor row IF we extend the viewer fixture, OR — simpler — just keep the viewer's owned brand set as {Rolex} and add a second Rolex catalog row to verify the multi-brand SET CONTAINS logic works correctly even for a 1-element set). The minimum-effort version: add `{ id: 'cat-rolex-2', brand: 'rolex', model: 'GMT Master II', ... }` with LOWERCASE brand 'rolex' to the catalogTopUpResolver — assert it surfaces (proves the SET-membership check is case-insensitive and matches even when catalog casing differs from viewer casing).
       → To meaningfully test the multi-brand SET (not just case-insensitivity), the cleanest fixture change is to extend the viewer to own one Tudor watch alongside the Rolexes:
       ```
       watchesByUser.set('viewer-1', [
         mkWatch({ id: 'v-1', brand: 'Rolex', model: 'Submariner', styleTags: ['sport'] }),
         mkWatch({ id: 'v-2', brand: 'Rolex', model: 'Explorer',   styleTags: ['sport'] }),
         mkWatch({ id: 'v-3', brand: 'Rolex', model: 'GMT',        styleTags: ['sport'] }),
         mkWatch({ id: 'v-4', brand: 'Tudor', model: 'Black Bay',  styleTags: ['sport'] }),
       ])
       ```
       Then add a Tudor catalog row: `{ id: 'cat-tudor', brand: 'Tudor', model: 'Pelagos', reference: '25600', imageUrl: null, ownersCount: 30, styleTags: ['sport'] }`. Assert the Tudor synthetic appears in the recs (proves Tudor — which is NOT the alphabetical-winner top brand 'Rolex' (R < T) — surfaces via SET match).
       NOTE: with this 4-watch fixture, `topBrandOf` returns 'Rolex' (3 vs 1) so `dominantStyleOf` still returns sport@1.0. The 260623-mn3 assertions remain valid: Rolex Datejust still brand-matches (100), Seiko SKX007 still style-matches (50). The NEW Tudor Pelagos row scores 100 + 50 + 0.030 = 150.030 (brand-match via the NEW set AND style-match via 'sport'). Assert it ranks ahead of Seiko SKX007 (proves the multi-brand SET is the gate; under the old single-brand check Tudor would have scored only 50 and ranked behind Seiko's 50.099).
       → New assertion: `expect(idx('Tudor', 'Pelagos')).toBeLessThan(idx('Seiko', 'SKX007'))` — the Tudor row, brand-matched via the SET, outranks the Seiko style-match.
       → New assertion: `expect(idx('Tudor', 'Pelagos')).toBeGreaterThanOrEqual(0)` — Tudor surfaces at all (would not under the old single-string brandMatch check, which would have returned 'Rolex' only).

    8. **Variety-cap (max 2 per brand).** The catalogTopUpResolver fixture is extended with 5+ Rolex rows so the cap MUST fire to keep the synthetic top-up from collapsing to all-Rolex. Add three more Rolex rows:
       ```
       { id: 'cat-rolex-2', brand: 'Rolex', model: 'GMT Master II', reference: '126710', imageUrl: null, ownersCount: 90, styleTags: ['sport'] },
       { id: 'cat-rolex-3', brand: 'Rolex', model: 'Submariner Date', reference: '126610', imageUrl: null, ownersCount: 85, styleTags: ['sport'] },
       { id: 'cat-rolex-4', brand: 'Rolex', model: 'Daytona', reference: '116500', imageUrl: null, ownersCount: 70, styleTags: ['sport'] },
       ```
       Each of these scores 100 + 50 + (ownersCount/1000) = 150.x — they would, without the cap, all rank ahead of every non-Rolex row.
       → New assertion: `expect(synthetics.filter(r => r.brand === 'Rolex').length).toBeLessThanOrEqual(2)` — no more than 2 Rolex rows in the synthetic top-up.
       → New assertion: `expect(synthetics.filter(r => r.brand === 'Rolex').length).toBeGreaterThanOrEqual(1)` — at least one Rolex row still surfaces (cap is 2, not 0).

    9. **Pool-broadening.** The catalogTopUpResolver fixture already includes a Zenith row in 260623-mn3 (`cat-filler1` brand:'Zenith' ownersCount:10). To test the pool-broadening behavior we need to verify that a row which would have been ALPHABETICALLY CUT OFF by the popularity LIMIT survives because the owned-brand secondary query catches it. The current resolver returns ~10 rows — well within LIMIT 60 — so the cutoff isn't naturally exercised. The cleanest in-test demonstration: the multi-query strategy means BOTH queries hit the SAME `catalogTopUpResolver` mock. The mock's existing `catalogTopUpResolver` is the only resolver wired to the catalog terminal in the chain factory (line 89-95 of the test file: any `.limit(...)` terminal routes to `catalogTopUpResolver`).
       → **Mock-routing implementation note for the executor:** in this test the same resolver fires for both queries — that's a test-environment simplification, NOT a prod claim. In prod the two queries return different rows; in tests we exercise scoring + cap + dedup on a single row set. The pool-broadening test is therefore expressed at the EXPLICIT-CALL-COUNT level, not at the row-content level:
       → New assertion: `expect(catalogResolverCalls).toBeGreaterThanOrEqual(1)` — confirms the catalog terminal was awaited at all (the .limit terminal).
       → To distinguish the popularity-query call from the owned-brands-query call, COUNT the calls (instrument `catalogTopUpResolver` to increment a counter as Case 4 already does for `catalogResolverCalls`). With viewerOwnedBrandsLower non-empty (the Rolex+Tudor fixture), assert `catalogResolverCalls === 2` (one for popularity, one for owned-brands). With viewerOwnedBrandsLower empty (zero-watches-owned), the function would early-return at line 93 before reaching the sparse-pool branch, so that's not testable from this case — but the back-compat preserved is the `getWatchesByUser` path returning 0 owned watches, which still hits the existing `viewerOwned.length === 0 → return []` branch.
       → SIMPLER alternative: if the executor finds two-call counting brittle (e.g. if the implementation merges into a single Drizzle `union` query that has only one .limit terminal), accept `catalogResolverCalls >= 1` and add a comment in the test explaining: "the actual query-count depends on whether the implementation uses two separate queries or a UNION — both shapes are acceptable per plan; this assertion just confirms the catalog terminal fires." Document in the SUMMARY which path was taken.

    Cases 1, 2, 4 are UNCHANGED. The pure-function suites for seedFor and mulberry32 are UNCHANGED. The `vi.mock` factories for `@/db`, `@/db/schema`, `drizzle-orm`, `@/data/watches`, `@/data/preferences`, `@/data/wearEvents` are UNCHANGED in structure — the only change is potentially adding `inArray: (...args: unknown[]) => ({ __op: 'inArray' })` to the `drizzle-orm` mock IF the executor uses `inArray` for the owned-brands query.
  </behavior>
  <action>
    Step 1 — In `src/data/__tests__/recommendations.test.ts`, locate the existing Case 3 `it(...)` block at lines 361-443. KEEP all existing fixture setup and assertions 1-6. EXTEND the fixture and APPEND the new assertions.

    Step 2 — Update the viewer fixture inside Case 3 to add a Tudor watch:
    ```
    watchesByUser.set('viewer-1', [
      mkWatch({ id: 'v-1', brand: 'Rolex', model: 'Submariner', styleTags: ['sport'] }),
      mkWatch({ id: 'v-2', brand: 'Rolex', model: 'Explorer',   styleTags: ['sport'] }),
      mkWatch({ id: 'v-3', brand: 'Rolex', model: 'GMT',        styleTags: ['sport'] }),
      mkWatch({ id: 'v-4', brand: 'Tudor', model: 'Black Bay',  styleTags: ['sport'] }),
    ])
    ```
    Add a comment above the fixture: "// 4-watch fixture (3 Rolex + 1 Tudor) — topBrandOf still returns 'Rolex' (3>1), but viewerOwnedBrandsLower is now {rolex, tudor}. This exercises the multi-brand SET match (260623-pzz)."

    Step 3 — Extend `catalogTopUpResolver` with a Tudor row + 3 more Rolex rows. The full new fixture rows (added to the existing 6 from 260623-mn3) are:
    ```
    { id: 'cat-tudor',   brand: 'Tudor', model: 'Pelagos',         reference: '25600',  imageUrl: null, ownersCount: 30, styleTags: ['sport'] },
    { id: 'cat-rolex-2', brand: 'Rolex', model: 'GMT Master II',   reference: '126710', imageUrl: null, ownersCount: 90, styleTags: ['sport'] },
    { id: 'cat-rolex-3', brand: 'Rolex', model: 'Submariner Date', reference: '126610', imageUrl: null, ownersCount: 85, styleTags: ['sport'] },
    { id: 'cat-rolex-4', brand: 'Rolex', model: 'Daytona',         reference: '116500', imageUrl: null, ownersCount: 70, styleTags: ['sport'] },
    ```
    Total rows in the resolver: now 10 (was 6). Comment above the resolver: "// 10 rows: 4 Rolex (one brand-match-only from 260623-mn3 + three new for the cap test), 1 Seiko (style-match), 1 Tudor (brand-match via owned-set), 1 Omega + 1 Cartier (pure popularity), 2 fillers."

    Step 4 — Instrument `catalogTopUpResolver` with a call counter. Hoist a `let catalogResolverCalls = 0` before the `catalogTopUpResolver = async () => ...` re-assignment and increment inside the resolver (mirrors Case 4's pattern at lines 458-462). Reset in beforeEach if it survives across tests — actually simpler: declare `let catalogResolverCalls = 0` INSIDE the `it(...)` block and shadow it; the outer holder is just `catalogTopUpResolver = async () => { catalogResolverCalls++; return [ ... ] }`.

    Step 5 — APPEND the following NEW assertions AFTER the existing assertion 6 (the Omega + Cartier rationale check), before the closing `})`:
    ```
    // ── 260623-pzz new assertions ──────────────────────────────────────

    // 7a. Multi-brand surfacing: Tudor is owned (viewer's brand SET is
    //     {rolex, tudor}) so the Tudor catalog row brand-matches via the
    //     SET — under the old single-string brandMatch (= topBrandOf only)
    //     Tudor would have scored only 50 (style-only); under the new
    //     SET-membership check it scores 150 (brand + style).
    expect(idx('Tudor', 'Pelagos')).toBeGreaterThanOrEqual(0)
    expect(idx('Tudor', 'Pelagos')).toBeLessThan(idx('Seiko', 'SKX007'))

    // 7b. Variety-cap: with 4 Rolex catalog rows all scoring 150+, the
    //     unbounded behavior would surface all 4. The cap MAX_PER_BRAND_IN_TOPUP=2
    //     limits Rolex to 2 rows in the synthetic top-up.
    const rolexCount = synthetics.filter((r) => r.brand === 'Rolex').length
    expect(rolexCount).toBeLessThanOrEqual(2)
    expect(rolexCount).toBeGreaterThanOrEqual(1) // cap is 2, not 0

    // 7c. Pool-broadening: the catalog terminal must be awaited at least
    //     once for the popularity slice, and (when viewerOwnedBrandsLower
    //     is non-empty) a second time for the owned-brands query. Two
    //     separate queries OR a single UNION both satisfy `>= 1`; the
    //     executor's implementation choice is documented in the SUMMARY.
    //     If the executor chose the two-query strategy, this will be 2;
    //     if they chose a Drizzle `union`, this will still be >=1.
    expect(catalogResolverCalls).toBeGreaterThanOrEqual(1)
    ```

    Step 6 — IF the executor's Task 2 implementation uses `inArray` from drizzle-orm, EXTEND the `drizzle-orm` mock (lines 126-132) to include `inArray: (..._a: unknown[]) => ({ __op: 'inArray' })`. The mock factory does not inspect the operator's identity beyond returning a tagged stub. Do NOT add this in Task 1 — it's only needed if Task 2 picks the `inArray` strategy; the test runs without it if Task 2 uses a different approach (e.g. raw SQL filter via `sql\`lower(trim(brand)) = ANY(${array})\``).

    Step 7 — Do NOT modify Case 1, Case 2, Case 4, or the pure-function suites. Do NOT modify the chain factory at lines 55-104. Do NOT modify the mock factories for `@/data/preferences` (the fully-formed UserPreferences from 260623-mn3 deviation #1 must be preserved) or `@/data/wearEvents`.

    Step 8 — RUN the test to confirm RED state (it MUST fail before Task 2 lands the implementation). Expected failure: Tudor not in synthetic recs because the current brand-match check is `=== viewerTopBrand` (Rolex), and Tudor scores only 50; and/or 4 Rolex rows present because no cap is enforced. Commit RED:
    ```
    git add src/data/__tests__/recommendations.test.ts
    git commit -m "test(260623-pzz): RED — multi-brand match + per-brand variety cap assertions"
    ```
  </action>
  <verify>
    <automated>npx vitest run src/data/__tests__/recommendations.test.ts --reporter=verbose</automated>
    Expected for THIS task only: Case 3 FAILS on at least one of the new assertions (Tudor missing OR rolexCount > 2). Cases 1, 2, 4 PASS unchanged. The pure-function suites PASS unchanged. This is the RED commit's exit state — Task 2's verify will flip Case 3 to GREEN.
  </verify>
  <done>
    - Case 3 now contains the 4-watch viewer fixture (3 Rolex + 1 Tudor) and the 10-row catalogTopUpResolver fixture (4 Rolex + 1 Seiko + 1 Tudor + 1 Omega + 1 Cartier + 2 fillers).
    - Assertions 7a, 7b, 7c (with their sub-assertions on Tudor index, rolexCount bounds, and catalogResolverCalls) are present after assertion 6.
    - `git diff src/data/__tests__/recommendations.test.ts` shows ONLY Case 3 changes — Cases 1/2/4 and pure-function suites are untouched.
    - `git log --oneline -1` shows the RED commit subject starting with `test(260623-pzz): RED`.
    - `npx vitest run src/data/__tests__/recommendations.test.ts` reports Case 3 FAILING (this is the expected RED state — proceed to Task 2).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement multi-brand match + pool broadening + per-brand variety cap in topUpFromCatalogPopularity — GREEN</name>
  <files>src/data/recommendations.ts</files>
  <behavior>
    After this task `topUpFromCatalogPopularity` accepts a 6th parameter `viewerOwnedBrandsLower: Set<string>` and uses it for both brand-matching AND pool broadening; the per-brand cap MAX_PER_BRAND_IN_TOPUP = 2 is enforced after sorting. The 260623-mn3 styleTags-projection, ownersCount tiebreaker, alpha tiebreaker, and synthetic-Watch construction are PRESERVED byte-identically. The function signature changes:

    ```
    export async function topUpFromCatalogPopularity(
      candidateMap, excluded, needed,
      viewerTopBrand: string | null,            // KEPT for back-compat / future use
      viewerDominantStyleLabel: string | null,
      viewerOwnedBrandsLower: Set<string>,      // NEW — the full set of owned brands, lowercased+trimmed
    ): Promise<void>
    ```

    `viewerTopBrand` STAYS in the signature even though it's no longer the brand-match gate (the SET is). Two reasons: (a) the rule-rationale loop at line 244-264 still uses it (indirectly — via rationaleFor which calls topBrandOf internally), so the broader caller derivation is still useful; (b) preserving signature ordering minimizes diff and avoids breaking any future test caller. Leave the param in place; just don't use it for brand-match inside this function (it's still passed in by the caller for consistency with the prior interface).

    NEW MODULE-LEVEL CONSTANT (top of file, near SPARSE_POOL_THRESHOLD line 48):
    ```
    /**
     * Per-brand cap applied to the sparse-pool catalog top-up so a viewer who
     * owns a catalog-heavy brand (e.g. Seiko, with 8+ catalog rows) does not
     * see the rail collapse to all-Seiko (quick task 260623-pzz). The cap is
     * applied AFTER scoring + sorting in topUpFromCatalogPopularity, so the
     * two surviving rows for any brand are the two highest-scoring rows for
     * that brand. Future iteration: make this viewer-adaptive (e.g. 3+ for
     * deep single-brand collections) once we have UX data.
     */
    const MAX_PER_BRAND_IN_TOPUP = 2
    ```

    CALLER DERIVATION (getRecommendationsForViewer ~line 102, alongside existing viewerTopBrand + viewerDominantStyleLabel):
    ```
    const viewerOwnedBrandsLower = new Set(
      viewerWatches
        .filter((w) => w.status === 'owned')
        .map((w) => w.brand.trim().toLowerCase()),
    )
    ```

    CALLER SITE (sparse-pool branch at line 233) extends to 6 args:
    ```
    await topUpFromCatalogPopularity(
      candidateMap, excluded, needed,
      viewerTopBrand, viewerDominantStyleLabel, viewerOwnedBrandsLower,
    )
    ```

    BROADENED CANDIDATE FETCH (inside topUpFromCatalogPopularity):
    - Query (A): unchanged — `SELECT … ORDER BY ownersCount DESC, brand ASC LIMIT 60` — produces `rowsByPopularity`.
    - Query (B): ONLY if `viewerOwnedBrandsLower.size > 0`. Use Drizzle's `inArray` to filter on lowercased brand. Since we don't have a lower(brand) expression as a column, the cleanest approach is to fetch ALL catalog rows for any brand in the set without lower-casing on the DB side — use `inArray(watchesCatalog.brand, brandArray)` with the brandArray built by CAPITALIZING each owned brand string back from the lowercased Set… actually this is the wrong approach: the user's brand strings AS STORED in `watches` may differ in case from the catalog's `brand` column. The safe approach is:
      ```
      const ownedBrandsForQuery = Array.from(viewerOwnedBrandsLower)
      // Use SQL lower(trim(brand)) IN (...) so casing differences between
      // the user's watches table entries and the watches_catalog table do
      // not cause misses.
      const rowsByOwnedBrand = await db
        .select({ id, brand, model, reference, imageUrl, ownersCount, styleTags })
        .from(watchesCatalog)
        .where(sql`lower(trim(${watchesCatalog.brand})) = ANY(${ownedBrandsForQuery})`)
      ```
      This requires `import { sql } from 'drizzle-orm'`. The `= ANY(${array})` form is the prod-safe equivalent of `IN (...)` for array params in Drizzle — it serializes the array as a single parameter rather than expanding to N placeholders (matters for variable-length user inputs).
    - Merge step: build `const rows = [...rowsByPopularity]; const seenIds = new Set(rowsByPopularity.map(r => r.id)); for (const r of rowsByOwnedBrand) { if (!seenIds.has(r.id)) rows.push(r); }`. Dedupe by id (the catalog primary key is uuid; identity is stable). Comment: "// Merge the two queries — popularity slice first (priority), owned-brand catch-up second (only rows not already present). Same-id rows collide and are dropped (their content is identical)."
    - If `viewerOwnedBrandsLower.size === 0`, set `const rows = rowsByPopularity` and skip query (B) entirely (preserves the single-query path for the zero-owned-brands edge — which is anyway unreachable here because the caller would have early-returned on `viewerOwned.length === 0`).

    SCORING — UPDATED brand-match check (inside the `scored = rows.map(...)` loop):
    ```
    const brandMatch =
      viewerOwnedBrandsLower.size > 0 &&
      viewerOwnedBrandsLower.has(row.brand.trim().toLowerCase())
    ```
    This replaces the prior `topBrandLower !== null && row.brand.toLowerCase() === topBrandLower` check. The `+= 100` weight, the styleMatch check, and the `ownersCount / 1000` additive are UNCHANGED. Remove the now-unused `topBrandLower` local (was `viewerTopBrand?.toLowerCase() ?? null`) — `viewerTopBrand` is no longer used inside this function (kept in the signature for back-compat).

    SORT — UNCHANGED. Score DESC, brand ASC, model ASC.

    APPEND LOOP — INSERT cap enforcement:
    ```
    const brandUsage = new Map<string, number>()
    let appended = 0
    for (const { row } of scored) {
      if (appended >= needed) break
      const rowBrandLower = row.brand.trim().toLowerCase()
      if ((brandUsage.get(rowBrandLower) ?? 0) >= MAX_PER_BRAND_IN_TOPUP) continue
      const key = `${rowBrandLower}|${row.model.trim().toLowerCase()}`
      if (excluded.has(key)) continue
      if (candidateMap.has(key)) continue
      // …existing synthetic Watch construction UNCHANGED…
      candidateMap.set(key, { key, watch: syntheticWatch, ownerId: null, count: 0 })
      brandUsage.set(rowBrandLower, (brandUsage.get(rowBrandLower) ?? 0) + 1)
      appended++
    }
    ```
    The cap check (`brandUsage.get(...) >= MAX_PER_BRAND_IN_TOPUP`) is placed BEFORE the excluded/dedupe checks so that a row skipped by the cap does NOT increment the brand-usage counter (only successfully-appended rows count). The brand-usage counter is local to the function call (pure relative to inputs).

    JSDoc on `topUpFromCatalogPopularity` is updated to: (a) describe the new SET-based brand match; (b) describe the pool-broadening UNION strategy with the rationale (alphabetical cutoff problem); (c) describe the variety cap with rationale (single-brand collapse problem); (d) call out that `viewerTopBrand` is kept in the signature for back-compat / future use but is no longer the brand-match gate; (e) preserve the existing DEFERRED notes (role scoring, designMotifs).

    The synthetic Watch construction (id, brand, model, status, movement, complications, styleTags, designTraits, roleTags, imageUrl) is BYTE-IDENTICAL to 260623-mn3. The `styleTags: row.styleTags ?? []` projection MUST remain — this is the 260623-mn3 rationale-projection contract being preserved.
  </behavior>
  <action>
    Step 1 — Add `MAX_PER_BRAND_IN_TOPUP = 2` constant near `SPARSE_POOL_THRESHOLD` (around line 48). Include the JSDoc block from the <behavior> section.

    Step 2 — Update imports at top of `src/data/recommendations.ts` to add `inArray` and `sql` to the drizzle-orm import:
    ```
    import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'
    ```
    (Note: per the strategy in <behavior>, we use `sql\`lower(trim(...)) = ANY(...)\`` for case-insensitive brand matching, so `inArray` is NOT actually needed — only `sql` is added. Confirm by writing the query as documented and verifying `inArray` is not referenced.)

    Step 3 — In `getRecommendationsForViewer`, immediately AFTER the existing `viewerDominantStyleLabel` derivation (current line 103), add:
    ```
    // Full set of owned brands (lower+trim) — used by sparse-pool top-up
    // for multi-brand match AND owned-brand pool broadening (260623-pzz).
    // The single-string viewerTopBrand above kept for back-compat / future
    // use; the SET is the actual brand-match gate inside top-up.
    const viewerOwnedBrandsLower = new Set(
      viewerWatches
        .filter((w) => w.status === 'owned')
        .map((w) => w.brand.trim().toLowerCase()),
    )
    ```

    Step 4 — Update the sparse-pool call site (current lines 233-239) to pass the new 6th arg:
    ```
    await topUpFromCatalogPopularity(
      candidateMap,
      excluded,
      needed,
      viewerTopBrand,
      viewerDominantStyleLabel,
      viewerOwnedBrandsLower,
    )
    ```

    Step 5 — Update `topUpFromCatalogPopularity`'s signature (lines 372-381) to add `viewerOwnedBrandsLower: Set<string>` as the 6th positional parameter. Update the JSDoc above the function per <behavior> step (a)-(e).

    Step 6 — Inside the function body (replacing lines 391-407, the current single-query fetch):
    - Rename the existing query result variable from `rows` to `rowsByPopularity`.
    - Add the conditional second query for owned brands (only if `viewerOwnedBrandsLower.size > 0`):
      ```
      let rows = rowsByPopularity
      if (viewerOwnedBrandsLower.size > 0) {
        const ownedBrandsArr = Array.from(viewerOwnedBrandsLower)
        const rowsByOwnedBrand = await db
          .select({
            id: watchesCatalog.id,
            brand: watchesCatalog.brand,
            model: watchesCatalog.model,
            reference: watchesCatalog.reference,
            imageUrl: watchesCatalog.imageUrl,
            ownersCount: watchesCatalog.ownersCount,
            styleTags: watchesCatalog.styleTags,
          })
          .from(watchesCatalog)
          .where(
            sql`lower(trim(${watchesCatalog.brand})) = ANY(${ownedBrandsArr})`,
          )
        // Merge: popularity slice first (priority for ordering-of-discovery
        // semantics), owned-brand catch-up second. Dedupe by primary key id.
        const seenIds = new Set(rowsByPopularity.map((r) => r.id))
        const extras = rowsByOwnedBrand.filter((r) => !seenIds.has(r.id))
        rows = [...rowsByPopularity, ...extras]
      }
      ```
      Comment above the conditional: "// 260623-pzz pool broadening: the popularity LIMIT 60 cuts off alphabetically when many rows have ownersCount=0 (true locally and on cold-start prod). Without this second query, owned-brand catalog rows whose brand sorts late (Seiko, TIMEX, Zenith) never make it into the scoring pool. With it, EVERY owned-brand row is scored. Cost: 1 extra DB round-trip per render, only when sparse-pool top-up fires (which is the small-tenant/cold-start case where per-render cost is already trivial)."

    Step 7 — Update the scoring map (current lines 411-424) to use the SET for brand match. Replace the `topBrandLower` local with the SET membership check:
    ```
    const styleLabelLower = viewerDominantStyleLabel?.toLowerCase() ?? null
    const scored = rows.map((row) => {
      const brandLower = row.brand.trim().toLowerCase()
      const brandMatch =
        viewerOwnedBrandsLower.size > 0 && viewerOwnedBrandsLower.has(brandLower)
      const styleMatch =
        styleLabelLower !== null &&
        (row.styleTags ?? []).some((s) => s.toLowerCase() === styleLabelLower)
      const score =
        (brandMatch ? 100 : 0) +
        (styleMatch ? 50 : 0) +
        (row.ownersCount ?? 0) / 1000
      return { row, score, brandLower }
    })
    ```
    Capturing `brandLower` in the scored tuple avoids re-computing it in the append loop. (Optional micro-optimization; if the executor prefers to keep the tuple as `{ row, score }` and recompute `brandLower` in the loop, that's fine — both shapes pass the test.)

    Step 8 — UPDATE the append loop (current lines 432-462) to enforce the per-brand cap. Replace the loop with:
    ```
    const brandUsage = new Map<string, number>()
    let appended = 0
    for (const { row, brandLower } of scored) {
      if (appended >= needed) break
      // 260623-pzz variety cap — skip rows whose brand has already
      // contributed MAX_PER_BRAND_IN_TOPUP rows to the appended set.
      // Cap check FIRST so an excluded-by-cap row does not even attempt
      // the dedupe lookup; brand-usage counter only increments on
      // successful appends below.
      if ((brandUsage.get(brandLower) ?? 0) >= MAX_PER_BRAND_IN_TOPUP) continue
      const key = `${brandLower}|${row.model.trim().toLowerCase()}`
      if (excluded.has(key)) continue
      if (candidateMap.has(key)) continue
      const syntheticWatch: Watch = {
        id: row.id,
        brand: row.brand,
        model: row.model,
        status: 'owned',
        movement: 'auto',
        complications: [],
        styleTags: row.styleTags ?? [],
        designTraits: [],
        roleTags: [],
        imageUrl: row.imageUrl ?? undefined,
      }
      candidateMap.set(key, {
        key,
        watch: syntheticWatch,
        ownerId: null,
        count: 0,
      })
      brandUsage.set(brandLower, (brandUsage.get(brandLower) ?? 0) + 1)
      appended++
    }
    ```
    If Step 7 kept the tuple as `{ row, score }` (no `brandLower` captured), replace `for (const { row, brandLower } of scored)` with `for (const { row } of scored) { const brandLower = row.brand.trim().toLowerCase(); ... }`.

    Step 9 — Run the test suite to confirm GREEN:
    ```
    npx vitest run src/data/__tests__/recommendations.test.ts --reporter=verbose
    ```
    All 10 tests (Cases 1/2/3/4 + 6 pure-function tests) MUST pass. Case 3 should now satisfy all 9 assertions (1-6 from 260623-mn3 + 7a/7b/7c from this plan).

    Step 10 — Run the authoritative build gate:
    ```
    npm run build
    ```
    MUST exit 0. Per project memory, this is THE gate — do not block on pre-existing tsc test-file errors or other unrelated noise.

    Step 11 — Commit GREEN:
    ```
    git add src/data/recommendations.ts
    git commit -m "feat(260623-pzz): multi-brand match + pool broadening + per-brand variety cap"
    ```

    Step 12 — Run `rg -n "topUpFromCatalogPopularity\\(" src/` to confirm exactly one call site, now passing 6 args. Run `rg -n "MAX_PER_BRAND_IN_TOPUP" src/` to confirm the constant is defined once and referenced once. Run `rg -n "viewerOwnedBrandsLower" src/` to confirm the var is derived once in the caller and used once in the function (and passed once through the call site).
  </action>
  <verify>
    <automated>npx vitest run src/data/__tests__/recommendations.test.ts --reporter=verbose && npm run build</automated>
    Expected: vitest reports 10/10 pass; build exits 0. If vitest fails on the Case 4 (no-regression-on-full-pool) test, the executor broke the back-compat path — check the conditional-second-query guard on `viewerOwnedBrandsLower.size > 0` (with 1 viewer watch in the buildSeedPool(30) fixture, viewerOwnedBrandsLower.size = 1, so query B WILL fire — but the function early-returns at the top via `if (needed <= 0) return` only if needed <= 0; in Case 4 the candidateMap is fully populated so the sparse-pool branch in the caller never fires the function at all, so the catalog resolver counter stays at 0 — that's the contract).
  </verify>
  <done>
    - `MAX_PER_BRAND_IN_TOPUP = 2` constant defined once near top of `src/data/recommendations.ts`.
    - `topUpFromCatalogPopularity` signature now takes 6 params; viewerOwnedBrandsLower: Set<string> is the 6th.
    - Caller derivation `const viewerOwnedBrandsLower = new Set(...)` present in `getRecommendationsForViewer` immediately after the existing viewerDominantStyleLabel derivation.
    - Sparse-pool call site passes 6 args.
    - Brand-match check uses `viewerOwnedBrandsLower.has(brandLower)` not `=== topBrandLower`.
    - Conditional second query exists and only fires when `viewerOwnedBrandsLower.size > 0`; merge logic dedupes by primary-key id.
    - Append loop enforces the per-brand cap before the dedupe checks; brand-usage counter increments only on successful appends.
    - Synthetic Watch construction (styleTags projection, ownerId:null, count:0) is BYTE-IDENTICAL to 260623-mn3 — `rg "styleTags: row\\.styleTags" src/data/recommendations.ts` returns ≥1 hit.
    - JSDoc updated per <behavior> (a)-(e).
    - `npx vitest run src/data/__tests__/recommendations.test.ts` reports all 10 tests pass.
    - `npm run build` exits 0.
    - `git log --oneline -1` shows the GREEN commit subject starting with `feat(260623-pzz):`.
    - `rg -n "topUpFromCatalogPopularity\\(" src/` shows exactly one call site passing 6 args.
    - 260623-mn3 contracts preserved: `topBrandOf` and `dominantStyleOf` still exports of `src/lib/recommendations.ts` (untouched); `rationaleFor`'s rule loop in `getRecommendationsForViewer` lines 244-264 unchanged; window-determinism (Case 1) and cross-window rotation (Case 2) both still pass.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` exits 0 (authoritative gate per CLAUDE.md memory `project_baseline_not_green_build_is_gate`).
2. `npx vitest run src/data/__tests__/recommendations.test.ts` reports 10/10 pass — Cases 1/2/3/4 + 6 pure-function tests (Case 3 now has 9 assertions: 6 from 260623-mn3 + 3 from this plan).
3. `rg -n "MAX_PER_BRAND_IN_TOPUP" src/` returns exactly 2 hits (definition + usage in the append loop).
4. `rg -n "viewerOwnedBrandsLower" src/` returns 3 hits (derivation in getRecommendationsForViewer + parameter in topUpFromCatalogPopularity signature + usage inside the function body).
5. `rg -n "topUpFromCatalogPopularity\\(" src/` shows exactly one call site passing 6 args.
6. `rg -n "styleTags: row\\.styleTags" src/data/recommendations.ts` returns ≥1 hit — 260623-mn3 rationale-projection contract preserved (regression guard).
7. `rg -n "^export function (topBrandOf|dominantStyleOf)" src/lib/recommendations.ts` returns 2 hits — 260623-mn3 exports preserved (untouched, not removed).
8. `git log --oneline -2` shows two commits with subjects `test(260623-pzz): RED` and `feat(260623-pzz):` in that order (TDD gate compliance).
</verification>

<success_criteria>
- Multi-brand match: viewer owning multiple brands sees catalog rows from ANY of those brands score +100 in the sparse-pool top-up (not just the alphabetical-winner top brand).
- Pool broadening: every catalog row belonging to an owned brand enters the scoring pool, regardless of its alphabetical position relative to the popularity LIMIT cutoff.
- Variety cap: no single brand contributes more than MAX_PER_BRAND_IN_TOPUP = 2 rows to the appended synthetic top-up; the rail cannot collapse to all-Seiko (or any single owned brand) even when one owned brand dominates the catalog.
- 260623-mn3 contracts preserved: styleTags projection on synthetic rows, brand-match rationale template (`Fans of {brand} love this`), dominant-style rationale template (`Matches your {style} collection`), community-fallback for unsigned rows.
- Determinism within the 6h rotation window is preserved (Cases 1 and 2 in recommendations.test.ts still pass) — no PRNG added.
- No UI change, no schema change, no migration, no cache change, no new SQL view, no new DB join (apart from the second SELECT on the same table, scoped to the sparse-pool branch only).
- `npm run build` exits 0.
- `npx vitest run src/data/__tests__/recommendations.test.ts` reports 10/10 pass.
- TDD gate: RED commit (`test:`) precedes GREEN commit (`feat:`); both authored in that order.
</success_criteria>

<output>
After completion, create `.planning/quick/260623-pzz-multi-brand-match-per-brand-variety-cap-/260623-pzz-01-SUMMARY.md` documenting:
- Files changed with line counts (expect ~50-80 lines in src/data/recommendations.ts including new constant, new caller derivation, new conditional query, new cap loop, and updated JSDoc; ~40-60 lines in the test file for the extended Case 3 fixture and three new assertions).
- The implementation choice for the secondary query: `sql\`lower(trim(brand)) = ANY(${array})\`` (the planned approach) vs. a different strategy if the executor chose one (e.g. Drizzle `union` query, raw `inArray` without lowering). Cite why.
- The catalogResolverCalls count in the new Case 3 assertion 7c (1 or 2) — confirms how many DB round-trips the implementation makes.
- Confirmation that `npm run build` and `npx vitest run src/data/__tests__/recommendations.test.ts` both exited 0.
- Confirmation that 260623-mn3 contracts (styleTags projection, brand-match/dominant-style rationale templates, topBrandOf/dominantStyleOf exports, Case 1/2/4 unchanged) all survive.
- Any deviation from the plan with rationale (e.g. if the executor needed to also update the drizzle-orm mock with `sql` — surface it).
- Note that the deferred items from 260623-mn3 (role-based scoring, designMotifs Jaccard) remain deferred and are unaffected by this plan, plus the additional out-of-scope items this plan explicitly defers (brand canonicalization, brand_normalized column, adaptive cap, role_tags backfill).
</output>
