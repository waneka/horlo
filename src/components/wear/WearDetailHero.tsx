import type { JSX } from 'react'

/**
 * Hero image for the wear detail page (WYWT-17, 15-CONTEXT.md D-20 / D-21).
 *
 * Phase 26 Plan 01: the signed-URL branch was MOVED to WearPhotoClient.tsx
 * (D-02 client retry on storage-CDN propagation). This component now
 * handles ONLY:
 *   1. Watch has imageUrl but no wear photo → render watch imageUrl as
 *      hero so the wear detail page still has a visual anchor.
 *   2. Neither → muted placeholder with "{brand} {model}" centered per
 *      UI-SPEC §Copywriting Contract (no-photo fallback).
 *
 * Aspect ratio: 4:5 portrait — matches typical wrist-shot composition
 * (CONTEXT.md D-20). Full-bleed on mobile (edge-to-edge); rounded + capped
 * width on md+ so the hero doesn't feel stretched on desktop.
 *
 * Native <img>, NOT next/image (Pitfall F-2 carry-forward).
 */
export function WearDetailHero({
  watchImageUrl,
  brand,
  model,
  altText,
}: {
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string
}): JSX.Element {
  if (watchImageUrl) {
    return (
      <div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={watchImageUrl}
          alt={altText}
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>
    )
  }
  return (
    <div
      className="w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
      aria-label={`No photo — ${brand} ${model}`}
    >
      <span className="text-sm font-semibold text-muted-foreground">
        {brand} {model}
      </span>
    </div>
  )
}
