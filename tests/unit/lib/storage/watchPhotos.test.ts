// tests/unit/lib/storage/watchPhotos.test.ts
//
// Unit coverage of buildWatchPhotoPath happy + error paths + RLS folder
// contract. Mirrors tests/lib/storage-path.test.ts (wearPhotos analog).
//
// Path convention: `{userId}/{photoId}.jpg` — enforced by Phase 60
// Storage RLS (`(storage.foldername(name))[1] = auth.uid()::text`).
// Defense in depth: client convention here + DB-level RLS enforcement.

import { describe, it, expect } from 'vitest'
import { buildWatchPhotoPath } from '@/lib/storage/watchPhotos'

const VALID_UUID = '01234567-89ab-cdef-0123-456789abcdef'

describe('buildWatchPhotoPath', () => {
  it('returns `${userId}/${photoId}.jpg` for valid inputs', () => {
    expect(
      buildWatchPhotoPath('user-abc', VALID_UUID),
    ).toBe(`user-abc/${VALID_UUID}.jpg`)
  })

  it('accepts uppercase hex in the UUID', () => {
    const upper = VALID_UUID.toUpperCase()
    expect(buildWatchPhotoPath('u-1', upper)).toBe(`u-1/${upper}.jpg`)
  })

  it('throws when userId is empty string', () => {
    expect(() => buildWatchPhotoPath('', VALID_UUID)).toThrow(/userId/)
  })

  it('throws when photoId is not a UUID — too short', () => {
    expect(() => buildWatchPhotoPath('user-1', 'not-a-uuid')).toThrow(/UUID/)
  })

  it('throws when photoId contains non-hex characters', () => {
    const bogus = 'XXXX0000-0000-0000-0000-000000000000'
    expect(() => buildWatchPhotoPath('user-1', bogus)).toThrow(/UUID/)
  })

  it('throws when photoId is missing dashes (raw 32 chars)', () => {
    const noDashes = '0123456789abcdef0123456789abcdef'
    expect(() => buildWatchPhotoPath('user-1', noDashes)).toThrow(/UUID/)
  })

  it('produces a path whose first segment is exactly the userId (RLS contract)', () => {
    const p = buildWatchPhotoPath('user-xyz', VALID_UUID)
    const firstSeg = p.split('/')[0]
    // Phase 60 Storage RLS uses `(storage.foldername(name))[1]`, which is
    // the first path segment. The path's first segment MUST equal the
    // user's id for the upload to pass RLS.
    expect(firstSeg).toBe('user-xyz')
  })
})
