// tests/lib/storage-path.test.ts
//
// Wave 0 — verifies the wear-photo Storage path convention. The
// `{userId}/{wearEventId}.jpg` convention is enforced at the DB level by
// Phase 11 Storage RLS (`(storage.foldername(name))[1] = auth.uid()`)
// AND at the client by buildWearPhotoPath. This test pins the client
// contract.

import { describe, it, expect } from 'vitest'
import { buildWearPhotoPath } from '@/lib/storage/wearPhotos'

const VALID_UUID = '01234567-89ab-cdef-0123-456789abcdef'

describe('buildWearPhotoPath', () => {
  it('returns `${userId}/${wearEventId}.jpg` for valid inputs', () => {
    expect(
      buildWearPhotoPath('user-abc', VALID_UUID),
    ).toBe(`user-abc/${VALID_UUID}.jpg`)
  })

  it('accepts uppercase hex in the UUID', () => {
    const upper = VALID_UUID.toUpperCase()
    expect(buildWearPhotoPath('u-1', upper)).toBe(`u-1/${upper}.jpg`)
  })

  it('throws when userId is empty string', () => {
    expect(() => buildWearPhotoPath('', VALID_UUID)).toThrow(/userId/)
  })

  it('throws when wearEventId is not a UUID — too short', () => {
    expect(() => buildWearPhotoPath('user-1', 'not-a-uuid')).toThrow(/UUID/)
  })

  it('throws when wearEventId contains non-hex characters', () => {
    const bogus = 'XXXX0000-0000-0000-0000-000000000000'
    expect(() => buildWearPhotoPath('user-1', bogus)).toThrow(/UUID/)
  })

  it('throws when wearEventId is missing dashes (raw 32 chars)', () => {
    const noDashes = '0123456789abcdef0123456789abcdef'
    expect(() => buildWearPhotoPath('user-1', noDashes)).toThrow(/UUID/)
  })

  it('produces a path whose first segment is exactly the userId (RLS contract)', () => {
    const p = buildWearPhotoPath('user-xyz', VALID_UUID)
    const firstSeg = p.split('/')[0]
    // Phase 11 Storage RLS uses `(storage.foldername(name))[1]`, which is
    // the first path segment. The path's first segment MUST equal the
    // user's id for the upload to pass RLS.
    expect(firstSeg).toBe('user-xyz')
  })
})
