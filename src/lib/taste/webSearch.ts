// src/lib/taste/webSearch.ts
//
// Phase 44 shared two-turn web_search helper (D-06).
//
// Exports:
//   WEB_SEARCH_TOOL       — WebSearchTool20250305 constant (max_uses: 3)
//   extractSourceUrls     — collect result.url from web_search_result blocks
//   enrichWithWebSearch   — two-turn: Turn 1 auto (let Claude search), Turn 2 forced tool
//
// Posture:
//   - NEVER throws — callers handle null toolUse
//   - Handles pause_turn from long web_search runs with exactly one continuation call
//   - Sets webSearchUnavailable: true when web_search is org-disabled, but still
//     proceeds to Turn 2 for text-only fallback (D-06 graceful degradation)

import Anthropic from '@anthropic-ai/sdk'

/** web_search server tool — capped at 3 uses per row to bound per-row cost. */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
}

/**
 * Walk content blocks and collect `result.url` from every `web_search_result`
 * entry inside each `web_search_tool_result` block.
 *
 * Returns URLs in document order.
 * Returns [] when no `web_search_tool_result` blocks are present.
 * Ignores `web_search_tool_result` blocks whose content is an error object.
 */
export function extractSourceUrls(content: Anthropic.Messages.ContentBlock[]): string[] {
  const urls: string[] = []
  for (const block of content) {
    if (block.type === 'web_search_tool_result') {
      const results = Array.isArray(block.content) ? block.content : []
      for (const result of results) {
        if (result.type === 'web_search_result') {
          urls.push(result.url)
        }
      }
    }
  }
  return urls
}

export interface EnrichWithWebSearchResult {
  toolUse: Anthropic.Messages.ToolUseBlock | null
  sourceUrls: string[]
  webSearchUnavailable: boolean
}

/**
 * Two-turn web_search + forced-tool pattern (D-06, RESEARCH Pattern 1).
 *
 * Turn 1: `tool_choice: { type: 'auto' }` with both customTools and WEB_SEARCH_TOOL
 *         in tools array — Claude decides to search for grounding context.
 *         If stop_reason === 'pause_turn', issue exactly one continuation call.
 *
 * Turn 2: `tool_choice: { type: 'tool', name: customToolName }` forced — Claude emits
 *         the structured output with web search results in context.
 *
 * Does NOT throw — all errors are surfaced via the caller's try/catch.
 * Sets webSearchUnavailable: true when web_search is org-disabled, then continues
 * to Turn 2 in text-only mode.
 *
 * @param client         Anthropic client instance (constructed with maxRetries by caller)
 * @param customTools    Custom tool definitions (e.g. [TASTE_TOOL])
 * @param initialMessages Initial message array for Turn 1
 * @param customToolName  Name of the custom tool to force in Turn 2
 */
export async function enrichWithWebSearch(
  client: Anthropic,
  customTools: Anthropic.Messages.Tool[],
  initialMessages: Anthropic.Messages.MessageParam[],
  customToolName: string,
): Promise<EnrichWithWebSearchResult> {
  const allTools: Array<Anthropic.Messages.Tool | Anthropic.Messages.WebSearchTool20250305> = [
    ...customTools,
    WEB_SEARCH_TOOL,
  ]

  // Turn 1: auto — let Claude decide to search for grounding context
  let searchResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: allTools,
    tool_choice: { type: 'auto' },
    messages: initialMessages,
  })

  // Handle pause_turn from long web_search runs (RESEARCH Pitfall 2)
  // Issue exactly one continuation call before proceeding to Turn 2.
  if (searchResponse.stop_reason === 'pause_turn') {
    searchResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools: allTools,
      tool_choice: { type: 'auto' },
      messages: [
        ...initialMessages,
        { role: 'assistant', content: searchResponse.content },
      ],
    })
  }

  // Detect web_search unavailable (org-level disabled) — still proceed to Turn 2
  let webSearchUnavailable = false
  for (const block of searchResponse.content) {
    if (block.type === 'web_search_tool_result') {
      const content = block.content
      if (!Array.isArray(content) && content.type === 'web_search_tool_result_error') {
        if (content.error_code === 'unavailable') {
          webSearchUnavailable = true
        }
      }
    }
  }

  const sourceUrls = extractSourceUrls(searchResponse.content)

  // Turn 2: force the custom tool — now with web search results in context
  const turn2Response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: allTools,
    tool_choice: { type: 'tool', name: customToolName },
    messages: [
      ...initialMessages,
      { role: 'assistant', content: searchResponse.content },
    ],
  })

  const toolUse = turn2Response.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
  ) ?? null

  return { toolUse, sourceUrls, webSearchUnavailable }
}
