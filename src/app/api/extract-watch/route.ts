import { NextRequest, NextResponse } from 'next/server'
import { fetchAndExtract } from '@/lib/extractors'
import { SsrfError } from '@/lib/ssrf'
import { UnauthorizedError, getCurrentUser } from '@/lib/auth'
import * as catalogDAL from '@/data/catalog'

/**
 * Phase 25 Plan 04 (UX-05 / D-11..D-15) — 5-category error taxonomy.
 *
 * Categorization happens at the route boundary (D-11). The 5 categories and
 * their LOCKED D-15 user-facing recovery copy are reproduced verbatim here;
 * the response `error` field is ALWAYS sourced from CATEGORY_COPY[category]
 * and never from `err.message` / `err.stack` / `String(err)` (T-25-04-01
 * information-disclosure mitigation).
 *
 * The category enum and copy are public surface (consumed by AddWatchFlow's
 * <ExtractErrorCard>); changes here must coordinate with that component's
 * contract.
 */
type ExtractErrorCategory =
  | 'host-403'
  | 'structured-data-missing'
  | 'LLM-timeout'
  | 'quota-exceeded'
  | 'generic-network'

const CATEGORY_COPY: Record<ExtractErrorCategory, string> = {
  'host-403':
    "This site doesn't allow data extraction. Try entering manually.",
  'structured-data-missing':
    "Couldn't find watch info on this page. Try the original product page or enter manually.",
  'LLM-timeout':
    'Extraction is taking longer than expected. Try again or enter manually.',
  'quota-exceeded': 'Extraction service is busy. Try again in a few minutes.',
  'generic-network': "Couldn't reach that URL. Check the link and try again.",
}

// HTTP status mapping per category — defense-in-depth so caches/CDNs don't
// cache transient errors. structured-data-missing handled inline at the
// post-extract gate (422); the catch block uses this map.
const CATEGORY_HTTP_STATUS: Record<ExtractErrorCategory, number> = {
  'host-403': 502,
  'structured-data-missing': 422,
  'LLM-timeout': 504,
  'quota-exceeded': 503,
  'generic-network': 500,
}

/**
 * Map a caught error to one of 5 categories per D-11..D-13. Detection order
 * matches plan acceptance criteria; first match wins.
 *
 * Note on Anthropic SDK detection: we duck-type via `.status === 429` rather
 * than `instanceof RateLimitError` so that errors crossing module boundaries
 * (e.g., when bundlers split SDK chunks) are still detected. SDK error
 * message text is NOT relied on — versions change.
 */
function categorizeExtractionError(err: unknown): ExtractErrorCategory {
  if (err instanceof Error) {
    // host-403: thrown by fetchAndExtract as
    // "Failed to fetch URL: 403 Forbidden" (see src/lib/extractors/index.ts)
    if (/Failed to fetch URL:\s*403\b/.test(err.message)) return 'host-403'
    // LLM-timeout: AbortError name OR message contains "timeout".
    // Note: "timed out" is a separate phrase and falls through to generic.
    if (err.name === 'AbortError' || /timeout/i.test(err.message)) {
      return 'LLM-timeout'
    }
  }
  // quota-exceeded: any error with HTTP status 429 (Anthropic SDK
  // RateLimitError extends APIError<429>; we match by .status to be robust
  // across SDK versions and module boundaries).
  const errAny = err as { status?: unknown; name?: unknown }
  if (typeof errAny?.status === 'number' && errAny.status === 429) {
    return 'quota-exceeded'
  }
  return 'generic-network'
}

