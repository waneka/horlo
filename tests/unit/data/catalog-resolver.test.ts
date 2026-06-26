// @vitest-environment node
// Node env required:
//   1. The resolver under test (src/data/catalog-resolver.ts, Plan 02) carries
//      `import 'server-only'` and uses node:crypto. Under jsdom, the transitive
//      `server-only` boundary throws at module load, masking the RED signal.
//   2. Mirrors the [[vitest-static-fs-guards-node-env]] pattern for server-side
//      test code — Vercel prebuild externalizes node:fs under jsdom-default.
//
// Wave 0 RED state (Phase 80 Plan 01):
//   The resolver module `src/data/catalog-resolver.ts` does NOT yet exist (Plan 02
//   ships it). The top-level import below will throw "Cannot find module" when vitest
//   collects this file. That is the expected RED signal. Plan 02 must green all 10
//   cases without modifying this file.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ----- DB mock — queue-based so each test controls execute-call results -----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let execQueue: Array<unknown[]> = []

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(() => Promise.resolve(execQueue.shift() ?? [])),
  },
}))

// Top-level import — fails with "Cannot find module" until Plan 02 ships.
// This is the Wave 0 RED signal per the plan's verify command.
import {
  resolveBrandId,
  resolveFamilyId,
  BRAND_FUZZY_CLEAR_GAP,
} from '@/data/catalog-resolver'

