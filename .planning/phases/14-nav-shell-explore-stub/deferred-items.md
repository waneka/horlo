# Phase 14 Deferred Items

Issues discovered during plan execution that are OUT OF SCOPE for the current plan.

## Pre-existing TypeScript error

- **File:** `src/app/u/[username]/layout.tsx:21`
- **Error:** `TS2304: Cannot find name 'LayoutProps'`
- **First surfaced during:** 14-01 Task 1 verification (`npx tsc --noEmit`); re-observed by 14-05, 14-06, 14-08, 14-09.
- **Scope note:** Not caused by any Phase 14 plan — reproduces on base commit `ed1dc1d` without any plan edits applied.
- **Suggested owner:** Plan 14-07 touches `/u/[username]` layout and may supersede or fix it; otherwise dedicated cleanup.
