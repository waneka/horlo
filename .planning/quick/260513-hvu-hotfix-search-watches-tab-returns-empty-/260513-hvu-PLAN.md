---
phase: 260513-hvu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/catalog.ts
  - tests/data/searchCatalogWatches.test.ts
autonomous: true
requirements:
  - HOTFIX-SEARCH-WATCHES-EMPTY

must_haves:
  truths:
    - "User searching '/search?q=omega' on the Watches tab sees seeded Omega catalog rows (ownersCount=0, wishlistCount=0) in the results."
    - "User searching for a popular reference still sees popular rows ordered ahead of zero-popularity rows (ORDER BY preserved)."
    - "Existing searchCatalogWatches contract tests (early-return gates, ILIKE OR shape, ref-normalization, anti-N+1, owned>wishlist, limit clamp, row mapping) remain green."
  artifacts:
    - path: "src/data/catalog.ts"
      provides: "searchCatalogWatches DAL — WHERE clause no longer ANDs the score-zero (ownersCount + 0.5*wishlistCount) > 0 predicate; ORDER BY preserves identical popularity expression."
      contains: "searchCatalogWatches"
    - path: "tests/data/searchCatalogWatches.test.ts"
      provides: "Updated Test 3+4 (drops the WHERE-side score-zero substring assertions; tightens to ILIKE-OR-only shape) + new test asserting zero-popularity name-match rows are returned."
      contains: "zero-popularity name-match"
  key_links:
    - from: "src/data/catalog.ts (searchCatalogWatches WHERE)"
      to: "popularity expression"
      via: "RELOCATED from WHERE-AND to ORDER-BY-DESC only"
      pattern: "popularity stays in orderBy, NOT in where"
    - from: "tests/data/searchCatalogWatches.test.ts (Test 3+4 'WHERE includes ...')"
      to: "ILIKE-OR-only WHERE assertion"
      via: "rename + drop score-zero substring expectations"
      pattern: "WHERE asserts ILIKE OR across 3 normalized cols; no popularity column substring"
---

