// src/lib/taste/enricher.test.ts
//
// Tests for Phase 19.1 enrichTasteAttributes() function.
//
// Mocking approach:
// - @anthropic-ai/sdk: vi.mock with a class whose constructor captures the args
//   so tests can inspect the messages.create call args.
// - @supabase/supabase-js: vi.mock createClient to return a stub that resolves
//   storage.from().createSignedUrl() with a fake signed URL.
// - global fetch: vi.stubGlobal to return canned ArrayBuffer bytes for the
//   vision-mode photo fetch. This avoids real network calls and lets tests
//   control the bytes handed to the base64 encoder.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { VALID_TOOL_USE_INPUT, makeMockAnthropic } from '../../../tests/setup/mockAnthropic'

// --- Anthropic SDK mock ---
// We need to capture `create` so each test can inspect calls or swap behavior.
let mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
      constructor() {}
    },
  }
})

// --- Supabase mock ---
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://fake.supabase.co/signed-url' },
          error: null,
        }),
      }),
    },
  }),
}))

// --- Import enricher AFTER mocks are set up ---
import { enrichTasteAttributes } from './enricher'
import type { EnrichmentInput } from './types'

const BASE_INPUT: EnrichmentInput = {
  catalogId: 'cat-001',
  source: 'manual',
  spec: {
    brand: 'Rolex',
    model: 'Datejust',
    reference: '1601',
    movement: 'automatic',
    caseSizeMm: 36,
    lugToLugMm: 44,
    waterResistanceM: 100,
    crystalType: 'sapphire',
    dialColor: 'silver',
    isChronometer: true,
    productionYear: 1972,
    complications: ['date'],
  },
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fake-service-key')

  // Reset create mock to return valid canned response by default
  const { create } = makeMockAnthropic(VALID_TOOL_USE_INPUT)
  mockCreate = create
  // Re-wire the mock module's create fn — we reassign the module-level ref
  // so the constructor in the vi.mock closure picks it up via the closure reference.
  // Since vi.mock captures the class and the class constructor uses `mockCreate`
  // from the outer scope, updating `mockCreate` before the test runs is sufficient.
  mockCreate.mockResolvedValue({
    content: [{ type: 'tool_use', name: 'record_taste_attributes', input: VALID_TOOL_USE_INPUT, id: 'toolu_test' }],
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('enrichTasteAttributes', () => {
  it('text mode happy path returns parsed taste', async () => {
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).not.toBeNull()
    expect(result?.formality).toBe(0.7)
    expect(result?.sportiness).toBe(0.2)
    expect(result?.heritageScore).toBe(0.85)
    expect(result?.primaryArchetype).toBe('dress')
    expect(result?.eraSignal).toBe('vintage-leaning')
    expect(result?.designMotifs).toEqual(['gilt-dial', 'breguet-hands'])
    expect(result?.confidence).toBe(0.9)
    expect(result?.extractedFromPhoto).toBe(false)
  })

  it('vision mode happy path sets extractedFromPhoto=true', async () => {
    // Stub global fetch to return canned bytes for the photo download
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer // fake JPEG header
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeBytes),
    }))

    const visionInput: EnrichmentInput = {
      ...BASE_INPUT,
      photoSourcePath: 'user-id/cat-001/photo.jpg',
    }
    const result = await enrichTasteAttributes(visionInput)
    expect(result).not.toBeNull()
    expect(result?.extractedFromPhoto).toBe(true)
  })

  it('no api key returns null and logs skipped event', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).toBeNull()
    const events = logSpy.mock.calls
      .map(call => { try { return JSON.parse(call[0]) } catch { return null } })
      .filter(Boolean)
    const skipped = events.find(e => e.event === 'taste_enrichment_skipped:no_api_key')
    expect(skipped).toBeDefined()
    expect(skipped?.catalog_id).toBe('cat-001')
  })

  it('fails non-fatal on network error', async () => {
    mockCreate.mockRejectedValue(new Error('5xx server error'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).toBeNull()
    const events = errorSpy.mock.calls
      .map(call => { try { return JSON.parse(call[0]) } catch { return null } })
      .filter(Boolean)
    const failed = events.find(e => e.event === 'taste_enrichment_failed')
    expect(failed).toBeDefined()
  })

  it('fails non-fatal on Zod parse error', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'record_taste_attributes', input: { invalid: 'data' }, id: 'toolu_bad' }],
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      stop_reason: 'tool_use',
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).toBeNull()
    const events = errorSpy.mock.calls
      .map(call => { try { return JSON.parse(call[0]) } catch { return null } })
      .filter(Boolean)
    const failed = events.find(e => e.event === 'taste_enrichment_failed' && e.error_class === 'zod_parse_failed')
    expect(failed).toBeDefined()
  })

  it('out-of-vocab archetype yields null archetype in result and emits drift event', async () => {
    // Feed a bad archetype through the mock — bypasses Anthropic strict:true
    // validation to exercise the post-parse vocab filter (validateAndCleanTaste).
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'record_taste_attributes',
        input: { ...VALID_TOOL_USE_INPUT, primary_archetype: 'BOGUS_ARCH' },
        id: 'toolu_drift',
      }],
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      stop_reason: 'tool_use',
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await enrichTasteAttributes(BASE_INPUT)
    // Result IS returned — vocab violation is dropped + warned, not fatal
    expect(result).not.toBeNull()
    expect(result?.primaryArchetype).toBeNull()
    const events = warnSpy.mock.calls
      .map(call => { try { return JSON.parse(call[0]) } catch { return null } })
      .filter(Boolean)
    const drift = events.find(e => e.event === 'taste_vocab_drift' && e.field === 'primary_archetype')
    expect(drift).toBeDefined()
    expect(drift?.value).toBe('BOGUS_ARCH')
  })

  it('returns null when response has no tool_use block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot assess this watch.' }],
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).toBeNull()
    const events = errorSpy.mock.calls
      .map(call => { try { return JSON.parse(call[0]) } catch { return null } })
      .filter(Boolean)
    const failed = events.find(e => e.event === 'taste_enrichment_failed' && e.error_class === 'no_tool_use_block')
    expect(failed).toBeDefined()
  })

  it('calls Anthropic with model claude-sonnet-4-6', async () => {
    await enrichTasteAttributes(BASE_INPUT)
    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
  })

  it('forces tool_choice to record_taste_attributes', async () => {
    await enrichTasteAttributes(BASE_INPUT)
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'record_taste_attributes' })
  })
})
