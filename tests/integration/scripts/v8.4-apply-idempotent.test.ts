// Phase 79 / 79-04-PLAN.md — GREEN (was Wave 0 RED stub).
//
// Integration coverage for the v8.4 `--apply --mode=both` idempotency gate
// (D-79-04). First run writes; second run hits the "Already applied — nothing
// to do." pre-flight gate and exits 0 with no DB writes. Also asserts the
// D-79-06 alias-append idempotency at the integration tier (second run does
// NOT append duplicate entries to watch_families.aliases).
//
// Test ordering note: this suite ASSUMES the local DB is already in the
// post-apply state (every catalog row has brand_id + family_id resolved) —
// the v8.4-apply-atomic.test.ts suite (run before this one alphabetically /
// by suite registration order) leaves the DB hydrated. The first
// `runScript(['--apply', '--mode=both'])` call here therefore hits the
// already-applied gate immediately and exits 0 with the "Already applied"
// message; the second call confirms re-run safety.
//
// DATABASE_URL-gated per Phase 78 convention: when env unset the suite is
// described-skipped (↓ skipped) and only the outer sanity test runs.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const SCRIPT_PATH = 'scripts/v8.4-brand-canonicalization.ts'
const FAMILY_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-family-merge-decisions.md',
)
const FAMILY_BACKUP = path.join(
  process.cwd(),
  '.planning/v8.4-family-merge-decisions.md.apply-idempotent-backup',
)

function runScript(args: string[] = []): {
  exitCode: number
  stdout: string
  stderr: string
} {
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

it('Wave 0 RED stub loads', () => {
  expect(true).toBe(true)
})

maybe('Phase 79 — v8.4 --apply --mode=both idempotent (D-79-04 + D-79-06)', () => {
  let sql: ReturnType<typeof postgres>

  beforeAll(async () => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })
    // Back up any pre-existing family file so the test doesn't clobber
    // operator state. (The apply-atomic test that ran before this one in the
    // same vitest invocation may have already generated + restored the file.)
    if (existsSync(FAMILY_PATH))
      writeFileSync(FAMILY_BACKUP, readFileSync(FAMILY_PATH, 'utf8'))
  })

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 5 })
    if (existsSync(FAMILY_BACKUP)) {
      writeFileSync(FAMILY_PATH, readFileSync(FAMILY_BACKUP, 'utf8'))
      unlinkSync(FAMILY_BACKUP)
    }
  })

  it('D-79-04: --apply --mode=both on an already-applied DB exits 0 with stdout matching /Already applied/', () => {
    // Pre-condition: the v8.4-apply-atomic.test.ts suite already brought the
    // local DB to the post-apply state (every catalog row has brand_id +
    // family_id resolved). The D-79-04 idempotent re-run gate fires BEFORE
    // strict gate so this run does NOT require the decisions files to exist.
    const result = runScript(['--apply', '--mode=both'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/Already applied/)
  })

  it('D-79-04: a second --apply --mode=both also exits 0 with the same "Already applied" gate (re-run safe)', () => {
    const result = runScript(['--apply', '--mode=both'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/Already applied/)
  })

  it('D-79-06: alias cardinality stable across re-runs (re-run does not duplicate alias entries)', async () => {
    const beforeRun = await sql<
      { name: string; cardinality: number }[]
    >`
      SELECT name, cardinality(aliases) AS cardinality
      FROM watch_families
      WHERE cardinality(aliases) > 0
      ORDER BY name
    `
    const result = runScript(['--apply', '--mode=both'])
    expect(result.exitCode).toBe(0)
    const afterRun = await sql<
      { name: string; cardinality: number }[]
    >`
      SELECT name, cardinality(aliases) AS cardinality
      FROM watch_families
      WHERE cardinality(aliases) > 0
      ORDER BY name
    `
    expect(afterRun.length).toBe(beforeRun.length)
    for (let i = 0; i < beforeRun.length; i++) {
      expect(afterRun[i].name).toBe(beforeRun[i].name)
      expect(Number(afterRun[i].cardinality)).toBe(
        Number(beforeRun[i].cardinality),
      )
    }
  })
})
