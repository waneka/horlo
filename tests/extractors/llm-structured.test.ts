import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 66 Plan 01 — structured-INPUT LLM extractor unit tests (EXTR-04)
//
// Asserts that extractFromStructuredInput():
//   - calls Anthropic messages.create with claude-sonnet-4-6 + max_tokens 1024
//     + tool_choice forcing extract_watch_from_identity
//   - maps the returned tool_use.input through validateAndCleanData and
//     returns a typed ExtractedWatchData shape
//   - throws on missing tool_use block in the response (Pitfall 1 fallback)
//   - throws on missing ANTHROPIC_API_KEY env var
//   - emits Reference/Year lines in the user message ONLY when supplied
//
// @anthropic-ai/sdk is fully mocked — no network call is made. Mirrors the
// canonical mock dance in tests/extractors/llm.test.ts:1-23.
// ---------------------------------------------------------------------------

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }))
  return { default: MockAnthropic }
})

// Import AFTER the vi.mock declaration so the module picks up the mock.
const { extractFromStructuredInput } = await import('@/lib/extractors/llm-structured')

describe('extractFromStructuredInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'

    // Default successful tool-use response shape (adapted from llm.test.ts
    // text-completion fixture per PATTERNS §B2).
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_default',
          name: 'extract_watch_from_identity',
          input: { brand: 'Omega', model: 'Speedmaster' },
        },
      ],
    })
  })

  it('calls messages.create with model claude-sonnet-4-6, max_tokens 1024, and tool_choice forcing extract_watch_from_identity', async () => {
    await extractFromStructuredInput({ brand: 'Omega', model: 'Speedmaster' })

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0] as {
      model: string
      max_tokens: number
      tools: Array<{ name: string }>
      tool_choice: { type: string; name: string }
    }
    expect(callArgs.model).toBe('claude-sonnet-4-6')
    expect(callArgs.max_tokens).toBe(1024)
    expect(callArgs.tools[0].name).toBe('extract_watch_from_identity')
    expect(callArgs.tool_choice).toEqual({
      type: 'tool',
      name: 'extract_watch_from_identity',
    })
  })

  it('maps tool input through validateAndCleanData and returns ExtractedWatchData', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_abc',
          name: 'extract_watch_from_identity',
          input: {
            brand: 'Omega',
            model: 'Speedmaster',
            movement: 'auto',
            caseSizeMm: 42,
          },
        },
      ],
    })

    const result = await extractFromStructuredInput({
      brand: 'Omega',
      model: 'Speedmaster',
    })

    // validateAndCleanData should round-trip enum-valid input untouched.
    expect(result.brand).toBe('Omega')
    expect(result.model).toBe('Speedmaster')
    expect(result.movement).toBe('auto')
    expect(result.caseSizeMm).toBe(42)
  })

  it('throws when response has no tool_use block (Pitfall 1 fallback)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'lorem ipsum' }],
    })

    await expect(
      extractFromStructuredInput({ brand: 'Omega', model: 'Speedmaster' }),
    ).rejects.toThrow(/tool_use/)
  })

  it('throws when ANTHROPIC_API_KEY env var is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY

    await expect(
      extractFromStructuredInput({ brand: 'Omega', model: 'Speedmaster' }),
    ).rejects.toThrow('ANTHROPIC_API_KEY not configured')
  })

  it('user message includes Reference and Year lines only when supplied', async () => {
    // First call — with reference + year supplied
    await extractFromStructuredInput({
      brand: 'Rolex',
      model: 'Submariner',
      reference: '116610LN',
      year: 2018,
    })

    const withCall = mockCreate.mock.calls[0][0] as {
      messages: Array<{ content: string }>
    }
    const withContent = withCall.messages[0].content
    expect(withContent).toContain('Brand: Rolex')
    expect(withContent).toContain('Model: Submariner')
    expect(withContent).toContain('Reference: 116610LN')
    expect(withContent).toContain('Year: 2018')

    // Second call — without reference / year
    await extractFromStructuredInput({
      brand: 'Rolex',
      model: 'Submariner',
    })

    const withoutCall = mockCreate.mock.calls[1][0] as {
      messages: Array<{ content: string }>
    }
    const withoutContent = withoutCall.messages[0].content
    expect(withoutContent).toContain('Brand: Rolex')
    expect(withoutContent).toContain('Model: Submariner')
    expect(withoutContent).not.toContain('Reference:')
    expect(withoutContent).not.toContain('Year:')
  })
})
