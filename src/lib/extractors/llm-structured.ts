// src/lib/extractors/llm-structured.ts
//
// Phase 66 STRUCTURED-INPUT LLM extraction (EXTR-04 / D-01..D-02).
//
// NAMING: This module handles the LLM call for STRUCTURED INPUT — user-supplied
// {brand, model, reference?, year?}. It is UNRELATED to ./structured.ts in this
// same directory, which extracts STRUCTURED DATA (JSON-LD) from scraped HTML.
//
// Server-only — never imported from a Client Component (the import 'server-only'
// directive below enforces this at the Next.js compile gate).
//
// Public surface:
//   extractFromStructuredInput(input) → Promise<ExtractedWatchData>
//     - calls claude-sonnet-4-6 with forced tool_choice on extract_watch_from_identity
//     - throws on missing ANTHROPIC_API_KEY (mirrors llm.ts:54-58)
//     - throws on missing tool_use block in the response (Pitfall 1 fallback)
//     - lets Anthropic SDK errors propagate (RateLimitError / AbortError / etc.)
//
// All thrown errors are categorized at the route boundary via
// categorizeExtractionError (D-05; 5-category taxonomy). This module is a
// thin LLM wrapper — it does NOT classify errors itself.

import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

import {
  MOVEMENT_TYPES,
  COMPLICATIONS,
  STRAP_TYPES,
  CRYSTAL_TYPES,
  DIAL_COLORS,
  STYLE_TAGS,
  DESIGN_TRAITS,
} from '@/lib/constants'

import type { ExtractedWatchData } from './types'
// NOTE: import from the sibling module './llm' directly, NOT from the
// extractors barrel index. The barrel re-exports cheerio — pulling it in
// here would weaken the EXTR-02 short-circuit guarantee that the structured
// branch never loads cheerio.
import { validateAndCleanData } from './llm'

/**
 * The user-supplied identity used to seed structured-INPUT extraction.
 *
 * `brand` and `model` are required by the route layer's Zod schema; `reference`
 * and `year` are optional. The route hands a parsed object directly to this
 * function — no further validation is performed here.
 */
export interface StructuredExtractionInput {
  brand: string
  model: string
  reference?: string
  year?: number
}

// -------------------------------------------------------------------------
// Tool definition — strict tool-use schema (Pitfall 1, Pitfall 8 mitigation).
//
// `additionalProperties: false` prevents the model from inventing keys.
// Enum arrays are derived programmatically from src/lib/constants.ts so the
// tool schema, the route's Zod parse, and validateAndCleanData all share one
// source of truth. `required: ['brand', 'model']` forces the model to echo
// the user-supplied identity.
// -------------------------------------------------------------------------

const EXTRACT_WATCH_TOOL = {
  name: 'extract_watch_from_identity',
  description:
    'Record best-known watch specifications for a watch identified by brand + model (+ optional reference / year). Echo brand and model normalized; omit any field whose value you cannot determine confidently.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      brand: {
        type: 'string',
        description:
          "Watch brand/manufacturer; echo input normalized to conventional casing (e.g. 'Omega', 'A. Lange & Söhne').",
      },
      model: {
        type: 'string',
        description:
          "Model name; echo input normalized (e.g. 'Speedmaster Professional').",
      },
      reference: {
        type: 'string',
        description:
          'Reference number; echo input verbatim if supplied, else infer when uniquely determinable from brand+model+year, else omit.',
      },
      movement: {
        type: 'string',
        enum: [...MOVEMENT_TYPES],
      },
      complications: {
        type: 'array',
        items: { type: 'string', enum: [...COMPLICATIONS] },
      },
      isChronometer: {
        type: 'boolean',
        description:
          'TRUE only if the model is COSC-certified or explicitly chronometer-grade. NOT a synonym for chronograph.',
      },
      caseSizeMm: { type: 'number', minimum: 20, maximum: 55 },
      lugToLugMm: { type: 'number', minimum: 30, maximum: 60 },
      waterResistanceM: { type: 'number', minimum: 0 },
      strapType: {
        type: 'string',
        enum: [...STRAP_TYPES],
      },
      crystalType: {
        type: 'string',
        enum: [...CRYSTAL_TYPES],
      },
      dialColor: {
        type: 'string',
        enum: [...DIAL_COLORS],
      },
      styleTags: {
        type: 'array',
        items: { type: 'string', enum: [...STYLE_TAGS] },
      },
      designTraits: {
        type: 'array',
        items: { type: 'string', enum: [...DESIGN_TRAITS] },
      },
      marketPrice: {
        type: 'number',
        minimum: 0,
        description:
          'USD MSRP or typical secondary-market price. Omit if uncertain.',
      },
    },
    required: ['brand', 'model'],
  },
} satisfies Anthropic.Messages.Tool

