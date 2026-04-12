---
phase: 03-data-layer-foundation
plan: "03"
subsystem: server-actions
tags: [server-actions, zod, validation, revalidatepath, dal]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["DATA-03", "DATA-04"]
  affects: []
tech_stack:
  added: []
  patterns:
    - "'use server' file-level directive for Server Action modules"
    - "Hand-written Zod schemas (drizzle-orm/zod subpath not exported)"
    - "ActionResult<T> discriminated union — never throw across server/client boundary"
    - "revalidatePath after successful mutations"
key_files:
  created:
    - src/app/actions/watches.ts
    - src/app/actions/preferences.ts
  modified: []
decisions:
  - "Used hand-written Zod schemas instead of createInsertSchema — drizzle-orm/zod subpath not exported in installed drizzle-orm@0.45.2"
  - "removeWatch returns ActionResult<void> with data: undefined (not ActionResult) — consistent with ActionResult<T = void> definition"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-12"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 03 Plan 03: Server Actions Summary

**One-liner:** Watch CRUD and preference Server Actions with Zod validation, DAL delegation, and revalidatePath — completing the Phase 3 mutation surface.

## What Was Built

Two Server Action modules in `src/app/actions/`:

**`src/app/actions/watches.ts`** — exports `addWatch`, `editWatch`, `removeWatch`
- `addWatch(userId, data)` — validates with full watch schema, calls `watchDAL.createWatch`, revalidates `/`
- `editWatch(userId, watchId, data)` — validates with partial schema, calls `watchDAL.updateWatch`, revalidates `/`
- `removeWatch(userId, watchId)` — no input validation needed (IDs only), calls `watchDAL.deleteWatch`, revalidates `/`

**`src/app/actions/preferences.ts`** — exports `savePreferences`
- `savePreferences(userId, data)` — validates partial preferences schema, calls `preferencesDAL.upsertPreferences`, revalidates `/preferences`

All actions:
- Accept `userId` as an explicit parameter (Phase 4 will replace with session-derived userId)
- Validate with Zod `.safeParse()` before calling any DAL function
- Return `ActionResult<T>` — never throw across the server/client boundary
- Log unexpected errors to console before returning a safe error string

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] drizzle-orm/zod subpath not exported**
- **Found during:** Task 1
- **Issue:** `drizzle-orm/zod` is not listed in the `exports` field of `drizzle-orm@0.45.2/package.json` — `require('drizzle-orm/zod')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`
- **Fix:** Used hand-written Zod schemas (plan's documented fallback for this exact scenario — RESEARCH.md Open Question 1, Common Pitfall 5)
- **Files modified:** `src/app/actions/watches.ts`, `src/app/actions/preferences.ts`
- **Commit:** 1b2a0a6

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | Passed — all 8 routes compile, TypeScript clean |
| `npm run lint` | Pre-existing errors in `useIsHydrated.ts` and `insights/page.tsx` (not caused by this plan) |
| `git diff --name-only <base>..HEAD` | Only `src/app/actions/watches.ts`, `src/app/actions/preferences.ts` |
| Dev server smoke test | `curl http://localhost:3000` returns full HTML — Zustand pages unaffected |

## Known Stubs

None. Server Actions are complete functional implementations — no placeholder data or TODOs in the logic path.

## Threat Surface Scan

The new Server Action files operate entirely within the existing trust boundaries documented in the plan's threat model. No new network endpoints, auth paths, or schema changes were introduced beyond what was planned.

| Flag | File | Description |
|------|------|-------------|
| T-03-09 accepted | src/app/actions/watches.ts | Client-supplied userId (accepted risk, documented with TODO for Phase 4) |
| T-03-09 accepted | src/app/actions/preferences.ts | Client-supplied userId (accepted risk, documented with TODO for Phase 4) |

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Create watch and preference Server Actions with Zod validation | 1b2a0a6 |
| 2 | Verification only — no files changed | N/A |

## Self-Check: PASSED

- [x] `src/app/actions/watches.ts` exists and starts with `'use server'`
- [x] `src/app/actions/preferences.ts` exists and starts with `'use server'`
- [x] Commit 1b2a0a6 exists in git log
- [x] `npm run build` exits 0
- [x] No existing files modified
