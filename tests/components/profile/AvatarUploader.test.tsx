// tests/components/profile/AvatarUploader.test.tsx
//
// Phase 43 PLSH-06 — AvatarUploader component tests.
//
// Behaviors:
//   1. File > 8 MB → shows inline error "Photo too large. Maximum size is 8 MB."
//      and does NOT show the crop UI.
//   2. Valid image → shows crop UI (Cropper) with "Confirm crop" and "Discard crop" buttons.
//   3. Confirm crop → calls stripAndResize, uploadAvatarPhoto, updateProfile,
//      then shows "Profile photo updated" toast.
//   4. Upload failure (uploadAvatarPhoto returns { error }) → shows inline error
//      "Upload failed. Please try again." and does NOT call updateProfile.
//
// We mock @/lib/storage/avatarPhotos, @/app/actions/profile, @/lib/exif/strip,
// react-easy-crop, and sonner.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---- Module mocks ----

// Mock react-easy-crop — renders a simple div so we can verify it's shown.
vi.mock('react-easy-crop', () => ({
  default: vi.fn(({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) => {
    // Immediately invoke onCropComplete with mock pixel area so croppedAreaPixels is set.
    onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 })
    return <div data-testid="cropper" />
  }),
}))

// Mock uploadAvatarPhoto
const mockUploadAvatarPhoto = vi.fn()
vi.mock('@/lib/storage/avatarPhotos', () => ({
  uploadAvatarPhoto: (...args: unknown[]) => mockUploadAvatarPhoto(...args),
  buildAvatarPath: (userId: string) => `${userId}/avatar.jpg`,
}))

// Mock updateProfile
const mockUpdateProfile = vi.fn()
vi.mock('@/app/actions/profile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}))

// Mock stripAndResize — returns a mock blob
const mockStripAndResize = vi.fn()
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: (...args: unknown[]) => mockStripAndResize(...args),
}))

// Mock sonner toast
const mockToastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}))

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
const createObjectURLMock = vi.fn(() => 'blob:mock-url')
const revokeObjectURLMock = vi.fn()
globalThis.URL.createObjectURL = createObjectURLMock
globalThis.URL.revokeObjectURL = revokeObjectURLMock

// Mock HTMLCanvasElement.toBlob (jsdom doesn't implement it)
HTMLCanvasElement.prototype.toBlob = function (
  callback: BlobCallback,
  _type?: string,
  _quality?: number,
) {
  const blob = new Blob(['mock-canvas'], { type: 'image/jpeg' })
  callback(blob)
}

// Mock Image — instantly fires onload
class MockImage {
  src = ''
  onload: (() => void) | null = null
  set srcValue(v: string) {
    this.src = v
    queueMicrotask(() => this.onload?.())
  }
}
Object.defineProperty(globalThis, 'Image', {
  writable: true,
  configurable: true,
  value: class extends MockImage {
    set src(v: string) {
      this.srcValue = v
    }
    get src() {
      return (this as MockImage).src
    }
  },
})

import { AvatarUploader } from '@/components/profile/AvatarUploader'

// Helper: create a File of a given size
function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('AvatarUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createObjectURLMock.mockReturnValue('blob:mock-url')
    mockStripAndResize.mockResolvedValue({ blob: new Blob(['stripped'], { type: 'image/jpeg' }) })
    mockUploadAvatarPhoto.mockResolvedValue({ publicUrl: 'https://example.com/avatar.jpg' })
    mockUpdateProfile.mockResolvedValue({ success: true })
  })

  it('Test 1: file > 8 MB shows inline error and does NOT show crop UI', async () => {
    render(<AvatarUploader userId="user-123" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const oversize = makeFile('big.jpg', 9 * 1024 * 1024)
    fireEvent.change(input, { target: { files: [oversize] } })

    await waitFor(() =>
      expect(screen.getByText('Photo too large. Maximum size is 8 MB.')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument()
  })

  it('Test 2: valid image shows crop UI with Confirm crop and Discard crop buttons', async () => {
    render(<AvatarUploader userId="user-123" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('photo.jpg', 1024)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('cropper')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Confirm crop/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Discard crop/i })).toBeInTheDocument()
  })

  it('Test 3: confirming crop calls stripAndResize then uploadAvatarPhoto then updateProfile and shows toast', async () => {
    render(<AvatarUploader userId="user-123" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('photo.jpg', 1024)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('cropper')).toBeInTheDocument())

    const confirmBtn = screen.getByRole('button', { name: /Confirm crop/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(mockStripAndResize).toHaveBeenCalledWith(expect.any(Blob), 512))
    await waitFor(() => expect(mockUploadAvatarPhoto).toHaveBeenCalledWith('user-123', expect.any(Blob)))
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
    )
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Profile photo updated'))
  })

  it('Test 4: upload failure shows inline error and does NOT call updateProfile', async () => {
    mockUploadAvatarPhoto.mockResolvedValue({ error: 'Storage error' })

    render(<AvatarUploader userId="user-123" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('photo.jpg', 1024)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('cropper')).toBeInTheDocument())

    const confirmBtn = screen.getByRole('button', { name: /Confirm crop/i })
    fireEvent.click(confirmBtn)

    await waitFor(() =>
      expect(screen.getByText('Upload failed. Please try again.')).toBeInTheDocument(),
    )
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })
})
