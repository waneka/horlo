// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Integration coverage for the v8.4 `--apply --mode=both` idempotency gate
// (D-79-04). First run writes; second run hits the "Already applied — nothing
// to do." pre-flight gate and exits 0 with no DB writes. Also asserts the
// D-79-06 alias-append idempotency at the integration tier (second run does
// NOT append duplicate entries to watch_families.aliases).
//
// DATABASE_URL-gated per Phase 78 convention: when env unset the suite is
// described-skipped (↓ skipped) and only the outer sanity test runs.
// Plan 02/04 ships the --apply flag + the already-applied gate; this stub
// is the assertion harness those plans un-todo.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const SCRIPT_PATH = 'scripts/v8.4-brand-canonicalization.ts'

// Suppress unused-var noise — Plan 02+ will use these in the un-todoed tests.
void SCRIPT_PATH
void postgres

function runScript(args: string[] = []): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
  })
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}
void runScript

it('Wave 0 RED stub loads', () => {
  expect(true).toBe(true)
})

maybe('Phase 79 — v8.4 --apply --mode=both idempotent (D-79-04 + D-79-06)', () => {
  beforeAll(() => {
    // TODO Plan 02+: install known-good brand + family decision fixtures so
    // the first --apply run has clean input.
  })

  afterAll(() => {
    // TODO Plan 02+: restore operator's decision files (per the apply-atomic
    // backup/restore pattern).
  })

  it.todo('D-79-04: first --apply --mode=both run exits 0 and writes (counts > 0)')
  it.todo(
    'D-79-04: second --apply --mode=both run exits 0 with stdout matching /Already applied — nothing to do\\./ (no writes; pre vs post snapshot identical)',
  )
  it.todo(
    'D-79-06: second --apply --mode=both does NOT append duplicate alias entries (post-second-run cardinality of every watch_families.aliases array equals post-first-run cardinality)',
  )
})
