// tests/components/photo-uploader.test.tsx
//
// Phase 61 Plan 02 — PhotoDropzone / upload pipeline tests.
//
// VALIDATION.md Requirement → Test Mapping:
//   PHOTO-02: Cap enforcement — batch > remaining slots → accept up to cap,
//             surface rejection message (no silent drop). "Added N photo(s).
//             M skipped — you've reached the 10-photo limit."
//   PHOTO-02: File selection invokes HEIC detect → convertHeic → stripAndResize
//             pipeline (mirrors CatalogPhotoUploader.test.tsx).
//   PHOTO-02: Sequential processing: parallel uploads cause sort_order race
//             (RESEARCH Pitfall 4) — batch must process one-at-a-time.
//   PHOTO-02: Input reset after batch so same files can be re-selected
//             (analog: CatalogPhotoUploader.test.tsx e.target.value = '').
//
// Manual-only behaviors (from VALIDATION.md §Manual-Only):
//   - OS photo picker offers camera + library on prod mobile (PHOTO-02)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// vi.hoisted() required — mock factories are hoisted before top-level let/const init
// (KEY DECISION from Phase 61 Plan 01)
const mocks = vi.hoisted(() => ({
  stripAndResize: vi.fn(async (blob: Blob) => ({ blob, width: 800, height: 600 })),
  uploadWatchPhoto: vi.fn(async () => ({ path: 'user-id/photo-id.jpg' })),
  buildWatchPhotoPath: vi.fn((_userId: string, photoId: string) => `user-id/${photoId}.jpg`),
  addWatchPhotoAction: vi.fn(async () => ({ success: true, data: { id: 'new-id' } })),
  reorderWatchPhotosAction: vi.fn(async () => ({ success: true, data: undefined })),
  deleteWatchPhotoAction: vi.fn(async () => ({ success: true, data: undefined })),
  toastFn: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}))

// Mock stripAndResize before importing the component
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: mocks.stripAndResize,
}))

// Mock the storage helper
vi.mock('@/lib/storage/watchPhotos', () => ({
  uploadWatchPhoto: mocks.uploadWatchPhoto,
  buildWatchPhotoPath: mocks.buildWatchPhotoPath,
}))

// Mock addWatchPhotoAction
vi.mock('@/app/actions/watchPhotos', () => ({
  addWatchPhotoAction: mocks.addWatchPhotoAction,
  reorderWatchPhotosAction: mocks.reorderWatchPhotosAction,
  deleteWatchPhotoAction: mocks.deleteWatchPhotoAction,
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(mocks.toastFn, {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  }),
}))

// Worker mock infrastructure (mirrors CatalogPhotoUploader.test.tsx)
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

function makeSuccessBuffer() {
  const ab = new ArrayBuffer(4)
  new Uint8Array(ab).set([0xff, 0xd8, 0xff, 0xe0])
  return ab
}

// jsdom doesn't implement Blob.prototype.arrayBuffer — polyfill it.
// Mirrors CatalogPhotoUploader.test.tsx pattern.
function ensureArrayBufferPolyfill() {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Response(this).arrayBuffer()
    }
  }
}

// Import AFTER mocks
import { PhotoDropzone } from '@/components/watch/PhotoDropzone'

function makeFile(name: string, type = 'image/jpeg'): File {
  return new File(['fake-content'], name, { type })
}

function makeHeicFile(name = 'photo.heic'): File {
  return new File(['fake-heic'], name, { type: 'image/heic' })
}

