# Phase 14 Deferred Items

Issues discovered during plan execution that are OUT OF SCOPE for the current plan.

## Pre-existing TypeScript error

- **File:** `src/app/u/[username]/layout.tsx:21`
- **Error:** `TS2304: Cannot find name 'LayoutProps'`
- **Discovered during:** 14-01 Task 1 verification (`npx tsc --noEmit`)
- **Scope note:** Not caused by this plan's changes — reproduced on base commit without any 14-01 edits applied
- **Suggested owner:** Plan that touches `/u/[username]` layout, or a dedicated cleanup task
