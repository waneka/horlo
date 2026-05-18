---
phase: 45-cms-data-model-admin-routes
plan: 06
status: complete
completed: 2026-05-18
requirements: [CMS-10]
---

# Plan 45-06 Summary — Seed Collection Paths

## Outcome

Six published `collection_paths` rows authored into the local DB, satisfying
CMS-10 (amended 2026-05-18 from ten → six per owner decision — six is
sufficient seed content for Phase 47's 3-at-a-time rotation; more can be added
anytime through `/admin/paths`).

## What was done

Two deviations from the plan-as-written, both owner-approved:

1. **Local DB gap fixed.** Plan 45-01's `[BLOCKING]` schema push ran only
   `drizzle-kit push` (column shapes). The migration SQL's RLS policies, CHECK
   constraints, the `is_admin` owner seed, and the `cms-covers` bucket were
   never applied to the local database — so the `/admin/*` layout guard saw
   `is_admin = false` and redirected the owner. Both Phase 45 migrations
   (`20260518200000_phase45_cms_tables.sql`,
   `20260518210000_phase45_cms_covers_bucket.sql`) were applied to the local DB
   via `docker exec … psql`. Local now matches the committed migrations: 5
   RLS-enabled CMS tables, all policies, the `path_type` CHECK, the owner
   `is_admin = true`, and the `cms-covers` bucket.

2. **Paths bootstrapped by Claude, owner edits later.** Rather than the owner
   hand-authoring each path, Claude authored six paths via natural-key
   (brand/model/reference) `INSERT`s against the real local `watches_catalog`.
   This is NOT a forbidden id-keyed migration seed (RESEARCH.md Pitfall 5) — it
   is runtime content keyed to the actual local catalog, lives only in the
   local DB, and is fully editable through `/admin/paths`.

## The six seed paths

| # | Path type | Seed watch | Follow-ons |
|---|-----------|-----------|-----------|
| 1 | Going Deeper | Seiko SKX007 | Tudor Black Bay 58 → Omega Seamaster 300M → Rolex Submariner No-Date |
| 2 | Trading Up | Omega Speedmaster Moonwatch | Rolex Daytona 116500LN → AP Royal Oak Offshore |
| 3 | Branching Out | Rolex Submariner Date | Grand Seiko Snowflake → AP Royal Oak Jumbo Extra-Thin |
| 4 | Filling a Gap | Rolex Explorer | Rolex GMT-Master II → Tudor Black Bay GMT |
| 5 | Going Deeper | Seiko 62MAS | Seiko 6105-8110 → Seiko 6309-7040 |
| 6 | Trading Up | Christopher Ward C60 Trident Pro 600 | Tudor Pelagos → Rolex Sea-Dweller |

Path-type spread: Going Deeper ×2, Trading Up ×2, Branching Out ×1, Filling a
Gap ×1 — all four values of the D-16 vocabulary represented. 13 path nodes
total.

## Verification

- `SELECT count(*) FROM collection_paths WHERE status = 'published'` → **6** ✓
- Every path has a non-null `seed_catalog_id` ✓
- Every `path_type` is one of the four D-16 values (DB CHECK enforces) ✓

## Notes for downstream

- **Prod has no CMS content yet.** These six paths are local-only. Prod gets
  the schema via `supabase db push --linked`; prod path content must be
  authored at deploy time (or re-bootstrapped) before Phase 47's "Where
  Collections Go" module can render there.
- The owner can edit/replace any path through `/admin/paths` — the bootstrap
  content is a starting point, not a final editorial cut.

## Self-Check: PASSED
