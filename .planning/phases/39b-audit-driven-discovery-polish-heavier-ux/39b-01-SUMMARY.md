---
phase: 39b-audit-driven-discovery-polish-heavier-ux
plan: 01
subsystem: database
tags: [drizzle, supabase, postgres, recursive-cte, lineage, seed-script, operator-curation, prod-bootstrap]

# Dependency graph
requires:
  - phase: 34
    provides: brands + watch_families schema (CAT-15) + backfill-catalog-brands operator pattern
  - phase: 35
    provides: watch_lineage_edges schema + lineage_relationship_type enum (CAT-16) + getLineageForReference recursive CTE
  - phase: 38
    provides: catalog_taste columns + Watch.catalogTaste type + LEFT JOIN in getWatchesByUser (CAT-13)
provides:
  - getLineageForReference CTE extended to return imageUrl on every LineageRow (both seed + recursive arms)
  - WearEventLite.note field exposed on WornCalendar interface (enables wear-detail panel in 39b-03)
  - getWatchesByUser Number() cast verification (A3 — formality/sportiness/heritageScore/confidence)
  - scripts/seed-lineage.ts idempotent operator-curation script (Pass A WHERE family_id IS NULL + Pass B ON CONFLICT DO NOTHING)
  - npm run db:seed-lineage package.json entry (tsx --env-file=.env.local)
  - 11 brands + 32 watch_families + 100 watches_catalog rows + 52 watch_lineage_edges in prod DB (one-shot bootstrap, idempotency-proven via second run)
  - Static guard tests/static/hierarchy.lineage-3-node.test.ts extended with 3 new assertions (2 green; 1 intentional RED until 39b-05)
affects: [39b-02, 39b-03, 39b-04, 39b-05, 42]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bootstrap SQL generator pattern: agent-authored TS arrays in .md → mjs parser → idempotent SQL transaction → supabase db query --linked (one-shot for v5.0 launch; future curation goes through seed-lineage.ts)"
    - "Recursive CTE column-extension: BOTH seed and UNION ALL recursive arms must carry the new column (Pitfall 5)"
    - "Idempotent two-pass operator script: Pass A UPDATE WHERE x IS NULL + Pass B INSERT ON CONFLICT DO NOTHING + standardized summary print line for UAT re-run verification"

key-files:
  created:
    - scripts/seed-lineage.ts (idempotent operator-curation script — empty TODO arrays; reusable for future iterative seeding)
    - scripts/watch-seed-data.md (agent-authored 100-watch manifest; brands/families/catalog/edges TS arrays)
    - scripts/build-seed-sql.mjs (parser that generates idempotent SQL from watch-seed-data.md)
    - scripts/seed-bootstrap-2026-05-13.sql (one-shot transactional bootstrap; ON CONFLICT DO NOTHING + NOT EXISTS guards)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md
  modified:
    - src/data/hierarchy.ts (CTE + LineageRow interface extended with imageUrl)
    - src/components/profile/WornCalendar.tsx (WearEventLite.note field added)
    - tests/static/hierarchy.lineage-3-node.test.ts (3 new assertions appended)
    - package.json (db:seed-lineage script entry)

key-decisions:
  - "Task 7 scope expansion: original plan assumed existing catalog rows to assign families to; prod was 0/0/0/0. Operator chose Option B — insert catalog + brands + families + edges as part of Wave 0 via a one-shot bootstrap SQL rather than deferring to a separate phase."
  - "Bootstrap path diverged from plan: scripts/seed-bootstrap-2026-05-13.sql applied via `supabase db query --linked` (not the planned `npm run db:seed-lineage` flow). scripts/seed-lineage.ts ships intact with empty TODO arrays as forward-compatible infrastructure for future iterative seeding once UUIDs are known."
  - "A3 verified — no patch needed: 4 Number() casts already present at src/data/watches.ts:154-160 for formality/sportiness/heritageScore/confidence."
  - "WearEventLite uses field name `note` (singular) matching DAL's getAllWearEventsByUser return shape — verified before patch."
  - "Static guard's getSameFamilyForCatalog assertion left intentionally RED — closes in Plan 39b-05 when the DAL function is shipped."

