'use client'

import { useEffect, useRef, useState } from 'react'

import { PhotoSkeleton } from './PhotoSkeleton'
import { WearPhotoOverlays } from './WearDetailHero'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 300

/**
 * WearPhotoClient — Phase 26 Plan 01 (D-02, D-05, D-06).
 *
 * Renders the signed-URL <img> with a retry state machine that covers the
 * 200–800ms Supabase Storage CDN propagation window after a fresh upload.
 *
 * State machine:
 *   - 'pending' → render <PhotoSkeleton />, <img> mounts hidden so onLoad/
 *     onError fire. (We render the <img> in the DOM but visually hidden so
 *     the browser actually fetches it; PhotoSkeleton overlays.)
 *   - on first onLoad → 'loaded' → swap skeleton for the real img
 *   - on onError before 3 retries → bump retry count, swap src to
 *     `${signedUrl}?retry=${n}` (cache-buster query string append — does NOT
 *     re-mint the URL, see D-05). Wait RETRY_DELAY_MS via setTimeout before
 *     bumping so the CDN has time to propagate.
 *   - on onError after MAX_RETRIES → 'failed' → render the parent's existing
 *     fallback chain (watchImageUrl → no-photo placeholder).
 *
 * Pitfall F-2 (carry-forward Phase 15): native <img>, NOT next/image. The
 * Next image optimizer can strip query parameters on its proxy variants
 * which would invalidate the Supabase signed-URL token. The
 * `// eslint-disable-next-line @next/next/no-img-element` comment is the
 * same pattern used in WearDetailHero.tsx:39.
 *
 * D-05: ?retry=N is a query-string append only — we are NOT re-minting the
 * signed URL. Server-side mint happens once per page request in the
 * Suspense-wrapped server child; this client only varies the query string.
 *
 * Phase 56 D-05/06/07/08: all 3 photo containers render WearPhotoOverlays once
 * photo (or fallback) is shown. The 2 failed-state containers gain `relative`
 * (previously missing). The signed-URL happy-path container at ~L94 already
 * had `relative` — not touched. Overlays are suppressed during 'pending' to
 * avoid painting text over the PhotoSkeleton shimmer (D-08 overlay contract).
 */
export function WearPhotoClient({
  signedUrl,
  altText,
  watchImageUrl,
  brand,
  model,
  username,
  displayName,
  avatarUrl,
  createdAt,
}: {
  signedUrl: string
  altText: string
  watchImageUrl: string | null
  brand: string
  model: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
}) {
  const [status, setStatus] = useState<'pending' | 'loaded' | 'failed'>('pending')
  const [retryCount, setRetryCount] = useState(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  if (status === 'failed') {
    // Fall through to the parent's existing fallback chain.
    if (watchImageUrl) {
      return (
        <div className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
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
          />
        </div>
      )
    }
    return (
      <div
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
        />
      </div>
    )
  }

  const src = retryCount === 0 ? signedUrl : `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}retry=${retryCount}`

  return (
    <div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto relative">
      {status === 'pending' && (
        <div className="absolute inset-0">
          <PhotoSkeleton />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={altText}
        className="w-full h-full object-cover"
        loading="eager"
        onLoad={() => setStatus('loaded')}
        onError={() => {
          if (retryCount >= MAX_RETRIES) {
            setStatus('failed')
            return
          }
          if (retryTimerRef.current !== null) {
            clearTimeout(retryTimerRef.current)
          }
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            setRetryCount((n) => n + 1)
          }, RETRY_DELAY_MS)
        }}
        style={status === 'pending' ? { visibility: 'hidden' } : undefined}
      />
      {status !== 'pending' && (
        <WearPhotoOverlays
          username={username}
          displayName={displayName}
          avatarUrl={avatarUrl}
          createdAt={createdAt}
          brand={brand}
          model={model}
          hasPhoto={true}
        />
      )}
    </div>
  )
}