<objective>
Hotfix the Watches tab on `/search`: `searchCatalogWatches` in `src/data/catalog.ts` AND-gates name-match results behind `(ownersCount + 0.5 * wishlistCount) > 0`. After Phase 39b-01 bootstrapped 100 catalog rows directly into prod (`owners_count = 0`, `wishlist_count = 0` for all of them — the `pg_cron` counter-refresh only credits rows that appear in users' `watches` tables), the Watches tab returns empty for every query that should hit a seeded row (e.g. `q=omega` against 16 Omega refs).

The score-zero exclusion was originally lifted from the Phase 18 `getTrendingCatalogWatches` idiom — correct for an empty-query browse surface ranking by popularity, wrong for an explicit `q` search where ILIKE-OR-across-3-normalized-cols already supplies relevance. Move the score-zero predicate OUT of the WHERE clause; keep it identically in the ORDER BY so popular rows still rank ahead when both popular and unpopular name-matches exist.

Purpose: Restore Watches-tab search functionality without rewriting the popularity-aware ordering or touching the daily counter-refresh job.

Output: Single source-file edit (`src/data/catalog.ts`) + paired test update (`tests/data/searchCatalogWatches.test.ts`) — drops the WHERE-side score-zero assertion in Test 3+4 (it will fail post-fix) and adds a positive test asserting zero-popularity rows are returned by name-match.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md
@src/data/catalog.ts
@tests/data/searchCatalogWatches.test.ts

<interfaces>
<!-- Key existing patterns the executor needs. No codebase exploration required. -->

The CURRENT WHERE block in `searchCatalogWatches` (src/data/catalog.ts lines ~318–331):

The WHERE is structured as `and(scoreZeroPredicate, or(ilike-brand, ilike-model, ilike-ref-or-false))`. Post-fix the WHERE collapses to just the `or(...)` clause (no outer `and(...)` wrapper needed), preserving the exact same OR branches including the `refPattern ? ilike(...) : sql\`false\`` Pitfall-1 fallback.

The ORDER BY (src/data/catalog.ts lines ~332–336) is UNCHANGED and continues to reference the SAME popularity expression `(ownersCount + 0.5 * wishlistCount)` wrapped in `desc(sql\`...\`)`.

`tests/data/searchCatalogWatches.test.ts` currently has these substring assertions inside Test 3+4 ("WHERE includes score-zero exclusion + ILIKE OR ..."):

  expect(json).toContain('owners_count')    // <-- WILL FAIL after the fix
  expect(json).toContain('wishlist_count')  // <-- WILL FAIL after the fix

Those two `.toContain` calls and the test name/comment referring to "score-zero exclusion" MUST be updated. The ILIKE-OR substring assertions (brand_normalized / model_normalized / reference_normalized + the 3+ ilike-operator chunks) MUST remain — they are still load-bearing.

Test 2 ("orderBy uses popularity-DESC + alphabetical tie-break") remains GREEN as-is: the popularity expression is unchanged in ORDER BY, so the existing `.toContain('owners_count') / .toContain('wishlist_count') / .toContain('0.5')` substring matches against the `cand.orderBy` capture still pass.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Drop score-zero AND-gate from searchCatalogWatches WHERE; update paired test; add zero-popularity coverage test</name>
  <files>
    src/data/catalog.ts,
    tests/data/searchCatalogWatches.test.ts
  </files>
  <behavior>
    - Existing Test 2 (orderBy popularity-DESC + alphabetical tie-break) — UNCHANGED, must remain green (popularity stays in ORDER BY).
    - Existing Test 3+4 — MODIFY in place: rename to drop "score-zero exclusion" framing (e.g. "Test 3+4: WHERE is ILIKE OR across 3 normalized cols (D-01, D-02)"); REMOVE the two `.toContain('owners_count')` / `.toContain('wishlist_count')` assertions and the "Score-zero exclusion (Phase 18 idiom)" comment line; KEEP the brand_normalized / model_normalized / reference_normalized substring assertions and the `ilikeOpMatches.length >= 3` regex check.
    - Existing Test 5 / 5b / 6 / 7 / 8 / 8b / 8c / 9 / 9b / 10 / 11 — UNCHANGED, must remain green.
    - NEW test (append at end of `describe` block): "Test 12 (hotfix 260513-hvu): zero-popularity name-match rows ARE returned by ILIKE — pre-fix the score-zero AND-gate excluded them".
      - `candidateRows` ships ONE row with `ownersCount: 0, wishlistCount: 0` (e.g. `{ id: 'cseed', brand: 'Omega', model: 'Speedmaster', reference: '311.30.42.30.01.005', imageUrl: null, ownersCount: 0, wishlistCount: 0 }`).
      - `stateRows = []`.
      - Call `searchCatalogWatches({ q: 'omega', viewerId: VIEWER })`.
      - Assert `out.length === 1`, `out[0].catalogId === 'cseed'`, `out[0].ownersCount === 0`, `out[0].wishlistCount === 0`, `out[0].viewerState === null`.
      - Additionally assert the WHERE capture does NOT contain the score-zero substring: capture `cand.where` args with `safeStringify`; verify the captured JSON does NOT contain the literal substring `"0.5"` (the score-zero predicate's `0.5 *` coefficient leaked into the WHERE bind; ORDER BY captures hit `cand.orderBy`, not `cand.where`, so this is a clean negative assertion against the post-fix WHERE bind).
  </behavior>
  <action>
    Edit `src/data/catalog.ts` `searchCatalogWatches` (around lines 318–331):

    1. Remove the `and(...)` wrapper from `.where(...)` so the WHERE clause is just the existing `or(...)` of three ILIKE branches (preserving the `refPattern ? ilike(watchesCatalog.referenceNormalized, refPattern) : sql\`false\`` Pitfall-1 fallback verbatim).
    2. Delete the `sql\`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0\`` line AND the "Score-zero exclusion: matches Phase 18 trending idiom" comment immediately above it.
    3. Replace the deleted comment with a 2–3 line comment block above the new `.where(or(...))` explaining: "260513-hvu hotfix: score-zero predicate moved OUT of WHERE. The Phase 18 trending idiom AND-gated name-match by popularity, which excluded seeded catalog rows whose pg_cron-maintained owners_count/wishlist_count are still 0. ORDER BY (below) preserves the identical popularity expression so popular rows still rank ahead." Reference quick id `260513-hvu` and ROOT (Phase 39b-01 bootstrap shipped 0/0 counter rows).
    4. Leave `.orderBy(...)` UNCHANGED. Leave the candidate `.limit(SEARCH_WATCHES_CANDIDATE_CAP)` cap UNCHANGED. Leave the post-fetch slice + state-hydration block UNCHANGED. Do NOT touch `getTrendingCatalogWatches` or any other DAL in the file. Do NOT touch any code in `src/data/discovery.ts`, `src/data/hierarchy.ts`, or any pg_cron / scheduled-job logic.

    Then edit `tests/data/searchCatalogWatches.test.ts`:

    5. In the existing Test 3+4 block (around line 129): drop the test-name fragment "score-zero exclusion +" so the name reflects the new WHERE shape; drop the "Score-zero exclusion (Phase 18 idiom)" comment; drop the two `.toContain('owners_count')` and `.toContain('wishlist_count')` lines. Keep the brand_normalized / model_normalized / reference_normalized assertions and the ilike-operator-chunk count check. The D-XX decision-ID references in the test name may be kept (the WHERE is still load-bearing for D-01 ILIKE shape).
    6. Append the NEW "Test 12 (hotfix 260513-hvu): zero-popularity name-match rows ARE returned" `it(...)` block at the end of the existing `describe` per the behavior section above.

    Do NOT add a new test file; extend the existing one. Do NOT modify any other test file. Do NOT change the chainable-mock setup (`makeCandidateChain` / `makeStateChain` / `vi.mock('@/db', ...)`) — Test 12 reuses them as-is.
  </action>
  <verify>
    <automated>npx vitest run tests/data/searchCatalogWatches.test.ts</automated>
  </verify>
  <done>
    - `src/data/catalog.ts`: `grep -c "(${watchesCatalog.ownersCount} + 0.5 \* ${watchesCatalog.wishlistCount}) > 0" src/data/catalog.ts` returns `0` (predicate gone from file entirely; the trending DAL `getTrendingCatalogWatches` uses its own separate constant so this scoped substring should be uniquely the `searchCatalogWatches` one — confirm with `grep -n "0.5 \* " src/data/catalog.ts | grep -v "ownersCount.*+ 0.5"` if needed).
    - `src/data/catalog.ts`: the `.orderBy(...)` block for `searchCatalogWatches` still contains the popularity expression — verify by reading lines around 332–336 post-edit OR `grep -A6 "searchCatalogWatches" src/data/catalog.ts | grep -c "ownersCount.*0.5.*wishlistCount"` returns `>= 1`.
    - `npx vitest run tests/data/searchCatalogWatches.test.ts` exits 0 with all tests green, including the new Test 12.
    - `npm run build` exits 0 (Next 16 server/client boundary regression guard).
    - No edits to `getTrendingCatalogWatches` (grep diff window: the function body between its definition and `searchCatalogWatches` is byte-identical pre/post; `git diff src/data/catalog.ts` shows ONLY the WHERE-clause delta inside `searchCatalogWatches`).
  </done>
</task>

</tasks>

<verification>
1. Unit gate: `npx vitest run tests/data/searchCatalogWatches.test.ts` — all tests pass including the new Test 12.
2. Full suite sanity: `npx vitest run tests/data/searchCatalogWatches.test.ts tests/data/getTrendingCatalogWatches.test.ts` — confirms no spillover into the trending DAL contract (the trending tests must remain green to prove `getTrendingCatalogWatches` was untouched).
3. Build gate: `npm run build` exits 0.
4. Behavioral spot-check (manual, optional): with dev server pointed at prod or a DB containing zero-popularity seeded rows, run `curl 'http://localhost:3000/search?q=omega'` and confirm the Watches tab payload includes Omega catalog rows. NOT required for plan close — the new Test 12 mock-asserts the same invariant deterministically.
5. Negative regression: `git diff src/data/catalog.ts` shows ONLY the WHERE-clause delta in `searchCatalogWatches` (no edits to `getTrendingCatalogWatches`, no edits to other DALs in the file).
</verification>

<success_criteria>
- [ ] `src/data/catalog.ts` `searchCatalogWatches` WHERE clause no longer contains `(ownersCount + 0.5 * wishlistCount) > 0`.
- [ ] `src/data/catalog.ts` `searchCatalogWatches` ORDER BY still contains the identical popularity expression.
- [ ] 2–3 line comment at the new WHERE clause documents the move (references quick id `260513-hvu` and the Phase 39b-01 bootstrap context).
- [ ] `tests/data/searchCatalogWatches.test.ts` Test 3+4 no longer asserts `owners_count` / `wishlist_count` substrings inside the WHERE capture.
- [ ] `tests/data/searchCatalogWatches.test.ts` ships a new Test 12 proving a zero-popularity name-match row IS returned.
- [ ] All other existing tests in `searchCatalogWatches.test.ts` remain green (Tests 1, 1b, 2, 5, 5b, 6, 7, 8, 8b, 8c, 9, 9b, 10, 11).
- [ ] `getTrendingCatalogWatches` is byte-identical pre/post (no edits leaked into the empty-query browse path).
- [ ] `npm run build` exits 0.
- [ ] `pg_cron` daily counter-refresh logic is UNTOUCHED.
</success_criteria>

<output>
After completion, create `.planning/quick/260513-hvu-hotfix-search-watches-tab-returns-empty-/260513-hvu-SUMMARY.md` documenting:
- The exact lines changed in `src/data/catalog.ts` (WHERE clause delta + comment).
- The test update (Test 3+4 trim + new Test 12).
- Confirmation that `getTrendingCatalogWatches` was not modified.
- Confirmation that `pg_cron` logic was not modified.
- Any deviations (none expected).
- Behavioral spot-check result if performed (optional).
</output>
