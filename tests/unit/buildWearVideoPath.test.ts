import { describe, it, expect } from 'vitest'
import {
  buildWearVideoPath,
  buildWearPosterPath,
} from '@/lib/storage/wearPhotos'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('buildWearVideoPath (VID-07 / VID-16 client-side helper)', () => {
  it('returns ${userId}/${wearEventId}.mp4 for valid inputs', () => {
    expect(buildWearVideoPath(USER_ID, VALID_UUID)).toBe(
      `${USER_ID}/${VALID_UUID}.mp4`,
    )
  })

  it('throws TypeError on empty userId', () => {
    expect(() => buildWearVideoPath('', VALID_UUID)).toThrow(
      new TypeError('userId required'),
    )
  })

  it('throws TypeError on non-UUID wearEventId', () => {
    expect(() => buildWearVideoPath(USER_ID, 'not-a-uuid')).toThrow(
      new TypeError('wearEventId must be a UUID'),
    )
  })
})

describe('buildWearPosterPath (VID-07 / VID-16 client-side helper)', () => {
  it('returns ${userId}/${wearEventId}-poster.jpg for valid inputs', () => {
    expect(buildWearPosterPath(USER_ID, VALID_UUID)).toBe(
      `${USER_ID}/${VALID_UUID}-poster.jpg`,
    )
  })

  it('throws TypeError on empty userId', () => {
    expect(() => buildWearPosterPath('', VALID_UUID)).toThrow(
      new TypeError('userId required'),
    )
  })

  it('throws TypeError on non-UUID wearEventId', () => {
    expect(() => buildWearPosterPath(USER_ID, 'not-a-uuid')).toThrow(
      new TypeError('wearEventId must be a UUID'),
    )
  })
})
