import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync as fsReadFileSync } from 'node:fs'

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
