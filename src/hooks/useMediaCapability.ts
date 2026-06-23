'use client'

// Phase 77 — useMediaCapability (VID-01, VID-04)
//
// Capability probe for MediaRecorder + getUserMedia + preferred mimeType.
// SSR-safe default: { supportsVideoCapture: false, preferredMimeType: null }.
// useEffect re-evaluates in the browser and flips the state if all checks pass.
//
// References:
// - 77-RESEARCH.md §Capability Probe Strategy
// - Spike 001 §Results — iOS 26.6 Safari: mp4+avc1: true; clip = video/mp4; codecs=avc1.42000a

import { useState, useEffect } from 'react'

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

export interface MediaCapability {
  supportsVideoCapture: boolean
  preferredMimeType: string | null
}

export function useMediaCapability(): MediaCapability {
  const [cap, setCap] = useState<MediaCapability>({
    supportsVideoCapture: false,
    preferredMimeType: null,
  })

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) return
    const preferred = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
    if (preferred) {
      setCap({ supportsVideoCapture: true, preferredMimeType: preferred })
    }
  }, [])

  return cap
}