patterns-established:
  - "Operator-bootstrap pattern for empty prod tables: agent authors structured manifest .md → mjs parser → idempotent SQL transaction; supabase CLI applies. Reusable when bootstrap > iterative curation."
  - "scripts/seed-lineage.ts as long-term iterative curation surface: empty TODO arrays + summary print contract = operator pastes future UUIDs + relationships without rewriting the script. Bootstrap was a one-shot; future curation is iterative."
  - "Recursive CTE column extension requires BOTH arms updated (seed SELECT + UNION ALL recursive SELECT) — Pitfall 5; codified by static guard `grep -c \"wc.image_url\" src/data/hierarchy.ts >= 2`."

requirements-completed:
  - DISC-11

# Metrics
duration: ~5h (across multi-session execution + operator UAT)
completed: 2026-05-13
---

# Phase 39b Plan 01: Wave 0 — Audit-Driven Discovery Polish Heavier UX Foundation Summary

**Bootstrap prod DB from empty (0 catalog / 0 families / 0 edges) to 100 catalog rows + 32 families + 52 lineage edges + getLineageForReference imageUrl CTE extension + WearEventLite.note interface field + idempotent operator-curation script ready for future iterative seeding.**

## Performance

- **Duration:** ~5h (multi-session; spans Tasks 1-6 prior executor session + Task 7 operator UAT + scope-expansion bootstrap)
- **Started:** 2026-05-13 (earlier session committed Tasks 1-6: commits 12e4fc1 → c2d2821)
- **Completed:** 2026-05-13T17:30:42Z (bootstrap commit 392fd90 prod-applied + idempotency-proven)
- **Tasks:** 7/7 (Task 7 via Option B scope expansion)
- **Files modified:** 4 (hierarchy.ts, WornCalendar.tsx, hierarchy.lineage-3-node.test.ts, package.json)
- **Files created:** 4 (seed-lineage.ts, watch-seed-data.md, build-seed-sql.mjs, seed-bootstrap-2026-05-13.sql)

## Accomplishments

- **CTE imageUrl extension:** `getLineageForReference` now returns `imageUrl: string | null` on every `LineageRow`. Both seed and UNION ALL recursive arms carry `wc.image_url` (Pitfall 5 codified). Outer SELECT aliases `image_url AS "imageUrl"`. Unblocks LineageRail card rendering in Plan 39b-05.
- **WearEventLite.note field:** WornCalendar interface extended; field name `note` (singular) aligned with DAL's `getAllWearEventsByUser` return shape. Interface-only patch — no `selectedDate` state or `onClick` added (Plan 39b-03 owns those).
- **A3 numeric-cast verification:** 4 `Number()` casts present at `src/data/watches.ts:154-160` for formality/sportiness/heritageScore/confidence. No patch needed. ReferenceIdentityCard (Plan 39b-02) and lineage rails (Plan 39b-05) can rely on numeric values.
- **scripts/seed-lineage.ts shipped:** Idempotent 2-pass operator script with Pass A (UPDATE WHERE family_id IS NULL) + Pass B (INSERT ON CONFLICT DO NOTHING). Empty TODO arrays — smoke test prints `family_patched=0 family_skipped=0 edges_inserted=0 edges_skipped=0`. T-34-04 / T-39b-02 footgun cross-reference in header. Reusable forward-compatible infrastructure for future iterative curation.
- **npm run db:seed-lineage wired:** package.json entry matches existing `tsx --env-file=.env.local` convention.
- **Prod DB bootstrap (Option B scope expansion):** 100 watches_catalog rows + 32 families + 52 lineage edges committed to prod. All catalog rows pre-assigned to family_id at INSERT time (no separate Pass A needed). 5x the SC#5 target (~20 family seeds + ~15 edges).
- **Static guard updated:** 3 new assertions appended to `hierarchy.lineage-3-node.test.ts`. Two pass green (wc.image_url ≥ 2, imageUrl interface field). One intentionally RED — `getSameFamilyForCatalog function is exported` — closes in Plan 39b-05.
- **Wave 1 unblocked:** Real sparse prod data now exists — hide-if-empty UI checks in 39b-02..05 will surface genuine sparsity (e.g., catalog rows without lineage edges) rather than empty-everywhere noise.

## Task Commits

