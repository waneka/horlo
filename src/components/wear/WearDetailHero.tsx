import type { JSX } from 'react'
import Link from 'next/link'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { timeAgo } from '@/lib/timeAgo'
import { cn } from '@/lib/utils'

/**
 * Hero image for the wear detail page (WYWT-17, 15-CONTEXT.md D-20 / D-21).
 *
 * Phase 26 Plan 01: the signed-URL branch was MOVED to WearPhotoClient.tsx
 * (D-02 client retry on storage-CDN propagation). This component now
 * handles ONLY:
 *   1. Watch has imageUrl but no wear photo → render watch imageUrl as
 *      hero so the wear detail page still has a visual anchor.
 *   2. Neither → muted placeholder per UI-SPEC §Copywriting Contract
 *      (no-photo fallback). The old centered {brand} {model} text is removed
 *      — brand/model moves to the bottom overlay (D-06/D-08).
 *
 * Phase 56 D-05/06/07/08: overlay sub-component (`WearPhotoOverlays`) is
 * co-located here and imported by WearPhotoClient.tsx to avoid duplication.
 *
 * Aspect ratio: 4:5 portrait — matches typical wrist-shot composition
 * (CONTEXT.md D-20). Full-bleed on mobile (edge-to-edge); rounded + capped
 * width on md+ so the hero doesn't feel stretched on desktop.
 *
 * Native <img>, NOT next/image (Pitfall F-2 carry-forward).
 */

// ---------------------------------------------------------------------------
// Shared overlay sub-component (D-08)
// ---------------------------------------------------------------------------

interface WearPhotoOverlaysProps {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  /** true = overlay text white (on scrimmed photo); false = text-foreground (muted fallback, D-08) */
  hasPhoto: boolean
  /** brand/model → /watch/[watchId] link (D-01) */
  watchId: string
}

/**
 * Absolute-positioned overlays for wear photo containers (D-05/06/08).
 *
 * - Top: avatar + username + relative timestamp (gradient scrim top-to-bottom)
 * - Bottom: brand + model (gradient scrim bottom-to-top)
 *
 * Exported so WearPhotoClient.tsx can import it without a second copy.
 * Must be rendered INSIDE a `relative`-positioned photo container.
 */
export function WearPhotoOverlays({
  username,
  displayName,
  avatarUrl,
  createdAt,
  brand,
  model,
  hasPhoto,
  watchId,
}: WearPhotoOverlaysProps): JSX.Element {
  const textClass = hasPhoto ? 'text-white' : 'text-foreground'

  return (
    <>
      {/* Top overlay: avatar + username + timestamp */}
      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%)' }}
      >
        <div className="flex items-center gap-2 p-3 pointer-events-auto">
          <AvatarDisplay
            avatarUrl={avatarUrl}
            displayName={displayName}
            username={username ?? '?'}
            size={40}
          />
          {username ? (
            <Link
              href={`/u/${username}`}
              className={cn('text-sm font-semibold hover:opacity-80', textClass)}
            >
              {displayName ?? username}
            </Link>
          ) : (
            <span className={cn('text-sm font-semibold', textClass)}>
              Unknown collector
            </span>
          )}
          <span className={cn('text-sm opacity-70', textClass)}>·</span>
          <span className={cn('text-sm opacity-70', textClass)}>{timeAgo(createdAt)}</span>
        </div>
      </div>

      {/* Bottom overlay: brand + model → /watch/[watchId] (D-01) */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 40%)' }}
      >
        <div className="flex flex-col p-3 pointer-events-auto">
          <Link
            href={`/watch/${watchId}`}
            className={cn('text-sm hover:opacity-80', textClass)}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-semibold">{brand}</span>
            <span className="block">{model}</span>
          </Link>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// WearDetailHero
// ---------------------------------------------------------------------------

export function WearDetailHero({
  watchImageUrl,
  brand,
  model,
  altText,
  username,
  displayName,
  avatarUrl,
  createdAt,
  watchId,
}: {
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  watchId: string
}): JSX.Element {
  if (watchImageUrl) {
    return (
      <div data-testid="wear-photo-container" className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={watchImageUrl}
          alt={altText}
          className="w-full h-full object-cover"
          loading="eager"
        />
        <WearPhotoOverlays
          username={username}
          displayName={displayName}
          avatarUrl={avatarUrl}
          createdAt={createdAt}
          brand={brand}
          model={model}
          hasPhoto={true}
          watchId={watchId}
        />
      </div>
    )
  }
  return (
    <div
      data-testid="wear-photo-container"
      className="relative w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
      aria-label={`No photo — ${brand} ${model}`}
    >
      {/* Brand/model text removed — moves to bottom overlay (D-06) */}
      <WearPhotoOverlays
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        createdAt={createdAt}
        brand={brand}
        model={model}
        hasPhoto={false}
        watchId={watchId}
      />
    </div>
  )
}
