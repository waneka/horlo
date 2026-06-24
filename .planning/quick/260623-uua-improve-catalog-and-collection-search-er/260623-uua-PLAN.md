---
id: 260623-uua
slug: improve-catalog-and-collection-search-er
type: quick
parent: null
depends_on: []
wave: 1
files_modified:
  - supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql
  - src/data/catalog.ts
  - src/data/search.ts
  - tests/data/searchCatalogWatches.test.ts
  - tests/data/searchCollections.test.ts
autonomous: false
must_haves:
  truths:
    - "Searching 'omega seamaster' in /search Watches tab returns ≥1 row whose brand is Omega and model contains Seamaster (D-01 multi-token AND-of-ORs)"
    - "Searching 'Heron' (no accent) in /search Watches tab returns ≥1 row whose brand is 'Héron Watches' (D-02 unaccent fold)"
    - "Searching 'Jaeger la' in /search Watches tab returns ≥1 Jaeger-LeCoultre row (D-01 token-wise match: 'jaeger' AND 'la' each substring of 'jaeger-lecoultre')"
    - "Searching 'Jeager' (typo) in /search Watches tab returns ≥1 Jaeger-LeCoultre row via pg_trgm similarity fallback (D-04 fuzzy tier triggered on zero strict hits + len≥3)"
    - "Existing facet predicates (movement / size / style / brand / era) AND-compose correctly with tokenized text search in searchCatalogWatches (D-05)"
    - "searchCollections preserves two-layer privacy (profile_public + collection_public), viewer self-exclusion, match_path 'name' vs 'tag' classification, and matched_tags aggregation after token+unaccent rewrite (D-06)"
    - "Migration is additive — CREATE EXTENSION + CREATE INDEX CONCURRENTLY only; no ALTER TABLE on watches_catalog columns (D-03, D-10)"
  artifacts:
    - path: "supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql"
      provides: "CREATE EXTENSION unaccent + pg_trgm; functional gin trigram indexes on lower(unaccent(brand|model)) for watches_catalog and watches"
      contains: "CREATE EXTENSION IF NOT EXISTS unaccent"
    - path: "src/data/catalog.ts"
      provides: "Rewired searchCatalogWatches with token+unaccent ILIKE + pg_trgm fuzzy fallback tier"
      contains: "searchCatalogWatches"
    - path: "src/data/search.ts"
      provides: "Rewired searchCollections with token+unaccent ILIKE (no fuzzy fallback per D-07)"
      contains: "searchCollections"
  key_links:
    - from: "src/data/catalog.ts (searchCatalogWatches text predicate)"
      to: "supabase migration unaccent extension + trgm index"
      via: "lower(unaccent(brand_normalized)) ILIKE lower(unaccent($1)) per token; similarity() in fallback CTE"
      pattern: "lower\\(unaccent"
    - from: "src/data/search.ts (searchCollections CTE WHERE)"
      to: "watches.brand / watches.model / unnest(style_tags||role_tags||complications)"
      via: "per-token AND-of-ORs with lower(unaccent(...)) wrapper preserving CTE shape and GROUP BY"
      pattern: "lower\\(unaccent"
---

<objective>
Make /search results forgiving of multi-token brand+model queries, diacritics, and hyphen/punctuation breaks so users don't have to type queries exactly the way the catalog stores them.

User report (verbatim): "search requires the user to be exactly perfect in their query, i want search to be more powerful. for example 'Jeager la' doesn't return anything because it's a dash 'jaeger-la'. searching brand and model doesn't return any results, example: 'omega' --> results. 'seamaster' --> results. 'omega seamaster' --> no results. 'heron' --> no results. 'Héron' --> results."

Three concrete read-path failures, all rooted in the single-pattern ILIKE in searchCatalogWatches (catalog.ts L309-516) and searchCollections (search.ts L205-294):

1. **Multi-token** — `brand_normalized ILIKE '%omega seamaster%'` never matches because brand_normalized is just 'omega' on its row; model is 'seamaster' on a different row.
2. **Diacritics** — `brand_normalized ILIKE '%heron%'` misses 'héron watches' (ILIKE is case-insensitive but not diacritic-folding).
3. **Hyphens/punctuation/typos** — `'jaeger la'` doesn't substring-match `'jaeger-lecoultre'` (hyphen breaks the substring). `'Jeager'` (transposed e/a) also misses cleanly.

