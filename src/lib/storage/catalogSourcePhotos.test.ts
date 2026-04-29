import { describe, it, expect } from 'vitest'
import { buildCatalogSourcePhotoPath } from '@/lib/storage/catalogSourcePhotos'

const VALID_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const VALID_CATALOG_ID = 'b1ffcd00-0d1c-4f99-cc7e-7cc0ce491b22'
const VALID_FILENAME = 'photo.jpg'

describe('buildCatalogSourcePhotoPath', () => {
  it('returns {userId}/pending/{filename} for pending middle', () => {
    const path = buildCatalogSourcePhotoPath(VALID_USER_ID, 'pending', VALID_FILENAME)
    expect(path).toBe(`${VALID_USER_ID}/pending/${VALID_FILENAME}`)
  })

  it('returns {userId}/{catalogId}/{filename} for UUID middle', () => {
    const path = buildCatalogSourcePhotoPath(VALID_USER_ID, VALID_CATALOG_ID, VALID_FILENAME)
    expect(path).toBe(`${VALID_USER_ID}/${VALID_CATALOG_ID}/${VALID_FILENAME}`)
  })

  it('throws TypeError for falsy userId', () => {
    expect(() => buildCatalogSourcePhotoPath('', 'pending', VALID_FILENAME)).toThrow(TypeError)
    expect(() => buildCatalogSourcePhotoPath('', 'pending', VALID_FILENAME)).toThrow('userId required')
  })

  it('throws TypeError for non-UUID and non-pending middle segment', () => {
    expect(() => buildCatalogSourcePhotoPath(VALID_USER_ID, 'not-a-uuid', VALID_FILENAME)).toThrow(TypeError)
    expect(() => buildCatalogSourcePhotoPath(VALID_USER_ID, 'not-a-uuid', VALID_FILENAME)).toThrow(
      "middle must be 'pending' or a UUID",
    )
  })

  it('throws TypeError for filename containing a slash', () => {
    expect(() =>
      buildCatalogSourcePhotoPath(VALID_USER_ID, 'pending', 'subdir/photo.jpg'),
    ).toThrow(TypeError)
    expect(() =>
      buildCatalogSourcePhotoPath(VALID_USER_ID, 'pending', 'subdir/photo.jpg'),
    ).toThrow('filename must be a basename, not a path')
  })
})