// -------------------------------------------------------------------------
// System prompt — verbatim from RESEARCH §Recommended Prompt Copy.
// Pitfall 7: the system+user split is required for forced tool-use to behave
// reliably; do NOT concatenate user input into this string.
// -------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a watch-spec assistant for a serious collector tool.

You will receive a watch identity: brand, model, and optionally a reference number and/or production year. You must call the extract_watch_from_identity tool exactly once with your best-known specifications for that watch.

Rules:
- ALWAYS echo brand and model. Normalize casing (e.g. "omega" → "Omega", "rolex submariner" → model "Submariner"). Do not invent words the user did not supply unless normalizing.
- ECHO the reference number when the user supplied one, in its conventional form. When the user did not supply a reference, infer one ONLY if it is uniquely determinable from brand+model+year; otherwise omit the reference field.
- For every other field, INFER from your training knowledge ONLY when you have reliable confidence. If you would otherwise guess, OMIT the field. A missing field is always better than a wrong one.
- "chrono" means a chronograph (start/stop/reset pushers + timing subdials). "chronometer-certified" is NOT a complication — set isChronometer: true instead.
- Style tags describe what TYPE of watch it is (diver, dress, field). Design traits describe visual/aesthetic character (heritage, minimalist, bold).
- Reply ONLY by calling extract_watch_from_identity. Do not emit any text response.`

/**
 * Builds the user message from the structured input. Reference and Year lines
 * are only appended when the corresponding field is supplied — so the model
 * is never prompted to invent values for missing inputs.
 */
function buildUserMessage(input: StructuredExtractionInput): string {
  const parts = [`Brand: ${input.brand}`, `Model: ${input.model}`]
  if (input.reference) parts.push(`Reference: ${input.reference}`)
  if (input.year !== undefined) parts.push(`Year: ${input.year}`)
  return parts.join('\n')
}

/**
 * Calls Anthropic strict tool-use to infer watch specifications from a
 * user-supplied identity. Returns the validated `ExtractedWatchData` shape.
 *
 * Error contract:
 * - Throws `Error('ANTHROPIC_API_KEY not configured')` when the env var is
 *   absent — mirrors `extractWithLlm` in `llm.ts`, NOT the silent-null pattern
 *   of taste/enricher.ts. The route layer's `categorizeExtractionError` maps
 *   this to `generic-network` HTTP 500.
 * - Throws `Error('LLM tool_use block missing from forced-tool response')`
 *   when the response contains no `tool_use` content block (Pitfall 1
 *   fallback). The route layer maps this to `generic-network` HTTP 500.
 * - Anthropic SDK errors (rate limit, timeout, network) propagate untouched —
 *   the route layer's catch block + `categorizeExtractionError` handles them.
 */
export async function extractFromStructuredInput(
  input: StructuredExtractionInput,
): Promise<ExtractedWatchData> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_WATCH_TOOL],
    tool_choice: { type: 'tool', name: 'extract_watch_from_identity' },
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  })

  // Pitfall 1: never index by position — forced tool-use can still prepend
  // text blocks. Use a type-narrowing `find` predicate.
  const toolUse = response.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
  )

  if (!toolUse) {
    throw new Error('LLM tool_use block missing from forced-tool response')
  }

  // Pitfall 8: `toolUse.input` is typed `unknown` per the SDK. The existing
  // 80-LOC validateAndCleanData enum-checks every field against the same
  // project constants the tool's input_schema spreads — single source of truth.
  return validateAndCleanData(toolUse.input as Record<string, unknown>)
}
