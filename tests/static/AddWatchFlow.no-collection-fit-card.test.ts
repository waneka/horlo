// @vitest-environment node
//
// This guard walks the filesystem (readdirSync/statSync) and reads source files.
// It MUST run in the node environment — under the config default (jsdom), vite
// externalizes node:fs "for browser compatibility" and readdirSync becomes
// undefined. That difference is environment-dependent: it passed locally but
// failed Vercel's build (prebuild hook) with "readdirSync is not a function".
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 71 CLNP-03 + Pitfall 1: No file in the add-flow component tree MUST
 * import CollectionFitCard. The add-flow is a data-entry surface; fit analysis
 * belongs on the watch-detail / insights surfaces only.
 *
 * Mirrors Phase 20 D-04 (CollectionFitCard.no-engine.test.ts) for the add-flow tree.
 * While a listed file does not exist, its check passes vacuously.
 */
const ADD_FLOW_FILES = [
  'src/components/watch/AddWatchFlow.tsx',
  'src/components/watch/SearchEntry.tsx',
  'src/components/watch/StructuredEntryPanel.tsx',
  'src/components/watch/ConfirmStep.tsx',
  'src/components/watch/DupeBanner.tsx',
  'src/components/watch/WatchForm.tsx',
  'src/components/watch/WatchPhotoStep.tsx',
  'src/components/watch/ExtractErrorCard.tsx',
]

describe('Phase 71 CLNP-03 — add-flow no-CollectionFitCard invariant', () => {
  for (const filePath of ADD_FLOW_FILES) {
    it(`${filePath} does not import CollectionFitCard`, () => {
      if (!existsSync(filePath)) return
      const src = readFileSync(filePath, 'utf8')
      expect(src).not.toMatch(/from ['"].*CollectionFitCard['"]/)
    })
  }
})
