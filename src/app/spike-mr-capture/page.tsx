'use client'

// THROWAWAY SPIKE PAGE — Spike 001 (mr-ios-capture)
// Tests iOS Safari MediaRecorder feasibility for WYWT 3-second wrist-rotation video capture.
// Delete this entire directory after the spike concludes — see .planning/spikes/001-mr-ios-capture/README.md.

import { useCallback, useEffect, useRef, useState } from 'react'

type LogEntry = {
  t: string
  level: 'info' | 'warn' | 'error'
  category: string
  message: string
  data?: Record<string, unknown>
}

const RECORD_DURATION_MS = 3000

export default function SpikeMrCapturePage() {
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const playbackRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<number | null>(null)

  const [phase, setPhase] = useState<'idle' | 'camera-ready' | 'recording' | 'recorded' | 'error'>('idle')
  const [countdown, setCountdown] = useState<number>(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null)
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [supportProbe, setSupportProbe] = useState<{
    mediaRecorder: boolean
    getUserMedia: boolean
    mp4: boolean
    mp4H264: boolean
    webm: boolean
    webmVp9: boolean
    webmVp8: boolean
    userAgent: string
  } | null>(null)

  const log = useCallback((level: LogEntry['level'], category: string, message: string, data?: Record<string, unknown>) => {
    setLogs((prev) => [...prev, { t: new Date().toISOString(), level, category, message, data }])
    if (typeof console !== 'undefined') {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      fn(`[spike-mr ${category}]`, message, data ?? '')
    }
  }, [])

  // Probe browser capabilities on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const supports = (mime: string) => {
      try { return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime) } catch { return false }
    }
    const probe = {
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mp4: supports('video/mp4'),
      mp4H264: supports('video/mp4;codecs=avc1'),
      webm: supports('video/webm'),
      webmVp9: supports('video/webm;codecs=vp9'),
      webmVp8: supports('video/webm;codecs=vp8'),
      userAgent: navigator.userAgent,
    }
    setSupportProbe(probe)
    log('info', 'probe', 'Browser capability probe complete', probe)
  }, [log])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      if (posterUrl) URL.revokeObjectURL(posterUrl)
    }
  }, [recordedUrl, posterUrl])

  const startCamera = useCallback(async () => {
    log('info', 'camera', 'Requesting back camera via getUserMedia')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (previewRef.current) {
        previewRef.current.srcObject = stream
        await previewRef.current.play().catch((err) => log('warn', 'camera', 'preview play() rejected', { err: String(err) }))
      }
      const settings = stream.getVideoTracks()[0]?.getSettings()
      log('info', 'camera', 'Camera ready', { settings })
      setPhase('camera-ready')
    } catch (err) {
      log('error', 'camera', 'getUserMedia failed', { err: String(err) })
      setPhase('error')
    }
  }, [log])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    log('info', 'record', 'Starting MediaRecorder')
    chunksRef.current = []
    // Try mp4 first (iOS preference), fall back to webm. Don't set mimeType if neither supported — let browser pick.
    let mimeType: string | undefined
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) mimeType = 'video/mp4;codecs=avc1'
    else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4'
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9'
    else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm'
    log('info', 'record', 'Selected mimeType', { mimeType: mimeType ?? '(browser default)' })

    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current)
    } catch (err) {
      log('error', 'record', 'MediaRecorder construction failed', { err: String(err) })
      setPhase('error')
      return
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
        log('info', 'record', 'ondataavailable chunk', { size: e.data.size, type: e.data.type })
      }
    }
    recorder.onstop = () => {
      const actualType = recorder.mimeType || mimeType || 'video/mp4'
      const blob = new Blob(chunksRef.current, { type: actualType })
      log('info', 'record', 'Recording stopped', { size: blob.size, type: blob.type, chunks: chunksRef.current.length })
      const url = URL.createObjectURL(blob)
      setRecordedBlob(blob)
      setRecordedUrl(url)
      setPhase('recorded')
      // Auto-extract poster as soon as we have a URL.
      extractPoster(url).catch((err) => log('error', 'poster', 'extractPoster threw', { err: String(err) }))
    }
    recorder.onerror = (e) => {
      log('error', 'record', 'MediaRecorder onerror', { event: String(e) })
      setPhase('error')
    }

    const startedAt = performance.now()
    recorder.start()
    setPhase('recording')
    setCountdown(Math.ceil(RECORD_DURATION_MS / 1000))
    log('info', 'record', 'recorder.start() called', { mimeType: recorder.mimeType })

    // 3-second auto-stop via setTimeout. Precision is reported in the log.
    stopTimerRef.current = window.setTimeout(() => {
      const elapsed = performance.now() - startedAt
      log('info', 'record', 'Auto-stop firing', { elapsedMs: elapsed.toFixed(1), targetMs: RECORD_DURATION_MS })
      try { recorder.stop() } catch (err) { log('error', 'record', 'recorder.stop() threw', { err: String(err) }) }
    }, RECORD_DURATION_MS)

    // Countdown UI.
    const countdownTimer = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(countdownTimer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }, [log])

  const extractPoster = useCallback(async (videoUrl: string) => {
    log('info', 'poster', 'Beginning poster extraction')
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = videoUrl
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('video load error'))
    })
    log('info', 'poster', 'Metadata loaded', { duration: video.duration, w: video.videoWidth, h: video.videoHeight })
    setPlaybackDuration(video.duration)
    // Seek to middle frame for a more representative wrist-rotation poster.
    const seekTo = Math.min(0.5, Math.max(0, video.duration / 2))
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('video seek error'))
      video.currentTime = seekTo
    })
    log('info', 'poster', 'Seeked to middle frame', { currentTime: video.currentTime })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      log('error', 'poster', 'Could not get 2d canvas context')
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) {
      log('error', 'poster', 'canvas.toBlob returned null')
      return
    }
    const url = URL.createObjectURL(blob)
    setPosterBlob(blob)
    setPosterUrl(url)
    log('info', 'poster', 'Poster extracted', { size: blob.size, type: blob.type, w: canvas.width, h: canvas.height })
  }, [log])

  const reset = useCallback(() => {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    if (posterUrl) URL.revokeObjectURL(posterUrl)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setPosterBlob(null)
    setPosterUrl(null)
    setPlaybackDuration(null)
    chunksRef.current = []
    setPhase(streamRef.current ? 'camera-ready' : 'idle')
    log('info', 'ui', 'Reset to camera-ready')
  }, [recordedUrl, posterUrl, log])

  const copyLog = useCallback(() => {
    const text = logs.map((e) => `${e.t} [${e.level}] ${e.category}: ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`).join('\n')
    void navigator.clipboard.writeText(text).then(
      () => log('info', 'ui', 'Log copied to clipboard'),
      (err) => log('warn', 'ui', 'Clipboard copy failed', { err: String(err) })
    )
  }, [logs, log])

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 font-sans">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wider text-neutral-500">Spike 001 (throwaway)</p>
        <h1 className="text-xl font-semibold">MediaRecorder iOS feasibility</h1>
        <p className="mt-1 text-sm text-neutral-600">3-second wrist-rotation video capture + poster extraction + inline playback.</p>
      </header>

      {/* Capability probe */}
      <section className="mb-4 rounded-md border border-neutral-200 p-3 text-xs">
        <p className="mb-1 font-semibold">Capability probe</p>
        {supportProbe ? (
          <ul className="space-y-0.5 font-mono">
            <li>MediaRecorder: {String(supportProbe.mediaRecorder)}</li>
            <li>getUserMedia: {String(supportProbe.getUserMedia)}</li>
            <li>mp4: {String(supportProbe.mp4)} / mp4+avc1: {String(supportProbe.mp4H264)}</li>
            <li>webm: {String(supportProbe.webm)} / vp9: {String(supportProbe.webmVp9)} / vp8: {String(supportProbe.webmVp8)}</li>
            <li className="break-all">UA: {supportProbe.userAgent}</li>
          </ul>
        ) : <p className="text-neutral-500">Probing…</p>}
      </section>

      {/* Preview */}
      <section className="mb-4">
        <div className="aspect-square w-full overflow-hidden rounded-md bg-neutral-900">
          <video ref={previewRef} className="h-full w-full object-cover" autoPlay muted playsInline />
        </div>
      </section>

      {/* Controls */}
      <section className="mb-4 flex flex-wrap gap-2">
        {phase === 'idle' && (
          <button onClick={startCamera} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Start camera
          </button>
        )}
        {phase === 'camera-ready' && (
          <button onClick={startRecording} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Record 3s
          </button>
        )}
        {phase === 'recording' && (
          <div className="rounded-md bg-red-100 px-4 py-2 text-sm font-mono text-red-900">
            ● Recording… auto-stop in {countdown}s
          </div>
        )}
        {(phase === 'recorded' || phase === 'error') && (
          <button onClick={reset} className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
            Reset
          </button>
        )}
      </section>

      {/* Recorded playback */}
      {recordedUrl && (
        <section className="mb-4 rounded-md border border-neutral-200 p-3">
          <p className="mb-2 text-sm font-semibold">Playback test (autoplay-muted-loop, playsinline)</p>
          <video
            ref={playbackRef}
            src={recordedUrl}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="aspect-square w-full rounded bg-neutral-900 object-cover"
          />
          <ul className="mt-2 font-mono text-xs">
            <li>blob.size: {recordedBlob?.size} bytes ({(((recordedBlob?.size ?? 0) / 1024) / 1024).toFixed(2)} MB)</li>
            <li>blob.type: {recordedBlob?.type}</li>
            <li>video.duration: {playbackDuration?.toFixed(3) ?? '—'} s</li>
          </ul>
          {recordedBlob && (
            <button
              onClick={() => downloadBlob(recordedBlob, `wywt-spike-${Date.now()}.${recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'}`)}
              className="mt-2 rounded-md border border-neutral-300 px-3 py-1 text-xs"
            >
              Download blob (for cross-browser test)
            </button>
          )}
        </section>
      )}

      {/* Poster */}
      {posterUrl && (
        <section className="mb-4 rounded-md border border-neutral-200 p-3">
          <p className="mb-2 text-sm font-semibold">Extracted poster frame (from middle of clip)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterUrl} alt="poster" className="aspect-square w-full rounded bg-neutral-900 object-cover" />
          <ul className="mt-2 font-mono text-xs">
            <li>poster.size: {posterBlob?.size} bytes ({((posterBlob?.size ?? 0) / 1024).toFixed(1)} KB)</li>
            <li>poster.type: {posterBlob?.type}</li>
          </ul>
        </section>
      )}

      {/* Forensic log */}
      <section className="mb-4 rounded-md border border-neutral-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Forensic log ({logs.length} events)</p>
          <button onClick={copyLog} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
            Copy all
          </button>
        </div>
        <div className="max-h-64 overflow-auto rounded bg-neutral-50 p-2 font-mono text-[10px] leading-tight">
          {logs.map((e, i) => (
            <div key={i} className={e.level === 'error' ? 'text-red-700' : e.level === 'warn' ? 'text-amber-700' : 'text-neutral-700'}>
              <span className="text-neutral-400">{e.t.slice(11, 23)}</span> [{e.category}] {e.message}
              {e.data && <span className="text-neutral-500"> {JSON.stringify(e.data)}</span>}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-neutral-500">
        Throwaway. Delete <code>src/app/spike-mr-capture/</code> after the spike concludes.
      </p>
    </main>
  )
}
