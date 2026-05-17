import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 43 Plan 01 — LLM extractor model ID assertion (PLSH-07 / D-13)
//
// Asserts that extractWithLlm() issues its Anthropic messages.create() call
// with model: 'claude-sonnet-4-6' (the non-deprecated model ID).
// @anthropic-ai/sdk is fully mocked — no network call is made.
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

// Import after mocking so the module picks up the mock
const { extractWithLlm } = await import('@/lib/extractors/llm')

describe('extractWithLlm — model ID', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Provide the API key so the function doesn't throw early
    process.env.ANTHROPIC_API_KEY = 'test-key'

    // Default successful response shape
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ brand: 'Rolex', model: 'Submariner' }),
        },
      ],
    })
  })

  it('calls messages.create with model claude-sonnet-4-6', async () => {
    const minimalHtml = '<html><head><title>Test Watch</title></head><body>Rolex Submariner</body></html>'
    await extractWithLlm(minimalHtml)

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0] as { model: string }
    expect(callArgs.model).toBe('claude-sonnet-4-6')
  })

  it('does NOT call messages.create with the deprecated model ID', async () => {
    const minimalHtml = '<html><head><title>Test Watch</title></head><body>Omega Seamaster</body></html>'
    await extractWithLlm(minimalHtml)

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0] as { model: string }
    expect(callArgs.model).not.toBe('claude-sonnet-4-20250514')
  })
})
