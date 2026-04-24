import type { JSX } from 'react'

/**
 * Hero image for the wear detail page (WYWT-17, 15-CONTEXT.md D-20 / D-21).
 *
 * Fallback chain (first non-null wins):
 *   1. signedUrl present → native <img src={signedUrl}>. Pitfall F-2: native
 *      <img>, NOT next/image. The Next image optimizer can strip query
 *      parameters on its proxy variants which would invalidate the Supabase
 *      signed-URL token. images.unoptimized:true in next.config.ts makes
 *      next/image pass-through, but native <img> architecturally enforces
 *      the rule regardless of future config changes.
 *   2. No photo but watch has imageUrl → render watch imageUrl as hero so
 *      the wear detail page still has a visual anchor.
 *   3. Neither → muted placeholder with "{brand} {model}" centered per
 *      UI-SPEC §Copywriting Contract (no-photo fallback).
 *
 * Aspect ratio: 4:5 portrait — matches typical wrist-shot composition
 * (CONTEXT.md D-20). Full-bleed on mobile (edge-to-edge); rounded + capped
 * width on md+ so the hero doesn't feel stretched on desktop.
 */
export function WearDetailHero({
  signedUrl,
  watchImageUrl,
  brand,
  model,
  altText,
}: {
  signedUrl: string | null
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string
}): JSX.Element {
  const url = signedUrl ?? watchImageUrl
  if (url) {
    return (
      <div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
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
