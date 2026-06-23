// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 04: upgraded from todo to assertions (VID-05)

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { extractPosterBlob } from '@/lib/video/extractPosterBlob'

// jsdom doesn't implement URL.createObjectURL / URL.revokeObjectURL; define
// them as no-op placeholders so vi.spyOn has something to wrap.
beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:placeholder',
      writable: true,
      configurable: true,
    })
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: () => {},
      writable: true,
      configurable: true,
    })
  }
})

type SetupOpts = {
  duration?: number
  toBlobResult?: Blob | null
  contextNull?: boolean
}

function setupMockMediaElements(opts: SetupOpts = {}) {
  const {
    duration = 3.0,
    toBlobResult = new Blob(['poster'], { type: 'image/jpeg' }),
    contextNull = false,
  } = opts

  let onseekedFn: (() => void) | null = null
  let onerrorFn: (() => void) | null = null
  let currentTime = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockVideoEl: any = {
    src: '',
    muted: false,
    playsInline: false,
    duration,
    videoWidth: 720,
    videoHeight: 1280,
    get currentTime() {
      return currentTime
    },
    set currentTime(t: number) {
      currentTime = t
      // Trigger onseeked once the seek completes (macrotask, so it runs after
      // the full Promise-constructor body has assigned onseeked).
      setTimeout(() => {
        if (onseekedFn) onseekedFn()
      }, 0)
    },
    set onloadedmetadata(fn: () => void) {
      // Trigger metadata-loaded callback once the src assignment has settled.
      setTimeout(() => fn(), 0)
    },
    set onseeked(fn: () => void) {
      onseekedFn = fn
    },
    set onerror(fn: () => void) {
      onerrorFn = fn
    },
    get onerror() {
      return onerrorFn
    },
  }

  const toBlobMock = vi.fn((cb: (b: Blob | null) => void) => cb(toBlobResult))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockCanvasEl: any = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (contextNull ? null : { drawImage: vi.fn() })),
    toBlob: toBlobMock,
  }

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return mockVideoEl as HTMLVideoElement
    if (tag === 'canvas') return mockCanvasEl as HTMLCanvasElement
    // Fallback — shouldn't happen in these tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any
  })

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')

  return {
    mockVideoEl,
    mockCanvasEl,
    toBlobMock,
    getCurrentTime: () => currentTime,
  }
}

describe('extractPosterBlob — canvas seek + toBlob (VID-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('seeks to duration * 0.75 before calling canvas.toBlob (VID-05)', async () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { toBlobMock, getCurrentTime } = setupMockMediaElements({ duration: 3.0 })
    await extractPosterBlob(new Blob(['x']))
    expect(getCurrentTime()).toBe(2.25) // 3.0 * 0.75
    expect(toBlobMock).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85)
  })

  it('rejects when canvas.toBlob returns null', async () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    setupMockMediaElements({ toBlobResult: null })
    await expect(extractPosterBlob(new Blob(['x']))).rejects.toThrow('canvas.toBlob returned null')
  })

  it('revokes object URL on success', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    setupMockMediaElements()
    await extractPosterBlob(new Blob(['x']))
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
  })
})
