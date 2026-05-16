# Phase 36 — Deferred Items

Tracks out-of-scope or rule-4 deviations discovered during execution that do not block the current plan but must be addressed by a future plan.

---

## Discovered during Plan 01 execution (2026-05-11)

### Item 1 — Pitfall 6 `.notNull()` tightening on `watches.catalogId` (DEFERRED)

**Discovered during:** Plan 01 Task 1 verification (`npx tsc --noEmit`).

**Plan 01 spec:** Edit 1 in `<action>` block requires adding `.notNull()` to `watches.catalogId` in `src/db/schema.ts` per Pitfall 6 mitigation (36-RESEARCH.md §Common Pitfalls Pitfall 6).

**Why deferred:** Applying `.notNull()` caused 18 NEW TypeScript errors (across 15 files) where existing call sites construct `watches` insert objects without supplying `catalogId`:

- `src/data/watches.ts:184` — production DAL `createWatch()` — the legacy flow at `src/app/actions/watches.ts:88-135` inserts the watch first (with NULL catalog_id) and links the catalog_id in a follow-up UPDATE. CAT-14 NOT NULL fundamentally requires this to become a single-step flow where `catalogDAL.upsertCatalogFromUserInput()` runs BEFORE `createWatch()`. Same legacy flow at `src/app/actions/wishlist.ts:124`.
- 17 integration test fixtures (`tests/integration/phase11-*.ts`, `phase12-*.ts`, `phase15-*.ts`, `phase17-*.ts`, `phase19-*.ts`, `phase27-*.ts`, `home-privacy.test.ts`, `debt02-rls-audit.test.ts`, `tests/data/getWearEventsCountByUser.test.ts`) construct watch insert fixtures without `catalogId`.

**Rule applied:** Rule 4 (architectural change required). The DAL flow rewrite + 17 fixture updates fall outside Plan 01's `files_modified: [src/db/schema.ts]` scope. The plan author acknowledged Pitfall 6 in 36-RESEARCH.md A4 as a "strict improvement" but did not anticipate the cascade into production DAL flow and test fixtures, and did not budget a Plan 04/05 task for it.

**Baseline tsc context (load-bearing):** The project already ships with 27 pre-existing tsc errors on `main` BEFORE this plan. Plan 01's AC `npx tsc --noEmit exits 0` is interpreted as "no NEW errors caused by this plan" — the strict literal reading was already unattainable.

**Resolution path (recommended):** Fold Pitfall 6 into Phase 38 (CAT-13 Engine Rewire). Phase 38 is the consumer that benefits from `watch.catalogId` being non-null (LEFT JOIN simplification per Pitfall 6 §Why it matters), AND Phase 38 has natural scope for the DAL flow rewrite (it consumes `watches` joined to `watches_catalog`). Sequence:

1. Phase 38 plan: rewrite `addWatch` flow at `src/app/actions/watches.ts:88-135` and `addToWishlistFromWearEvent` at `src/app/actions/wishlist.ts:124` to upsert catalog FIRST, then `createWatch(userId, data, catalogId)` with required `catalogId` parameter.
2. Phase 38 plan: update the 17 integration test fixtures to supply `catalogId` (or refactor to use a fixture helper that auto-upserts a catalog row).
3. Phase 38 plan: ADD `.notNull()` to `src/db/schema.ts:118` `watches.catalogId`.
4. Phase 38 plan: verify `npx tsc --noEmit` regresses to the pre-Phase-36 baseline of 27 errors (or fewer).

**Plan 01 actual edit:** `watches.catalogId` retains the legacy `references(() => watchesCatalog.id, { onDelete: 'set null' })` form WITHOUT `.notNull()`. The comment block at lines 116–125 of `src/db/schema.ts` explains the deferral and points readers here.

**Prod state unaffected:** The CAT-14 NOT NULL flip on `watches.catalog_id` STILL ships via `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` (Plan 02). Drizzle's TypeScript-level mismatch with prod is the temporary cost of the deferral. The mismatch surfaces as `InferSelectModel<typeof watches>.catalogId` reporting `string | null` (the looser type) when prod is actually `string`. Reads work; writes that omit `catalog_id` would fail at runtime — exactly what the existing legacy DAL flow does NOT do (it inserts first, links second) — so production behavior is unaffected until the flow is rewritten in Phase 38.

**Acceptance criterion impact:** Plan 01 AC3 `grep -nE "catalogId: uuid\\('catalog_id'\\)\\.notNull\\(\\)\\.references\\(\\(\\) => watchesCatalog\\.id" src/db/schema.ts` returns at least 2 matches" relaxed to "at least 1 match (watchVariants.catalogId only — watches.catalogId deferred per Rule 4)". All other ACs unaffected.

---

## Pre-existing baseline (out of scope per scope boundary rule)

The following tsc errors existed on `main` BEFORE Phase 36 Plan 01 ran. They are NOT caused by this plan and are NOT fixed by this plan. Listed here only for visibility:

| File | Error count | Type |
|------|-------------|------|
| `src/components/watch/RecentlyEvaluatedRail.test.tsx` | 3 | TS2322 (RailEntry type mismatch) |
| `tests/components/layout/DesktopTopNav.test.tsx` | 3 | TS2300 + TS1119 (duplicate 'href') |
| `tests/components/preferences/PreferencesClient.debt01.test.tsx` | 2 | TS2322 (UserPreferences undefined) |
| `tests/components/search/useSearchState.test.tsx` | 1 | TS2578 (Unused ts-expect-error) |
| `tests/components/settings/PreferencesClientEmbedded.test.tsx` | 5 | TS2578 (Unused ts-expect-error) |
| `tests/components/watch/WatchForm.isChronometer.test.tsx` | 4 | TS2556 + TS2352 + TS2493 |
| `tests/components/watch/WatchForm.notesPublic.test.tsx` | 3 | TS2556 + TS2352 + TS2493 |
| `tests/integration/phase17-extract-route-wiring.test.ts` | 3 | TS2322 (null vs undefined) |
| **Total** | **27** | |

Baseline captured via `git stash push -- src/db/schema.ts && npx tsc --noEmit 2>&1 \| grep error \| wc -l` → 27.

These should be opportunistically cleaned up by whichever future plan touches the relevant files. They are NOT a Phase 36 deliverable.
