# Phase 28 Deferred Items

## Pre-existing TypeScript errors in tests/ (out of scope for Plan 03)

`npx tsc --noEmit` exits non-zero on baseline (29 errors before Plan 03; 28 after).
All errors are in `tests/components/...` and `tests/integration/...` — none in
`src/lib/watchFlow/`, `src/app/watch/new/page.tsx`, or
`src/components/watch/AddWatchFlow.tsx`.

Files with pre-existing errors (NOT touched by Plan 03):
- tests/components/preferences/PreferencesClient.debt01.test.tsx
- tests/components/search/useSearchState.test.tsx
- tests/components/settings/PreferencesClientEmbedded.test.tsx (5 unused @ts-expect-error)
- tests/components/watch/WatchForm.isChronometer.test.tsx
- tests/components/watch/WatchForm.notesPublic.test.tsx
- tests/integration/phase17-extract-route-wiring.test.ts

Plan 03 verifies that no NEW errors were introduced by its changes (delta: -1 error).
The `tsc --noEmit exits 0` acceptance criterion in the plan was unattainable on baseline.