1. **Task 1: Extend getLineageForReference CTE to return imageUrl** — `12e4fc1` (feat)
2. **Task 2: Update hierarchy.lineage-3-node test to assert imageUrl in CTE** — `acd63e6` (test) — 7 pass / 1 intentional RED
3. **Task 3: Extend WornCalendar WearEventLite to include note field** — `69394fc` (feat)
4. **Task 4: Verify getWatchesByUser numeric-cast hygiene (A3)** — no commit (A3 VERIFIED — no patch needed)
5. **Task 5: Create scripts/seed-lineage.ts idempotent operator script** — `25d03fe` (feat)
6. **Task 6: Add db:seed-lineage npm script entry** — `c2d2821` (chore)
7. **Task 7 (Option B scope expansion): Bootstrap catalog + families + lineage edges to prod DB** — `392fd90` (feat)

**Validation-map update:** `b8895d0` (docs — Tasks 1-6 marked green in 39b-VALIDATION.md)

**Plan metadata commit:** (this commit — finalization)

## Files Created/Modified

### Created
- `scripts/seed-lineage.ts` (154 lines) — idempotent operator-curation script; Pass A UPDATE WHERE family_id IS NULL + Pass B INSERT ON CONFLICT DO NOTHING; empty TODO arrays + summary print contract. Reusable forward-compatible infrastructure.
- `scripts/watch-seed-data.md` (856 lines) — agent-authored 100-watch manifest in TS array form: 11 brands (Rolex/Omega/AP/Tudor/Squale/Christopher Ward/Steinhart/Swatch/Seiko/Grand Seiko/Longines), 32 families across Submariner/Sea-Dweller/GMT/Daytona/Explorer/Datejust + Speedmaster/Seamaster/Constellation + Royal Oak/Offshore + others, 100 catalog rows with pre-assigned family_id + brand_id, 52 lineage edges (successor chains + same-brand tributes/remakes + cross-brand homages).
- `scripts/build-seed-sql.mjs` (354 lines) — parser that generates `seed-bootstrap-2026-05-13.sql` from the TS arrays in `watch-seed-data.md`. Emits ON CONFLICT DO NOTHING on every pass; NOT EXISTS guard on catalog (local lacks `watches_catalog_natural_key` constraint that prod has).
- `scripts/seed-bootstrap-2026-05-13.sql` (248 lines) — one-shot transactional INSERT (BEGIN…COMMIT) for brands + families + catalog + edges. Applied to prod via `supabase db query --linked`.
- `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md` — this file.

### Modified
- `src/data/hierarchy.ts` — `LineageRow` interface adds `imageUrl: string | null` field; recursive CTE column list extended with `image_url`; seed SELECT + UNION ALL recursive SELECT both add `wc.image_url`; outer SELECT aliases `image_url AS "imageUrl"`. CYCLE clause + `depth < 10` guard preserved.
- `src/components/profile/WornCalendar.tsx` — `WearEventLite` interface extended with `note: string | null` field. No state or onClick added (Plan 39b-03 owns).
- `tests/static/hierarchy.lineage-3-node.test.ts` — 3 new assertions appended (CTE selects wc.image_url in both arms; LineageRow declares imageUrl; getSameFamilyForCatalog function is exported — intentional RED until 39b-05).
- `package.json` — `db:seed-lineage` script entry: `"tsx --env-file=.env.local scripts/seed-lineage.ts"`.

## Decisions Made

1. **Task 7 scope expansion (Option B):** The original plan assumed existing prod catalog rows the operator would assign families to. Prod was empty (0/0/0/0 across brands/families/catalog/edges — the catalog had never been seeded). Operator was offered Options A (defer prod-data work to a separate phase) and B (insert catalog + brands + families + edges as part of Wave 0). Operator chose B because:
   - Wave 1 UI plans (39b-02..05) need REAL sparse prod data to verify hide-if-empty branches (D-39b-19) — empty-everywhere doesn't exercise the branch.
   - Deferring would require splitting Phase 39b into another sub-phase.
   - The bootstrap is a one-shot for v5.0 launch; future iterative curation continues to go through `scripts/seed-lineage.ts`.