describe('PhotoDropzone / upload pipeline (PHOTO-02)', () => {
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

  it('PHOTO-02: renders drop zone with correct aria-label', () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={0}
        onPhotosAdded={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Upload photos/i }),
    ).toBeInTheDocument()
  })

  it('PHOTO-02: batch within remaining slots → all files accepted', async () => {
    const onPhotosAdded = vi.fn()

    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={8}
        onPhotosAdded={onPhotosAdded}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()

    // Provide 2 files (2 remaining slots)
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    await waitFor(() => {
      // addWatchPhotoAction should be called twice
      expect(mocks.addWatchPhotoAction).toHaveBeenCalledTimes(2)
    })

    // No overflow warning
    expect(mocks.toastWarning).not.toHaveBeenCalled()
  })

  it('PHOTO-02: batch exceeds cap → accepted up to remaining, rejected files surface toast', async () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={9}
        onPhotosAdded={vi.fn()}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // Try to add 3 files but only 1 slot remaining
    const files = [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')]
    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    // Warning toast should fire immediately
    await waitFor(() => {
      expect(mocks.toastWarning).toHaveBeenCalled()
    })
    const call = mocks.toastWarning.mock.calls[0][0] as string
    expect(call).toContain('skipped')
    expect(call).toContain('10-photo limit')
  })

  it('PHOTO-02: toast message contains count of accepted and skipped files', async () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={8}
        onPhotosAdded={vi.fn()}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // 2 remaining, try to add 5
    const files = [
      makeFile('a.jpg'),
      makeFile('b.jpg'),
      makeFile('c.jpg'),
      makeFile('d.jpg'),
      makeFile('e.jpg'),
    ]
    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    await waitFor(() => {
      expect(mocks.toastWarning).toHaveBeenCalled()
    })

    const msg = mocks.toastWarning.mock.calls[0][0] as string
    // Should say "Added 2 photos. 3 skipped — you've reached the 10-photo limit."
    expect(msg).toMatch(/Added 2 photo/)
    expect(msg).toMatch(/3 skipped/)
  })

  it('PHOTO-02: JPEG file triggers stripAndResize pipeline', async () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={0}
        onPhotosAdded={vi.fn()}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const files = [makeFile('photo.jpg')]

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    await waitFor(() => {
      expect(mocks.stripAndResize).toHaveBeenCalled()
      expect(mocks.addWatchPhotoAction).toHaveBeenCalled()
    })
  })

  it('PHOTO-02: HEIC file triggers convertHeic → stripAndResize pipeline', async () => {
    nextWorkerBehavior = {
      kind: 'success',
      reply: { buffer: makeSuccessBuffer(), type: 'image/jpeg' },
    }

    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={0}
        onPhotosAdded={vi.fn()}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const files = [makeHeicFile()]

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    await waitFor(() => {
      // A worker should have been created for HEIC conversion
      expect(workerInstances.length).toBeGreaterThan(0)
      // stripAndResize should also have been called
      expect(mocks.stripAndResize).toHaveBeenCalled()
    })
  })

  it('PHOTO-02: input value reset after batch so same file can be re-selected', async () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={0}
        onPhotosAdded={vi.fn()}
      />,
    )

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const files = [makeFile('photo.jpg')]

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true })
      fireEvent.change(input)
    })

    await waitFor(() => {
      // After batch, input value should be reset to '' so the same file can be re-selected
      expect(input.value).toBe('')
    })
  })

  it('PHOTO-02: desktop drop zone onDrop passes files to upload pipeline', async () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={0}
        onPhotosAdded={vi.fn()}
      />,
    )

    const dropZone = screen.getByRole('button', { name: /Upload photos/i })
    const files = [makeFile('dropped.jpg')]
    const dataTransfer = {
      files,
      items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
    }

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer })
    })

    await waitFor(() => {
      expect(mocks.addWatchPhotoAction).toHaveBeenCalled()
    })
  })

  it('PHOTO-02: at cap (10 photos), drop zone shows cap message', () => {
    render(
      <PhotoDropzone
        watchId="watch-123"
        userId="user-123"
        currentPhotoCount={10}
        onPhotosAdded={vi.fn()}
      />,
    )
    expect(screen.getByText(/10 photos — at the limit/i)).toBeInTheDocument()
  })
})
