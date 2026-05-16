---
phase: 37
plan: 04
subsystem: server-actions, watch-form, watch-card
tags: [server-action, transaction, accordion, base-ui, watch-form, watch-card, ui, drizzle, dual-write]
dependency_graph:
  requires:
    - 37-01 (Drizzle schema: divestments table, 3 pgEnums, 7 watches columns)
    - 37-02 (Supabase migration: DDL + RLS + GRANTs)
    - 37-03 (Drizzle migration twin + journal idx=10)
  provides:
    - recordDivestment Server Action (atomic dual-write via db.transaction)
    - editWatch owned→sold transition detection + inline dual-write
    - WatchForm Collector's Record Accordion (edit-only, collapsed default)
    - WatchCard sold-badge visual distinction
  affects:
    - src/app/actions/divestments.ts (new)
    - src/app/actions/watches.ts (insertWatchSchema + editWatch restructure)
    - src/components/watch/WatchForm.tsx (Accordion + provenance fields)
    - src/components/watch/WatchCard.tsx (Badge variant ternary)
    - src/data/watches.ts (mapRowToWatch + mapDomainToRow for 7 provenance fields — Rule 2 deviation)
tech_stack:
  added:
    - db.transaction(async (tx) => {...}) — FIRST Drizzle transaction in codebase
  patterns:
    - ActionResult<T> return shape for Server Actions (consistent with addWatch/editWatch/removeWatch)
    - @base-ui/react/accordion — Accordion.Root/.Item/.Header/.Trigger/.Panel (L-07 enforced)
    - data-[open]:animate-in / data-[ending-style]:animate-out animation via tw-animate-css
    - data-[panel-open]:[&>svg]:rotate-180 chevron rotation
key_files:
  created:
    - src/app/actions/divestments.ts
  modified:
    - src/app/actions/watches.ts
    - src/components/watch/WatchForm.tsx
    - src/components/watch/WatchCard.tsx
    - src/data/watches.ts
decisions:
  - "Option (b) chosen for editWatch transaction: inline watches UPDATE inside db.transaction rather than threading tx parameter through updateWatch DAL. Rationale: avoids DAL signature change that would cascade to all callsites; plan explicitly called out option (b) as the clean path when (a) cascades."
  - "ActionResult<{ divestmentId: string }> return shape used (intentional deviation from CONTEXT.md D-11 { ok } sketch). ActionResult is the project-wide Server Action convention — using a one-off shape would force callers to branch on two distinct success conventions."
  - "mapDomainToRow + mapRowToWatch in src/data/watches.ts updated to handle 7 provenance fields (Rule 2 auto-fix — missing critical functionality for fields to persist and be read from DB)."
metrics:
  duration: "6 minutes"
  completed: "2026-05-12"
  tasks_completed: 3
  files_modified: 5
---

# Phase 37 Plan 04: Server Action + UI Wire-up Summary

Atomic dual-write Server Action (recordDivestment + editWatch transition branch) with db.transaction(), WatchForm Collector's Record Accordion (edit-only, collapsed), and WatchCard sold-badge visual distinction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create recordDivestment Server Action | 7abad1b | src/app/actions/divestments.ts (+134 lines) |
| 2 | Extend editWatch + DAL provenance mapping | 89919c3 | src/app/actions/watches.ts (+97 lines), src/data/watches.ts (+22 lines) |
| 3 | Accordion + WatchCard badge | 02c0359 | src/components/watch/WatchForm.tsx (+190 lines), src/components/watch/WatchCard.tsx (+1 line) |

## File Summary

| File | Action | Line Delta |
|------|--------|-----------|
| src/app/actions/divestments.ts | Created | +134 |
| src/app/actions/watches.ts | Modified | +97 (7 zod fields + hoisted priorRow + transaction branch) |
| src/data/watches.ts | Modified | +22 (mapRowToWatch + mapDomainToRow provenance fields — Rule 2) |
| src/components/watch/WatchForm.tsx | Modified | ~+190 (imports + Accordion block + seeding) |
| src/components/watch/WatchCard.tsx | Modified | +1 (Badge variant ternary) |

## Transaction Implementation (Option b)

The `editWatch` transaction uses **Option (b): inline watches UPDATE** inside `db.transaction()` rather than threading a `tx` parameter through `watchDAL.updateWatch`. The `updateWatch` signature is `(userId, watchId, Partial<Watch>)` — adding an optional `tx` param would require updating every caller and the DAL's internal Drizzle query. Inlining `tx.update(watches).set(...).where(and(...))` is 4 lines and keeps the DAL unchanged. The plan explicitly documented both options and called (b) clean when (a) cascades.

## FIRST db.transaction() in Codebase

Confirmed: `grep -r "db\.transaction" src/` returns exactly 2 files:
- `src/app/actions/divestments.ts` (recordDivestment canonical path)
- `src/app/actions/watches.ts` (editWatch transition branch)

Both are Phase 37 additions. This is the first Drizzle transaction usage in the codebase per RESEARCH Open Q #2.

