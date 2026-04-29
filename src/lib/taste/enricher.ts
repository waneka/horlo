// src/lib/taste/enricher.ts
//
// Phase 19.1 taste enricher (D-08 to D-11, D-17).
// Server-only module — never imported from a Client Component.
//
// Public surface: enrichTasteAttributes(input) → CatalogTasteAttributes | null
//   - text mode: input.photoSourcePath is undefined/null
//   - vision mode: input.photoSourcePath is set (catalog-source-photos bucket path)
//
// Posture:
//   - NEVER throws — all failure modes return null + structured event log (D-09, D-10)
//   - No retries — operator runs npm run db:reenrich-taste for failed rows (D-13, D-15)
//   - Missing API key → null + 'taste_enrichment_skipped:no_api_key' event (D-17)

import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { TasteSchema, validateAndCleanTaste, PRIMARY_ARCHETYPES, ERA_SIGNALS, DESIGN_MOTIFS } from './vocab'
import { buildTextPrompt, buildVisionPrompt } from './prompt'
import type { EnrichmentInput, EnrichmentResult, EnrichmentMode } from './types'
import type { CatalogTasteAttributes } from '@/lib/types'

// Tool-use definition with strict: true for Anthropic structured-output guarantees.
// The Anthropic SDK 0.88+ accepts `strict: true` on tool definitions; type assertion
// used to forward-declare in case of older type definitions.
const TASTE_TOOL = {
  name: 'record_taste_attributes',
  description: 'Record structured taste attributes for a watch.',
  input_schema: {
    type: 'object',
    properties: {
      formality:      { type: 'number', minimum: 0, maximum: 1, description: 'How formal/dressy 0..1' },
      sportiness:     { type: 'number', minimum: 0, maximum: 1 },
      heritage_score: { type: 'number', minimum: 0, maximum: 1, description: 'How storied/historically-significant 0..1' },
      primary_archetype: { type: 'string', enum: [...PRIMARY_ARCHETYPES] },
      era_signal:        { type: 'string', enum: [...ERA_SIGNALS] },
      design_motifs:     {
        type: 'array',
        items: { type: 'string', enum: [...DESIGN_MOTIFS] },
        description: 'Zero to 8 visual/aesthetic motifs from the closed vocabulary.',
        maxItems: 8,
      },
      confidence: {
        type: 'number', minimum: 0, maximum: 1,
        description: 'Self-rated confidence in this assessment (0..1). Use <0.5 for ambiguous cases.',
      },
    },
    required: ['formality', 'sportiness', 'heritage_score', 'primary_archetype', 'era_signal', 'design_motifs', 'confidence'],
  },
  strict: true,
} satisfies Anthropic.Messages.Tool

function logEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}

function logError(event: string, payload: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}

/**
 * D-08 + D-11: Enrich a catalog row's taste attributes via Anthropic tool-use.
 * Returns null on ANY failure (D-09 + D-10 fire-and-forget posture).
 */
export async function enrichTasteAttributes(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logEvent('taste_enrichment_skipped:no_api_key', {
      catalog_id: input.catalogId,
      source: input.source,
    })
    return null
  }

  const mode: EnrichmentMode = input.photoSourcePath ? 'vision' : 'text'
  const startedAt = Date.now()
  logEvent('taste_enrichment_started', {
    catalog_id: input.catalogId,
    source: input.source,
    mode,
  })

  try {
    const client = new Anthropic({ apiKey })

    let messages: Anthropic.Messages.MessageParam[]

    if (mode === 'vision' && input.photoSourcePath) {
      // Fetch via signed URL (RESEARCH §"Photo fetch shape" — option 2 recommended).
      const photoBytes = await fetchPhotoBytes(input.photoSourcePath)
      if (!photoBytes) {
        // Photo fetch failed; degrade to text mode rather than abort.
        logEvent('taste_enrichment_photo_fetch_failed_fallback_text', {
          catalog_id: input.catalogId,
        })
        messages = [{ role: 'user', content: buildTextPrompt(input.spec) }]
      } else {
        const photoBase64 = Buffer.from(photoBytes).toString('base64')
        messages = [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } },
            { type: 'text', text: buildVisionPrompt(input.spec) },
          ],
        }]
      }
    } else {
      messages = [{ role: 'user', content: buildTextPrompt(input.spec) }]
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [TASTE_TOOL],
      tool_choice: { type: 'tool', name: 'record_taste_attributes' },
      messages,
    })

    // Sanity-log the actual model id Anthropic routed to (per Plan-time check below).
    // Surfaces silent model rotation in observability without breaking flow.
    logEvent('taste_enrichment_model_resolved', {
      catalog_id: input.catalogId,
      requested_model: 'claude-sonnet-4-6',
      resolved_model: response.model,
    })

    const toolUse = response.content.find(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
    )
    if (!toolUse) {
      logError('taste_enrichment_failed', {
        catalog_id: input.catalogId,
        source: input.source,
        mode,
        error_class: 'no_tool_use_block',
        latency_ms: Date.now() - startedAt,
      })
      return null
    }

    const parsed = TasteSchema.safeParse(toolUse.input)
    if (!parsed.success) {
      logError('taste_enrichment_failed', {
        catalog_id: input.catalogId,
        source: input.source,
        mode,
        error_class: 'zod_parse_failed',
        zod_issues: parsed.error.issues,
        latency_ms: Date.now() - startedAt,
      })
      return null
    }

    const cleaned = validateAndCleanTaste(parsed.data, { catalogId: input.catalogId })
    const result: CatalogTasteAttributes = {
      ...cleaned,
      extractedFromPhoto: mode === 'vision' && !!input.photoSourcePath,
    }

    logEvent('taste_enrichment_succeeded', {
      catalog_id: input.catalogId,
      source: input.source,
      mode,
      confidence: result.confidence,
      latency_ms: Date.now() - startedAt,
    })

    return result
  } catch (err) {
    logError('taste_enrichment_failed', {
      catalog_id: input.catalogId,
      source: input.source,
      mode,
      error_class: err instanceof Error ? err.name : 'unknown',
      error_message: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - startedAt,
    })
    return null
  }
}

// Internal: fetch photo bytes from catalog-source-photos via signed URL.
// Returns null on failure — caller falls back to text-only mode.
//
// Inlines the service-role Supabase client construction (mirrors the canonical
// pattern used in Plan 04's `getCatalogSourcePhotoSignedUrl`). NO shared admin
// client helper — keeps the surface contained to this module.
async function fetchPhotoBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return null

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await adminClient.storage
      .from('catalog-source-photos')
      .createSignedUrl(path, 60) // 60s TTL
    if (error || !data?.signedUrl) return null
    const res = await fetch(data.signedUrl)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}
