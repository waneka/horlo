import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-04 D-06 — getVerdictForCatalogWatch Server Action.
 *
 * Filled by Plan 05 Task: "Implement Server Action + tests".
 */
describe('D-06 getVerdictForCatalogWatch Server Action (Plan 05)', () => {
  it.todo('returns {success:false, error:"Not authenticated"} when getCurrentUser throws')
  it.todo('returns {success:false, error:"Invalid request"} when catalogId is not a UUID')
  it.todo('returns {success:false, error:"Invalid request"} when extra fields present (Zod .strict)')
  it.todo('returns {success:false, error:"Watch not found"} when getCatalogById returns null')
  it.todo('returns {success:true, data:VerdictBundle} for valid request with viewer.collection.length > 0')
  it.todo('VerdictBundle is plain JSON-serializable (no Date, Map, Set in returned object — Pitfall 3)')
  it.todo('framing in returned bundle is "cross-user" (search rows are always non-owned per Plan 05 contract)')
  it.todo('uses user.id from getCurrentUser — never accepts viewerId from input (V4 ASVS)')
})