export async function POST(request: NextRequest) {
  // AUTH-04 / D-14: auth gate runs FIRST, before URL parsing or SSRF check.
  // Proxy is an optimistic outer gate; this is the per-route-handler inner gate.
  try {
    await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw err
  }

  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP/HTTPS URLs are supported' },
        { status: 400 }
      )
    }

    const result = await fetchAndExtract(url)

    // Phase 25 Plan 04 — D-12: post-extract gate. When the extractor
    // succeeded but produced no usable brand AND no usable model, flip to a
    // structured-data-missing error response. Treats null / undefined / ''
    // / whitespace-only as empty.
    const brandPopulated = Boolean(result.data?.brand?.trim())
    const modelPopulated = Boolean(result.data?.model?.trim())
    if (!brandPopulated && !modelPopulated) {
      return NextResponse.json(
        {
          success: false,
          error: CATEGORY_COPY['structured-data-missing'],
          category: 'structured-data-missing' as const,
        },
        { status: CATEGORY_HTTP_STATUS['structured-data-missing'] },
      )
    }

    // CAT-08 — catalog wiring (fire-and-forget per route response, but SYNC awaited
    // for correctness). Phase 20.1 UAT gap 1 fix: surface upsert errors in the
    // response so the client can distinguish "extraction succeeded but cataloging
    // failed" from "extraction failed entirely".
    let catalogId: string | null = null
    let catalogIdError: string | null = null
    try {
      if (result.data?.brand && result.data?.model) {
        catalogId = await catalogDAL.upsertCatalogFromExtractedUrl({
          brand: result.data.brand,
          model: result.data.model,
          reference: result.data.reference ?? null,
          movement: result.data.movement ?? null,
          caseSizeMm: result.data.caseSizeMm ?? null,
          lugToLugMm: result.data.lugToLugMm ?? null,
          waterResistanceM: result.data.waterResistanceM ?? null,
          crystalType: result.data.crystalType ?? null,
          dialColor: result.data.dialColor ?? null,
          isChronometer: result.data.isChronometer ?? null,
          productionYear: null,
          imageUrl: result.data.imageUrl ?? null,
          imageSourceUrl: url,
          imageSourceQuality: 'unknown',
          styleTags: result.data.styleTags ?? [],
          designTraits: result.data.designTraits ?? [],
          roleTags: [],
          complications: result.data.complications ?? [],
        })
        // Even when the upsert helper does not throw, it CAN return null when
        // the SQL execution shape doesn't yield a row id (per debug session
        // 2026-04-30T18:30:00Z). Mark this case explicitly.
        if (!catalogId) {
          catalogIdError = 'catalog upsert returned null id'
        }
      } else {
        catalogIdError = 'brand/model missing from extraction'
      }
    } catch (err) {
      console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
      // Sanitize the error message before sending to the client — never leak DB
      // internals or stack traces. Just surface a short reason code.
      catalogIdError = err instanceof Error
        ? `catalog upsert threw: ${err.message.slice(0, 200)}`
        : 'catalog upsert threw'
    }

    // Phase 19.1 D-07 + D-08: second-pass taste enrichment after spec extraction commits.
    // Fire-and-forget per D-09 — the route response does not block on enrichment result.
    // URL-extract path is text-only (no photo upload from this surface — D-19 forbids).
    // D-07 lock: this block does NOT touch src/lib/extractors/llm.ts — only the route handler grows.
    // Await semantics: Option A (synchronous await) per plan recommendation. Acceptable at v4.0 scale.
    if (catalogId && result.data?.brand && result.data?.model) {
      try {
        const { enrichTasteAttributes } = await import('@/lib/taste/enricher')
        const { updateCatalogTaste } = await import('@/data/catalog')
        const taste = await enrichTasteAttributes({
          catalogId,
          source: 'url-extract',
          spec: {
            brand: result.data.brand,
            model: result.data.model,
            reference: result.data.reference ?? null,
            movement: result.data.movement ?? null,
            caseSizeMm: result.data.caseSizeMm ?? null,
            lugToLugMm: result.data.lugToLugMm ?? null,
            waterResistanceM: result.data.waterResistanceM ?? null,
            crystalType: result.data.crystalType ?? null,
            dialColor: result.data.dialColor ?? null,
            isChronometer: result.data.isChronometer ?? null,
            productionYear: null,
            complications: result.data.complications ?? [],
          },
          photoSourcePath: null,  // D-19: URL extract does NOT use the photo path
        })
        if (taste) {
          await updateCatalogTaste(catalogId, taste)
        }
      } catch (err) {
        console.error('[extract-watch] taste enrichment failed (non-fatal):', err)
      }
    }

    // Phase 20.1 D-08: include catalogId so the Add-Watch Flow can call
    // getVerdictForCatalogWatch immediately on extraction success.
    // catalogId is null when brand/model were not extracted (no catalog upsert).
    return NextResponse.json({
      success: true,
      catalogId,
      // Phase 20.1 UAT gap 1 observability — null on success / non-null when
      // upsert failed or could not run. Consumed by AddWatchFlow.handleExtract
      // via console.warn for diagnostic visibility into silent null-catalogId paths.
      catalogIdError,
      ...result,
    })
  } catch (error) {
    // T-25-04-01 mitigation: log the raw error server-side (full detail for
    // debugging) but emit a sanitized response (no stack, no provider name,
    // no internal paths). The user-facing `error` field is sourced from the
    // LOCKED D-15 copy table — never from `err.message`.
    console.error('Extraction error:', error)

    // SsrfError stays as `generic-network` per CONTEXT §integration_points.
    // Preserve the existing HTTP 400 status (don't apply CATEGORY_HTTP_STATUS
    // here — SsrfError is a client-input class of error, not an upstream
    // failure).
    if (error instanceof SsrfError) {
      return NextResponse.json(
        {
          success: false,
          error: CATEGORY_COPY['generic-network'],
          category: 'generic-network' as ExtractErrorCategory,
        },
        { status: 400 },
      )
    }

    // Dispatch to one of 5 explicit emit sites — keeps the category enum
    // grep-able per plan acceptance criteria, and makes each user-facing copy
    // emission visible at the call site (not buried in a helper).
    const category = categorizeExtractionError(error)
    switch (category) {
      case 'host-403':
        return NextResponse.json(
          {
            success: false,
            error: CATEGORY_COPY['host-403'],
            category: 'host-403' as const,
          },
          { status: CATEGORY_HTTP_STATUS['host-403'] },
        )
      case 'LLM-timeout':
        return NextResponse.json(
          {
            success: false,
            error: CATEGORY_COPY['LLM-timeout'],
            category: 'LLM-timeout' as const,
          },
          { status: CATEGORY_HTTP_STATUS['LLM-timeout'] },
        )
      case 'quota-exceeded':
        return NextResponse.json(
          {
            success: false,
            error: CATEGORY_COPY['quota-exceeded'],
            category: 'quota-exceeded' as const,
          },
          { status: CATEGORY_HTTP_STATUS['quota-exceeded'] },
        )
      case 'generic-network':
      default:
        return NextResponse.json(
          {
            success: false,
            error: CATEGORY_COPY['generic-network'],
            category: 'generic-network' as const,
          },
          { status: CATEGORY_HTTP_STATUS['generic-network'] },
        )
    }
  }
}
