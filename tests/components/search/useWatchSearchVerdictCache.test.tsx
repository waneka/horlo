import { describe, it } from 'vitest'

/**
 * Phase 20 D-06 — verdict cache keyed by viewer collection-revision.
 *
 * Filled by Plan 05 Task: "Implement useWatchSearchVerdictCache + tests".
 */
describe('D-06 useWatchSearchVerdictCache (Plan 05)', () => {
  it.todo('get() returns undefined for a never-set catalogId')
  it.todo('set() then get() returns the same VerdictBundle reference')
  it.todo('changing collectionRevision prop drops all cached entries')
  it.todo('hook does not refetch on re-render when revision is unchanged')
})