## ActionResult Return Shape (Intentional Deviation from CONTEXT.md D-11)

`recordDivestment` returns `ActionResult<{ divestmentId: string }>` (with `success`/`error` keys) rather than the `{ ok: true; divestmentId } | { ok: false; error }` shape sketched in CONTEXT.md D-11. This is intentional:
- `ActionResult<T>` is the project-wide Server Action convention (addWatch, editWatch, removeWatch all use it)
- Using a one-off `{ ok }` shape would force callers to branch on two distinct success conventions
- The locked behavior — "success on dual-write, error otherwise" — is identical in both shapes
- Documented in the action JSDoc and plan artifacts

## Threat Mitigations

| Threat ID | Category | Mitigation Code Site |
|-----------|----------|---------------------|
| T-37-OWN-01 | Spoofing (no auth) | `try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }` — divestments.ts L:63-66, watches.ts (existing) |
| T-37-OWN-02 | Elevation of privilege (wrong owner) | `const watch = await watchDAL.getWatchById(user.id, watchId); if (!watch) return { success: false, error: 'Not found' }` — divestments.ts L:80-83 + watches.ts priorRow null early-return |
| T-37-INPUT-01 | Tampering (malformed input) | `recordDivestmentSchema.safeParse(data ?? {})` — divestments.ts L:68-74; `updateWatchSchema.safeParse(data)` with 7 new fields — watches.ts |
| T-37-RLS-02 | Information disclosure (cross-user read) | Plan 02 RLS policy enforced at DB layer; Server Action only inserts; future reads respect RLS |
| T-37-TXN-01 | Partial dual-write | `db.transaction(async (tx) => { ... })` wraps INSERT divestments + UPDATE watches atomically — both sites |
| T-37-TXN-02 | DoS / unbounded transaction | Transaction body is 2 bounded writes; no loops, no external calls inside closure |

## priorRow Single Fetch (BLOCKER #2 + WARNING #4)

The prior `editWatch` code fetched `currentRow` INSIDE the `if (cleanData.status === 'wishlist' || cleanData.status === 'grail')` branch only. Phase 37 hoists a single unconditional `priorRow` fetch above ALL branches:

```typescript
const priorRow = await watchDAL.getWatchById(user.id, watchId)
if (!priorRow) {
  return { success: false, error: 'Watch not found' }
}
```

This fixes:
1. **BLOCKER #2**: removes any dead-code ternary; `priorRow` is always available for transition detection
2. **WARNING #4**: adds explicit null early-return before UPDATE (prevents UPDATE on a deleted row)
3. **Performance**: single DB round-trip reused for sort-order logic AND transition detection

## WatchForm Notes (Deviations from Plan Literal)

- `FormData = Omit<Watch, 'id'>` already includes the 7 provenance fields (Watch type was updated in Plan 01). No explicit FormData type extension needed — the type inherits them automatically.
- `CONDITION_GRADES, CONDITION_GRADE_LABELS` and `BOX_PAPERS_STATUSES, BOX_PAPERS_LABELS` are imported on separate lines (one per line) rather than as comma-separated pairs on one line. Functionally identical — the imports are present and the constants are used correctly in JSX.
- `Collector's Record` text in JSX uses `Collector&apos;s Record` HTML entity to avoid React JSX unescaped apostrophe lint warning. The rendered text is identical.
- `Box & Papers` label uses `Box &amp; Papers` HTML entity for the same reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Update src/data/watches.ts for 7 provenance fields**

- **Found during:** Task 2 — when adding zod schema fields to watches.ts, noticed mapDomainToRow and mapRowToWatch had no handling for the 7 new provenance columns (serial, yearOfAcquisition, condition, boxPapers, serviceHistory, paidCurrency, purchaseDate)
- **Issue:** Without updating these functions, provenance fields submitted via WatchForm would be silently discarded (mapDomainToRow ignores unknown fields) and never read back from DB (mapRowToWatch would return undefined for all 7 fields even if DB had values)
- **Fix:** Added 7 entries to mapDomainToRow (with `?? null` null-to-DB mapping) and 7 entries to mapRowToWatch (with `?? undefined` DB-to-domain mapping)
- **Files modified:** src/data/watches.ts
- **Commit:** 89919c3

## Self-Check: PASSED

Files exist:
- src/app/actions/divestments.ts: FOUND
- src/app/actions/watches.ts: FOUND (modified)
- src/components/watch/WatchForm.tsx: FOUND (modified)
- src/components/watch/WatchCard.tsx: FOUND (modified)
- src/data/watches.ts: FOUND (modified, Rule 2 deviation)

Commits verified:
- 7abad1b: feat(37-04): create recordDivestment Server Action
- 89919c3: feat(37-04): extend editWatch with hoisted priorRow + owned→sold dual-write transaction
- 02c0359: feat(37-04): add Collector's Record Accordion to WatchForm + sold badge variant in WatchCard

tsc --noEmit: zero new errors from all 5 modified/created src/ files (pre-existing test file errors unchanged).