Scope is read-path only. Out of scope per task brief: brand_id rewiring, ingest path, brand-picker UI, mutating existing catalog rows.

Purpose: Solve the user-facing frustration of "search is too strict" without expanding scope into the SEED-021 canonicalization work.

Output:
- One additive migration (extensions + functional trigram indexes)
- Rewired searchCatalogWatches (catalog.ts) with tokenized AND-of-ORs + unaccent + pg_trgm fuzzy fallback tier
- Rewired searchCollections (search.ts) with tokenized AND-of-ORs + unaccent (no fuzzy fallback per D-07)
- Extended unit tests + manual UAT walkthrough
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md

# Reference implementation (already does multi-token AND-of-ORs per Phase 72 SRCH-01)
@src/data/catalog.ts

# Search path to fix #2 — privacy-gated CTE
@src/data/search.ts

# Existing tests (must continue to pass; extend with new behavior tests)
@tests/data/searchCatalogWatches.test.ts
@tests/data/searchCollections.test.ts

# Schema reference — watches_catalog has GENERATED brand_normalized/model_normalized/reference_normalized;
# watches table has plain brand/model text columns
@src/db/schema.ts

# Durable memories the executor MUST honor:
# - project_drizzle_supabase_db_mismatch.md — supabase/migrations filename convention; supabase db push --linked for prod
# - project_db_wipeable_2026_05_09.md — watches_catalog is NOT wipeable; in-place additive migration only
# - project_drizzle_sql_any_array_pitfall.md — DAL test mocks don't execute SQL; verify SQL shape against local Supabase
# - project_local_catalog_natural_key_drift.md — local catalog can silently drift; re-seed via supabase/seed.sql + scripts/import-prod-catalog.sh if natural-key dupes appear
# - feedback_local_first_dev.md — mandatory dev-server verification before commit/push

<interfaces>
<!-- Key contracts the executor needs. Extracted from src/data/catalog.ts, src/data/search.ts, src/db/schema.ts. -->

From src/data/catalog.ts (L264-271):
```
const SEARCH_WATCHES_TRIM_MIN_LEN = 2
const SEARCH_WATCHES_CANDIDATE_CAP = 50
const SEARCH_WATCHES_DEFAULT_LIMIT = 20

const SEARCH_ADD_FLOW_TRIM_MIN_LEN = 2
const SEARCH_ADD_FLOW_CANDIDATE_CAP = 50
const SEARCH_ADD_FLOW_DEFAULT_LIMIT = 20
```

From src/data/catalog.ts (the reference implementation to mirror — searchCatalogForAddFlow L554-665) — its tokenization, per-token AND-of-ORs, refToken normalization, and `sql\`false\`` pitfall guards are the exact pattern to copy into searchCatalogWatches.

