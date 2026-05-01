# Phase 24: Notification Stub Cleanup + Test Fixture & Carryover - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Tech-debt cleanup phase. Three independent but co-located workstreams:

1. **Notification stub purge (DEBT-03..05)** — The two never-written `notification_type` enum values (`price_drop`, `trending_collector`) and every render branch / type-union member / stub UI path that references them are removed via the rename + recreate ENUM evolution pattern. Drizzle `pgEnum` is updated AFTER the prod migration applies. A pre-flight zero-row assertion guards against unexpected stub rows in `notifications.type` BEFORE the destructive migration runs.

2. **Test fixture cleanup (DEBT-06)** — Test files that still reference the `wornPublic` column (dropped in Phase 12 / migration `20260424000001_phase12_drop_worn_public.sql`) are updated to the v3.0 `wear_visibility` enum. Empirically there are 4 such files in the current tree (`tests/integration/phase12-visibility-matrix.test.ts`, `tests/integration/home-privacy.test.ts`, `tests/data/getFeedForUser.test.ts`, `tests/data/getWearRailForViewer.test.ts`) — the roadmap's "9 files" count appears to be historical or counted reference sites; researcher will verify and update the count.

3. **Carryover test suites (TEST-04/05/06)** — Three test suites deferred since v1.0 finally land: `watchStore` filter reducer unit tests, `POST /api/extract-watch` integration coverage, and `WatchForm` / `FilterBar` / `WatchCard` component tests.

**In scope:** Migration + Drizzle update + render-branch deletion + 4-file fixture rewrite + 3 new test suites — all on a single phase branch.

**Out of scope:** Any new product capability; redesign of notifications UX; ENUM additions for future notification types; refactor of `wear_visibility` semantics; expansion of test infrastructure (e.g., adding Playwright). Phase 24 is mechanical cleanup, not redesign.

**Out of scope (other phases own):** Profile nav prominence (Phase 25), WYWT auto-nav (Phase 26).

</domain>

<decisions>
## Implementation Decisions

### Pre-Flight Assertion (DEBT-03)

