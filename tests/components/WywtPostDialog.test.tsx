// tests/components/WywtPostDialog.test.tsx
//
// Wave 0 — Phase 15 Plan 03b frontend composition layer.
//
// Tests three surfaces:
//   1. WatchPickerDialog extension (Task 1) — onWatchSelected + wornTodayIds
//   2. WywtPostDialog orchestrator (Task 2) — two-step state machine + preflight
//   3. ComposeStep + VisibilitySegmentedControl (Task 3) — photo zone 3-handler split
//      + note counter + visibility + submit + toast
//
// Mocks are set per-suite so each suite can swap child-component stubs independently.
// PhotoUploader / CameraCaptureView / Sonner / action wrappers are mocked via
// vi.mock factories declared at module top (vitest hoists them).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

import type { Watch } from '@/lib/types'

// ---- Shared mocks ----------------------------------------------------------

// next/link stub (WatchPickerDialog uses <Link> in empty state)
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock Server Actions — markAsWorn for WatchPickerDialog tests; logWearWithPhoto
// + getWornTodayIdsForUserAction for WywtPostDialog / ComposeStep tests.
const mockMarkAsWorn = vi.fn()
const mockLogWearWithPhoto = vi.fn()
const mockGetWornTodayIdsForUserAction = vi.fn()
vi.mock('@/app/actions/wearEvents', () => ({
  markAsWorn: (...args: unknown[]) => mockMarkAsWorn(...args),
  logWearWithPhoto: (...args: unknown[]) => mockLogWearWithPhoto(...args),
  getWornTodayIdsForUserAction: (...args: unknown[]) =>
    mockGetWornTodayIdsForUserAction(...args),
}))

// Mock sonner — capture toast.success calls
const mockToastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}))

// Mock stripAndResize / uploadWearPhoto — verified via call order in Test 17
const mockStripAndResize = vi.fn()
const mockUploadWearPhoto = vi.fn()
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: (...args: unknown[]) => mockStripAndResize(...args),
}))
vi.mock('@/lib/storage/wearPhotos', () => ({
  uploadWearPhoto: (...args: unknown[]) => mockUploadWearPhoto(...args),
  buildWearPhotoPath: (userId: string, id: string) => `${userId}/${id}.jpg`,
}))

// Mock PhotoUploader — use forwardRef + useImperativeHandle so ComposeStep
// can call photoUploaderRef.current?.openPicker() (D-07 handler #3).
const mockOpenPicker = vi.fn()
vi.mock('@/components/wywt/PhotoUploader', () => ({
  PhotoUploader: React.forwardRef<
    { openPicker: () => void },
    {
      onPhotoReady: (b: Blob) => void
      onError: (msg: string) => void
      disabled?: boolean
    }
  >(function PhotoUploaderMock(props, ref) {
    React.useImperativeHandle(ref, () => ({ openPicker: mockOpenPicker }), [])
    return (
      <button
        type="button"
        data-testid="simulate-upload"
        disabled={props.disabled}
        onClick={() =>
          props.onPhotoReady(new Blob(['upload'], { type: 'image/jpeg' }))
        }
      >
        Upload photo
      </button>
    )
  }),
}))

// Mock CameraCaptureView — expose received stream + onPhotoReady via testid.
vi.mock('@/components/wywt/CameraCaptureView', () => ({
  CameraCaptureView: (props: {
    stream: MediaStream
    onPhotoReady: (b: Blob) => void
    onError: (m: string) => void
    onCancel: () => void
    disabled?: boolean
  }) => (
    <div data-testid="camera-capture-view" data-stream-id={(props.stream as unknown as { id?: string } | null)?.id ?? ''}>
      <button
        type="button"
        data-testid="simulate-capture"
        disabled={props.disabled}
        onClick={() =>
          props.onPhotoReady(new Blob(['cam'], { type: 'image/jpeg' }))
        }
      >
        Capture
      </button>
      <button type="button" data-testid="simulate-camera-cancel" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  ),
}))