2. **Bootstrap path diverged from plan command:** Plan named `scripts/seed-lineage.ts` + `npm run db:seed-lineage` as the operator path. Bootstrap used a different operator script (`scripts/seed-bootstrap-2026-05-13.sql` applied via `supabase db query --linked`) because:
   - 100 rows + 11 brands + 32 families + 52 edges is bootstrap-scale, not curation-scale.
   - The TS-array → mjs-parser → SQL transaction path is simpler than authoring 100 UUIDs by hand into `FAMILY_ASSIGNMENTS` (UUIDs are gen_random_uuid()'d inside the SQL transaction; never need to leave the DB).
   - Idempotency contract identical: ON CONFLICT DO NOTHING throughout + NOT EXISTS guard for catalog.

3. **scripts/seed-lineage.ts intentionally ships with empty TODO arrays:** Bootstrap satisfies SC#5; ongoing curation goes through `seed-lineage.ts` once catalog UUIDs are known (e.g., adding a new Tudor reference + linking it to existing Sub homages).

4. **A3 verified, no patch shipped:** The 4 `Number()` casts on taste fields were already present from Plan 38-02. SUMMARY documents "A3 VERIFIED — no patch needed" per the verify-then-patch protocol; zero edits to `src/data/watches.ts`.

5. **WearEventLite field name = `note` (singular):** Matches DAL's `getAllWearEventsByUser` return shape (verified by grep before patching). Plan offered `note`/`notes` flexibility — chose singular.

6. **Static guard's third assertion left RED:** `getSameFamilyForCatalog function is exported` will not pass until Plan 39b-05 ships the function. This is the intentional handoff signal — when 39b-05 closes, the static guard transitions from 7 pass / 1 fail to 8 pass / 0 fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan-state mismatch on Task 7: prod catalog empty**

- **Found during:** Task 7 operator checkpoint
- **Issue:** Original plan named `FAMILY_ASSIGNMENTS` (assign families to existing catalog rows) and `LINEAGE_EDGES` (insert edges referencing existing rows) as the operator's two TODO arrays. Operator queried prod DB and found 0 catalog rows / 0 families / 6 brands / 0 edges — there was nothing to assign families TO. Plan implicitly assumed prior phases had seeded the catalog; none had.
- **Fix:** Operator chose Option B scope expansion — insert catalog rows + brands + families + edges as part of Wave 0 rather than defer to a separate phase. Implemented via:
  - Agent-authored `scripts/watch-seed-data.md` (100-watch manifest in TS array form)
  - Agent-authored `scripts/build-seed-sql.mjs` (parser → idempotent SQL transaction)
  - Generated `scripts/seed-bootstrap-2026-05-13.sql` (one-shot bootstrap)
  - Applied to prod via `supabase db query --linked < scripts/seed-bootstrap-2026-05-13.sql`
- **Files modified:** scripts/watch-seed-data.md (new), scripts/build-seed-sql.mjs (new), scripts/seed-bootstrap-2026-05-13.sql (new); prod DB tables brands/watch_families/watches_catalog/watch_lineage_edges
- **Verification:** Pre/post counts via `supabase db query --linked`:
  - brands: 6 → 16 (10 NEW + 1 conflict on existing Longines)
  - families: 0 → 32
  - catalog: 0 → 100 (100 with family_id)
  - edges: 0 → 52
  - Second-run idempotency: INSERT 0 / 0 / 0 / 0 across all 4 passes (proven)
- **Committed in:** `392fd90` (feat(39b-01): bootstrap catalog with 100 refs + 32 families + 52 lineage edges)

---

**Total deviations:** 1 auto-fixed (1 blocking via operator-approved scope expansion)
**Impact on plan:** Scope expansion EXCEEDED SC#5's target (~20 family seeds + ~15 edges → 100 / 32 / 52). Bootstrap path diverged from the named command (`npm run db:seed-lineage` → `supabase db query --linked`) but achieves the identical end state for Wave 1 dependencies. `scripts/seed-lineage.ts` ships intact for future iterative curation. No scope creep — all work was needed to honor Wave 1's hide-if-empty verification requirement.

## Prod DB State Delta (D-39b-19 + T-39b-02 Mitigation)

| Table | Pre-Run | Post-Run | Post-Rerun (Idempotency Proof) |
|-------|---------|----------|--------------------------------|
| brands | 6 | 16 | 16 (INSERT 0) |
| watch_families | 0 | 32 | 32 (INSERT 0) |
| watches_catalog | 0 | 100 | 100 (INSERT 0) |
| catalog rows with family_id IS NOT NULL | 0 | 100 | 100 |
| watch_lineage_edges | 0 | 52 | 52 (INSERT 0) |

**Idempotency proof:** Second prod run of `supabase db query --linked < scripts/seed-bootstrap-2026-05-13.sql` returned `INSERT 0 0` for every INSERT statement across all 4 passes. T-39b-02 mitigation green — a wrong-DB write would be recoverable via re-run on the right DB.

## Sample Data Confirmations

**Family assignment sanity check (Submariner family):**
- All 8 Rolex Submariners (Sub 5513, 14060M, 16610, 16610LV "Kermit", 116610LN, 116610LV "Hulk", 124060, 126610LN) assigned to "Submariner" family.

**Lineage edge sanity check (Sub 5513 → 4 homages + 1 successor):**
- Sub 5513 → 14060M (successor)
- Sub 5513 → Steinhart Ocean Vintage Military (homage)
- Sub 5513 → Squale 1521 (homage)
- Sub 5513 → Tudor Black Bay 58 (homage)
- Sub 5513 → Tudor Black Bay (homage)

**Wave 1 readiness:** When Plan 39b-05 ships, Lineage rail will materialize for Sub 5513 on `/watch/{id}` and `/catalog/{id}` with these 5 edges rendered; catalog rows without lineage edges (most of the 100) will exercise the hide-if-empty branch.

## Intentional RED State (Closes in Plan 39b-05)

- Test name: `getSameFamilyForCatalog function is exported`
- File: `tests/static/hierarchy.lineage-3-node.test.ts`
- Assertion: `/export\s+(async\s+)?function\s+getSameFamilyForCatalog/`
- Current state: FAIL (function not yet defined in `src/data/hierarchy.ts`)
- Resolves: Plan 39b-05 Task 1 ships `getSameFamilyForCatalog` DAL function; this assertion transitions to GREEN.

## Issues Encountered

- **Plan-state mismatch on Task 7** (see Deviations §1) — handled via Option B scope expansion.
- **Local snapshot drift:** Local DB lacks the prod `watches_catalog_natural_key` constraint, so the bootstrap SQL uses `NOT EXISTS` guards in addition to `ON CONFLICT DO NOTHING` to remain idempotent against local-only runs. (No production impact — prod has the constraint and uses both paths.)

## User Setup Required

None — prod DB bootstrap was the user setup for Wave 0.

## Next Phase Readiness

**Wave 1 unblocked:**
- 39b-02 (ReferenceIdentityCard) — has 100 catalog rows with family_id + confidence-eligible catalog_taste columns (from Phase 38) to verify the high/low confidence branches.
- 39b-03 (NSV-14 sub-cluster: LockedTabCard + WornCalendar + StatsTabContent) — `WearEventLite.note` exposed; wear-detail panel Task 2 can read it.
- 39b-04 (NSV-18 OtherOwnersRoster) — DAL work; not directly blocked by bootstrap but no longer fighting empty-everywhere.
- 39b-05 (NSV-02/16 SameFamily + Lineage rails) — has 32 families + 52 edges to verify rail rendering; the imageUrl CTE extension is in place; static guard's intentional RED closes when `getSameFamilyForCatalog` ships.

**Forward-compatible infrastructure:**
- `scripts/seed-lineage.ts` remains the long-term iterative curation surface. Future operator runs to add edges for new catalog references go through `npm run db:seed-lineage` with populated `FAMILY_ASSIGNMENTS` + `LINEAGE_EDGES` arrays.

**No blockers.**

## Self-Check: PASSED

Verified file existence:
- FOUND: scripts/seed-lineage.ts
- FOUND: scripts/watch-seed-data.md
- FOUND: scripts/build-seed-sql.mjs
- FOUND: scripts/seed-bootstrap-2026-05-13.sql
- FOUND: src/data/hierarchy.ts (modified)
- FOUND: src/components/profile/WornCalendar.tsx (modified)
- FOUND: tests/static/hierarchy.lineage-3-node.test.ts (modified)
- FOUND: package.json (modified)

Verified commits exist on main:
- FOUND: 12e4fc1 (Task 1)
- FOUND: acd63e6 (Task 2)
- FOUND: 69394fc (Task 3)
- FOUND: 25d03fe (Task 5)
- FOUND: c2d2821 (Task 6)
- FOUND: b8895d0 (Validation map update)
- FOUND: 392fd90 (Task 7 scope-expansion bootstrap)

---
*Phase: 39b-audit-driven-discovery-polish-heavier-ux*
*Plan: 01*
*Completed: 2026-05-13*