From src/db/schema.ts (L451-459):
```
brandNormalized: text('brand_normalized').generatedAlwaysAs(sql`lower(trim(brand))`),
modelNormalized: text('model_normalized').generatedAlwaysAs(sql`lower(trim(model))`),
referenceNormalized: text('reference_normalized').generatedAlwaysAs(
  sql`CASE WHEN reference IS NULL THEN NULL ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g') END`,
),
```
Note: brand_normalized + model_normalized are already lower(trim), but NOT unaccent-folded. Reference_normalized already strips non-alphanumerics (subsumes diacritics for ref).

From src/data/search.ts (L205-294): searchCollections is a `db.execute<...>(sql\`WITH matched AS (...) SELECT ... FROM profiles p JOIN matched m ... GROUP BY ... LIMIT ${SEARCH_COLLECTIONS_CANDIDATE_CAP}\`)`. The WHERE inside the CTE is the only thing changing; the CTE shape, GROUP BY, jsonb_agg of matched_watches, and matched_tags array_agg must be preserved verbatim.

From src/data/search.ts (L180-182):
```
const SEARCH_COLLECTIONS_TRIM_MIN_LEN = 2
const SEARCH_COLLECTIONS_CANDIDATE_CAP = 50
const SEARCH_COLLECTIONS_DEFAULT_LIMIT = 20
```

From supabase/migrations/ — most recent filename is `20260623000000_phase77_storage_rls_poster_filename.sql`. New migration MUST sort after it; use timestamp `20260623200000` (D-11).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add additive migration (unaccent + pg_trgm extensions + functional trigram indexes)</name>
  <files>supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql</files>
  <action>
    Create the migration file at the exact path above. Filename timestamp MUST be `20260623200000` so it sorts after the most recent migration (`20260623000000_phase77_storage_rls_poster_filename.sql`) per D-11 / `project_drizzle_supabase_db_mismatch`. Migration is purely additive per D-03/D-10 (`project_db_wipeable_2026_05_09` — watches_catalog is NOT wipeable; no ALTER TABLE on existing columns, no GENERATED column additions, no NOT NULL changes).

    Contents in this exact order:
    1. Header comment block referencing the quick task id `260623-uua` and citing D-02, D-03, D-04, D-10, D-11 from this plan.
    2. `CREATE EXTENSION IF NOT EXISTS unaccent;` — Supabase first-party extension; idempotent.
    3. `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — Supabase first-party extension; idempotent.
    4. Two functional gin trigram indexes on `watches_catalog` (per D-03 — index the fold expression so ILIKE on `lower(unaccent(col))` and `similarity(lower(unaccent(col)), q)` both use the index):
       - `CREATE INDEX IF NOT EXISTS watches_catalog_brand_unaccent_trgm_idx ON watches_catalog USING gin (lower(unaccent(brand)) gin_trgm_ops);`
       - `CREATE INDEX IF NOT EXISTS watches_catalog_model_unaccent_trgm_idx ON watches_catalog USING gin (lower(unaccent(model)) gin_trgm_ops);`
       Note on CONCURRENTLY: D-10 originally favored CONCURRENTLY for prod safety, but `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block and Supabase migrations execute in a transaction by default. Use plain `CREATE INDEX IF NOT EXISTS` here — catalog row counts are small (~205 local, similar order prod) so the lock is sub-second and acceptable. Document this tradeoff in the migration header comment so the next reader does not re-litigate it.
    5. Two functional gin trigram indexes on `watches` (user-side, wipeable, but same pattern for consistency):
       - `CREATE INDEX IF NOT EXISTS watches_brand_unaccent_trgm_idx ON watches USING gin (lower(unaccent(brand)) gin_trgm_ops);`
       - `CREATE INDEX IF NOT EXISTS watches_model_unaccent_trgm_idx ON watches USING gin (lower(unaccent(model)) gin_trgm_ops);`
    6. A post-flight `DO $$ BEGIN ASSERT (SELECT extname FROM pg_extension WHERE extname = 'unaccent') IS NOT NULL; ASSERT (SELECT extname FROM pg_extension WHERE extname = 'pg_trgm') IS NOT NULL; END $$;` block — verify the extensions are present. Per `project_post_flight_assertion_predicate_divergence`, phrase assertions broadly (extension presence) rather than mirroring the index DDL.

    Important: `unaccent()` is marked STABLE by default and is therefore NOT usable in a functional index expression unless wrapped or re-marked IMMUTABLE. The standard Postgres workaround is to either (a) create a wrapper SQL function declared IMMUTABLE that calls `unaccent('unaccent', $1)` with the explicit dictionary name, or (b) use the public.unaccent overload that takes a regdictionary + text. Choose option (a): emit a `CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT public.unaccent('public.unaccent', $1) $$;` and use `lower(public.f_unaccent(brand))` in every index expression AND in every DAL query expression (Tasks 2 + 3). This is the well-known idiom; if the executor finds local Postgres rejects the immutable assertion, fall back to materializing the fold as a stored value via a BEFORE INSERT/UPDATE trigger (last resort — adds write-path coupling, prefer the immutable wrapper).

    DO NOT modify src/db/schema.ts — drizzle-kit cannot express extensions or functional indexes (D-12). The schema stays in sync without changes.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; npx supabase db reset 2>&amp;1 | tail -40 &amp;&amp; psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT extname FROM pg_extension WHERE extname IN ('unaccent','pg_trgm');" -c "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%unaccent_trgm_idx';"</automated>
  </verify>
  <done>
    Migration file exists at the exact path. `supabase db reset` applies cleanly (exits 0, no errors). Both extensions show in pg_extension. All 4 functional indexes show in pg_indexes. `public.f_unaccent` function exists and is IMMUTABLE (verified via `\df+ public.f_unaccent` showing volatility=immutable). No `npm run build` regression.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewire searchCatalogWatches with token+unaccent ILIKE + pg_trgm fuzzy fallback tier</name>
  <files>src/data/catalog.ts, tests/data/searchCatalogWatches.test.ts</files>
  <behavior>
    - Test: multi-token query 'omega seamaster' produces AND-of-ORs SQL with 2 token-clauses (verify spy mock call structure or generated SQL inspection)
    - Test: query 'Héron' and 'Heron' produce identical generated SQL after unaccent fold (assert lower(f_unaccent(...)) appears in the where-fragment string for both)
    - Test: query 'jaeger la' (length 8, 2 tokens) executes 2 token-clauses, each token ILIKE'd via lower(f_unaccent(brand_normalized)) (NOT raw brand_normalized)
    - Test: empty / whitespace-only query short-circuits to [] (existing behavior preserved)
    - Test: facets-only (no q) still runs (existing Phase 40 D-01 behavior preserved — hasActiveFacet branch)
    - Test: pg_trgm fallback tier executes only when strict-tier returns 0 rows AND trimmed.length >= 3 (D-04); for trimmed.length < 3 fallback is skipped
    - Test: existing tests (multi-row owned-wins-over-wishlist, facet AND-composition, brand-slug unresolved → []) continue to pass
  </behavior>
  <action>
    Replace the text-predicate block inside searchCatalogWatches (catalog.ts L407-422, the `predicates.push(or(ilike(...), ilike(...), ...))` chunk) with the same tokenized AND-of-ORs structure used by searchCatalogForAddFlow at L587-598. Key differences from the add-flow path:

    1. **Preserve `hasActiveFacet` early-return guard** at L361 — when trimmed.length < 2 AND no facets, return []. UNCHANGED.
    2. **Preserve `resolvedBrandId` block** at L376-385 (Phase 46 WR-04 brand-slug resolution). UNCHANGED.
    3. **Replace** the L411-422 `if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) { predicates.push(or(...)) }` block with:
       - Tokenize: `const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean)` (mirror L567)
       - Per-token AND-of-ORs, wrapping each column in the f_unaccent fold (D-02):
         - For each token, build `or(sql\`lower(public.f_unaccent(${watchesCatalog.brandNormalized})) ILIKE lower(public.f_unaccent(${tokenPattern}))\`, sql\`lower(public.f_unaccent(${watchesCatalog.modelNormalized})) ILIKE lower(public.f_unaccent(${tokenPattern}))\`, refToken.length > 0 ? ilike(watchesCatalog.referenceNormalized, refTokenPattern) : sql\`false\`)`. Note: reference_normalized already strips non-alphanumerics including diacritics — D-02 — so the reference branch does NOT need the f_unaccent wrapper.
         - `tokenPattern = \`%\${token}%\``; `refToken = token.replace(/[^a-z0-9]+/g, '')`; `refTokenPattern = \`%\${refToken}%\``.
       - Push the resulting `and(...tokenClauses)` to the predicates array (alongside the existing facet predicates, which keep working unchanged per D-05).
    4. **Add pg_trgm fuzzy fallback tier (D-04)** AFTER the candidates query completes but BEFORE the `if (candidates.length === 0) return []` short-circuit at L471. The fallback only fires when ALL of:
       - `candidates.length === 0` (strict tier produced nothing)
       - `trimmed.length >= 3` (D-04: avoid noise on 2-char queries)
       - `tokens.length > 0` (defensive)
       Build a second SELECT against watchesCatalog using the SAME column projection, with a WHERE expressed as: `sql\`similarity(lower(public.f_unaccent(${watchesCatalog.brand})), lower(public.f_unaccent(${lowerQ}))) > 0.3 OR similarity(lower(public.f_unaccent(${watchesCatalog.model})), lower(public.f_unaccent(${lowerQ}))) > 0.3\`` — using the WHOLE query (not per-token) for the similarity score so 'Jeager' matches 'Jaeger' as a single fuzzy unit. AND-compose with the same facet predicates (resolvedBrandId, movement, size, style, era) so facet narrowing still applies to fuzzy hits. ORDER BY `desc(sql\`GREATEST(similarity(lower(public.f_unaccent(${watchesCatalog.brand})), lower(public.f_unaccent(${lowerQ}))), similarity(lower(public.f_unaccent(${watchesCatalog.model})), lower(public.f_unaccent(${lowerQ}))))\`)` then the existing popularity/alpha tiers. Limit to `SEARCH_WATCHES_CANDIDATE_CAP`. Reassign `candidates = fallbackCandidates` for downstream viewer-state hydration.

       Important: D-04 says strict matches rank ABOVE fuzzy matches — that's automatically true here because fuzzy is only consulted when strict returns 0. (We do NOT union strict + fuzzy results; we substitute fuzzy when strict is empty.)
    5. **Update the doc comment block** (catalog.ts L308-336) to describe the new behavior:
       - D-01 tokenization, D-02 unaccent fold, D-04 fuzzy fallback tier
       - Reference Phase 67 / searchCatalogForAddFlow as prior art for the tokenization pattern
       - Cite the quick task id `260623-uua`
       - PRESERVE the existing Pitfall 1 (reference normalization), Pitfall 4 (empty inArray), and T-19-01-01 parameterization notes — they still apply.
    6. **Viewer-state hydration block** (L477-490) is UNCHANGED — same `inArray(watches.catalogId, topIds)` pattern, same 'owned' wins over 'wishlist' resolution, same return shape.

    Per `project_drizzle_sql_any_array_pitfall` and CLAUDE.md `## Local-First Development`: the DAL test mock does NOT execute SQL — Task 5 manual UAT against local Supabase is the authoritative correctness gate. Tests in this task assert generated SQL shape (via mock spy / `db._dialect.sqlToQuery(...)` inspection if available) and code-path branching, not row-count.

    Extend tests/data/searchCatalogWatches.test.ts (DO NOT rewrite — append new describe blocks):
    - `describe('260623-uua tokenization')` — 3-5 tests per <behavior> block above
    - `describe('260623-uua unaccent fold')` — assert lower(public.f_unaccent appears in generated SQL for both 'Héron' and 'Heron' queries
    - `describe('260623-uua pg_trgm fallback tier')` — assert the fallback query fires when strict mock returns []; assert it does NOT fire when trimmed.length < 3
    - Existing tests must continue to pass unchanged.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; npm run test -- tests/data/searchCatalogWatches.test.ts --run 2>&amp;1 | tail -40 &amp;&amp; npm run build 2>&amp;1 | tail -15</automated>
  </verify>
  <done>
    All existing tests in searchCatalogWatches.test.ts pass. New 260623-uua describe blocks pass. `npm run build` exits 0 (per `project_baseline_not_green_build_is_gate` — build is THE gate). No new pre-existing test failures introduced. searchCatalogForAddFlow is UNCHANGED (it already implements the pattern). The function exports the same signature.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Rewire searchCollections CTE WHERE with token+unaccent ILIKE (no fuzzy fallback per D-07)</name>
  <files>src/data/search.ts, tests/data/searchCollections.test.ts</files>
  <behavior>
    - Test: multi-token query against searchCollections produces a CTE whose WHERE contains N AND-grouped OR-blocks (one per token)
    - Test: 'Héron' and 'Heron' produce identical generated SQL after unaccent fold
    - Test: privacy gates `ps.profile_public = true AND ps.collection_public = true AND p.id != viewerId` are PRESERVED VERBATIM (D-06)
    - Test: match_path CASE expression for 'name' vs 'tag' is rewritten to use the token+unaccent predicate but still produces the same two categorical values
    - Test: matched_tag_elements `ARRAY(SELECT t FROM unnest(...) WHERE t ILIKE ...)` is rewritten to use unaccent + AND-of-ORs and still produces an array of matched tag strings
    - Test: existing tests (privacy gating, viewer self-exclusion, match_count + tasteOverlap sort) continue to pass
  </behavior>
  <action>
    Modify ONLY the CTE WHERE block + the match_path CASE + the matched_tag_elements subquery inside the `db.execute<...>(sql\`WITH matched AS (...)\`)` template at search.ts L222-294. The CTE shape, the outer SELECT, the jsonb_agg of matched_watches, the GROUP BY, the ORDER BY, the LIMIT, and the JS post-sort (lines after L294) are ALL UNCHANGED per D-06.

    Per D-07 (NO fuzzy fallback in searchCollections — its CTE shape + JS overlap scoring is more complex; user's failing examples are all catalog-side):

    1. Tokenize at the top: `const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean)`. If `tokens.length === 0` return []. The existing trimmed.length < 2 early-return at L215 stays.
    2. Drop the single `const pattern = \`%${trimmed}%\`` at L217. Replace with per-token pattern bind values. Construct each token's `colPattern` and `tagPattern` (the same — `%${token}%`) in TypeScript before the sql template.
    3. Rewrite the CTE WHERE (L257-267) as: AND-composition over N token-OR-groups. Each token's OR-group has 5 branches mirroring the original:
       - `lower(public.f_unaccent(w.brand)) ILIKE lower(public.f_unaccent(${tokenPattern}))`
       - `lower(public.f_unaccent(w.model)) ILIKE lower(public.f_unaccent(${tokenPattern}))`
       - `EXISTS (SELECT 1 FROM unnest(w.style_tags) t WHERE lower(public.f_unaccent(t)) ILIKE lower(public.f_unaccent(${tokenPattern})))`
       - `EXISTS (SELECT 1 FROM unnest(w.role_tags) t WHERE lower(public.f_unaccent(t)) ILIKE lower(public.f_unaccent(${tokenPattern})))`
       - `EXISTS (SELECT 1 FROM unnest(w.complications) t WHERE lower(public.f_unaccent(t)) ILIKE lower(public.f_unaccent(${tokenPattern})))`
       Build this in TS by joining N `sql\`(...)\`` fragments with ` AND ` via `sql.join([...], sql\` AND \`)` (mirroring the `project_drizzle_sql_any_array_pitfall` correct-IN-clause pattern — sql.join is the safe primitive for emitting list-shaped SQL with parameterized binds).
    4. Rewrite the match_path CASE (L245-249) to: `CASE WHEN lower(public.f_unaccent(w.brand)) ILIKE ANY(ARRAY[...patterns...]) OR lower(public.f_unaccent(w.model)) ILIKE ANY(ARRAY[...patterns...]) THEN 'name' ELSE 'tag' END`. Or equivalently rebuild the same N-token AND-of-ORs over JUST brand|model and emit 'name' if it's satisfied, 'tag' otherwise. Pick whichever is cleaner; the OUTPUT must remain the categorical 'name' | 'tag' string. CAUTION: `ANY(ARRAY[...])` with Drizzle template binds — emit the pattern array literal as `ARRAY[${sql.join(patterns.map(p => sql\`${p}\`), sql\`, \`)}]::text[]` to ensure each pattern is a parameterized bind, not concatenated text (T-19-01-02 mitigation; this is the exact incident pattern from `project_drizzle_sql_any_array_pitfall`).
    5. Rewrite the matched_tag_elements subquery (L250-253) to: `ARRAY(SELECT t FROM unnest(w.style_tags || w.role_tags || w.complications) t WHERE lower(public.f_unaccent(t)) ILIKE ANY(ARRAY[...patterns...]))`. Same ANY(ARRAY[...]) pattern as #4 with the same parameterization caution. A tag now matches if it hits ANY token (OR), not requires ALL — this matches user expectation ("seamaster" in matched_tags when query is "omega seamaster"; we don't need every tag to match every token).
    6. Update the doc comment (search.ts L184-204) — describe the tokenized + unaccent behavior, cite D-01/D-02/D-06/D-07, cite quick task id `260623-uua`, preserve the SRCH-11/SRCH-12 + D-09..D-12/D-16 citations.
    7. All viewerId + token interpolations stay as Drizzle template binds — never string-concatenated into SQL text (T-19-01-02). PER `project_drizzle_sql_any_array_pitfall`: any list-of-values emitted in SQL MUST go through `sql.join(arr.map(v => sql\`${v}\`), sql\`, \`)` — NOT `= ANY(${arr})` tagged-template (which emits a ROW literal and crashes with Postgres 42809).

    Per `project_drizzle_sql_any_array_pitfall`: this exact SQL shape MUST be exercised against local Supabase (Task 5) before commit. The DAL test mock won't catch a ROW-literal vs array-literal bug.

    Extend tests/data/searchCollections.test.ts (append, don't rewrite) with the behavior tests above. Existing tests must continue to pass.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; npm run test -- tests/data/searchCollections.test.ts --run 2>&amp;1 | tail -40 &amp;&amp; npm run build 2>&amp;1 | tail -15</automated>
  </verify>
  <done>
    All existing tests pass + new 260623-uua describe blocks pass. `npm run build` exits 0. CTE shape, GROUP BY, jsonb_agg, matched_tags array_agg, ORDER BY, LIMIT, and JS post-sort are UNCHANGED (verified by inspecting the diff — only the WHERE + match_path CASE + matched_tag_elements subquery are modified). Privacy predicate `ps.profile_public = true AND ps.collection_public = true AND p.id != ${viewerId}` appears verbatim in the new SQL.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual UAT against local Supabase — the 4 failing queries</name>
  <what-built>Tokenized + unaccent-folded search across /search Watches tab (catalog) and /search Collections tab, plus pg_trgm fuzzy fallback on the catalog path.</what-built>
  <how-to-verify>
    Per CLAUDE.md `## Local-First Development` (MANDATORY) and `feedback_local_first_dev` memory: prod-push gated on this UAT.

    Pre-conditions:
    1. Local Supabase running on `127.0.0.1:54321/54322` (confirm with `npx supabase status`).
    2. Migration applied (Task 1's `supabase db reset` already did this; if not, run `npx supabase db reset`).
    3. Catalog seeded with realistic data — `supabase/seed.sql` runs automatically on `db reset`; if natural-key drift surfaces (per `project_local_catalog_natural_key_drift`), re-import via `./scripts/import-prod-catalog.sh`.
    4. Start dev server: `npm run dev` (the `.env.development.local` override points at local Supabase per CLAUDE.md).
    5. Sign in as `viewer@horlo.test` (password `password123`).

    Run these 4 queries on /search Watches tab. Each MUST return ≥1 expected row.

    | # | Query | Expected | Tier (strict vs fuzzy) |
    |---|-------|----------|------------------------|
    | 1 | `omega seamaster` | ≥1 Omega Seamaster row | strict (multi-token AND-of-ORs) |
    | 2 | `Heron` (no accent) | ≥1 'Héron Watches' row | strict (unaccent fold) |
    | 3 | `Jaeger la` | ≥1 Jaeger-LeCoultre row | strict (per-token: 'jaeger' AND 'la' each substring) |
    | 4 | `Jeager` (typo, transposed e/a) | ≥1 Jaeger-LeCoultre row | fuzzy fallback (pg_trgm similarity ≥ 0.3) |

    Additional smoke checks to confirm no regression:
    - 5. `omega` alone — must still return Omega rows (baseline single-token preserved)
    - 6. `seamaster` alone — must still return Seamaster rows (baseline single-token preserved)
    - 7. Apply movement=auto facet + query `submariner` — facet AND-composes with text predicate (D-05 preserved)
    - 8. Empty query with movement=auto facet selected — browse-mode (Phase 40 D-01) still works
    - 9. 1-character query `o` — returns [] (SEARCH_WATCHES_TRIM_MIN_LEN guard preserved)

    Then switch to /search Collections tab. Sign in as `viewer@horlo.test`, then sign out and in as `vintage-anna@horlo.test` (so there's a non-viewer profile to find). Repeat queries 1-3 above on the Collections tab.
    - 10. `omega seamaster` — must return collectors who own an Omega Seamaster (token+unaccent path)
    - 11. `Heron` (no accent) — must return collectors who own a 'Héron Watches' (unaccent path)
    - 12. Viewer self-exclusion: searching as `viewer@horlo.test`, results must NOT include viewer's own profile (D-06 privacy preserved)
    - 13. Private collection check: confirm a collector with `collection_public=false` does NOT surface (two-layer privacy preserved)

    Resume-signal acceptance: queries 1-9 (catalog) AND 10-13 (collections) ALL pass.

    If ANY query fails:
    - For 1/2/3/10/11 (strict path): debug the token+unaccent SQL — log the generated SQL via Drizzle's query logger and inspect by hand. Check `public.f_unaccent('Héron')` returns 'Heron' at the psql prompt; check `lower(public.f_unaccent('Jaeger-LeCoultre')) ILIKE '%jaeger%' AND lower(public.f_unaccent('Jaeger-LeCoultre')) ILIKE '%la%'` returns true.
    - For 4 (fuzzy): check `SELECT similarity(lower(public.f_unaccent('jaeger-lecoultre')), lower(public.f_unaccent('jeager')));` at the psql prompt — must be > 0.3. If not, the strict tier already returned something (fallback didn't fire) OR threshold needs revisiting.
    - For 12/13 (privacy): the privacy WHERE clause was modified — revert that part of search.ts L257-260 to verbatim original.
  </how-to-verify>
  <resume-signal>Type "approved" after all 13 checks pass on local. If any fail, describe the failing query + the actual SQL produced (enable Drizzle query logging).</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Document the quick task summary + push migration to prod</name>
  <files>.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-SUMMARY.md</files>
  <action>
    Write the standard quick-task SUMMARY.md at the exact path above. Contents:
    - Quick task id, description, files modified, commit shas
    - Migration filename: `20260623200000_quick_260623_uua_search_unaccent_trgm.sql`
    - One-paragraph "Durable lesson" if anything new surfaced during execution (e.g., unaccent immutability workaround variant chosen; pg_trgm threshold tuning observations). If nothing new, write "No new durable lesson — applied known patterns (Phase 72 SRCH-01 tokenization, Phase 67 add-flow reference impl)."
    - UAT result table (the 13 checks above with pass/fail)
    - Operator action item: "Run `supabase db push --linked` to apply the migration to prod" per `project_drizzle_supabase_db_mismatch` (drizzle-kit push is LOCAL ONLY).

    The actual `supabase db push --linked` invocation is an OPERATOR action, not Claude's — per Horlo's pattern (CLAUDE.md ## Local-First Development, `project_drizzle_supabase_db_mismatch`). Surface it clearly in the SUMMARY but do NOT execute it from this task. Do not commit either — the user runs the commit step.
  </action>
  <verify>
    <automated>test -f /Users/tylerwaneka/Documents/horlo/.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-SUMMARY.md &amp;&amp; grep -q "20260623200000_quick_260623_uua_search_unaccent_trgm.sql" /Users/tylerwaneka/Documents/horlo/.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-SUMMARY.md &amp;&amp; grep -q "supabase db push --linked" /Users/tylerwaneka/Documents/horlo/.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-SUMMARY.md</automated>
  </verify>
  <done>
    SUMMARY.md exists at the exact path. Contains the migration filename, the 13-row UAT results table, the operator action item, and a durable-lesson note. No git commit (operator runs that step).
  </done>
</task>

</tasks>

<verification>
- Migration applies cleanly via `npx supabase db reset` (extensions present + 4 functional indexes + f_unaccent IMMUTABLE function)
- `npm run build` exits 0 (per `project_baseline_not_green_build_is_gate` — build is THE gate)
- Existing tests in searchCatalogWatches.test.ts + searchCollections.test.ts continue to pass
- New 260623-uua describe blocks pass in both test files
- All 13 UAT queries pass against local Supabase (catalog 1-9 + collections 10-13)
- searchCatalogForAddFlow at catalog.ts L554+ is UNCHANGED (it already implements the pattern; do not touch)
- No schema.ts changes (D-12)
- No mutations to existing catalog rows (D-10)
</verification>

<success_criteria>
- User can search 'omega seamaster' and see Omega Seamaster rows in /search Watches tab
- User can search 'Heron' (no accent) and see 'Héron Watches' rows in /search Watches tab
- User can search 'Jaeger la' and see Jaeger-LeCoultre rows in /search Watches tab
- User can search 'Jeager' (typo) and see Jaeger-LeCoultre rows in /search Watches tab via fuzzy fallback
- Multi-token + unaccent search ALSO works in /search Collections tab
- All existing privacy gates and facet predicates continue to work
- Migration deploys to prod via operator-run `supabase db push --linked`
</success_criteria>

<output>
After completion, create `.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-SUMMARY.md` (Task 5 produces this).
</output>
