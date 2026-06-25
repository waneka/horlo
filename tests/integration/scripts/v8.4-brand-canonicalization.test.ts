// Phase 78 / 78-03-PLAN.md — GREEN.
//
// End-to-end integration for scripts/v8.4-brand-canonicalization.ts (MIG-01).
// Runs the dry-run against local Supabase via DATABASE_URL + service-role and
// asserts the operator-resolve artifact is written and the refuse-to-overwrite
// guard behaves per D-78-07.
//
// Gated on DATABASE_URL per the local-first integration idiom
// (analog: tests/integration/migration-drop-archetype.test.ts:26). Without
// DATABASE_URL the suite is described-skipped.
//
// The test backs up + restores any pre-existing .planning/v8.4-brand-merge-
// decisions.md so the operator's working file is not destroyed by the test.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const ARTIFACT_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)
const BACKUP_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md.test-backup',
)
const SCRIPT_PATH = 'scripts/v8.4-brand-canonicalization.ts'

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

maybe('Phase 78 — v8.4-brand-canonicalization.ts (end-to-end dry-run)', () => {
  beforeAll(() => {
    // Back up any pre-existing artifact so the test doesn't clobber the
    // operator's working file.
    if (existsSync(ARTIFACT_PATH)) {
      writeFileSync(BACKUP_PATH, readFileSync(ARTIFACT_PATH, 'utf8'))
      unlinkSync(ARTIFACT_PATH)
    }
  })

  afterAll(() => {
    // Restore the backup if present; otherwise leave the test-emitted artifact
    // in place (Task 3 commits it).
    if (existsSync(BACKUP_PATH)) {
      writeFileSync(ARTIFACT_PATH, readFileSync(BACKUP_PATH, 'utf8'))
      unlinkSync(BACKUP_PATH)
    }
  })

  it('first run with --force exits 0 and writes the GFM artifact with the D-78-01 header', () => {
    const result = runScript(['--force'])
    expect(result.exitCode).toBe(0)
    expect(existsSync(ARTIFACT_PATH)).toBe(true)
    const content = readFileSync(ARTIFACT_PATH, 'utf8')
    expect(content).toContain(
      '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
    )
    expect(content.length).toBeGreaterThan(100)
  }, 30000)

  it('second run without flags exits non-zero per D-78-07 (refuse-to-overwrite); stderr mentions --regenerate and --force', () => {
    // Precondition: previous test wrote the artifact.
    expect(existsSync(ARTIFACT_PATH)).toBe(true)
    const result = runScript([])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--regenerate/)
    expect(result.stderr).toMatch(/--force/)
  }, 30000)

  it('third run with --regenerate exits 0 per D-78-07', () => {
    expect(existsSync(ARTIFACT_PATH)).toBe(true)
    const result = runScript(['--regenerate'])
    expect(result.exitCode).toBe(0)
  }, 30000)
})
