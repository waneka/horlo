'use client'

// src/components/wear/WearVideoClient.tsx
//
// Phase 77 — Detail-page + stories-lane video player (VID-13, VID-14, D-06, D-08).
//
// Renders <video autoPlay muted loop playsInline> inside the same container
// class as WearPhotoClient (visual parity — VID-15 contract). Tap toggles
// pause/resume (D-06). onError swaps to a static poster + "Video unavailable"
// label (D-08). No retry state machine — videos do not have the photo's CDN-
// propagation window.

import { useRef, useState } from 'react'
import { WearPhotoOverlays } from './WearDetailHero'

interface WearVideoClientProps {
  signedVideoUrl: string | null
  signedPosterUrl: string | null
  altText: string
  watchImageUrl: string | null
  brand: string
  model: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  watchId: string
}

export function WearVideoClient({
  signedVideoUrl,
  signedPosterUrl,
  altText,
  brand,
  model,
  username,
  displayName,
  avatarUrl,
  createdAt,
  watchId,
}: WearVideoClientProps) {
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // D-08: error fallback. Triggered by <video onError> OR when signedVideoUrl
  // is null (non-owner viewer that the admin client failed to mint a URL for).
  if (failed || !signedVideoUrl) {
    return (
      <div
        data-testid="wear-video-container"
        className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh]"
        aria-label={altText}
      >
        {signedPosterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedPosterUrl}
            alt={altText}
            className="w-full h-full object-cover"
          />
        )}
        <span className="absolute bottom-[60px] left-3 z-10 text-xs font-semibold text-white/70">
          Video unavailable
        </span>
        <WearPhotoOverlays
          username={username}
          displayName={displayName}
          avatarUrl={avatarUrl}
          createdAt={createdAt}
          brand={brand}
          model={model}
          hasPhoto={!!signedPosterUrl}
          watchId={watchId}
        />
      </div>
    )
  }

  return (
    <div
      data-testid="wear-video-container"
      className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh]"
      aria-label={paused ? 'Video paused — tap to resume' : 'Video playing — tap to pause'}
      onClick={() => {
        const v = videoRef.current
        if (!v) return
        if (v.paused) {
          v.play()
          setPaused(false)
        } else {
          v.pause()
          setPaused(true)
        }
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={signedVideoUrl}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
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
