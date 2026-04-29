import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

describe('scripts/backfill-taste.ts --dry-run', () => {
  it('dry run reports row count and cost without API calls', () => {
    // Run via tsx with the existing env-file flag
    const output = execSync('tsx --env-file=.env.local scripts/backfill-taste.ts --dry-run', {
      encoding: 'utf-8',
      timeout: 30_000,
    })
    expect(output).toMatch(/DRY RUN/)
    expect(output).toMatch(/rows with NULL confidence/)
    expect(output).toMatch(/estimated cost/)
    expect(output).toMatch(/no API calls made/)
  })
})

describe('scripts/reenrich-taste.ts', () => {
  it('exits with usage hint when no flags', () => {
    let exitCode = 0
    try {
      execSync('tsx --env-file=.env.local scripts/reenrich-taste.ts', {
        encoding: 'utf-8',
        timeout: 10_000,
      })
    } catch (err: unknown) {
      const e = err as { status?: number; stderr?: Buffer }
      exitCode = e.status ?? -1
      const stderr = e.stderr?.toString() ?? ''
      expect(stderr).toMatch(/missing --force flag/)
    }
    expect(exitCode).toBe(1)
  })
})
