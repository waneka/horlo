# Deferred Items — Phase 999.1

## Out-of-scope TypeScript errors in `tests/`

Discovered during Task 1 verification (`npx tsc --noEmit`). These are pre-existing
test-suite type errors unrelated to the three Phase-5 code-review follow-ups this
phase addresses. All stem from the Phase 12 removal of the `worn_public` column
from `profile_settings` schema (see STATE.md — "`worn_public` column dropped
from schema + local + prod").

The test files still reference the removed `wornPublic` shape in their fixture
setups and `.update()/.insert()` calls. These failures are not triggered by any
files this plan modifies (PreferencesClient.tsx, actions/watches.ts,
actions/preferences.ts) and are therefore out of scope per the executor's
deviation-rule scope boundary.

Files affected:

- `tests/balance-chart.test.tsx` — unused `@ts-expect-error` directive
- `tests/components/home/PersonalInsightsGrid.test.tsx` — `wornPublic` in
  ProfileSettings fixture (3 sites)
- `tests/components/home/WywtOverlay.test.tsx` — `visibility?` typed as optional
- `tests/components/home/WywtTile.test.tsx` — `visibility?` typed as optional
- `tests/data/getFeedForUser.test.ts` — `wornPublic` in insert/update calls
- `tests/data/getRecommendationsForViewer.test.ts` — `wornPublic` in insert
- `tests/data/getSuggestedCollectors.test.ts` — `wornPublic` in insert
- `tests/data/getWatchByIdForViewer.test.ts` — `wornPublic` in insert/update
- `tests/data/getWearRailForViewer.test.ts` — `wornPublic` in insert/update (4 sites)

Recommendation: close these in a follow-up quick-fix (scrub test fixtures of
`wornPublic` references). Not a functional regression — runtime is fine.
