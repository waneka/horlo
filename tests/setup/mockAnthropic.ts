// tests/setup/mockAnthropic.ts
//
// Shared Anthropic SDK mock fixture for Phase 19.1 enricher tests.
// Returns canned tool_use blocks; intercepts client.messages.create.

import { vi } from 'vitest'

export const VALID_TOOL_USE_INPUT = {
  formality: 0.7,
  sportiness: 0.2,
  heritage_score: 0.85,
  primary_archetype: 'dress' as const,
  era_signal: 'vintage-leaning' as const,
  design_motifs: ['gilt-dial', 'breguet-hands'],
  confidence: 0.9,
}

export function makeMockAnthropic(toolUseInput: object = VALID_TOOL_USE_INPUT) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: 'tool_use', name: 'record_taste_attributes', input: toolUseInput, id: 'toolu_test' }],
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
  })
  return {
    create,
    mockClient: { messages: { create } },
  }
}
