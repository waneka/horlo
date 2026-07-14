-- =============================================================================
-- Phase 81 D-81-04 Drift Fixture — Local-First Verification
-- =============================================================================
-- Purpose:
--   Inserts one drift `watches_catalog` row with denormalized `brand = 'Hamilton
--   Watch'` sitting on the CANONICAL Hamilton `brand_id` + a real Hamilton
--   `family_id` (canonical FK identity, drifted denormalized display string).
--   This synthesizes the exact class of row that Plan 02's `excludeKey(w)` +
--   INNER-JOIN read-path must handle correctly:
--
--     - RECO-01: an owner of the canonical Hamilton brand must NOT see this
--       drift row surface in "From Collectors Like You" (exclusion by
--       canonical `brand_id`, not by the free-text `brand` column).
--     - RECO-04: rail rationale must render `Fans of Hamilton love this`
--       (canonical `brands.name`), NEVER `Fans of Hamilton Watch love this`
--       (drifted denorm column value).
--
--   Also inserts a peer-collector `watches` row (vintage-anna@horlo.test)
--   owning the drift catalog row, so the multi-brand `+100` boost has a
--   surface-eligible candidate to actually attempt to surface in the viewer's
--   rail. Without the peer ownership, RECO-01's assertion would pass trivially
--   (unowned catalog rows don't top up).
--
-- NOT a Supabase migration:
--   This file lives under `.planning/phases/.../fixtures/` — NOT under
--   `supabase/migrations/`. Supabase's migration runner never picks it up.
--   Do NOT copy this to `supabase/migrations/`. Do NOT apply against prod.
--
-- Portable across environments:
--   FK resolution uses `SELECT id FROM brands WHERE name = 'Hamilton'` and
--   `SELECT wf.id FROM watch_families wf JOIN brands b ... WHERE b.name =
--   'Hamilton' AND wf.name = 'Khaki Field Mechanical' LIMIT 1` subselects.
--   No hardcoded UUIDs. Safe to run on any env that has post-Phase-79
--   canonical Hamilton + a Khaki Field Mechanical family row (per
--   [[catalog-id-divergence]] — local UUIDs differ from prod, so
--   FK-by-name resolution is the correct portable shape).
--
-- Preconditions (verify before APPLY):
--   1. Local Supabase is running (`docker ps` shows supabase_db_horlo healthy
--      on port 54322).
--   2. Post-Phase-79 canonical state:
--        SELECT COUNT(*) FROM brands WHERE name = 'Hamilton';
--        -- expect: 1  (canonical singleton; if 0, run Phase 79 apply first)
--   3. Peer collector `vintage-anna@horlo.test` exists and is public:
--        SELECT ps.profile_public FROM profile_settings ps
--          JOIN auth.users u ON u.id = ps.user_id
--         WHERE u.email = 'vintage-anna@horlo.test';
--        -- expect: t
--   4. At least one Hamilton `watch_families` row exists (the fixture picks
--      'Khaki Field Mechanical' as a stable choice — Phase 79 apply always
--      resolves it):
--        SELECT wf.id FROM watch_families wf
--          JOIN brands b ON b.id = wf.brand_id
--         WHERE b.name = 'Hamilton' AND wf.name = 'Khaki Field Mechanical';
--        -- expect: 1 row
--
-- Usage:
--   Apply block only:
--     awk '/^-- BEGIN APPLY/,/^-- END APPLY/' drift-hamilton.sql \
--       | docker exec -i supabase_db_horlo psql -U postgres -d postgres
--   Revert block only:
--     awk '/^-- BEGIN REVERT/,/^-- END REVERT/' drift-hamilton.sql \
--       | docker exec -i supabase_db_horlo psql -U postgres -d postgres
--   Full file (APPLY, then REVERT — idempotent restore-to-canonical):
--     docker exec -i supabase_db_horlo psql -U postgres -d postgres \
--       < drift-hamilton.sql
--
-- Idempotency:
--   APPLY block uses `ON CONFLICT DO NOTHING` on the natural key so re-running
--   is safe. REVERT block DELETEs by the exact composite identity so it can
--   run any number of times to guarantee cleanup.
-- =============================================================================


-- =============================================================================
-- BEGIN APPLY
-- =============================================================================

BEGIN;

-- 1. Insert the drift catalog row.
--    Denorm `brand = 'Hamilton Watch'` on canonical Hamilton `brand_id` +
--    canonical Hamilton family_id (Khaki Field Mechanical). Distinct `model`
--    string ('DriftTest Chrono') so the natural-key unique constraint doesn't
--    collide with any existing Hamilton catalog row.
INSERT INTO watches_catalog (
  id,
  brand,
  model,
  reference,
  source,
  brand_id,
  family_id,
  image_url,
  style_tags,
  design_traits,
  role_tags,
  complications,
  owners_count,
  wishlist_count
)
VALUES (
  gen_random_uuid(),
  'Hamilton Watch',
  'DriftTest Chrono',
  'DR-81',
  'admin_curated',
  (SELECT id FROM brands WHERE name = 'Hamilton'),
  (SELECT wf.id FROM watch_families wf
     JOIN brands b ON b.id = wf.brand_id
    WHERE b.name = 'Hamilton'
      AND wf.name = 'Khaki Field Mechanical'
    LIMIT 1),
  'https://example.com/hamilton-drifttest-placeholder.jpg',
  ARRAY['sport']::text[],
  ARRAY[]::text[],
  ARRAY['field']::text[],
  ARRAY[]::text[],
  0,
  0
)
ON CONFLICT DO NOTHING;

-- 2. Insert a peer-collector watch owning the drift catalog row so it is a
--    surface-eligible candidate in the "From Collectors Like You" rail.
--    Owner = vintage-anna@horlo.test (fixed seed UUID
--    00000000-0000-0000-0000-000000000002 per supabase/seed.sql). The personal
--    row itself carries CANONICAL brand='Hamilton' (matches Plan 03 DISP-01/02
--    write semantics; a real peer's collection is post-Phase-79 hydrated).
--    Free-text drift lives on the CATALOG side, not the personal side — that's
--    the whole point of the Phase 81 read-path test.
INSERT INTO watches (
  id,
  user_id,
  brand,
  model,
  reference,
  status,
  catalog_id
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000002'::uuid,  -- vintage-anna@horlo.test
  'Hamilton',                                    -- canonical (peer collection is hydrated)
  'DriftTest Chrono',
  'DR-81',
  'owned',
  wc.id
FROM watches_catalog wc
WHERE wc.brand = 'Hamilton Watch'
  AND wc.model = 'DriftTest Chrono'
  AND wc.reference = 'DR-81'
-- Guard: skip if the drift row is missing (peer-watch INSERT would fail on
-- the NOT NULL catalog_id FK); do NOT re-insert if this fixture peer-watch
-- already exists on that catalog row.
  AND NOT EXISTS (
    SELECT 1 FROM watches w
     WHERE w.user_id = '00000000-0000-0000-0000-000000000002'::uuid
       AND w.catalog_id = wc.id
  );

-- Post-APPLY sanity: emit the drift catalog id + peer watch id so the
-- operator can eyeball the two-row precondition before walking the UI.
SELECT
  (SELECT id FROM watches_catalog
    WHERE brand = 'Hamilton Watch'
      AND model = 'DriftTest Chrono'
      AND reference = 'DR-81') AS drift_catalog_id,
  (SELECT id FROM watches w
    WHERE w.user_id = '00000000-0000-0000-0000-000000000002'::uuid
      AND w.reference = 'DR-81'
      AND w.model = 'DriftTest Chrono') AS peer_watch_id;

COMMIT;

-- =============================================================================
-- END APPLY
-- =============================================================================


-- =============================================================================
-- BEGIN REVERT
-- =============================================================================

BEGIN;

-- 1. Delete the peer-collector fixture watch first. The catalog row FK is
--    `ON DELETE SET NULL` at schema level but the column is NOT NULL, so we
--    must delete the referencing row before the catalog row.
DELETE FROM watches
 WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid
   AND reference = 'DR-81'
   AND model = 'DriftTest Chrono';

-- 2. Delete any viewer test watches created during the walkthrough (Step iii
--    'Test DISP-01' and Step iv 'Test DISP-02'). Keyed by owner UUID + model
--    string so re-runs of the walkthrough are idempotent.
DELETE FROM watches
 WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid  -- viewer@horlo.test
   AND model IN ('Test DISP-01', 'Test DISP-02');

-- 3. Delete the drift catalog row. Guarded by the composite identity so no
--    real catalog row is at risk of collateral deletion.
DELETE FROM watches_catalog
 WHERE brand = 'Hamilton Watch'
   AND model = 'DriftTest Chrono'
   AND reference = 'DR-81';

-- Post-REVERT sanity: confirm counts are all zero.
SELECT
  (SELECT COUNT(*) FROM watches_catalog
    WHERE brand = 'Hamilton Watch'
      AND model = 'DriftTest Chrono') AS remaining_drift_catalog,
  (SELECT COUNT(*) FROM watches
    WHERE reference = 'DR-81' AND model = 'DriftTest Chrono') AS remaining_peer_fixture,
  (SELECT COUNT(*) FROM watches
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND model IN ('Test DISP-01', 'Test DISP-02')) AS remaining_viewer_test_watches;

COMMIT;

-- =============================================================================
-- END REVERT
-- =============================================================================
