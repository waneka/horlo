-- Quick task 260623-uua: search-ergonomics — unaccent + pg_trgm + functional trigram indexes
--
-- See `.planning/quick/260623-uua-improve-catalog-and-collection-search-er/260623-uua-PLAN.md`
--
-- Motivation: searchCatalogWatches + searchCollections use plain ILIKE which is
--   (1) not multi-token (a single pattern across brand_normalized misses
--       'omega seamaster' because brand is just 'omega'),
--   (2) not diacritic-folding ('heron' misses 'héron watches'), and
--   (3) brittle on hyphens/typos ('jaeger la' misses 'jaeger-lecoultre';
--       'jeager' misses Jaeger-LeCoultre entirely).
--
--   Tasks 2 + 3 of the quick task rewrite the DAL to tokenize the query,
--   wrap each column ILIKE in lower(public.f_unaccent(...)) for diacritic
--   folding, and fall back to pg_trgm `word_similarity() > 0.2` when the
--   strict tier returns nothing (catalog side only; D-07 keeps Collections
--   strict). `word_similarity` not `similarity` — see memory
--   `project_pg_trgm_word_similarity_for_brand_typos`.
--
--   This migration adds the SQL primitives those rewrites depend on:
--     - the unaccent extension (diacritic folding)
--     - the pg_trgm extension (trigram similarity)
--     - an IMMUTABLE wrapper `public.f_unaccent(text)` so the fold expression
--       is usable in a functional index (unaccent() default volatility is
--       STABLE because the dictionary is mutable; the wrapper pins the
--       'public.unaccent' dictionary by name so the result is deterministic)
--     - 4 functional gin trigram indexes on `lower(public.f_unaccent(col))`
--       for both watches_catalog (brand|model) and watches (brand|model).
--
-- Decisions honored:
--   D-02 — Diacritic folding via unaccent.
--   D-03 — Index the fold expression (functional index on lower(f_unaccent(col))
--          gin_trgm_ops) so the ILIKE-on-fold and similarity()-on-fold paths
--          both hit the index.
--   D-04 — pg_trgm similarity is the fuzzy-fallback engine for the catalog
--          tier (DAL change lives in Task 2 / src/data/catalog.ts).
--   D-10 — Migration is purely ADDITIVE. NO `ALTER TABLE watches_catalog` —
--          watches_catalog is NOT wipeable per `project_db_wipeable_2026_05_09`
--          (v4-v5.1 LLM/factual/photo enrichment is not in any seed); we add
--          extensions + indexes only.
--   D-11 — Filename timestamp `20260623200000` sorts AFTER the most recent
--          migration `20260623000000_phase77_storage_rls_poster_filename.sql`
--          per `project_drizzle_supabase_db_mismatch` filename convention.
--
-- CONCURRENTLY tradeoff: `CREATE INDEX CONCURRENTLY` cannot run inside a
--   transaction block, and Supabase migrations execute in a transaction by
--   default. We use plain `CREATE INDEX IF NOT EXISTS` here — catalog row
--   counts are small (~205 local, similar order prod) so the AccessExclusive
--   lock is sub-second and acceptable. Do not re-litigate this tradeoff
--   without measuring catalog row count first.
--
-- PORTABILITY: the first push of this migration to prod failed because
--   Supabase prod installs pg_trgm into the `extensions` schema (not on the
--   default search_path during a migration), so unqualified `gin_trgm_ops`
--   could not be resolved. Local Supabase, by contrast, has pg_trgm in
--   `public`. The cross-environment-portable pattern is to extend the
--   session search_path to include both schemas and use unqualified names:
--   Postgres resolves `gin_trgm_ops` and `unaccent` to whichever schema has
--   them, and the resolved OIDs are baked into the function/index plans at
--   creation time, so later sessions don't need extensions in search_path.
--   See `project_drizzle_supabase_db_mismatch` memory (extension-schema is
--   one of the 4 prod-push gotchas).

-- 0. Make extensions schema reachable for the rest of this migration.
--    SET LOCAL scopes only to the current transaction (Supabase wraps each
--    migration in BEGIN/COMMIT). Listing `extensions` AFTER `public` keeps
--    the existing project convention that public objects take precedence
--    when both schemas have a name collision.
SET LOCAL search_path = public, extensions;

-- 1. Diacritic-folding extension. Idempotent. WITH SCHEMA extensions matches
--    Supabase guidance (passes advisor lint 0015_extension_in_public) when
--    the extension is being newly installed; if it's already installed
--    elsewhere (e.g., local has it in public), IF NOT EXISTS skips the
--    create and the existing-schema location is left as-is.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- 2. Trigram similarity extension. Idempotent. Same rationale.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 3. IMMUTABLE wrapper around unaccent() so the fold is usable in a functional
--    index. The default unaccent(text) overload is marked STABLE because the
--    dictionary is technically mutable; pinning the dictionary by name with
--    the unaccent(regdictionary, text) overload makes the call deterministic
--    in practice, and an IMMUTABLE label tells Postgres it can be used in an
--    index expression.
--
--    The `unaccent` regdictionary reference is unqualified — Postgres resolves
--    it via the search_path PINNED ON THE FUNCTION (not just the session)
--    via the SET clause below. This matters because INDEX BUILD inlines SQL
--    functions and re-resolves names in the index-build context, which has
--    a DIFFERENT search_path than the user session. Pinning the path on the
--    function itself ensures it finds the dictionary in either `extensions`
--    (Supabase prod) or `public` (local Supabase CLI) regardless of caller.
--    Caught during the first prod-push attempt: session-level SET LOCAL was
--    not enough; index-build re-resolved with default search_path and failed
--    with "text search dictionary 'unaccent' does not exist".
--
--    Standard Postgres workaround documented in the unaccent extension docs.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path = public, extensions, pg_catalog
AS $$
  SELECT unaccent('unaccent'::regdictionary, $1)
$$;

-- 4. Functional gin trigram indexes on watches_catalog. Both ILIKE on the
--    fold AND similarity() / word_similarity() on the fold use these
--    (gin_trgm_ops supports both operator classes).
--
--    `gin_trgm_ops` is unqualified per the search_path strategy above.
CREATE INDEX IF NOT EXISTS watches_catalog_brand_unaccent_trgm_idx
  ON watches_catalog
  USING gin (lower(public.f_unaccent(brand)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS watches_catalog_model_unaccent_trgm_idx
  ON watches_catalog
  USING gin (lower(public.f_unaccent(model)) gin_trgm_ops);

-- 5. Same pattern on watches (user-side, wipeable, kept consistent so the
--    Collections DAL can use the same fold expression in its CTE WHERE).
CREATE INDEX IF NOT EXISTS watches_brand_unaccent_trgm_idx
  ON watches
  USING gin (lower(public.f_unaccent(brand)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS watches_model_unaccent_trgm_idx
  ON watches
  USING gin (lower(public.f_unaccent(model)) gin_trgm_ops);

-- 6. Post-flight assertions. Phrased broadly (extension presence) per
--    `project_post_flight_assertion_predicate_divergence` — do not mirror
--    the DDL we just ran or the check inherits the same bug.
DO $$
BEGIN
  ASSERT (SELECT extname FROM pg_extension WHERE extname = 'unaccent') IS NOT NULL,
    'unaccent extension is missing after migration';
  ASSERT (SELECT extname FROM pg_extension WHERE extname = 'pg_trgm') IS NOT NULL,
    'pg_trgm extension is missing after migration';
  ASSERT (
    SELECT provolatile = 'i'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_unaccent'
  ),
    'public.f_unaccent must be IMMUTABLE to be index-usable';
END $$;
