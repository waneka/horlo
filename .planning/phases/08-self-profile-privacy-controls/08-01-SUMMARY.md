---
phase: 08-self-profile-privacy-controls
plan: 01
subsystem: database
tags: [drizzle, supabase, migration, dal, server-actions, zod, rls, privacy, taste-tags]

requires:
  - phase: 06-rls-foundation
    provides: RLS policies on watches (owner-only SELECT/INSERT/UPDATE/DELETE)
  - phase: 07-social-schema-profile-auto-creation
    provides: profiles / profile_settings / follows / wear_events tables + auto-provisioning trigger
provides:
  - watches.notes_public (default true) + watches.notes_updated_at columns in production
  - Profile DAL (getProfileByUsername, getProfileById, getProfileSettings, getFollowerCounts, updateProfileFields, updateProfileSettingsField)
  - Cross-user wear-event visibility gate (getPublicWearEventsForViewer) honoring worn_public (D-15, PRIV-05)
  - Server Actions for profile edit, privacy toggles, per-note visibility (all Zod-strict, auth-guarded, IDOR-safe)
  - Pure computeTasteTags function implementing the six D-06 rules (PROF-10) with 16 passing tests
affects: [profile-route-shell, collection-tab, wishlist-tab, notes-tab, worn-tab, stats-tab, settings-page]

tech-stack:
  added: []
  patterns:
    - "DAL safe-default pattern: getProfileSettings returns DEFAULT_SETTINGS when row missing (fail-open to avoid lockout during migration window)"
    - "DAL visibility gate pattern: two-layer enforcement (RLS + DAL) where DAL short-circuits to [] when cross-user + owner.flagPublic is false"
    - "Zod .strict() schemas on Server Actions for mass-assignment + field-injection protection"
    - "Ownership-gated UPDATE via WHERE watchId = x AND userId = current — 0-row return surfaces as generic 'not found' (IDOR mitigation without existence leak)"

key-files:
  created:
    - drizzle/0002_phase8_notes_columns.sql
    - supabase/migrations/20260420000003_phase8_notes_columns.sql
    - src/lib/tasteTags.ts
    - tests/lib/tasteTags.test.ts
    - src/data/profiles.ts
    - tests/data/profiles.test.ts
    - src/app/actions/profile.ts
    - src/app/actions/notes.ts
  modified:
    - src/db/schema.ts (added notes_public + notes_updated_at to watches)
    - src/lib/types.ts (Watch.notesPublic + Watch.notesUpdatedAt optional fields)
    - src/data/watches.ts (mapRowToWatch + mapDomainToRow round-trip the new columns)
    - src/data/wearEvents.ts (+ getAllWearEventsByUser, getPublicWearEventsForViewer)

key-decisions:
  - "Test file location: tests/lib/tasteTags.test.ts (NOT src/lib/tasteTags.test.ts as plan specified) — matches the project's vitest include pattern 'tests/**/*.test.ts'"
  - "getProfileSettings missing-row behavior: fail-open (DEFAULT_SETTINGS with all true) — avoids locking the owner out of their own profile during the brief window after the migration runs but before the Phase 7 trigger has populated their row"
  - "updateProfileSettingsField uses upsert (onConflictDoUpdate) rather than plain update — defense in depth if backfill INSERT was somehow skipped"
  - "Mocked-db test style for profiles.test.ts — exercises control flow of getProfileSettings defaults only; the DAL visibility gate is covered by Plan 02/04 manual checkpoints against a real DB"

patterns-established:
  - "DAL file header: always 'server-only' directive at line 1"
  - "Server Action file header: 'use server' at line 1, getCurrentUser() first call, Zod .strict() validation, ActionResult<T> never throws across boundary"
  - "Visibility-gate placement: gate lives in DAL (application layer), not in Server Action, so Server Components that call the DAL directly also get gated"

requirements-completed: [PROF-10, PRIV-05]

duration: ~25 min (orchestrator + inline + one crashed agent)
completed: 2026-04-21
---

# Plan 08-01: Schema + DAL + Server Actions Summary

**Adds per-note visibility columns to `watches`, the profiles DAL with safe fail-open defaults, a cross-user wear-event visibility gate enforcing worn_public, Zod-strict Server Actions for profile edit / privacy toggles / note-visibility toggle, and a pure computeTasteTags function covering all six D-06 rules.**

## Performance

- **Duration:** ~25 min (spanning one API-overloaded executor agent + inline continuation)
- **Tasks:** 3 (2 auto, 1 human-action checkpoint)
- **Commits:** 3 (test → feat × 2)
- **Test additions:** 19 (16 tasteTags + 3 profiles)

## Accomplishments
- watches table extended in production with `notes_public` (default true, NOT NULL) and `notes_updated_at` (nullable timestamptz) columns, plus idempotent profile_settings backfill INSERT
- computeTasteTags implements the six D-06 rules (Vintage Collector, {Brand} Fan, Sport/Dress/Diver precedence, Daily Rotator) capped at 3, with full positive/negative Vitest coverage
- Profile DAL provides reads (by username, by id), follower counts, and safe-default settings reads — cross-user pages render correctly even mid-migration
- Cross-user wear-event DAL gate (`getPublicWearEventsForViewer`) short-circuits to [] when viewer ≠ owner and `worn_public` is false — PRIV-05 satisfied at the application layer in addition to Phase 7 RLS
- updateProfile / updateProfileSettings / updateNoteVisibility Server Actions all enforce auth (`getCurrentUser` first), Zod `.strict()` validation, and ownership-gated writes

