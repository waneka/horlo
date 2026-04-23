import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * NAV-12: MobileNav retirement.
 *
 * These tests fail loudly if MobileNav.tsx is ever re-introduced or if a new
 * src file imports the old module path. Locks the deletion against accidental
 * regression.
 */
describe('NAV-12: MobileNav removal', () => {
  it('src/components/layout/MobileNav.tsx does not exist', () => {
    const p = path.resolve(process.cwd(), 'src/components/layout/MobileNav.tsx')
    expect(existsSync(p)).toBe(false)
  })

  it('no src file imports from @/components/layout/MobileNav or uses <MobileNav', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const content = readFileSync(full, 'utf8')
          if (
            content.includes("from '@/components/layout/MobileNav'") ||
            content.includes('<MobileNav')
          ) {
            offenders.push(full)
          }
        }
      }
    }
    walk(path.resolve(process.cwd(), 'src'))
    expect(offenders).toEqual([])
  })
})
