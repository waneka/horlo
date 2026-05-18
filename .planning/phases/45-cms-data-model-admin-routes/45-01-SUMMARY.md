---
phase: 45-cms-data-model-admin-routes
plan: "01"
subsystem: cms-data-model
tags: [cms, schema, drizzle, rls, supabase, migrations, auth]
dependency_graph:
  requires: []
  provides:
    - curated_lists table (local DB + Drizzle schema)
    - curated_list_items table (local DB + Drizzle schema)
    - collection_paths table (local DB + Drizzle schema)
    - collection_path_nodes table (local DB + Drizzle schema)
    - cms_settings table (local DB + Drizzle schema)
    - profiles.is_admin column (local DB + Drizzle schema)
    - assertOwner() server-only helper (src/lib/auth.ts)
    - react-markdown dependency
  affects:
    - src/db/schema.ts (5 new table exports + profiles.isAdmin)
    - src/lib/auth.ts (assertOwner added)
    - supabase/migrations/20260518200000_phase45_cms_tables.sql (new file)
tech_stack:
  added:
    - react-markdown@^10.1.0 (markdown renderer — React 19 compatible)
  patterns:
    - Drizzle pgTable for column shapes; raw SQL migration for CHECK/RLS
    - EXISTS(profiles.is_admin) InitPlan-wrapped RLS write policies
    - Email-keyed owner seed (cross-DB-stable for local/prod divergence)
    - RESTRICT FK on catalog-referencing columns (no trigger, no SECURITY DEFINER)
key_files:
  created:
    - supabase/migrations/20260518200000_phase45_cms_tables.sql
  modified:
    - src/db/schema.ts
    - src/lib/auth.ts
    - package.json
    - package-lock.json
    - tests/app/common-ground-fallback.test.tsx
decisions:
  - "D-01: profiles.is_admin boolean is the single source of truth for owner identity (RLS + assertOwner)"
  - "D-07: plain RESTRICT FK on catalog-referencing columns — no SECURITY DEFINER function; intentionally NOT using SECDEF REVOKE pattern"
  - "D-17: path_type is text + CHECK constraint in raw SQL — no pgEnum (easier to evolve)"
  - "D-10: forward-flag — RESTRICT FKs from CMS tables onto watches_catalog will block future bulk catalog wipe/TRUNCATE"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-18T21:16:00Z"
---

# Phase 45 Plan 01: CMS Data Model Foundation Summary

**One-liner:** Five CMS tables + profiles.is_admin + assertOwner() via Drizzle schema, raw SQL migration (RLS/CHECK/seed), and drizzle-kit push to local DB.

## What Was Built

### react-markdown installation
`react-markdown@^10.1.0` added to `package.json`. Lightest viable markdown renderer; React 19 compatible; XSS-safe by default (blocks `javascript:` URLs via `defaultUrlTransform`). No editor runtime.

### Drizzle schema additions (src/db/schema.ts)
- `profiles.isAdmin: boolean('is_admin').notNull().default(false)` added inline to the existing `profiles` pgTable definition (D-01: owner identity single source of truth).
- Five new pgTable exports: `curatedLists`, `curatedListItems`, `collectionPaths`, `collectionPathNodes`, `cmsSettings`.
- D-07: RESTRICT FKs on three catalog-referencing columns: `curatedListItems.catalogId`, `collectionPaths.seedCatalogId`, `collectionPathNodes.catalogId` — plain FK, no trigger, no SECURITY DEFINER.
- D-17: `pathType` uses `text('path_type')` — no pgEnum. CHECK constraint lives in raw SQL migration.
- `cmsSettings.heroFormat` uses text enum `['featured_list', 'featured_collector']` (SEED-008 forward-compat).
- Comment block above CMS tables directing CHECK/RLS concerns to the raw SQL migration (mirrors the notifications + watchLineageEdges pattern).

