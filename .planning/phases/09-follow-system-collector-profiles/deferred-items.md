# Deferred Items — Phase 09

Out-of-scope issues discovered during Plan execution that are NOT caused by Plan changes. Not fixed here per SCOPE BOUNDARY rule; logged for future cleanup.

## Plan 09-02

### 1. `LayoutProps` global type resolution in layout.tsx

- **File:** `src/app/u/[username]/layout.tsx`
- **Error:** `TS2304: Cannot find name 'LayoutProps'.`
- **Origin:** Pre-existing (exists on base commit before Plan 02 began — reproduced via `git stash` + `tsc --noEmit`).
- **Root cause:** Next.js 16 generates `LayoutProps<T>` as a global type, but the generated `.next/types` may not be present during standalone `tsc --noEmit`. Runtime and `next build` resolve it correctly; unit tests pass.
- **Impact:** None on runtime or test suite; `npx tsc --noEmit` reports one error.
- **Fix direction:** Either run `next dev` once to generate `.next/types/**`, add a `next-env.d.ts` reference, or use `{ params, children }: { params: Promise<{ username: string }>, children: React.ReactNode }` explicitly.

### 2. `react-hooks/purity` flag on `Date.now()` in layout.tsx

- **File:** `src/app/u/[username]/layout.tsx` (Date.now() and new Date() inside the collectionAgeDays computation)
- **Error:** ESLint `react-hooks/purity — Cannot call impure function`.
- **Origin:** Pre-existing (same code was present before Plan 02 edits).
- **Impact:** ESLint warning-level lint error; does not block build.
- **Fix direction:** Lift the date math into a small helper that returns `number` and accept the timestamp as a prop, OR wrap in a function marked with an escape hatch. Out of scope for Plan 02 (no new code added by this plan to that block).

### 3. `tests/balance-chart.test.tsx` unused `@ts-expect-error`

- **File:** `tests/balance-chart.test.tsx(11,1)`
- **Error:** `TS2578: Unused '@ts-expect-error' directive.`
- **Origin:** Pre-existing and called out in Plan 09-01 SUMMARY.
- **Impact:** `tsc --noEmit` reports one error; does not block build or the vitest suite.
- **Fix direction:** Remove the stale `@ts-expect-error` directive (a previous fix made the underlying error go away).
