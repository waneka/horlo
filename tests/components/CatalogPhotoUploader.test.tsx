// tests/components/CatalogPhotoUploader.test.tsx
//
// Phase 19.1 D-19 — CatalogPhotoUploader component tests.
//
// Behaviors:
//   1. Empty state — renders "Choose photo" outline button + "JPG, PNG, or HEIC up to 8 MB" caption
//   2. File selection → calls onPhotoReady with a Blob after successful processing
//   3. File > 8MB → calls onError with "too large" message
//   4. disabled={true} → disables Choose photo button + file input
//   5. After successful processing → renders "Photo ready" caption (preview state)
//   6. Click Remove (X) → returns to empty state; onClear is called
//   7. Worker onerror → calls onError with HEIC convert message
//
// We mock @/lib/exif/strip to bypass the real canvas pipeline.
// We stub global Worker for HEIC paths.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock stripAndResize before importing the component.
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: vi.fn(async () => ({
    blob: new Blob(['fake-jpeg'], { type: 'image/jpeg' }),
    width: 800,
    height: 600,
  })),
}))

import { CatalogPhotoUploader } from '@/components/watch/CatalogPhotoUploader'

// Worker mock helpers (mirrors PhotoUploader.test.tsx pattern)
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

function ensureArrayBufferPolyfill() {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Response(this).arrayBuffer()
    }
  }
}

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
const createObjectURLMock = vi.fn(() => 'blob:mock-url')
const revokeObjectURLMock = vi.fn()
globalThis.URL.createObjectURL = createObjectURLMock
globalThis.URL.revokeObjectURL = revokeObjectURLMock

describe('CatalogPhotoUploader', () => {
  beforeEach(() => {
    workerInstances = []
    nextWorkerBehavior = null
    vi.clearAllMocks()
    createObjectURLMock.mockReturnValue('blob:mock-url')
    ensureArrayBufferPolyfill()
    installWorkerMock()
  })

  afterEach(() => {
    restoreWorkerMock()
  })

  it('renders empty state with Choose photo button + formats caption', () => {
    render(<CatalogPhotoUploader onPhotoReady={vi.fn()} onError={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Choose photo/i })).toBeInTheDocument()
    expect(screen.getByText('JPG, PNG, or HEIC up to 8 MB')).toBeInTheDocument()
    expect(screen.getByText('Reference Photo')).toBeInTheDocument()
  })

  it('calls onPhotoReady with a Blob after a successful JPEG file selection', async () => {
    const onPhotoReady = vi.fn()
    render(<CatalogPhotoUploader onPhotoReady={onPhotoReady} onError={vi.fn()} />)

    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/Upload reference photo/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onPhotoReady).toHaveBeenCalledTimes(1))
    const arg = onPhotoReady.mock.calls[0][0]
    expect(arg).toBeInstanceOf(Blob)
  })

  it('calls onError when file size > 8MB', async () => {
    const onError = vi.fn()
    render(<CatalogPhotoUploader onPhotoReady={vi.fn()} onError={onError} />)

    // Build a File object with size just over 8MB
    const oversize = new File([new Uint8Array(9 * 1024 * 1024)], 'huge.jpg', {
      type: 'image/jpeg',
    })
    const input = screen.getByLabelText(/Upload reference photo/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [oversize] } })

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/too large/i)),
    )
  })

  it('disables Choose photo button and file input when disabled prop is true', () => {
    render(<CatalogPhotoUploader onPhotoReady={vi.fn()} onError={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: /Choose photo/i })).toBeDisabled()
    expect(screen.getByLabelText(/Upload reference photo/i)).toBeDisabled()
  })

  it('shows Photo ready caption after successful file selection', async () => {
    const onPhotoReady = vi.fn()
    render(<CatalogPhotoUploader onPhotoReady={onPhotoReady} onError={vi.fn()} />)

    const file = new File(['x'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText(/Upload reference photo/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('Photo ready')).toBeInTheDocument())
    // Remove button should also appear
    expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument()
  })

  it('clicking Remove returns to empty state and calls onClear', async () => {
    const onClear = vi.fn()
    render(
      <CatalogPhotoUploader onPhotoReady={vi.fn()} onError={vi.fn()} onClear={onClear} />,
    )

    // Upload a file to reach preview state
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/Upload reference photo/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument())

    // Click Remove
    fireEvent.click(screen.getByRole('button', { name: /Remove photo/i }))

    // Should return to empty state
    await waitFor(() => expect(screen.getByRole('button', { name: /Choose photo/i })).toBeInTheDocument())
    expect(onClear).toHaveBeenCalledTimes(1)
    // revokeObjectURL should have been called
    expect(revokeObjectURLMock).toHaveBeenCalled()
  })

  it('calls onError with HEIC convert message when Worker onerror fires', async () => {
    const onError = vi.fn()
    nextWorkerBehavior = {
      kind: 'error',
      err: new ErrorEvent('error', { message: 'WASM init failed' }),
    }

    render(<CatalogPhotoUploader onPhotoReady={vi.fn()} onError={onError} />)

    const file = new File([new Uint8Array(8)], 'broken.heic', { type: '' })
    const input = screen.getByLabelText(/Upload reference photo/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'Could not convert HEIC photo. Please try another image.',
      ),
    )
  })
})