### Migration file (supabase/migrations/20260518200000_phase45_cms_tables.sql)
In order:
1. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false` (D-01)
2. CREATE TABLE for all five CMS tables with matching FK ON DELETE behaviors (CASCADE on parent refs, RESTRICT on catalog refs, SET NULL on `cms_settings.pinned_list_id`)
3. `collection_paths_path_type_check` CHECK with four-value vocabulary (D-16/D-17)
4. `cms_settings_single_row` CHECK + INSERT seed row
5. ENABLE ROW LEVEL SECURITY on all five tables
6. RLS policies — 22 CREATE POLICY statements:
   - `curated_lists` + `collection_paths`: `status = 'published'` public SELECT + owner draft SELECT + owner INSERT/UPDATE/DELETE
   - `curated_list_items` + `collection_path_nodes`: owner SELECT + public authenticated/anon SELECT + owner INSERT/UPDATE/DELETE
   - `cms_settings`: public SELECT (no sensitive data) + owner UPDATE
   - All write policies use `EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin)` (D-02)
7. Email-keyed owner seed: `UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'twwaneka@gmail.com')` (D-04)
8. DO $$ sanity block verifying `profiles.is_admin` column + all 5 tables

**D-07 confirmed: NO SECURITY DEFINER function** — the plain RESTRICT FK approach avoids it entirely. The `project_supabase_secdef_grants` REVOKE pattern was correctly not applied; see 45-RESEARCH.md §Pitfalls. This is explicitly flagged so future maintainers do not add unnecessary REVOKE steps.

### assertOwner() (src/lib/auth.ts)
Added after `getCurrentUserFull()`. Calls `getCurrentUser()`, selects `is_admin` from `profiles`, throws `UnauthorizedError('Not an admin')` when falsy. Returns `{ id, email }` on success. Three-layer CMS security: RLS write policies (DB) + layout redirect (UX) + this call in every Server Action.

### Local DB push (Task 3 — BLOCKING)
`npx drizzle-kit push` applied all five new tables and `profiles.is_admin` column to the local development database. Introspection verify confirmed all 5 tables present (`to_regclass` exit 0). `profiles.is_admin boolean` confirmed present. `supabase db push --linked` was NOT run — prod is untouched this phase.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 6561ba3 | feat(45-01): install react-markdown + add 5 CMS tables and profiles.isAdmin to Drizzle schema |
| Task 2 | 35c5442 | feat(45-01): write CMS tables migration + add assertOwner() to auth.ts |
| Task 3 | (no commit — DB operation only) | drizzle-kit push to local DB |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] common-ground-fallback test: null mock type error**
- **Found during:** Task 1 tsc verification
- **Issue:** Adding `isAdmin: boolean` to the `profiles` pgTable widened the Drizzle-inferred return type of `getProfileByUsername`. An existing mock `vi.mocked(getProfileByUsername).mockResolvedValue(null)` without `as any` became a type error (TS2345).
- **Fix:** Added `as any` to the mock at `tests/app/common-ground-fallback.test.tsx:177`. Other null mocks in the file already used `as any`.
- **Files modified:** tests/app/common-ground-fallback.test.tsx
- **Commit:** 6561ba3

**Pre-existing TSC errors (not caused by this plan):** 41 errors remain in test files (`RecentlyEvaluatedRail.test.tsx`, `SearchPageClient.test.tsx`, `DesktopTopNav.test.tsx`, etc.). These were verified pre-existing via `git stash` check — 42 errors existed before any changes; my fix reduced the count by 1 (the common-ground-fallback null mock). All remaining errors are in test files and are out of scope for this plan.

## D-10 Forward Flag

**The RESTRICT FKs from CMS tables onto `watches_catalog` will block a future bulk catalog wipe or TRUNCATE.** Specifically: `curated_list_items.catalog_id`, `collection_path_nodes.catalog_id`, and `collection_paths.seed_catalog_id` all have `ON DELETE RESTRICT`. Any Phase 36-style bulk catalog deletion (cf. Phase 44 production enrichment) that attempts to DELETE or TRUNCATE `watches_catalog` rows referenced by these columns will raise a foreign-key RESTRICT error. A future catalog-mutation phase (v5.2 expansion, SEED-009) must account for this — either dereference CMS tables first, or use a service-role bypass that removes CMS references.

## Known Stubs

None — this plan ships no UI or user-visible output. It is a contract layer only.

## Threat Flags

No new threat surface beyond what is explicitly modeled in the plan's threat register (T-45-01 through T-45-05). The migration contains no network endpoints, no new auth paths, and no file access patterns.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| supabase/migrations/20260518200000_phase45_cms_tables.sql | FOUND |
| src/db/schema.ts | FOUND |
| src/lib/auth.ts | FOUND |
| .planning/phases/45-cms-data-model-admin-routes/45-01-SUMMARY.md | FOUND |
| commit 6561ba3 | FOUND |
| commit 35c5442 | FOUND |
| assertOwner exported from src/lib/auth.ts | FOUND |
| curatedLists exported from src/db/schema.ts | FOUND |
| cmsSettings exported from src/db/schema.ts | FOUND |
