import { NextRequest, NextResponse } from 'next/server'
import { fetchAndExtract } from '@/lib/extractors'
import { SsrfError } from '@/lib/ssrf'
import { UnauthorizedError, getCurrentUser } from '@/lib/auth'
import * as catalogDAL from '@/data/catalog'

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

    // CAT-08 — catalog wiring (fire-and-forget)
    let catalogId: string | null = null
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
      }
    } catch (err) {
      console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
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
      ...result,
    })
  } catch (error) {
    console.error('Extraction error:', error)

    if (error instanceof SsrfError) {
      return NextResponse.json(
        { error: "That URL points to a private address and can't be imported." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to extract watch data from URL.' },
      { status: 500 }
    )
  }
}
