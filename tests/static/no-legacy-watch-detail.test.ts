// @vitest-environment node
// Filesystem-walking static guards need the node env, not jsdom, or
// existsSync silently misbehaves (see MEMORY project_vitest_static_node_env).

// WR-01 / quick-260912-jo6 — legacy `WatchDetail.tsx` was unrendered since
// Phase 64 and caused Plan 83-03 to edit a dead file; edit
// `WatchDetailHero.tsx` / `WatchDetailTrailing.tsx` instead.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('legacy WatchDetail.tsx must not be re-introduced', () => {
  it('src/components/watch/WatchDetail.tsx does not exist', () => {
    expect(existsSync(join(process.cwd(), 'src/components/watch/WatchDetail.tsx'))).toBe(false)
  })
})