// ---- Helpers --------------------------------------------------------------

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: 'watch-1',
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

function makeStream(id = 'stream-1'): MediaStream {
  const tracks: MediaStreamTrack[] = [
    { stop: vi.fn() } as unknown as MediaStreamTrack,
  ]
  return {
    id,
    getTracks: () => tracks,
  } as unknown as MediaStream
}

// ---- Task 1 — WatchPickerDialog extension ---------------------------------

// Import AFTER mocks are declared so vi.mock hoist replaces the module.
import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'

describe('WatchPickerDialog — Task 1 extension: onWatchSelected + wornTodayIds', () => {
  beforeEach(() => {
    mockMarkAsWorn.mockReset()
    mockLogWearWithPhoto.mockReset()
    mockGetWornTodayIdsForUserAction.mockReset()
  })

  it('Test 1 (backwards-compat) — without onWatchSelected, Log wear calls markAsWorn and closes', async () => {
    mockMarkAsWorn.mockResolvedValue({ success: true })
    const onOpenChange = vi.fn()
    render(
      <WatchPickerDialog
        open
        onOpenChange={onOpenChange}
        watches={[makeWatch({ id: 'w-orig' })]}
      />,
    )
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Log wear' }))
    await waitFor(() => expect(mockMarkAsWorn).toHaveBeenCalledWith('w-orig'))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('Test 2 — when onWatchSelected is provided, Log wear emits to parent and does NOT call markAsWorn', async () => {
    const onWatchSelected = vi.fn()
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[makeWatch({ id: 'w-emit' })]}
        onWatchSelected={onWatchSelected}
      />,
    )
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Log wear' }))
    expect(onWatchSelected).toHaveBeenCalledWith('w-emit')
    expect(onWatchSelected).toHaveBeenCalledTimes(1)
    expect(mockMarkAsWorn).not.toHaveBeenCalled()
  })

  it('Test 3 — wornTodayIds renders matching row disabled + aria-disabled + "Worn today" label', () => {
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[
          makeWatch({ id: 'watch-a', brand: 'Rolex', model: 'Submariner' }),
          makeWatch({ id: 'watch-b', brand: 'Omega', model: 'Speedmaster' }),
        ]}
        wornTodayIds={new Set(['watch-a'])}
      />,
    )
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(2)
    // Find the watch-a row — should be disabled + aria-disabled=true
    const rowA = options.find((o) => o.textContent?.includes('Rolex'))!
    expect(rowA.getAttribute('aria-disabled')).toBe('true')
    expect(rowA.hasAttribute('disabled')).toBe(true)
    expect(rowA.className).toMatch(/opacity-50/)
    expect(rowA.textContent).toMatch(/Worn today/)
    // Row B should remain selectable
    const rowB = options.find((o) => o.textContent?.includes('Omega'))!
    expect(rowB.getAttribute('aria-disabled')).toBe('false')
    expect(rowB.hasAttribute('disabled')).toBe(false)
    // Clicking the disabled row does not set selection (Log wear stays disabled)
    fireEvent.click(rowA)
    expect(screen.getByRole('button', { name: 'Log wear' }).hasAttribute('disabled')).toBe(true)
  })
})

// ---- Task 2 — WywtPostDialog orchestrator ---------------------------------

// The WywtPostDialog orchestrator composes WatchPickerDialog + ComposeStep.
// For orchestrator-level assertions we override WatchPickerDialog + ComposeStep
// mocks per-suite via vi.doMock so the full component tree doesn't need real
// Dialog portals or Compose form rendering.