## Task Commits

1. **Task 1 (TDD red):** failing tests for computeTasteTags — `167e254`
2. **Task 1 (TDD green):** schema columns + migrations + types + computeTasteTags implementation — `1f1b2aa`
3. **Task 2:** profiles DAL + wear-event gate + Server Actions + DAL test — `c132290`
4. **Task 3 (human-action):** user applied migration via `supabase db push --linked` and confirmed columns + backfill

## Files Created/Modified

Created:
- `drizzle/0002_phase8_notes_columns.sql` — Drizzle migration (ADD COLUMN × 2)
- `supabase/migrations/20260420000003_phase8_notes_columns.sql` — Supabase CLI migration with `IF NOT EXISTS` + profile_settings backfill INSERT
- `src/lib/tasteTags.ts` — pure computeTasteTags function (D-06)
- `tests/lib/tasteTags.test.ts` — 16 tests across all six rules + cap + case sensitivity
- `src/data/profiles.ts` — profiles DAL (6 exports + 2 types)
- `tests/data/profiles.test.ts` — DAL defaults coverage (3 tests)
- `src/app/actions/profile.ts` — updateProfile + updateProfileSettings
- `src/app/actions/notes.ts` — updateNoteVisibility

Modified:
- `src/db/schema.ts` — +notesPublic, +notesUpdatedAt on watches table
- `src/lib/types.ts` — Watch.notesPublic, Watch.notesUpdatedAt optional fields
- `src/data/watches.ts` — round-trip new columns in mapRowToWatch / mapDomainToRow
- `src/data/wearEvents.ts` — added getAllWearEventsByUser + getPublicWearEventsForViewer (DAL visibility gate)

## Decisions Made
- **Test file location deviated from plan** — plan said `src/lib/tasteTags.test.ts`, but the project's `vitest.config.ts` includes only `tests/**/*.test.ts`. The agent correctly placed the test at `tests/lib/tasteTags.test.ts`.
- **Safe-default on missing profile_settings row** — chose fail-open (all visibility flags true) over fail-closed. Rationale: fail-closed locks the owner out of their own profile during the brief window between migration and Phase 7 trigger catching up.
- **Upsert pattern for updateProfileSettingsField** — uses `onConflictDoUpdate` so a missing row self-heals on first toggle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan defect — test path] `src/lib/tasteTags.test.ts` → `tests/lib/tasteTags.test.ts`**
- **Found during:** Task 1 (red-phase test authoring)
- **Issue:** Plan specified `src/lib/tasteTags.test.ts`, but `vitest.config.ts` includes only `tests/**/*.test.ts` — a test at the `src` location would never run.
- **Fix:** Placed the test at `tests/lib/tasteTags.test.ts` to match the project's actual convention.
- **Committed in:** `167e254`

**2. [Runtime issue — API overload] Executor agent crashed mid-Task-1**
- **Found during:** Task 1 green phase
- **Issue:** First parallel executor agent hit an Anthropic API overload after ~14 min / 137 tool calls. Green-phase changes were on disk but not committed.
- **Fix:** Salvaged the worktree's uncommitted diff, verified content quality, staged, committed, merged worktree branch to main, and completed Task 2 inline.
- **Files modified:** none (recovery only)
- **Verification:** `npx tsc --noEmit` clean (apart from pre-existing balance-chart.test.tsx TS error), `npm test -- --run tests/lib/tasteTags.test.ts tests/data/profiles.test.ts` 19/19 green.

---

**Total deviations:** 2 — one plan-defect auto-fix (test path), one runtime recovery (no code impact)
**Impact on plan:** No scope change. Both auto-fixes preserve plan intent.

## Issues Encountered
- Pre-existing TS2578 error in `tests/balance-chart.test.tsx` (unused `@ts-expect-error`) — documented as not caused by Phase 8. Flag for a future cleanup.
- Task 3 required user intervention to run `supabase db push --linked` against production (per user's memory, drizzle-kit push is LOCAL ONLY). User confirmed completion.

## User Setup Required
None — migration applied in Task 3 by the user.

## Next Phase Readiness
- Schema and DAL ready for Plan 02 (profile route shell + ProfileHeader + Settings page) to consume
- Plan 02 can now call `getProfileByUsername`, `getProfileSettings`, `getFollowerCounts` for `/u/[username]` layout
- `computeTasteTags` ready to be called from the profile header Server Component
- Plan 04 (Worn/Stats tabs) will use `getPublicWearEventsForViewer` for the DAL-gated view
- Plans 02-04 can wire UI to `updateProfile`, `updateProfileSettings`, `updateNoteVisibility` Server Actions

---
*Phase: 08-self-profile-privacy-controls*
*Completed: 2026-04-21*
