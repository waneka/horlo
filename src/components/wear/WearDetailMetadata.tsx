import type { JSX } from 'react'

/**
 * Phase 56 D-07: WearDetailMetadata is reduced to the note/caption only.
 * Collector row (D-05) and brand/model row (D-06) moved to photo overlays
 * (WearPhotoOverlays in WearDetailHero.tsx). Watch thumbnail removed (D-06).
 *
 * Original fields no longer needed by this component:
 * username, displayName, avatarUrl, brand, model, watchImageUrl, createdAt.
 * All callers (wear/[wearEventId]/page.tsx) must stop passing those props.
 */
export function WearDetailMetadata({
  note,
}: {
  note: string | null
}): JSX.Element | null {
  if (!note) return null
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap px-4 pt-3 md:max-w-[600px] md:mx-auto">
      {note}
    </p>
  )
}