- **D-01 (Claude's Discretion): Defense-in-depth — both a standalone pre-migration script AND an embedded SQL `DO $$ … RAISE EXCEPTION` block at the top of the rename+recreate migration.**
  - **Standalone script:** `scripts/preflight-notification-types.ts` (invokable via `npm run db:preflight-notification-cleanup`) connects to the configured `DATABASE_URL`, runs `SELECT count(*) FROM notifications WHERE type IN ('price_drop','trending_collector')`, and exits non-zero if the count is non-zero. Run in CI before deploying the migration.
  - **In-migration assertion:** A `DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM notifications WHERE type IN ('price_drop','trending_collector'); IF n > 0 THEN RAISE EXCEPTION 'preflight failed: % stub rows present', n; END IF; END $$;` block as the first statement in the migration SQL.
  - **Why both:** The script catches the condition at deploy-prep time when remediation is cheap (delete the rows or pause). The in-migration assertion is the last line of defense if the script is somehow skipped or if rows are written between the script run and the migration apply (vanishingly unlikely given v3.0 has no write-path for these types, but cost is one `DO` block — accept the redundancy). Mirrors the belt-and-suspenders posture of Phase 11/13 (D-09 / D-25 explicit-viewerId two-layer defense).

### TEST-04/05/06 Coverage Depth

- **D-02 (Claude's Discretion): Standard representative coverage — every public behavior with happy path + 1-2 representative edge cases per behavior.** Not minimum-viable smoke; not exhaustive table-driven. Rationale: these suites have been deferred since v1.0 — a token check-box would re-defer the debt; comprehensive table-driven explodes phase scope. Standard representative is the level of rigor v3.0 phases (Phase 11/13/15 component & integration tests) actually shipped.

  **Per-suite targets** (planner refines specifics):

  - **TEST-04 — `tests/store/watchStore.test.ts`:** `beforeEach` resets store via `useWatchStore.setState(initialState)`. Cover: filter slice toggle (status, style, role, dial color) — set, unset, multi-select; CRUD (`addWatch`, `updateWatch`, `deleteWatch`); `getFilteredWatches()` derived selector with combined filters. Excludes integration with persistence middleware (out of scope for unit tests).

  - **TEST-05 — `tests/api/extract-watch.test.ts`** (separate from existing `extract-watch-auth.test.ts` which only covers auth gate): Happy path (valid URL → structured-data success), categorized failures (host-403, structured-data-missing, LLM-timeout, generic-network), URL validation (non-http(s) protocol rejected), Zod input shape rejection. Mock outbound `fetch` via vitest's `vi.mock` or MSW pattern matching whatever exists in `tests/setup.ts`.

  - **TEST-06 — `tests/components/watch/{WatchForm,FilterBar,WatchCard}.test.tsx`:** Augment, do not replace, the existing `WatchForm.isChronometer.test.tsx` and `WatchForm.notesPublic.test.tsx`. Add: form submit happy path, validation errors per required field, status field transitions; `FilterBar` interaction (each filter toggles the right store action); `WatchCard` render variants (status pill, image-fallback, active vs. archived display).

### Type-Union Narrowing Aggressiveness

- **D-03 (Claude's Discretion): Aggressively narrow `NotificationRowData['type']` to `'follow' | 'watch_overlap'` and let TypeScript errors guide deletion.** This applies to every type alias and inline literal:
  - `src/lib/notifications/types.ts` — narrow exported type
  - `src/components/notifications/NotificationRow.tsx` line 21 — narrow `NotificationRowData.type`
  - `src/data/notifications.ts` line 16 — narrow query-result type
  - `src/db/schema.ts` lines 32-37 — `pgEnum` definition reduced to two values (AFTER prod migration applies, per success criteria #2)

  **Why aggressive narrowing:** The TS compiler becomes the deletion oracle — every `case 'price_drop':` / `row.type === 'trending_collector'` site lights up red, and grep alone can miss obscure call paths (e.g., `tests/components/notifications/NotificationRow.test.tsx` describe blocks). Aligns with project guidance ("If you are certain that something is unused, you can delete it completely") and the project Key Decision favoring direct evolution over backwards-compat shims.

  **Followup tests to delete:** `describe('price_drop type')`, `describe('trending_collector type')`, and the `'price_drop row click does NOT call markNotificationRead (stub type)'` test in `tests/components/notifications/NotificationRow.test.tsx` go away with the render branches — the stub-guard contract no longer exists once the types are gone.

### wornPublic Regression-Lock Tests

- **D-04 (Claude's Discretion): Rewrite as `wear_visibility` positive-assertion tests, do not delete and do not preserve as-is.** The Phase-12-era tests like:
  - `tests/data/getFeedForUser.test.ts`: `'Phase 12: where clause contains no reference to wornPublic'`
  - `tests/data/getFeedForUser.test.ts`: `'Phase 12: select projection contains no wornPublic field'`
  - `tests/data/getWearRailForViewer.test.ts`: `'Unit 10 (Phase 12): where clause contains no reference to wornPublic'`
  - `tests/data/getWearRailForViewer.test.ts`: `'Unit 11 (Phase 12): select projection contains no wornPublic field'`
  - `tests/integration/phase12-visibility-matrix.test.ts`: `'WYWT-11: profile_settings.worn_public column dropped post-migration'`

  ...were anchor tests for the Phase 12 migration cutover. The column is gone and cannot regress at the SQL level (Drizzle would fail to type-check a reintroduction). Keeping them as negative assertions is dead weight; deleting them loses the architectural intent ("the privacy gate is per-row, not per-tab").

  **Rewrite rule:** Convert each negative assertion to a positive assertion against the v3.0 architecture. Examples:
  - `expect(columnNames.has('worn_public')).toBe(false)` → `expect(projection).toContain('wear_events.visibility')` (or equivalent positive shape check)
  - `'where clause contains no reference to wornPublic'` → `'where clause gates on wear_events.visibility'` with an EXPLAIN-shape or generated-SQL substring assertion
  - `'WYWT-11: profile_settings.worn_public column dropped post-migration'` → either delete (one-shot migration assertion served its purpose) OR retitle as `'WYWT-11: wear_events.visibility column exists with public/followers/private enum'` and assert the positive schema shape

  Planner has discretion on per-test rewrite vs. deletion — the rule is "every wornPublic test file ends with positive wear_visibility assertions or no assertion at all (dead test removed)."

  Test files to update:
  - `tests/integration/phase12-visibility-matrix.test.ts`
  - `tests/integration/home-privacy.test.ts` — the `wornPublic: true` fixture seeds need to be replaced with `wear_events.visibility: 'public'` per-row seeds (this is data-shape migration, not assertion rewrite — the test logic stays)
  - `tests/data/getFeedForUser.test.ts`
  - `tests/data/getWearRailForViewer.test.ts`
  - **Also:** the `_wornPublic = true` parameter at `tests/data/getWearRailForViewer.test.ts:363` — this is a test-helper signature compat-leftover; remove the parameter entirely (TS guides the deletion of all callers).

### Migration + Code Sequencing

- **D-05: Single phase branch, but commits ordered to match the success criteria.** The success criteria #2 explicitly requires "Drizzle `pgEnum` is updated AFTER the prod migration applies." Commit order on the branch:
  1. Add `scripts/preflight-notification-types.ts` + `npm run db:preflight-notification-cleanup` script entry (independent — can land first, no migration coupling)
  2. Add the rename+recreate SQL migration `supabase/migrations/{timestamp}_phase24_notification_enum_cleanup.sql` (apply locally with `supabase db reset` per memory `project_local_db_reset.md`)
  3. **Apply migration to prod** via `supabase db push --linked` (per memory `project_drizzle_supabase_db_mismatch.md`) — this is a deploy step, gated on the pre-flight script passing in CI. Verification commit follows.
  4. Update Drizzle `pgEnum` in `src/db/schema.ts` to remove the two stub values (AFTER step 3 confirms in prod)
  5. Aggressively narrow types and delete render branches (D-03) — let TS errors guide the deletion sweep
  6. Update / rewrite `wornPublic` test fixtures (D-04)
  7. Land TEST-04, TEST-05, TEST-06 (each in its own commit)

  **Why this order:** Preserves rollback safety. If step 3 fails, Drizzle still reflects the wider enum and code still renders all four types, so prod is recoverable. Once step 4 lands, rolling back the migration without rolling back code is a build break.

### Claude's Discretion

- D-01 through D-04 are the four user-delegated gray areas. Decisions captured above with full rationale. Planner may further refine the per-test specifics within D-02 and D-04 without re-asking the user.
- The exact migration filename timestamp and the precise SQL syntax of the rename+recreate (`ALTER TYPE ... RENAME TO ..._old` → `CREATE TYPE` → `ALTER COLUMN ... USING ...::text::...` → `DROP TYPE ..._old`) follow the canonical pattern — planner / researcher fills in.
- Whether `scripts/preflight-notification-types.ts` uses Drizzle's `db` connection or a raw `pg` client is planner's call. Drizzle is consistent with the rest of `scripts/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements

- `.planning/ROADMAP.md` — Phase 24 entry under "Phase Details" (success criteria, requirements, dependencies)
- `.planning/REQUIREMENTS.md` — DEBT-03 (preflight assertion), DEBT-04 (rename+recreate), DEBT-05 (Drizzle update + render branch deletion), DEBT-06 (9-file fixture cleanup), TEST-04 (watchStore reducer), TEST-05 (extract-watch integration), TEST-06 (component tests)
- `.planning/PROJECT.md` — Key Decisions row: "ENUM cleanup uses rename + recreate (`ALTER TYPE … DROP VALUE` does not exist in Postgres)"

### Memory (User-Established Patterns)

- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`. Critical for D-05 sequencing — applies to step 3.
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md` — `supabase db reset` workflow for re-applying migrations locally (must follow with drizzle push + selective supabase migrations via `docker exec psql`)

### Existing Code (read before deleting)

- `src/db/schema.ts` lines 28-37 — `notification_type` enum definition with comment explaining why all four values were defined upfront
- `src/db/schema.ts` lines 196-198 — `wornPublic` column-removal comment with reference to Phase 12 migration
- `src/components/notifications/NotificationRow.tsx` — render branches and stub-type guards (lines 21, 50-57, 71, 138, 183-186, 199)
- `src/components/notifications/NotificationsInbox.tsx` line 71 — comment about "non-overlap rows (follow, price_drop, trending) pass through unchanged" (will need updating)
- `src/lib/notifications/types.ts` — exported type union to narrow
- `src/data/notifications.ts` line 16 — query result type to narrow
- `tests/components/notifications/NotificationRow.test.tsx` — `describe('price_drop type')` (line 162), `describe('trending_collector type')` (line 181), `'price_drop row click does NOT call markNotificationRead'` (line 327) — to delete with the render branches

### Existing Migrations (canonical reference for the rename+recreate pattern)

- `supabase/migrations/20260423000002_phase11_notifications.sql` — original `notification_type` enum creation (the pattern being undone)
- `supabase/migrations/20260424000001_phase12_drop_worn_public.sql` — Phase 12 column-drop pattern (reference for how column-drop migrations are structured here)
- `supabase/migrations/20260423000047_phase11_backfill_coverage_assertion.sql` — example of an in-migration `DO $$ ... RAISE EXCEPTION` assertion (canonical syntax for D-01's in-migration block)

### Testing Conventions

- `vitest.config.ts` (or `vitest.config.mjs`) and `tests/setup.ts` — current test framework + setup. Researcher should confirm setup hooks before writing TEST-04/05/06.
- `tests/components/watch/WatchForm.isChronometer.test.tsx` and `tests/components/watch/WatchForm.notesPublic.test.tsx` — existing partial-coverage style; TEST-06 augments rather than replaces these
- `tests/api/extract-watch-auth.test.ts` — existing auth-only coverage; TEST-05 covers the rest
- `tests/integration/phase13-notifications-flow.test.ts` and `tests/components/notifications/NotificationRow.test.tsx` — current notification-test patterns (planner reads to keep style consistent)

### Deploy Documentation

- `docs/deploy-db-setup.md` — local + prod database setup, includes the `supabase db push --linked` pattern. Plan 24-NN that ships the prod migration should append a backout-plan section here following the Phase 21 precedent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`scripts/`** directory has multiple precedents (`backfill-catalog.ts`, `refresh-counts.ts`, `backfill-taste.ts`) — `preflight-notification-types.ts` (D-01) follows the same shape: `tsx --env-file=.env.local` invocation, Drizzle `db` client, exit-non-zero on assertion failure.
- **In-migration `DO $$ ... RAISE EXCEPTION` block** has a working precedent at `supabase/migrations/20260423000047_phase11_backfill_coverage_assertion.sql` — copy syntax verbatim for D-01's in-migration assertion.
- **`useWatchStore` setState reset pattern** for TEST-04 — Zustand's vanilla `useWatchStore.setState(initialState, true)` (replace mode) inside `beforeEach` is the standard pattern; mirror existing test styles in `tests/store/` (if any) or `tests/data/` for setup ergonomics.
- **`vi.mock` patterns** for outbound `fetch` already exist in `tests/api/` (referenced via `tests/api/extract-watch-auth.test.ts`) and `tests/data/` integration tests — TEST-05 builds on whatever pattern those use.

### Established Patterns

- **rename + recreate ENUM evolution** (PROJECT.md Key Decision): `ALTER TYPE notification_type RENAME TO notification_type_old; CREATE TYPE notification_type AS ENUM ('follow','watch_overlap'); ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::text::notification_type; DROP TYPE notification_type_old;`
- **Drizzle pgEnum updated AFTER prod migration applies** — established in Phase 11 (D-09) and reaffirmed by success criteria #2. Never ship Drizzle changes that lead the SQL.
- **Two-layer defense** (Phase 11 D-25, Phase 13 D-09) — D-01's belt-and-suspenders preflight follows this established posture.
- **Test file naming:** `tests/{layer}/{Subject}.test.{ts|tsx}` — TEST-04 → `tests/store/watchStore.test.ts`; TEST-05 → `tests/api/extract-watch.test.ts`; TEST-06 → `tests/components/{filters,watch}/{Component}.test.tsx`.

### Integration Points

- **Drizzle schema** (`src/db/schema.ts`) — single source of truth for the `pgEnum`; updates here ripple through every consumer of the inferred TS types.
- **Server Actions / DAL** (`src/data/notifications.ts`, `src/app/actions/notifications.ts`) — type narrowing in D-03 ripples through these; TS errors will guide the cleanup.
- **Render layer** (`src/components/notifications/`) — the deletion endpoint; aggressive narrowing in D-03 ensures every render site is touched.
- **CI gate** — D-01's `npm run db:preflight-notification-cleanup` script needs to run in the deploy pipeline before `supabase db push --linked`; whether that's a GitHub Action step or a manual checklist item in `docs/deploy-db-setup.md` is the planner's call (recommend both — automate when CI exists, document until then).

</code_context>

<specifics>
## Specific Ideas

- **Empirical fact, not roadmap-stated:** Only 4 test files reference `wornPublic` in the current tree (not 9 as the roadmap text states). Researcher should grep `wornPublic|worn_public` and reconcile. The 9-count likely reflects an earlier inventory or counts call-sites rather than files; this is a documentation drift, not a missing-deletion.
- **Existing partial coverage of WatchForm:** Don't duplicate — augment. `tests/components/watch/WatchForm.isChronometer.test.tsx` and `WatchForm.notesPublic.test.tsx` exist; TEST-06 fills the rest of the surface.
- **Existing partial coverage of `/api/extract-watch`:** `tests/api/extract-watch-auth.test.ts` covers the auth gate only; TEST-05 covers everything past the gate.
- **The `_wornPublic` parameter in `tests/data/getWearRailForViewer.test.ts:363`** is a leftover compat-stub (renamed to `_wornPublic` with the underscore signaling "unused"). Remove the parameter entirely as part of D-04 — TS will guide deletion of every caller's positional arg.

</specifics>

<deferred>
## Deferred Ideas

- **None raised in discussion.** The user delegated all four gray areas to Claude's Discretion without scope-creep prompts. If any emerge during planning or execution, route them through the deferred-ideas mechanism and the planner / executor's capture-and-continue protocol.

</deferred>

---

*Phase: 24-notification-stub-cleanup-test-fixture-carryover*
*Context gathered: 2026-05-01*