describe('Phase 80 — catalog-resolver (INGEST-01..04)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    execQueue = []
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  // ---- Brand resolver tests ------------------------------------------------

  it('Brand Tier 1 (exact) — INGEST-01', async () => {
    // Tier 1 SELECT returns one matching row → short-circuit; no Tier 2/3 needed.
    execQueue.push([{ id: 'brand-uuid', name: 'Hamilton' }])

    const result = await resolveBrandId('Hamilton')

    expect(result.brandId).toBe('brand-uuid')
    expect(result.decision).toMatchObject({ tier: 'exact', decision: 'matched' })
    // Exact match must NOT emit any console.log events.
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('Brand Tier 2 (fuzzy clear-gap matched) — INGEST-02', async () => {
    // Tier 1 → empty; Tier 2 → two candidates (gap 0.23 ≥ BRAND_FUZZY_CLEAR_GAP 0.1).
    execQueue.push([]) // Tier 1 empty
    execQueue.push([
      { id: 'A', name: 'Hamilton', score: 0.85 },
      { id: 'B', name: 'Hamilton Watch', score: 0.62 },
    ]) // Tier 2 two candidates

    const result = await resolveBrandId('Hamilon')

    expect(result.brandId).toBe('A')
    expect(result.decision.tier).toBe('fuzzy')
    expect((result.decision as { tier: 'fuzzy'; score: number }).score).toBe(0.85)
    expect(
      (result.decision as { tier: 'fuzzy'; runnerUp?: { id: string; name: string; score: number } }).runnerUp
    ).toMatchObject({ id: 'B' })

    // Must emit exactly one fuzzy_brand_match log with the unified 8-key D-80-04 payload.
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][0]).toBe('[extract-watch] fuzzy_brand_match')
    const payload = logSpy.mock.calls[0][1]
    expect(payload).toMatchObject({
      input_raw: 'Hamilon',
      decision: 'matched',
      matched_id: 'A',
      matched_name: 'Hamilton',
      score: 0.85,
    })
    // D-80-04 unified whitelist — all 8 keys must be present (T-80-06 mitigation).
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        'input_raw',
        'decision',
        'matched_id',
        'matched_name',
        'score',
        'runner_up_id',
        'runner_up_name',
        'runner_up_score',
      ]),
    )
    // Gap assertion — verifies BRAND_FUZZY_CLEAR_GAP constant is respected.
    expect(0.85 - 0.62).toBeGreaterThanOrEqual(BRAND_FUZZY_CLEAR_GAP)
  })

  it('Brand Tier 2 (ambiguous → tied_auto_create) — INGEST-02/03', async () => {
    // Tier 1 → empty; Tier 2 → near-tie (gap 0.04 < 0.1 → falls through to auto-create).
    execQueue.push([]) // Tier 1 empty
    execQueue.push([
      { id: 'A', name: 'IWC', score: 0.72 },
      { id: 'B', name: 'IWC Schaffhausen', score: 0.68 },
    ]) // Tier 2 ambiguous
    execQueue.push([{ id: 'new-uuid', was_created: true }]) // Tier 3 auto-create

    const result = await resolveBrandId('Iwc')

    expect(result.decision.decision).toBe('tied_auto_create')
    expect(result.decision.tier).toBe('auto_create')

    // Two log events: fuzzy_brand_match (tied) + brand_auto_created.
    expect(logSpy).toHaveBeenCalledTimes(2)
    expect(logSpy.mock.calls[0][0]).toBe('[extract-watch] fuzzy_brand_match')
    expect(logSpy.mock.calls[0][1]).toMatchObject({ decision: 'tied_auto_create' })
    expect(logSpy.mock.calls[1][0]).toBe('[extract-watch] brand_auto_created')
    // Gap assertion — confirms BRAND_FUZZY_CLEAR_GAP boundary (0.04 < 0.1).
    expect(0.72 - 0.68).toBeLessThan(BRAND_FUZZY_CLEAR_GAP)
  })

  it('Brand Tier 3 (no candidates → no_candidates_auto_create) — INGEST-03', async () => {
    // Tier 1 → empty; Tier 2 → empty; Tier 3 INSERT → new row.
    execQueue.push([]) // Tier 1 empty
    execQueue.push([]) // Tier 2 empty (no candidates above threshold)
    execQueue.push([{ id: 'new-uuid', was_created: true }]) // Tier 3 auto-create INSERT

    const result = await resolveBrandId('Acme Chronograph Co')

    expect(result.brandId).toBe('new-uuid')
    expect(result.decision.decision).toBe('no_candidates_auto_create')
    expect(result.decision.tier).toBe('auto_create')

    // Must fire brand_auto_created event.
    expect(logSpy).toHaveBeenCalledWith(
      '[extract-watch] brand_auto_created',
      expect.any(Object),
    )

    // D-80-04 unified 8-key payload — auto-create events include null placeholders
    // for score + runner_up_* (unified shape per D-80-04; NOT a 5-key truncation).
    const autoCreateCall = logSpy.mock.calls.find(
      (c: unknown[]) => c[0] === '[extract-watch] brand_auto_created',
    )!
    const autoCreatePayload = autoCreateCall[1]
    expect(Object.keys(autoCreatePayload)).toEqual(
      expect.arrayContaining([
        'input_raw',
        'decision',
        'matched_id',
        'matched_name',
        'score',
        'runner_up_id',
        'runner_up_name',
        'runner_up_score',
      ]),
    )
    // Score + runner_up_* must be present as null (not omitted) for auto-create events.
    expect(autoCreatePayload.score).toBeNull()
    expect(autoCreatePayload.runner_up_id).toBeNull()
    expect(autoCreatePayload.runner_up_name).toBeNull()
    expect(autoCreatePayload.runner_up_score).toBeNull()
  })

  // ---- Family resolver tests -----------------------------------------------

  it('Family Tier 1 (exact) — INGEST-04', async () => {
    // Tier 1 exact match → short-circuit; Tier 2/3/4 mocks never consumed.
    execQueue.push([{ id: 'fam-uuid', name: 'Khaki Field' }]) // Tier 1 hit
    // Leave Tier 2/3/4 mocks absent — execQueue.shift() returns undefined (empty []).

    const result = await resolveFamilyId('hamilton-brand-uuid', 'Khaki Field')

    expect(result.familyId).toBe('fam-uuid')
    expect(result.decision).toMatchObject({ tier: 'exact', decision: 'matched' })
    // Tier 2/3/4 not consumed — queue must still be empty (only 1 execute call made).
    expect(execQueue.length).toBe(0)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('Family Tier 2 (alias hit beats fuzzy) — INGEST-04 / D-80-02', async () => {
    // Tier 1 → empty; Tier 2 alias → hit; Tier 3 fuzzy must NOT be consumed.
    execQueue.push([]) // Tier 1 empty
    execQueue.push([{ id: 'fam-uuid', name: 'Brut Datejust' }]) // Tier 2 alias hit
    execQueue.push([{ id: 'fuzzy-should-not-use', name: 'Brut Datejust Classic', score: 0.91 }]) // Tier 3 NOT consumed

    const result = await resolveFamilyId('brut-brand-uuid', 'Brut Date')

    expect(result.decision.tier).toBe('alias')
    expect(result.familyId).toBe('fam-uuid')
    // Tier 3 queue entry was NOT consumed → queue length should be 1 (alias-before-fuzzy).
    expect(execQueue.length).toBe(1)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('Family Tier 3 (fuzzy) — INGEST-04', async () => {
    // Tier 1 → empty; Tier 2 alias → empty; Tier 3 fuzzy → one hit.
    execQueue.push([]) // Tier 1 empty
    execQueue.push([]) // Tier 2 alias empty
    execQueue.push([{ id: 'fam-uuid', name: 'Portugieser', score: 0.78 }]) // Tier 3 fuzzy

    const result = await resolveFamilyId('iwc-brand-uuid', 'Portuguser')

    expect(result.decision.tier).toBe('fuzzy')
    expect(
      (result.decision as { tier: 'fuzzy'; score: number }).score
    ).toBe(0.78)
    expect(result.familyId).toBe('fam-uuid')

    // Must emit fuzzy_family_match event with brand_id in payload (D-80-04).
    expect(logSpy).toHaveBeenCalledWith(
      '[extract-watch] fuzzy_family_match',
      expect.objectContaining({
        brand_id: 'iwc-brand-uuid',
      }),
    )
    // D-80-04 unified 8-key payload.
    const fuzzyFamilyCall = logSpy.mock.calls.find(
      (c: unknown[]) => c[0] === '[extract-watch] fuzzy_family_match',
    )!
    expect(Object.keys(fuzzyFamilyCall[1])).toEqual(
      expect.arrayContaining([
        'input_raw',
        'decision',
        'matched_id',
        'matched_name',
        'score',
        'runner_up_id',
        'runner_up_name',
        'runner_up_score',
      ]),
    )
  })

  it('Family Tier 4 (auto-create) — INGEST-04', async () => {
    // All tiers miss → auto-create.
    execQueue.push([]) // Tier 1 empty
    execQueue.push([]) // Tier 2 alias empty
    execQueue.push([]) // Tier 3 fuzzy empty
    execQueue.push([{ id: 'new-fam', was_created: true }]) // Tier 4 INSERT

    const result = await resolveFamilyId('acme-brand-uuid', 'Foo Bar')

    expect(result.familyId).toBe('new-fam')

    // Must emit family_auto_created event with brand_id in payload.
    expect(logSpy).toHaveBeenCalledWith(
      '[extract-watch] family_auto_created',
      expect.objectContaining({ brand_id: 'acme-brand-uuid' }),
    )

    // D-80-04 unified 8-key payload — auto-create events include null placeholders.
    const autoCreateCall = logSpy.mock.calls.find(
      (c: unknown[]) => c[0] === '[extract-watch] family_auto_created',
    )!
    const autoCreatePayload = autoCreateCall[1]
    expect(Object.keys(autoCreatePayload)).toEqual(
      expect.arrayContaining([
        'input_raw',
        'decision',
        'matched_id',
        'matched_name',
        'score',
        'runner_up_id',
        'runner_up_name',
        'runner_up_score',
      ]),
    )
    // Score + runner_up_* must be null (not omitted) for auto-create.
    expect(autoCreatePayload.score).toBeNull()
    expect(autoCreatePayload.runner_up_id).toBeNull()
    expect(autoCreatePayload.runner_up_name).toBeNull()
    expect(autoCreatePayload.runner_up_score).toBeNull()
  })

  // ---- Edge cases ----------------------------------------------------------

  it('Empty model_raw → placeholder (unspecified) family', async () => {
    // resolveFamilyId with whitespace-only model should coerce to '(unspecified)'
    // and auto-create a placeholder family scoped to the brand.
    execQueue.push([]) // Tier 1 empty (searches for '(unspecified)' or '' — no match yet)
    execQueue.push([]) // Tier 2 alias empty
    execQueue.push([]) // Tier 3 fuzzy empty (word_similarity('', ...) < 0.6)
    execQueue.push([{ id: 'placeholder-fam', was_created: true }]) // Tier 4 auto-create

    const result = await resolveFamilyId('acme-brand-uuid', '   ')

    // Should auto-create (or find existing) a family with name '(unspecified)'.
    expect(result.familyId).toBe('placeholder-fam')
    // family_auto_created event must fire.
    expect(logSpy).toHaveBeenCalledWith(
      '[extract-watch] family_auto_created',
      expect.any(Object),
    )
  })

  it('Re-extract idempotency — same brandId returned on second call', async () => {
    // First call: Tier 1 miss → Tier 2 empty → Tier 3 auto-creates 'same-uuid'.
    execQueue.push([]) // 1st call Tier 1 empty
    execQueue.push([]) // 1st call Tier 2 empty
    execQueue.push([{ id: 'same-uuid', was_created: true }]) // 1st call Tier 3 auto-create

    // Second call: Tier 1 now returns the just-created row (idempotency).
    execQueue.push([{ id: 'same-uuid', name: 'Acme' }]) // 2nd call Tier 1 hit

    const result1 = await resolveBrandId('Acme')
    const result2 = await resolveBrandId('Acme')

    expect(result1.brandId).toBe('same-uuid')
    expect(result2.brandId).toBe('same-uuid')
  })
})
