// tests/lib/signCoverUrls.test.ts
//
// Unit coverage for signCoverUrls batch helper.
// Tests: raw→signed, https-untouched, null-passthrough, batch de-dupe, signing-failure→null.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @/lib/supabase/server before any imports ────────────────────────────
// vi.hoisted required — factory runs before top-level module initialization.
const { mockCreateSignedUrl } = vi.hoisted(() => {
  const mockCreateSignedUrl = vi.fn()
  return { mockCreateSignedUrl }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}))

// ── Import under test (after mock is registered) ──────────────────────────────
import { signCoverUrls } from '@/lib/storage/signCoverUrls'

// ── Helpers ───────────────────────────────────────────────────────────────────
function watch(imageUrl: string | null | undefined) {
  return { id: 'w-' + Math.random().toString(36).slice(2), imageUrl }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── (a) raw storage path → signed https url ───────────────────────────────────
describe('signCoverUrls — raw path → signed url', () => {
  it('replaces a raw storage path with the signed url', async () => {
    const rawPath = 'user-abc/photo-123.jpg'
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: `https://signed/${rawPath}` },
    })

    const result = await signCoverUrls([watch(rawPath)])
    expect(result[0].imageUrl).toBe(`https://signed/${rawPath}`)
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(rawPath, 3600)
  })
})

// ── (b) https catalog url → passes through untouched, NOT signed ──────────────
describe('signCoverUrls — https url passes through', () => {
  it('returns https url unchanged and does not call createSignedUrl', async () => {
    const catalogUrl = 'https://cdn.example.com/watches/rolex.jpg'

    const result = await signCoverUrls([watch(catalogUrl)])
    expect(result[0].imageUrl).toBe(catalogUrl)
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })
})

// ── (c) null/undefined imageUrl → passes through ─────────────────────────────
describe('signCoverUrls — null/undefined passthrough', () => {
  it('returns null imageUrl unchanged', async () => {
    const result = await signCoverUrls([watch(null)])
    expect(result[0].imageUrl).toBeNull()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('returns undefined imageUrl unchanged', async () => {
    const result = await signCoverUrls([watch(undefined)])
    expect(result[0].imageUrl).toBeUndefined()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })
})

// ── (d) batch of mixed watches — signs only raw ones, de-dupes identical paths ─
describe('signCoverUrls — batch de-dupe', () => {
  it('signs raw paths, passes https and null through, and de-dupes identical raw paths', async () => {
    const rawPath = 'user-xyz/photo-1.jpg'
    const catalogUrl = 'https://cdn.example.com/pic.jpg'

    // Two watches share the same raw path — only one createSignedUrl call expected.
    const watches = [
      watch(rawPath),
      watch(catalogUrl),
      watch(null),
      watch(rawPath), // same path as first — must be de-duped
    ]

    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: `https://signed/${rawPath}` },
    })

    const result = await signCoverUrls(watches)

    // Both raw-path watches get the signed url
    expect(result[0].imageUrl).toBe(`https://signed/${rawPath}`)
    expect(result[3].imageUrl).toBe(`https://signed/${rawPath}`)
    // https url unchanged
    expect(result[1].imageUrl).toBe(catalogUrl)
    // null unchanged
    expect(result[2].imageUrl).toBeNull()

    // De-dupe: createSignedUrl called ONCE for the single distinct raw path
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(rawPath, 3600)
  })
})

// ── (e) signing failure → imageUrl null, no thrown error ─────────────────────
describe('signCoverUrls — signing failure → null', () => {
  it('yields null imageUrl when createSignedUrl returns { data: null }', async () => {
    const rawPath = 'user-abc/missing.jpg'
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null })

    const result = await signCoverUrls([watch(rawPath)])
    expect(result[0].imageUrl).toBeNull()
    // Must not throw
  })
})

// ── Immutability: input array must not be mutated ─────────────────────────────
describe('signCoverUrls — does not mutate input', () => {
  it('returns a new array without mutating the input watches', async () => {
    const rawPath = 'user-abc/photo.jpg'
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed/path' },
    })
    const input = [watch(rawPath)]
    const originalUrl = input[0].imageUrl

    const result = await signCoverUrls(input)
    // Input object unchanged
    expect(input[0].imageUrl).toBe(originalUrl)
    // Result is a different array
    expect(result).not.toBe(input)
    // Result item is a different object
    expect(result[0]).not.toBe(input[0])
  })
})
