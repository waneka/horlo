# Deferred Items (Phase 51)

Items out of scope for the current plan — surfaced for triage.


## From 51-03 (2026-05-20)

- **`tests/integration/backfill-taste.test.ts` — 2 failures (pre-existing, env-related)**: `dry run reports row count and cost without API calls` and `exits with usage hint when no flags`. Both fail because the worktree environment lacks `.env.local` — `node: .env.local: not found`. Confirmed on baseline (pre-Task-2 state); unrelated to the F3-Composite structural change. Triage: the tests should either gracefully skip when `.env.local` is absent, or the worktree spawn process should symlink/copy `.env.local`. Filed as deferred per executor scope boundary (only auto-fix issues DIRECTLY caused by current task changes).
