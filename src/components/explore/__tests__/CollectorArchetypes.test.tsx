// src/components/explore/__tests__/CollectorArchetypes.test.tsx
//
// Wave 0 test scaffold for Phase 46 Plan 03 CollectorArchetypes component.
// Both tests are skipped — unskip in Plan 03 once CollectorArchetypes is built.
//
// Coverage (EXPL-02, EXPL-05):
//   1. Component renders null when archetype-count data is empty (EXPL-02 null-hide)
//   2. Component renders 10 chips when given 10 archetype counts

import { describe, it } from 'vitest'

describe('CollectorArchetypes', () => {
  // unskip in Plan 03 once CollectorArchetypes is built
  it.skip('renders null when archetype-count data is empty (EXPL-02 null-hide)', async () => {
    // Plan 03 TODO:
    //   const { container } = render(await CollectorArchetypes({ counts: [] }))
    //   expect(container.firstChild).toBeNull()
  })

  // unskip in Plan 03 once CollectorArchetypes is built
  it.skip('renders 10 archetype chips when given 10 archetype counts', async () => {
    // Plan 03 TODO:
    //   const counts = PRIMARY_ARCHETYPES.map(a => ({ archetype: a, count: 5 }))
    //   const { getAllByRole } = render(await CollectorArchetypes({ counts }))
    //   expect(getAllByRole('button')).toHaveLength(10)
  })
})
