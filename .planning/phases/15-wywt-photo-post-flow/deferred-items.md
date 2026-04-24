# Deferred Items — Phase 15

Pre-existing issues observed during execution but out-of-scope for current plans.

## Plan 15-02 — pre-existing tsc errors (not introduced by this plan)

Observed via `npx tsc --noEmit` against base commit `8c831ae`:

- `src/app/u/[username]/layout.tsx(21,4)`: `Cannot find name 'LayoutProps'` — Next.js 16 LayoutProps generic type may need explicit import or redefinition
- `tests/components/preferences/PreferencesClient.debt01.test.tsx(86,67)` & `(129,7)`: `Type 'undefined' is not assignable to type 'UserPreferences'` — test fixtures pass undefined where typed prop is required

These are pre-existing on the base commit (verified by stashing 15-02 changes and re-running tsc). Not regressions; not blocking 15-02 verification.
