import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync as fsReadFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

describe('src/lib/taste/webSearch.ts', () => {
  it('extractSourceUrls returns URLs in order from web_search_result blocks', async () => {
    const { extractSourceUrls } = await import('@/lib/taste/webSearch')
    // Hand-built content array with a web_search_tool_result block containing two results
    const content = [
      {
        type: 'web_search_tool_result' as const,
        tool_use_id: 'toolu_01',
        caller: { type: 'server' as const, name: 'web_search' as const },
        content: [
          {
            type: 'web_search_result' as const,
            url: 'https://example.com/rolex-submariner',
            title: 'Rolex Submariner',
            encrypted_content: '',
            page_age: null,
          },
          {
            type: 'web_search_result' as const,
            url: 'https://watchtime.com/review',
            title: 'Review',
            encrypted_content: '',
            page_age: null,
          },
        ],
      },
    ]
    const urls = extractSourceUrls(content as unknown as Parameters<typeof extractSourceUrls>[0])
    expect(urls).toEqual([
      'https://example.com/rolex-submariner',
      'https://watchtime.com/review',
    ])
  })

  it('extractSourceUrls returns [] when no web_search_tool_result blocks', async () => {
    const { extractSourceUrls } = await import('@/lib/taste/webSearch')
    const content = [
      { type: 'text' as const, text: 'Some text' },
      { type: 'tool_use' as const, id: 'tu_01', name: 'record_taste_attributes', input: {} },
    ]
    const urls = extractSourceUrls(content as unknown as Parameters<typeof extractSourceUrls>[0])
    expect(urls).toEqual([])
  })

  it('extractSourceUrls ignores web_search_tool_result blocks whose content is an error', async () => {
    const { extractSourceUrls } = await import('@/lib/taste/webSearch')
    const content = [
      {
        type: 'web_search_tool_result' as const,
        tool_use_id: 'toolu_01',
        caller: { type: 'server' as const, name: 'web_search' as const },
        content: {
          type: 'web_search_tool_result_error' as const,
          error_code: 'unavailable' as const,
        },
      },
    ]
    const urls = extractSourceUrls(content as unknown as Parameters<typeof extractSourceUrls>[0])
    expect(urls).toEqual([])
  })
})

describe('scripts/factual-apply.ts --dry-run', () => {
  it('prints DRY RUN and UPDATE statement for approved row, not for rejected row, and writes no migration file', () => {
    // Write a temp JSONL review file with one approved and one rejected entry
    const tempFile = join(tmpdir(), `factual-apply-test-${Date.now()}.jsonl`)
    const approvedEntry = JSON.stringify({
      catalog_id: '00000000-0000-0000-0000-000000000001',
      field: 'movement_type',
      current: null,
      proposed: 'auto',
      source_url: 'https://example.com/watch',
      approved: true,
    })
    const rejectedEntry = JSON.stringify({
      catalog_id: '00000000-0000-0000-0000-000000000002',
      field: 'movement_type',
      current: null,
      proposed: 'manual',
      source_url: 'https://example.com/watch2',
      approved: false,
    })
    writeFileSync(tempFile, `${approvedEntry}\n${rejectedEntry}\n`, 'utf-8')

    try {
      // Record migrations dir state before the dry-run
      const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
      const beforeFiles = readdirSync(migrationsDir)

      // Run factual-apply --dry-run
      const output = execSync(
        `npx tsx --env-file=/Users/tylerwaneka/Documents/horlo/.env.local scripts/factual-apply.ts --dry-run --review-file=${tempFile}`,
        { encoding: 'utf-8', timeout: 30_000 },
      )

      // Should print DRY RUN
      expect(output).toMatch(/DRY RUN/)

      // Should include an UPDATE for the approved catalog_id
      expect(output).toContain('UPDATE watches_catalog')
      expect(output).toContain('00000000-0000-0000-0000-000000000001')

      // Should NOT include an UPDATE for the rejected catalog_id
      expect(output).not.toContain('00000000-0000-0000-0000-000000000002')

      // No new migration file should have appeared in supabase/migrations/
      const afterFiles = readdirSync(migrationsDir)
      const newFiles = afterFiles.filter((f) => !beforeFiles.includes(f))
      const newMigrations = newFiles.filter((f) => f.includes('phase44_factual_data'))
      expect(newMigrations).toHaveLength(0)
    } finally {
      // Clean up temp file
      try { unlinkSync(tempFile) } catch { /* ignore */ }
    }
  })
})

describe('scripts/verify-catalog-coverage.ts', () => {
  it('source imports PRIMARY_ARCHETYPES from ../src/lib/taste/vocab', () => {
    const src = fsReadFileSync('scripts/verify-catalog-coverage.ts', 'utf-8')
    expect(src).toContain("PRIMARY_ARCHETYPES")
    expect(src).toContain("../src/lib/taste/vocab")
  })

  it('source contains confidence IS NULL taste hard-assertion', () => {
    const src = fsReadFileSync('scripts/verify-catalog-coverage.ts', 'utf-8')
    expect(src).toContain('confidence IS NULL')
  })

  it('source contains movement_type IS NULL factual hard-assertion', () => {
    const src = fsReadFileSync('scripts/verify-catalog-coverage.ts', 'utf-8')
    expect(src).toContain('movement_type IS NULL')
  })

  it('source contains array_length(style_tags, 1) IS NULL factual hard-assertion (ENRH-05 style_tags emptiness check)', () => {
    const src = fsReadFileSync('scripts/verify-catalog-coverage.ts', 'utf-8')
    expect(src).toContain('array_length(style_tags, 1) IS NULL')
  })

  // Integration test: requires a populated local DB (skip if DATABASE_URL not pointing at local).
  // Unskip once Task 2 (production enrichment run) has been completed.
  describe.skip('integration — requires populated local DB (unskip after Task 2 run)', () => {
    it('exits 0 against fully-populated local catalog', () => {
      execSync('tsx --env-file=.env.local scripts/verify-catalog-coverage.ts', {
        encoding: 'utf-8',
        timeout: 30_000,
      })
    })
  })
})

describe('scripts/backfill-taste.ts — source assertions (ENRH-01/D-14)', () => {
  const src = fsReadFileSync('scripts/backfill-taste.ts', 'utf-8')

  it('contains INTER_ROW_DELAY_MS pacing constant', () => {
    expect(src).toContain('INTER_ROW_DELAY_MS')
  })

  it('contains phase44_taste_data migration suffix string', () => {
    expect(src).toContain('phase44_taste_data')
  })

  it('contains generateMigrationFilename helper', () => {
    expect(src).toContain('generateMigrationFilename')
  })
})
