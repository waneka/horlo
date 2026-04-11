import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = [
  /\bbg-gray-\d/,
  /\btext-gray-\d/,
  /\bborder-gray-\d/,
  /\bhover:bg-gray-\d/,
  /\bhover:text-gray-\d/,
  /\bbg-green-\d/,
  /\bbg-blue-\d/,
  /\bbg-purple-\d/,
  /\bbg-yellow-\d/,
  /\bbg-red-\d/,
  /\btext-red-\d/,
  /\btext-blue-\d/,
  /\btext-yellow-\d/,
  /\btext-green-\d/,
  /\bfont-medium\b/,
  /\bfont-bold\b/,
  /\bfont-light\b/,
]

// Shadcn primitives use their own token system internally and Phase 1
// forbids editing their source — skip them in the invariant.
const SKIP_DIRS = ['src/components/ui']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (SKIP_DIRS.some((s) => full.startsWith(s))) continue
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('no raw Tailwind palette or forbidden weights', () => {
  const files = [
    ...walk('src/components'),
    ...walk('src/app'),
  ]

  for (const file of files) {
    for (const pattern of FORBIDDEN) {
      it(`${file} does not use ${pattern}`, () => {
        const src = readFileSync(file, 'utf8')
        expect(src).not.toMatch(pattern)
      })
    }
  }
})
