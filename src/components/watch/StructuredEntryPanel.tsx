'use client'

/**
 * Phase 69 Plan 04 — StructuredEntryPanel
 *
 * Pure-presenter 4-field structured-input form for the v8.0 add-watch flow.
 * Ships DORMANT — Phase 70 mounts this inside AddWatchFlow's no-match expand
 * (via SearchEntry, Plan 05) and wires onSubmitStructured / onSwitchToUrl.
 *
 * Contract (props in, callbacks out):
 *   - Emits onSubmitStructured(result) on extract success (cache hit OR network)
 *   - Emits onSwitchToUrl() when the URL backup ghost link (EXTR-07 copy
 *     verbatim in JSX) is clicked, and when the in-card "Add manually" button
 *     on the ExtractErrorCard is clicked (same manualAction wiring)
 *   - Pure presenter — no client-side navigation hooks, no action imports;
 *     all routing concerns live with Phase 70's orchestrator (AddWatchFlow).
 *
 * Decisions encoded (see 69-CONTEXT.md):
 *   D-15 — 4-field grid: brand|model row 1 (required), reference|year row 2
 *   D-16 — CatalogPhotoUploader inline always-visible + URL ghost link below CTA
 *   D-17 — In-place VerdictSkeleton during round-trip; fields stay visible
 *   D-18 — Cache key = JSON.stringify({brand,model,reference,year}) with
 *          per-field trim().toLowerCase() (year nullable)
 *   EXTR-05 — Explicit "Find specs" button gates the LLM call; cache check
 *             happens BEFORE the network call
 *   EXTR-06 — CatalogPhotoUploader inline (NOT behind a reveal)
 *   EXTR-07 — URL backup is an upward callback (onSwitchToUrl); routing in Phase 70
 *   Phase 66 D-06 — <ExtractErrorCard mode="structured"> on failure
 *
 * Memory guardrails:
 *   - font-semibold guardrail honored — no raw weight-500 className overrides
 *     in this file. The Label primitive ships the design system's allowed
 *     baseline weight internally (see label.tsx:12); we render via <Label> with
 *     no className override.
 */

import { useState } from 'react'
import { Loader2, Link2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CatalogPhotoUploader } from '@/components/watch/CatalogPhotoUploader'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
import {
  ExtractErrorCard,
  type ExtractErrorCategory,
} from '@/components/watch/ExtractErrorCard'
import { useStructuredExtractCache } from '@/components/watch/useStructuredExtractCache'
import type { ExtractedWatchData } from '@/lib/extractors/types'

export interface StructuredEntryPanelProps {
  /** D-07 prop-drilled viewer id for cache invalidation. */
  viewerUserId: string
  /** D-12 pre-seed from parseSearchQuery (SearchEntry no-match expand). */
  initialBrand?: string
  initialModel?: string
  initialReference?: string
  /** D-03 — emits the extracted data upward; Phase 70 transitions to ConfirmStep. */
  onSubmitStructured: (result: ExtractedWatchData) => void
  /** EXTR-07 escape hatch — Phase 70 wires routing to the URL-paste path. */
  onSwitchToUrl: () => void
}

interface ExtractSuccessEnvelope {
  success: true
  data: ExtractedWatchData
  catalogId?: string
  mode?: 'structured' | 'url'
}

interface ExtractErrorEnvelope {
  success: false
  error: { category: ExtractErrorCategory; message?: string }
  mode?: 'structured' | 'url'
}

type ExtractEnvelope = ExtractSuccessEnvelope | ExtractErrorEnvelope

