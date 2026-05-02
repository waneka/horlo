---
phase: 24-notification-stub-cleanup-test-fixture-carryover
plan: 01
subsystem: tooling
tags: [preflight, db, debt-03, notification-cleanup, scripts]
requires: []
provides:
  - scripts/preflight-notification-types.ts
  - npm:db:preflight-notification-cleanup
affects:
  - package.json
tech_stack_added: []
patterns_used:
  - drizzle-execute-sql-template
  - tsx-env-file-script
  - whitelist-not-blacklist-assertion
key_files_created:
  - scripts/preflight-notification-types.ts
key_files_modified:
  - package.json
decisions:
  - "Whitelist phrasing per D-01 reconciliation (RESEARCH.md A6): type::text NOT IN ('follow','watch_overlap') — same coverage as the original blacklist for known stub values, plus catches unexpected/corrupt values (Pitfall 2)"
  - "Drizzle db client (not raw pg.Client) — consistent with sibling scripts/refresh-counts.ts and scripts/backfill-catalog.ts"
  - "Relative import from '../src/db' — tsx does not resolve @/* aliases at runtime (Pitfall 7)"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
completed_date: "2026-05-01"
requirements_satisfied: [DEBT-03]
---

# Phase 24 Plan 01: Preflight Notification Types Script Summary

Layer-1 standalone preflight assertion script for the Phase 24 notification_type ENUM rename+recreate, with whitelist phrasing and an `npm run db:preflight-notification-cleanup` invocation entry.

## Objective

Land the standalone preflight assertion script (D-01 layer-1) as the FIRST commit of Phase 24. Pairs with the in-migration `DO $$` whitelist preflight in plan 24-02 to give belt-and-suspenders coverage per CONTEXT.md D-01.

## What Was Built

### `scripts/preflight-notification-types.ts` (NEW, 47 lines)

Standalone TypeScript script that:

- Imports the Drizzle `db` client via relative path `'../src/db'` (Pitfall 7 — `tsx` does not resolve `@/*` aliases at runtime)
- Runs a single read-only `SELECT count(*)::int` query against `notifications` with the **whitelist** predicate: `WHERE type::text NOT IN ('follow', 'watch_overlap')`
- Exits 0 with `[preflight] OK ...` line if the count is zero (safe to apply migration)
- Exits 1 with `[preflight] FAILED — N notification rows ...` line if any out-of-whitelist rows exist
- Wraps `main()` in `.catch(...)` for fatal errors with `[preflight] fatal:` prefix and exit 1

Shape mirrors the closest sibling `scripts/refresh-counts.ts`: same Drizzle import, same `tsx --env-file=.env.local` invocation pattern, same explicit `process.exit` codes, same `[prefix]` console output convention.

### `package.json` (MODIFIED)

Added one new entry to the `scripts` block, placed adjacent to the other `db:*` entries (after `db:reenrich-taste`):

```json
"db:preflight-notification-cleanup": "tsx --env-file=.env.local scripts/preflight-notification-types.ts"
```

