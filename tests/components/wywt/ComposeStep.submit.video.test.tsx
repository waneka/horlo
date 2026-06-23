// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 06: upgraded from todo to assertions (VID-01, VID-06)

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// jsdom doesn't implement URL.createObjectURL / URL.revokeObjectURL; define
// no-op placeholders so the videoPreviewUrl useMemo inside ComposeStep doesn't
// throw on render.
beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:mock',
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

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}))

vi.mock('@/hooks/useMediaCapability', () => ({
  useMediaCapability: () => ({
    supportsVideoCapture: true,
    preferredMimeType: 'video/mp4;codecs=avc1',
  }),
}))

const logWearWithVideo = vi.fn()
const logWearWithPhoto = vi.fn()
vi.mock('@/app/actions/wearEvents', () => ({
  logWearWithVideo: (...args: unknown[]) => logWearWithVideo(...args),
  logWearWithPhoto: (...args: unknown[]) => logWearWithPhoto(...args),
}))

// Hold a reference to the supabase stub for per-test reconfiguration.
type UploadResult = { error: { message: string } | null }
type RemoveResult = { data: unknown; error: { message: string } | null }
type StorageBucket = {
  upload: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}
let bucket: StorageBucket
const fromMock = vi.fn(() => bucket)
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ storage: { from: fromMock } }),
}))

import { ComposeStep } from '@/components/wywt/ComposeStep'

function configureBucket({
  videoError = null as UploadResult['error'],
  posterError = null as UploadResult['error'],
  removeError = null as RemoveResult['error'],
} = {}) {
  bucket = {
    upload: vi.fn((path: string) => {
      if (path.endsWith('.mp4')) return Promise.resolve({ error: videoError })
      if (path.endsWith('-poster.jpg')) return Promise.resolve({ error: posterError })
      return Promise.resolve({ error: null })
    }),
    remove: vi.fn(() => Promise.resolve({ data: null, error: removeError })),
  }
}

function mkPropsWithVideo() {
  return {
    watch: {
      id: 'w-1',
      brand: 'Rolex',
      model: 'GMT',
      reference: '126710',
      imageUrl: null,
    } as Parameters<typeof ComposeStep>[0]['watch'],
    viewerId: 'v-1',
    wearEventId: '00000000-0000-0000-0000-000000000001',
    mediaState: {
      kind: 'video' as const,
      videoBlob: new Blob(['v'], { type: 'video/mp4' }),
      posterBlob: new Blob(['p'], { type: 'image/jpeg' }),
    },
    setMediaState: vi.fn(),
    note: '',
    setNote: vi.fn(),
    visibility: 'public' as const,
    setVisibility: vi.fn(),
    onChange: vi.fn(),
    onSubmitted: vi.fn(),
  }
}

async function flush() {
  // Let microtasks + the React transition settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('ComposeStep video submit — pipeline integration (VID-01, VID-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerPush.mockReset()
    logWearWithVideo.mockReset()
    logWearWithPhoto.mockReset()
    configureBucket()
  })

  it('VID-06: submit calls logWearWithVideo (not logWearWithPhoto) when mediaState.kind=video', async () => {
    logWearWithVideo.mockResolvedValueOnce({
      success: true,
      data: { wearEventId: 'we-1' },
    })
    render(<ComposeStep {...mkPropsWithVideo()} />)
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await flush()
    expect(logWearWithVideo).toHaveBeenCalledTimes(1)
    expect(logWearWithPhoto).not.toHaveBeenCalled()
  })

  it('VID-06: upload ordering = video blob → poster blob → action', async () => {
    logWearWithVideo.mockResolvedValueOnce({
      success: true,
      data: { wearEventId: 'we-1' },
    })
    render(<ComposeStep {...mkPropsWithVideo()} />)
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await flush()
    expect(bucket.upload).toHaveBeenCalledTimes(2)
    const firstPath = (bucket.upload as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const secondPath = (bucket.upload as ReturnType<typeof vi.fn>).mock.calls[1][0] as string
    expect(firstPath).toMatch(/\.mp4$/)
    expect(secondPath).toMatch(/-poster\.jpg$/)
    expect(logWearWithVideo).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith('/wear/00000000-0000-0000-0000-000000000001')
  })

  it('VID-10 / VID-06: compensating remove([videoPath]) fires when poster upload fails', async () => {
    configureBucket({ posterError: { message: 'poster boom' } })
    render(<ComposeStep {...mkPropsWithVideo()} />)
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await flush()
    // Both upload attempts ran (video succeeded, poster failed)
    expect(bucket.upload).toHaveBeenCalledTimes(2)
    // Compensating cleanup removed the orphan video
    expect(bucket.remove).toHaveBeenCalledTimes(1)
    const removePaths = (bucket.remove as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[]
    expect(removePaths[0]).toMatch(/\.mp4$/)
    // Action was never called
    expect(logWearWithVideo).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })
})
