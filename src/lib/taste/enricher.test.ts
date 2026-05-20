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
    movement: 'auto',
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
    // Phase 49.1 Plan 06 — primaryArchetype dropped from CatalogTasteAttributes
    // and from the LLM tool schema; happy path now asserts the surviving fields.
    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).not.toBeNull()
    expect(result?.formality).toBe(0.7)
    expect(result?.sportiness).toBe(0.2)
    expect(result?.heritageScore).toBe(0.85)
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

  // Phase 49.1 Plan 06 — out-of-vocab archetype drift test removed; the
  // primary_archetype field is no longer part of the LLM tool schema, Zod
  // wire schema, or validateAndCleanTaste. The era-signal drift remains as
  // the surviving sibling-pattern test.

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
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6')
  })

  it('primary call is auto with web_search + the custom tool available', async () => {
    await enrichTasteAttributes(BASE_INPUT)
    // The primary call lets the model web_search for grounding and emit the
    // custom tool in one turn — when it does, no fallback call is made.
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({ type: 'auto' })
    const toolNames = mockCreate.mock.calls[0][0].tools.map((t: { name: string }) => t.name)
    expect(toolNames).toContain('web_search')
    expect(toolNames).toContain('record_taste_attributes')
  })

  it('forces the custom tool in a prefill-free fallback when the primary has no tool_use', async () => {
    // Primary: model web-searches and answers in text WITHOUT emitting the
    // custom tool. Fallback: a forced-tool call that must end with a user
    // message and replay no tool blocks — claude-sonnet-4-6 rejects
    // assistant-message prefill (regression: API 400).
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: 'server_tool_use', id: 'srvtoolu_x', name: 'web_search', input: { query: 'q' } },
          { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_x', content: [] },
          { type: 'text', text: 'Research summary of the watch.' },
        ],
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'toolu_final', name: 'record_taste_attributes', input: VALID_TOOL_USE_INPUT }],
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        stop_reason: 'tool_use',
      })

    const result = await enrichTasteAttributes(BASE_INPUT)
    expect(result).not.toBeNull()
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate.mock.calls[1][0].tool_choice).toEqual({ type: 'tool', name: 'record_taste_attributes' })

    // Prefill-safety: the fallback request ends with a user message and carries
    // no replayed tool blocks of any kind.
    const fallbackMessages = mockCreate.mock.calls[1][0].messages
    expect(fallbackMessages[fallbackMessages.length - 1].role).toBe('user')
    for (const m of fallbackMessages) {
      const blocks = typeof m.content === 'string' ? [] : m.content
      for (const b of blocks as Array<{ type: string }>) {
        expect(['tool_use', 'server_tool_use', 'web_search_tool_result']).not.toContain(b.type)
      }
    }

    // The primary call's research text is folded into the user message.
    const lastMsg = fallbackMessages[fallbackMessages.length - 1]
    const lastText = typeof lastMsg.content === 'string'
      ? lastMsg.content
      : (lastMsg.content as Array<{ text?: string }>).map(b => b.text ?? '').join(' ')
    expect(lastText).toContain('Research summary of the watch.')
  })
})
