// src/lib/taste/webSearch.ts
//
// Phase 44 web_search enrichment helper (D-06).
//
// Exports:
//   WEB_SEARCH_TOOL       — WebSearchTool20250305 constant (max_uses: 3)
//   extractSourceUrls     — collect result.url from web_search_result blocks
//   enrichWithWebSearch   — primary auto call (web_search for grounding +
//                           emit the custom tool) with a forced-tool fallback
//
// Posture:
//   - NEVER throws — callers handle a null toolUse.
//   - claude-sonnet-4-6 rejects assistant-message prefill ("the conversation
//     must end with a user message"). So every request ends with a user
//     message and NO tool blocks are ever replayed. The primary call's
//     research is folded into the fallback's user message as plain text.
//   - Sets webSearchUnavailable: true when web_search is org-disabled.

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

/** Detect org-disabled web_search from a `web_search_tool_result` error block. */
function detectWebSearchUnavailable(content: Anthropic.Messages.ContentBlock[]): boolean {
  for (const block of content) {
    if (block.type === 'web_search_tool_result') {
      const c = block.content
      if (
        !Array.isArray(c) &&
        c.type === 'web_search_tool_result_error' &&
        c.error_code === 'unavailable'
      ) {
        return true
      }
    }
  }
  return false
}

/** Concatenate the text of every `text` block, in document order. */
function collectTextBlocks(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim()
}

/**
 * Fold research text into the last message's content as an extra text block.
 * Returns `messages` unchanged when `groundingText` is empty.
 *
 * This keeps the request a single user message — no assistant prefill, no
 * replayed tool blocks — which claude-sonnet-4-6 requires.
 */
function appendGroundingToLastMessage(
  messages: Anthropic.Messages.MessageParam[],
  groundingText: string,
): Anthropic.Messages.MessageParam[] {
  if (!groundingText) return messages
  const note: Anthropic.Messages.TextBlockParam = {
    type: 'text',
    text:
      '\n\n---\nWeb research notes gathered for this watch (use as grounding ' +
      `context, weighed against your own knowledge):\n\n${groundingText}`,
  }
  const head = messages.slice(0, -1)
  const last = messages[messages.length - 1]
  const lastBlocks: Anthropic.Messages.ContentBlockParam[] =
    typeof last.content === 'string'
      ? [{ type: 'text', text: last.content }]
      : [...last.content]
  return [...head, { role: last.role, content: [...lastBlocks, note] }]
}

/**
 * web_search + forced-tool enrichment (D-06).
 *
 * Primary call: `tool_choice: auto` with customTools + WEB_SEARCH_TOOL — the
 *   model searches for grounding context and, in practice, emits the custom
 *   tool in the same response. When a custom tool_use is present it is
 *   returned directly (one API call, the common path).
 *
 * Fallback call: when the primary response carries no custom tool_use (a
 *   text-only answer, or a pause_turn that stopped before emitting), force the
 *   tool with a fresh call. The primary call's research text is folded into
 *   the user message — claude-sonnet-4-6 rejects assistant-message prefill, so
 *   no tool blocks are replayed and the request ends with a user message.
 *
 * Does NOT throw — all errors surface via the caller's try/catch.
 *
 * @param client          Anthropic client instance (constructed with maxRetries by caller)
 * @param customTools      Custom tool definitions (e.g. [TASTE_TOOL])
 * @param initialMessages  Initial message array (a single user message)
 * @param customToolName   Name of the custom tool to extract / force
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

  // Primary call: auto — let the model web_search for grounding and emit the
  // custom tool in one turn.
  const primary = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: allTools,
    tool_choice: { type: 'auto' },
    messages: initialMessages,
  })

  const webSearchUnavailable = detectWebSearchUnavailable(primary.content)
  const sourceUrls = extractSourceUrls(primary.content)

  const primaryToolUse = primary.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock =>
      c.type === 'tool_use' && c.name === customToolName,
  )
  if (primaryToolUse) {
    return { toolUse: primaryToolUse, sourceUrls, webSearchUnavailable }
  }

  // Fallback: the model answered in text only (or paused before emitting).
  // Force the custom tool, folding the primary call's research in as text.
  const forced = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: customTools,
    tool_choice: { type: 'tool', name: customToolName },
    messages: appendGroundingToLastMessage(
      initialMessages,
      collectTextBlocks(primary.content),
    ),
  })

  const toolUse =
    forced.content.find(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
    ) ?? null

  return { toolUse, sourceUrls, webSearchUnavailable }
}