No other entries modified; no `dependencies` / `devDependencies` changes.

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Whitelist phrasing `type::text NOT IN ('follow','watch_overlap')` | Per D-01 reconciliation in 24-RESEARCH.md A6. Covers the two known stub values (`price_drop`, `trending_collector`) AND any unexpected/corrupt values (Pitfall 2). Strict improvement over the original blacklist. |
| 2 | Drizzle `db` client (not raw `pg.Client`) | Consistent with sibling scripts (`refresh-counts.ts`, `backfill-catalog.ts`). One less moving part. |
| 3 | Relative import `'../src/db'` (NOT `@/db`) | `tsx` does not resolve `@/*` aliases at runtime (Pitfall 7). Documented in `scripts/backfill-catalog.ts:14` as the canonical caveat. |
| 4 | No retry, no transaction wrapping, no explicit pool teardown | Read-only `SELECT` — no need for transactions; Drizzle handles pool teardown on `process.exit`. Matches `refresh-counts.ts` minimal shape. |
| 5 | Error message includes the count only, not row IDs | Per RESEARCH.md §"Security Domain / V7 Error Handling and Logging": count is fine, row IDs would be a leak. T-24-PREFLIGHT-03 accepted disposition. |

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-24-PREFLIGHT-01 | mitigate | Layer-1 (this plan) catches the condition at deploy-prep time. Layer-2 in-migration `DO $$` block lands in plan 24-02. |
| T-24-PREFLIGHT-02 | mitigate | Layer-1 alone is bypassable by skipping CI; layer-2 (plan 24-02) closes the gap. |
| T-24-PREFLIGHT-03 | accept | Error message leaks row count only — no PII. |
| T-24-PREFLIGHT-04 | mitigate | Relative import `from '../src/db'` per Pitfall 7. Zero `from '@/` occurrences in the new file (acceptance criterion enforced). |

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | Create `scripts/preflight-notification-types.ts` (DEBT-03 layer 1) | scripts/preflight-notification-types.ts |
| 2 | Add `db:preflight-notification-cleanup` npm script entry (DEBT-03) | package.json |

## Verification

### Acceptance Criteria — Task 1

- [x] File `scripts/preflight-notification-types.ts` exists
- [x] File contains the literal string `type::text NOT IN ('follow', 'watch_overlap')` (whitelist, not blacklist) — line 31
- [x] File contains `from '../src/db'` (relative import) — line 24
- [x] File does NOT contain `from '@/` (no path-alias imports — Pitfall 7)
- [x] File contains `process.exit(1)` and `process.exit(0)` — lines 37, 41, 46
- [x] File contains `[preflight] FAILED` and `[preflight] OK` log prefixes — lines 36, 40
- [x] File contains `main().catch(` top-level error handler — line 44

### Acceptance Criteria — Task 2

- [x] `package.json` `scripts` object contains key `db:preflight-notification-cleanup` — line 16
- [x] Value contains `tsx --env-file=.env.local scripts/preflight-notification-types.ts`
- [x] No other entries in `scripts` are modified (only a trailing comma added to the previous line)
- [ ] `npm run db:preflight-notification-cleanup --silent` is invocable — **NOT VERIFIED in this session** (Bash tool became non-functional during execution; live invocation deferred to user re-run)

## Deviations from Plan

### Environment Issue — Bash Tool Non-Functional

The Bash tool returned exit code 1 for every invocation in BOTH the executor worktree and this orchestrator session. This blocked:

1. Per-task commits via `git commit --no-verify`
2. Live verification via `npm run db:preflight-notification-cleanup`
3. Worktree merge-back

**Recovery:** The work product was successfully transferred from the executor's worktree (`/.claude/worktrees/agent-a27035652ef03dda1/`) into the main tree using Read/Write/Edit file tools. Files are now present in the main tree but **uncommitted** at the time this SUMMARY was written.

**User action required:** Run the following once Bash works again, OR review and apply the changes manually:

```bash
git add scripts/preflight-notification-types.ts package.json .planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-01-SUMMARY.md
git commit --no-verify -m "feat(24-01): add preflight-notification-types script + npm entry (DEBT-03 layer 1)"
git worktree remove /Users/tylerwaneka/Documents/horlo/.claude/worktrees/agent-a27035652ef03dda1 --force
```

Then verify the script invokes cleanly:

```bash
npm run db:preflight-notification-cleanup
# Expected: [preflight] OK — zero out-of-whitelist notification.type rows. Safe to apply migration.
```

## Files Changed

### Created

- `scripts/preflight-notification-types.ts` (47 lines, NEW)
- `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-01-SUMMARY.md` (this file)

### Modified

- `package.json` (+1 line — new `db:preflight-notification-cleanup` script entry, trailing comma added to `db:reenrich-taste` line)

## Self-Check: PASSED (with environment caveat)

All file-state acceptance criteria are met. Commit-state and live-run verifications are deferred to a follow-up session due to the non-functional Bash tool.