export function StructuredEntryPanel({
  viewerUserId,
  initialBrand,
  initialModel,
  initialReference,
  onSubmitStructured,
  onSwitchToUrl,
}: StructuredEntryPanelProps) {
  const [brand, setBrand] = useState(initialBrand ?? '')
  const [model, setModel] = useState(initialModel ?? '')
  const [reference, setReference] = useState(initialReference ?? '')
  // Year is tracked as string for input ergonomics; converted to number-or-null
  // on send. Aligns with the UI-SPEC tree's controlled-number Input pattern.
  const [year, setYear] = useState<string>('')
  // photoBlob is captured for parity with WatchForm — Phase 70 forwards it to
  // the catalog source-photo upload pipeline at ConfirmStep commit. Held here
  // because EXTR-06 requires the affordance to live inline alongside the
  // structured-input fields.
  const [, setPhotoBlob] = useState<Blob | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<ExtractErrorCategory | null>(
    null,
  )

  const cache = useStructuredExtractCache(viewerUserId)

  async function handleFindSpecs() {
    // EXTR-05 defense-in-depth: button is disabled when invalid; this guard
    // catches the rare path where state desynchronises.
    if (!brand.trim() || !model.trim()) return

    // D-18 cache key — JSON-tuple, per-field trim().toLowerCase(), year nullable.
    // Aligns with catalog DAL natural-key normalization (regexp_replace(lower(trim(...)))).
    const yearNum = year.trim() ? Number(year) : null
    const key = JSON.stringify({
      brand: brand.trim().toLowerCase(),
      model: model.trim().toLowerCase(),
      reference: reference.trim().toLowerCase(),
      year: yearNum,
    })

    // Cache check happens BEFORE the network call (EXTR-05).
    const cached = cache.get(key)
    if (cached) {
      onSubmitStructured(cached.extracted)
      return
    }

    setIsExtracting(true)
    setExtractError(null)

    try {
      // Build a clean optional-shape body that matches the Phase 66 Zod
      // discriminated-union schema: omit reference / year when empty / null.
      const body: Record<string, unknown> = {
        mode: 'structured',
        brand: brand.trim(),
        model: model.trim(),
      }
      const trimmedRef = reference.trim()
      if (trimmedRef) body.reference = trimmedRef
      if (yearNum !== null) body.year = yearNum

      const res = await fetch('/api/extract-watch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const envelope = (await res.json()) as ExtractEnvelope

      if (envelope.success) {
        cache.set(key, {
          catalogId: envelope.catalogId ?? '',
          extracted: envelope.data,
          catalogIdError: null,
        })
        onSubmitStructured(envelope.data)
      } else {
        setExtractError(envelope.error.category)
      }
    } catch {
      // Network / parse failure — surface the generic category so the
      // ExtractErrorCard branch renders (mode='structured' shows the LOCKED
      // Phase 25 D-15 generic-network copy per Phase 66 D-06 — only
      // structured-data-missing has a mode variant).
      setExtractError('generic-network')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Section 1: 4-field grid (D-15 LOCKED) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="se-brand">
            Brand{' '}
            <span className="text-muted-foreground" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="se-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            required
            aria-required="true"
            disabled={isExtracting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="se-model">
            Model{' '}
            <span className="text-muted-foreground" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="se-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            aria-required="true"
            disabled={isExtracting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="se-reference">Reference</Label>
          <Input
            id="se-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={isExtracting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="se-year">Year</Label>
          <Input
            id="se-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={isExtracting}
          />
        </div>
      </div>

      {/* Section 2: CatalogPhotoUploader — inline always-visible (D-16 / EXTR-06) */}
      <CatalogPhotoUploader
        onPhotoReady={setPhotoBlob}
        onError={() => {
          /* The CatalogPhotoUploader surfaces its own error UI inline. The
             panel does not need to react — the photo is optional and a failure
             does not block "Find specs". */
        }}
        onClear={() => setPhotoBlob(null)}
        disabled={isExtracting}
      />

      {/* Section 3: "Find specs" primary CTA (D-16 LOCKED — full-width) */}
      <Button
        type="button"
        onClick={handleFindSpecs}
        disabled={!brand.trim() || !model.trim() || isExtracting}
        className="w-full min-h-[44px]"
      >
        {isExtracting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
            Finding specs…
          </>
        ) : (
          'Find specs'
        )}
      </Button>

      {/* Section 4: VerdictSkeleton in-place during round-trip (D-17 LOCKED) */}
      {isExtracting && <VerdictSkeleton />}

      {/* Section 5: Error display — Phase 66 D-06 mode-branched copy */}
      {extractError && !isExtracting && (
        <ExtractErrorCard
          category={extractError}
          mode="structured"
          retryAction={() => setExtractError(null)}
          manualAction={onSwitchToUrl}
        />
      )}

      {/* Section 6: URL backup ghost link (D-16 LOCKED — EXTR-07) */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          onClick={onSwitchToUrl}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          <Link2 className="size-4 mr-2" aria-hidden />
          Have a URL for this watch?
        </Button>
      </div>
    </div>
  )
}
