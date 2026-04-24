// tests/components/PhotoUploader.test.tsx
//
// Wave 0 — verifies PhotoUploader (WYWT-05).
//
// Behaviors:
//   1. isHeicFile() detects .heic / .HEIF / image-heic / image-heif
//   2. Selecting a .heic file constructs new Worker, posts the buffer,
//      and calls onPhotoReady with the post-strip blob
//   3. Selecting a .jpg file SKIPS the worker entirely and calls
//      stripAndResize directly
//   4. Worker onerror surfaces an inline error via onError
//
// We mock @/lib/exif/strip so canvas backend isn't required.
// We stub global Worker with a recording constructor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock stripAndResize so we don't need a real canvas backend.
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: vi.fn(async () => ({
    blob: new Blob(['stripped'], { type: 'image/jpeg' }),
    width: 1080,
    height: 720,
  })),
}))

import { PhotoUploader, isHeicFile } from '@/components/wywt/PhotoUploader'
import { stripAndResize } from '@/lib/exif/strip'

interface RecordedWorker {
  url: URL | string
  options: WorkerOptions | undefined
}

let workerInstances: RecordedWorker[] = []
let nextWorkerBehavior:
  | { kind: 'success'; reply: { buffer: ArrayBuffer; type: string } }
  | { kind: 'error'; err: ErrorEvent }
  | null = null
let originalWorker: typeof Worker | undefined

function installWorkerMock() {
  originalWorker = globalThis.Worker
  class WorkerMock {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: ErrorEvent) => void) | null = null
    constructor(url: string | URL, options?: WorkerOptions) {
      workerInstances.push({ url, options })
    }
    postMessage(_data: unknown, _transfer?: Transferable[]) {
      const onmsg = this.onmessage
      const onerr = this.onerror
      const behavior = nextWorkerBehavior
      queueMicrotask(() => {
        if (!behavior) return
        if (behavior.kind === 'success') {
          onmsg?.({ data: behavior.reply } as MessageEvent)
        } else {
          onerr?.(behavior.err)
        }
      })
    }
    terminate() {}
  }
  ;(globalThis as unknown as { Worker: typeof Worker }).Worker =
    WorkerMock as unknown as typeof Worker
}

function restoreWorkerMock() {
  if (originalWorker) {
    ;(globalThis as unknown as { Worker: typeof Worker }).Worker = originalWorker
  } else {
    delete (globalThis as unknown as { Worker?: typeof Worker }).Worker
  }
}

describe('isHeicFile', () => {
  it('detects HEIC by extension when MIME is empty (Android browsers)', () => {
    const f = new File([new Uint8Array(1)], 'photo.heic', { type: '' })
    expect(isHeicFile(f)).toBe(true)
  })

  it('detects HEIC by image/heic MIME', () => {
    const f = new File([new Uint8Array(1)], 'photo.weird', {
      type: 'image/heic',
    })
    expect(isHeicFile(f)).toBe(true)
  })

  it('detects HEIF by extension (case-insensitive)', () => {
    const f = new File([new Uint8Array(1)], 'photo.HEIF', { type: 'image/heif' })
    expect(isHeicFile(f)).toBe(true)
  })

  it('returns false for plain JPEG', () => {
    const f = new File([new Uint8Array(1)], 'photo.jpg', { type: 'image/jpeg' })
    expect(isHeicFile(f)).toBe(false)
  })
})

// jsdom's File/Blob lack `arrayBuffer()`. Polyfill so PhotoUploader's
// convertHeic path can buffer the file before posting to the worker.
function ensureArrayBufferPolyfill() {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Response(this).arrayBuffer()
    }
  }
}

describe('PhotoUploader', () => {
  beforeEach(() => {
    workerInstances = []
    nextWorkerBehavior = null
    vi.clearAllMocks()
    ensureArrayBufferPolyfill()
    installWorkerMock()
  })

  afterEach(() => {
    restoreWorkerMock()
  })

  it('selects a .heic file → constructs Worker + calls stripAndResize + onPhotoReady', async () => {
    const onPhotoReady = vi.fn()
    const onError = vi.fn()
    nextWorkerBehavior = {
      kind: 'success',
      reply: {
        buffer: new ArrayBuffer(8),
        type: 'image/jpeg',
      },
    }
    render(
      <PhotoUploader onPhotoReady={onPhotoReady} onError={onError} />,
    )
    const input = screen.getByLabelText(
      'Upload photo from device',
    ) as HTMLInputElement
    const file = new File([new Uint8Array(8)], 'wrist.heic', { type: '' })
    await userEvent.upload(input, file)
    // Allow the worker microtask + downstream awaits to settle. Multiple
    // ticks are needed because: handleFileChange → file.arrayBuffer() (1
    // tick) → worker.postMessage → microtask emits onmessage → resolve →
    // stripAndResize (1 tick) → onPhotoReady.
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
    expect(workerInstances).toHaveLength(1)
    expect(stripAndResize).toHaveBeenCalledTimes(1)
    expect(onPhotoReady).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('selects a .jpg file → SKIPS Worker entirely + calls stripAndResize directly', async () => {
    const onPhotoReady = vi.fn()
    const onError = vi.fn()
    render(
      <PhotoUploader onPhotoReady={onPhotoReady} onError={onError} />,
    )
    const input = screen.getByLabelText(
      'Upload photo from device',
    ) as HTMLInputElement
    const file = new File([new Uint8Array(8)], 'wrist.jpg', {
      type: 'image/jpeg',
    })
    await userEvent.upload(input, file)
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
    expect(workerInstances).toHaveLength(0) // crucial: no worker for non-HEIC
    expect(stripAndResize).toHaveBeenCalledTimes(1)
    expect(onPhotoReady).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('worker onerror surfaces "Could not convert HEIC photo." via onError', async () => {
    const onPhotoReady = vi.fn()
    const onError = vi.fn()
    nextWorkerBehavior = {
      kind: 'error',
      err: new ErrorEvent('error', { message: 'WASM init failed' }),
    }
    render(
      <PhotoUploader onPhotoReady={onPhotoReady} onError={onError} />,
    )
    const input = screen.getByLabelText(
      'Upload photo from device',
    ) as HTMLInputElement
    const file = new File([new Uint8Array(8)], 'broken.heic', { type: '' })
    await userEvent.upload(input, file)
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
    expect(onPhotoReady).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      'Could not convert HEIC photo. Please try another image.',
    )
  })
})