describe('WywtPostDialog — Task 2 orchestrator + preflight + state preservation', () => {
  beforeEach(() => {
    mockMarkAsWorn.mockReset()
    mockLogWearWithPhoto.mockReset()
    mockGetWornTodayIdsForUserAction.mockReset()
    vi.resetModules()
  })

  async function renderWithStubs(opts: {
    wornTodayIds?: string[]
    ownedWatches?: Watch[]
  } = {}) {
    mockGetWornTodayIdsForUserAction.mockResolvedValue(opts.wornTodayIds ?? [])
    // Stub WatchPickerDialog to expose props via test hooks.
    vi.doMock('@/components/home/WatchPickerDialog', () => ({
      WatchPickerDialog: (props: {
        open: boolean
        watches: Watch[]
        wornTodayIds?: ReadonlySet<string>
        onWatchSelected?: (id: string) => void
      }) => (
        <div
          data-testid="stubbed-picker"
          data-worn-today-size={props.wornTodayIds?.size ?? 'undefined'}
        >
          {props.watches.map((w) => (
            <button
              key={w.id}
              data-testid={`select-${w.id}`}
              onClick={() => props.onWatchSelected?.(w.id)}
            >
              {w.brand} {w.model}
            </button>
          ))}
        </div>
      ),
    }))
    // Stub ComposeStep to reflect received props via data-attributes.
    vi.doMock('@/components/wywt/ComposeStep', () => ({
      ComposeStep: (props: {
        watch: Watch
        viewerId: string
        wearEventId: string
        photoBlob: Blob | null
        note: string
        visibility: string
        onChange: () => void
        onSubmitted: () => void
      }) => (
        <div
          data-testid="stubbed-compose"
          data-watch-id={props.watch.id}
          data-wear-event-id={props.wearEventId}
          data-note={props.note}
          data-visibility={props.visibility}
          data-photo-present={props.photoBlob ? '1' : '0'}
        >
          <button data-testid="stub-change" onClick={props.onChange}>
            Change
          </button>
          <button data-testid="stub-submitted" onClick={props.onSubmitted}>
            Submitted
          </button>
        </div>
      ),
    }))
    const { WywtPostDialog } = await import('@/components/wywt/WywtPostDialog')
    const ownedWatches = opts.ownedWatches ?? [
      makeWatch({ id: 'watch-a', brand: 'Rolex', model: 'Submariner' }),
      makeWatch({ id: 'watch-b', brand: 'Omega', model: 'Speedmaster' }),
    ]
    return { WywtPostDialog, ownedWatches }
  }

  it('Test 4 (WYWT-01) — selecting a watch in Step 1 advances to Step 2', async () => {
    const { WywtPostDialog, ownedWatches } = await renderWithStubs()
    render(
      <WywtPostDialog
        open
        onOpenChange={() => {}}
        ownedWatches={ownedWatches}
        viewerId="u1"
      />,
    )
    // Step 1 picker is visible
    expect(screen.getByTestId('stubbed-picker')).toBeTruthy()
    // Select watch-a
    fireEvent.click(screen.getByTestId('select-watch-a'))
    // Step 2 compose appears with watch-a
    const compose = await screen.findByTestId('stubbed-compose')
    expect(compose.getAttribute('data-watch-id')).toBe('watch-a')
  })

  it('Test 5 (WYWT-02) — Change from Step 2 returns to picker; selection cleared', async () => {
    const { WywtPostDialog, ownedWatches } = await renderWithStubs()
    render(
      <WywtPostDialog
        open
        onOpenChange={() => {}}
        ownedWatches={ownedWatches}
        viewerId="u1"
      />,
    )
    fireEvent.click(screen.getByTestId('select-watch-a'))
    await screen.findByTestId('stubbed-compose')
    // Click Change → picker re-renders
    fireEvent.click(screen.getByTestId('stub-change'))
    expect(screen.getByTestId('stubbed-picker')).toBeTruthy()
    expect(screen.queryByTestId('stubbed-compose')).toBeNull()
  })

  it('Test 6 (preflight) — on open, getWornTodayIdsForUserAction is called and Set is passed to picker', async () => {
    const { WywtPostDialog, ownedWatches } = await renderWithStubs({
      wornTodayIds: ['watch-b', 'watch-a'],
    })
    render(
      <WywtPostDialog
        open
        onOpenChange={() => {}}
        ownedWatches={ownedWatches}
        viewerId="u1"
      />,
    )
    await waitFor(() =>
      expect(mockGetWornTodayIdsForUserAction).toHaveBeenCalled(),
    )
    await waitFor(() => {
      const picker = screen.getByTestId('stubbed-picker')
      expect(picker.getAttribute('data-worn-today-size')).toBe('2')
    })
    // Action received the right shape
    const [arg] = mockGetWornTodayIdsForUserAction.mock.calls[0]
    expect(arg).toMatchObject({ userId: 'u1' })
    expect(arg.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Test 7 (wearEventId stability) — stable across picker↔compose transitions within one open', async () => {
    const { WywtPostDialog, ownedWatches } = await renderWithStubs()
    render(
      <WywtPostDialog
        open
        onOpenChange={() => {}}
        ownedWatches={ownedWatches}
        viewerId="u1"
      />,
    )
    fireEvent.click(screen.getByTestId('select-watch-a'))
    const first = (await screen.findByTestId('stubbed-compose')).getAttribute('data-wear-event-id')
    expect(first).toBeTruthy()
    // Change → select again → wearEventId remains the same (same open session)
    fireEvent.click(screen.getByTestId('stub-change'))
    fireEvent.click(screen.getByTestId('select-watch-a'))
    const second = (await screen.findByTestId('stubbed-compose')).getAttribute('data-wear-event-id')
    expect(second).toBe(first)
  })

  it('Test 8 (close resets) — closing dialog resets state; wearEventId regenerates on next open', async () => {
    const { WywtPostDialog, ownedWatches } = await renderWithStubs()
    function Wrapper() {
      const [open, setOpen] = React.useState(true)
      return (
        <>
          <button data-testid="outer-close" onClick={() => setOpen(false)}>
            close
          </button>
          <button data-testid="outer-open" onClick={() => setOpen(true)}>
            open
          </button>
          <WywtPostDialog
            open={open}
            onOpenChange={setOpen}
            ownedWatches={ownedWatches}
            viewerId="u1"
          />
        </>
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByTestId('select-watch-a'))
    const first = (await screen.findByTestId('stubbed-compose')).getAttribute('data-wear-event-id')
    // Close, then re-open — should land on picker (step reset) and regenerate wearEventId
    fireEvent.click(screen.getByTestId('outer-close'))
    fireEvent.click(screen.getByTestId('outer-open'))
    // Pick watch again to read the new wearEventId
    fireEvent.click(screen.getByTestId('select-watch-a'))
    const second = (await screen.findByTestId('stubbed-compose')).getAttribute('data-wear-event-id')
    expect(second).not.toBe(first)
  })
})

// ---- Task 3 — VisibilitySegmentedControl ----------------------------------

import { VisibilitySegmentedControl } from '@/components/wywt/VisibilitySegmentedControl'

describe('VisibilitySegmentedControl — Task 3 three-button segmented + sub-label', () => {
  it('Test 9 — renders 3 buttons; default=public shows Public as aria-pressed', () => {
    render(<VisibilitySegmentedControl value="public" onChange={() => {}} />)
    const privateBtn = screen.getByRole('button', { name: /Private/i })
    const followersBtn = screen.getByRole('button', { name: /Followers/i })
    const publicBtn = screen.getByRole('button', { name: /Public/i })
    expect(privateBtn.getAttribute('aria-pressed')).toBe('false')
    expect(followersBtn.getAttribute('aria-pressed')).toBe('false')
    expect(publicBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('Test 10 — clicking Followers fires onChange("followers") and sub-label updates', () => {
    const onChange = vi.fn()
    function Ctl() {
      const [v, setV] = React.useState<'public' | 'followers' | 'private'>('public')
      return (
        <VisibilitySegmentedControl
          value={v}
          onChange={(next) => {
            setV(next)
            onChange(next)
          }}
        />
      )
    }
    render(<Ctl />)
    fireEvent.click(screen.getByRole('button', { name: /Followers/i }))
    expect(onChange).toHaveBeenCalledWith('followers')
    expect(screen.getByText(/Followers — people who follow you/)).toBeTruthy()
  })

  it('Test 11 — sub-label copy matches UI-SPEC for all three modes', () => {
    const { rerender } = render(
      <VisibilitySegmentedControl value="private" onChange={() => {}} />,
    )
    expect(screen.getByText('Only you')).toBeTruthy()
    rerender(<VisibilitySegmentedControl value="followers" onChange={() => {}} />)
    expect(screen.getByText('Followers — people who follow you')).toBeTruthy()
    rerender(<VisibilitySegmentedControl value="public" onChange={() => {}} />)
    expect(screen.getByText('Anyone on Horlo')).toBeTruthy()
  })
})

// ---- Task 3 — ComposeStep core flow + D-07 three-handler split ------------

import { ComposeStep } from '@/components/wywt/ComposeStep'

describe('ComposeStep — Task 3 core flow + photo submit order + toast', () => {
  beforeEach(() => {
    mockLogWearWithPhoto.mockReset()
    mockToastSuccess.mockReset()
    mockStripAndResize.mockReset()
    mockUploadWearPhoto.mockReset()
    mockOpenPicker.mockReset()
  })

  function renderCompose(overrides: Partial<{
    photoBlob: Blob | null
    note: string
    visibility: 'public' | 'followers' | 'private'
    onSubmitted: () => void
  }> = {}) {
    const onSubmitted = overrides.onSubmitted ?? vi.fn()
    // Controlled-from-the-outside: use a wrapper to mirror WywtPostDialog's owner.
    function Harness() {
      const [photoBlob, setPhotoBlob] = React.useState<Blob | null>(
        overrides.photoBlob ?? null,
      )
      const [note, setNote] = React.useState<string>(overrides.note ?? '')
      const [visibility, setVisibility] = React.useState<
        'public' | 'followers' | 'private'
      >(overrides.visibility ?? 'public')
      return (
        <ComposeStep
          watch={makeWatch({ id: 'watch-x', brand: 'Seiko', model: 'SKX007' })}
          viewerId="u1"
          wearEventId="11111111-1111-4111-8111-111111111111"
          photoBlob={photoBlob}
          setPhotoBlob={setPhotoBlob}
          note={note}
          setNote={setNote}
          visibility={visibility}
          setVisibility={setVisibility}
          onChange={() => {}}
          onSubmitted={onSubmitted}
        />
      )
    }
    render(<Harness />)
    return { onSubmitted }
  }

  it('Test 12 (WYWT-03) — submit with photoBlob=null calls logWearWithPhoto(hasPhoto:false)', async () => {
    mockLogWearWithPhoto.mockResolvedValue({ success: true, data: { wearEventId: 'w' } })
    renderCompose({ photoBlob: null })
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await waitFor(() => expect(mockLogWearWithPhoto).toHaveBeenCalled())
    const arg = mockLogWearWithPhoto.mock.calls[0][0]
    expect(arg.hasPhoto).toBe(false)
    expect(arg.watchId).toBe('watch-x')
  })

  it('Test 13 (WYWT-07) — note counter: 0/200 → 5/200 → destructive at 200; maxLength 200', () => {
    renderCompose()
    const textarea = screen.getByLabelText('Wear note') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(200)
    expect(screen.getByText('0/200')).toBeTruthy()
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(screen.getByText('5/200')).toBeTruthy()
    const big = 'a'.repeat(200)
    fireEvent.change(textarea, { target: { value: big } })
    const counter = screen.getByText('200/200')
    expect(counter.className).toMatch(/text-destructive/)
  })

  it('Test 14 (WYWT-08) — change visibility to followers; submit forwards value', async () => {
    mockLogWearWithPhoto.mockResolvedValue({ success: true, data: { wearEventId: 'w' } })
    renderCompose()
    fireEvent.click(screen.getByRole('button', { name: /Followers/i }))
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await waitFor(() => expect(mockLogWearWithPhoto).toHaveBeenCalled())
    expect(mockLogWearWithPhoto.mock.calls[0][0].visibility).toBe('followers')
  })

  it('Test 15 (WYWT-16) — success path fires toast.success("Wear logged") and onSubmitted', async () => {
    mockLogWearWithPhoto.mockResolvedValue({ success: true, data: { wearEventId: 'w' } })
    const { onSubmitted } = renderCompose()
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Wear logged'))
    expect(onSubmitted).toHaveBeenCalledTimes(1)
  })

  it('Test 16 (error surfacing) — action failure shows inline role="alert" and no toast', async () => {
    mockLogWearWithPhoto.mockResolvedValue({
      success: false,
      error: 'Already logged this watch today',
    })
    renderCompose()
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/Already logged this watch today/)
    })
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('Test 17 (photo submit order) — stripAndResize → uploadWearPhoto → logWearWithPhoto', async () => {
    mockStripAndResize.mockResolvedValue({
      blob: new Blob(['stripped'], { type: 'image/jpeg' }),
      width: 1080,
      height: 720,
    })
    mockUploadWearPhoto.mockResolvedValue({ path: 'u1/11111111-1111-4111-8111-111111111111.jpg' })
    mockLogWearWithPhoto.mockResolvedValue({ success: true, data: { wearEventId: 'w' } })

    const rawBlob = new Blob(['raw'], { type: 'image/jpeg' })
    renderCompose({ photoBlob: rawBlob })
    fireEvent.click(screen.getByRole('button', { name: /Log wear/i }))

    await waitFor(() => expect(mockLogWearWithPhoto).toHaveBeenCalled())

    // Call order matches the plan's Step 3 happy-path contract.
    const stripOrder = mockStripAndResize.mock.invocationCallOrder[0]
    const uploadOrder = mockUploadWearPhoto.mock.invocationCallOrder[0]
    const logOrder = mockLogWearWithPhoto.mock.invocationCallOrder[0]
    expect(stripOrder).toBeLessThan(uploadOrder)
    expect(uploadOrder).toBeLessThan(logOrder)

    // logWearWithPhoto hasPhoto=true path
    expect(mockLogWearWithPhoto.mock.calls[0][0].hasPhoto).toBe(true)
    // uploadWearPhoto called with (userId, wearEventId, strippedBlob)
    const [uid, weid] = mockUploadWearPhoto.mock.calls[0]
    expect(uid).toBe('u1')
    expect(weid).toBe('11111111-1111-4111-8111-111111111111')
  })
})

// ---- Task 3 — D-07 three-handler distinction ------------------------------

describe('ComposeStep — D-07 three distinct handlers (X / Retake / Choose another)', () => {
  // Typed as the vi.fn returned by the mock constructor; assignment is done in
  // beforeEach so each test gets a fresh mock + fresh implementation queue.
  let gumMock: ReturnType<typeof vi.fn> = vi.fn()

  beforeEach(() => {
    mockLogWearWithPhoto.mockReset()
    mockStripAndResize.mockReset()
    mockUploadWearPhoto.mockReset()
    mockToastSuccess.mockReset()
    mockOpenPicker.mockReset()
    // Install mock getUserMedia. Using a plain vi.fn (not vi.spyOn) avoids the
    // MediaStreamConstraints generic-mismatch under strict tsc.
    gumMock = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: gumMock },
      configurable: true,
    })
  })

  function renderHarness() {
    function Harness() {
      const [photoBlob, setPhotoBlob] = React.useState<Blob | null>(null)
      const [note, setNote] = React.useState('')
      const [visibility, setVisibility] = React.useState<
        'public' | 'followers' | 'private'
      >('public')
      return (
        <ComposeStep
          watch={makeWatch({ id: 'watch-x', brand: 'Seiko', model: 'SKX007' })}
          viewerId="u1"
          wearEventId="11111111-1111-4111-8111-111111111111"
          photoBlob={photoBlob}
          setPhotoBlob={setPhotoBlob}
          note={note}
          setNote={setNote}
          visibility={visibility}
          setVisibility={setVisibility}
          onChange={() => {}}
          onSubmitted={() => {}}
        />
      )
    }
    render(<Harness />)
  }

  it('Test 18 (X button removes entirely) — from either source, returns to pre-capture chooser', async () => {
    // Seed with an upload-sourced photo
    renderHarness()
    fireEvent.click(screen.getByTestId('simulate-upload'))
    // Photo preview appears; Choose another link visible for upload source
    await waitFor(() => expect(screen.getByLabelText('Remove photo')).toBeTruthy())
    expect(screen.getByRole('button', { name: /Choose another/i })).toBeTruthy()
    // Click X — pre-capture chooser re-renders (Take wrist shot + Upload photo both visible)
    fireEvent.click(screen.getByLabelText('Remove photo'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Take wrist shot/i })).toBeTruthy(),
    )
    expect(screen.getByTestId('simulate-upload')).toBeTruthy()
    // Preview gone
    expect(screen.queryByLabelText('Remove photo')).toBeNull()

    // Now seed with camera-sourced photo — tap camera → capture → X should also return to chooser.
    gumMock.mockResolvedValueOnce(makeStream('s-cam1'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Take wrist shot/i }))
    })
    await waitFor(() => expect(screen.getByTestId('camera-capture-view')).toBeTruthy())
    fireEvent.click(screen.getByTestId('simulate-capture'))
    await waitFor(() => expect(screen.getByLabelText('Remove photo')).toBeTruthy())
    // Retake (camera path) — assert first, then remove via X
    expect(screen.getByRole('button', { name: /Retake/i })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Remove photo'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Take wrist shot/i })).toBeTruthy(),
    )
  })

  it('Test 19 (Retake re-opens live camera) — getUserMedia invoked again, photoSource stays camera', async () => {
    renderHarness()
    const stream1 = makeStream('s-cam-initial')
    const stream2 = makeStream('s-cam-retake')
    gumMock
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2)

    // Initial Take wrist shot
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Take wrist shot/i }))
    })
    await waitFor(() => expect(screen.getByTestId('camera-capture-view')).toBeTruthy())
    const cam1 = screen.getByTestId('camera-capture-view')
    expect(cam1.getAttribute('data-stream-id')).toBe('s-cam-initial')
    // Capture photo → preview shows with Retake link (camera source)
    fireEvent.click(screen.getByTestId('simulate-capture'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Retake/i })).toBeTruthy())
    // Click Retake — should re-invoke getUserMedia
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retake/i }))
    })
    await waitFor(() => expect(gumMock).toHaveBeenCalledTimes(2))
    // Camera view re-opens with stream2 (not the chooser)
    await waitFor(() =>
      expect(screen.getByTestId('camera-capture-view').getAttribute('data-stream-id')).toBe('s-cam-retake'),
    )
    // Pre-capture chooser is NOT shown (no "Take wrist shot" button while live camera is up)
    expect(screen.queryByRole('button', { name: /Take wrist shot/i })).toBeNull()
  })

  it('Test 20 (Choose another re-opens file picker via PhotoUploader ref)', async () => {
    renderHarness()
    // Upload a photo first
    fireEvent.click(screen.getByTestId('simulate-upload'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Choose another/i })).toBeTruthy(),
    )
    expect(mockOpenPicker).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Choose another/i }))
    expect(mockOpenPicker).toHaveBeenCalledTimes(1)
    // Pre-capture chooser is NOT re-rendered — user should see photo-removed state
    // with the upload path still hot (simulate-upload remains present because
    // PhotoUploader mock is always rendered; the chooser's "Take wrist shot"
    // re-renders because we cleared photoBlob, which is D-07's documented
    // "returns to chooser visually"). Key assertion is openPicker was invoked.
  })
})
