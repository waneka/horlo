---
phase: 03-data-layer-foundation
plan: "02"
subsystem: data-layer
tags: [drizzle, dal, server-only, postgres, preferences, watches]
dependency_graph:
  requires:
    - src/db/schema.ts (Plan 01)
    - src/db/index.ts (Plan 01)
  provides:
    - src/data/watches.ts — Watch CRUD DAL (getWatchesByUser, getWatchById, createWatch, updateWatch, deleteWatch)
    - src/data/preferences.ts — Preferences DAL (getPreferencesByUser, upsertPreferences)
  affects:
    - src/app/actions/ (Plan 03 — Server Actions delegate to this DAL)
tech_stack:
  added: []
  patterns:
    - server-only import as first line of every DAL file (build-time client-import prevention)
    - Explicit userId scoping in every WHERE clause (D-10)
    - mapRowToWatch / mapRowToPreferences strips DB-internal fields (userId, createdAt, updatedAt)
    - getPreferencesByUser returns defaults object when no row exists (avoids throwing for missing prefs)
    - onConflictDoUpdate on userId unique constraint for upsertPreferences
    - mapDomainToRow converts undefined to null for nullable DB columns
key_files:
  created:
    - src/data/watches.ts
    - src/data/preferences.ts
  modified: []
decisions:
  - getWatchById returns null for not-found (expected outcome) vs throwing (D-08 — only unexpected failures throw)
  - getPreferencesByUser returns defaults object when no row exists — preferences are always readable without a DB row
  - mapDomainToRow uses 'key' in data check to distinguish explicit undefined from absent fields in Partial<Watch>
  - upsertPreferences builds a full insert row from defaults+data, then only updates provided fields on conflict
metrics:
  duration: "~15 minutes"
  completed: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 03 Plan 02: Data Access Layer Summary

**One-liner:** Server-only DAL for Watch CRUD and preferences upsert, with explicit userId scoping, domain type mapping, and build-time client-import enforcement.

## What Was Built

### Task 1: `src/data/watches.ts`

Five exported functions covering the full Watch CRUD surface:

- **`getWatchesByUser(userId)`** — SELECT all watches WHERE userId matches; maps each row to domain Watch
- **`getWatchById(userId, watchId)`** — SELECT single watch WHERE userId AND id match; returns null if not found
- **`createWatch(userId, data)`** — INSERT with `.returning()`, maps inserted row to Watch
- **`updateWatch(userId, watchId, data)`** — UPDATE with `.returning()`, throws if no row returned (wrong user or not found), sets updatedAt
- **`deleteWatch(userId, watchId)`** — DELETE with `.returning()`, throws if no row deleted

Two private helpers:
- **`mapRowToWatch`** — converts `watches.$inferSelect` row to domain Watch (strips userId, createdAt, updatedAt; converts null to undefined)
- **`mapDomainToRow`** — converts domain Watch fields to DB row shape (undefined to null for nullable columns)

### Task 2: `src/data/preferences.ts`

Two exported functions:

- **`getPreferencesByUser(userId)`** — SELECT from userPreferences WHERE userId matches; returns `defaults` object if no row exists (preferences are always readable)
- **`upsertPreferences(userId, data)`** — INSERT a full row (data merged with defaults), ON CONFLICT on userId UPDATE only provided fields, set updatedAt; returns mapped domain object

One private helper:
- **`mapRowToPreferences`** — converts `userPreferences.$inferSelect` row to domain UserPreferences (strips id, userId, createdAt, updatedAt; casts jsonb preferredCaseSizeRange to domain type)

## Threat Model Coverage

All three threats from the plan's threat register are mitigated:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-03-04 (Information Disclosure) | mapRowToWatch and mapRowToPreferences both strip userId, createdAt, updatedAt before returning |
| T-03-05 (Elevation of Privilege) | `import 'server-only'` is first line of both DAL files — build error if client-imported |
| T-03-06 (Tampering) | Every exported function includes `eq(*.userId, userId)` in WHERE clause; no bare watchId queries |

## Deviations from Plan

None — plan executed exactly as written.

The plan noted `isFlaggedDeal` and `isChronometer` domain types as `boolean | undefined`. The mapRowToWatch uses `?? undefined` (not `?? false`) to match the domain interface, which declares these as `boolean?` (optional). This is consistent with the plan's mapping rules.

## Known Stubs

None. Both DAL files are fully wired to the Drizzle schema with no placeholder data or hardcoded values.

## Self-Check

Files created:
- src/data/watches.ts — FOUND
- src/data/preferences.ts — FOUND

Commits:
- c98c60b — feat(03-02): create watches DAL — FOUND
- 41834ce — feat(03-02): create preferences DAL — FOUND

TypeScript: both files pass `npx tsc --noEmit` with zero errors in DAL files (one pre-existing unrelated error in tests/balance-chart.test.tsx).

## Self-Check: PASSED
