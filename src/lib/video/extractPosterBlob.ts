// Phase 77 — extractPosterBlob (VID-05)
//
// Canvas-based poster frame extraction from a recorded video Blob. Seeks to
// 3/4 through the clip (the "completed angle" moment for wrist rotation per
// SEED-020 D-08) and emits a JPEG at quality 0.85.
//
// Validated in Spike 001 on iOS 26.6 Safari (3.0s clip → 169 KB JPEG at 720×1280).
//
// References:
// - .planning/spikes/001-mr-ios-capture/README.md §Results
// - 77-RESEARCH.md §Discretion Item 5
//
// No 'use client' — pure async function (not a hook). Uses browser APIs so
// must only be called in a browser context (inside a useEffect or event handler).

export async function extractPosterBlob(videoBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)
    video.src = url
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      video.currentTime = video.duration * 0.75 // 3/4 through clip (SEED-020 D-08)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas ctx unavailable'))
        return
      }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('canvas.toBlob returned null'))
        },
        'image/jpeg',
        0.85,
      )
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('video load failed'))
    }
  })
}
