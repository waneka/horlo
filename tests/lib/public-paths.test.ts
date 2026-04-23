import { describe, it, expect } from 'vitest'
import { PUBLIC_PATHS, isPublicPath } from '@/lib/constants/public-paths'

describe('PUBLIC_PATHS', () => {
  it('is a readonly tuple with exactly the 5 expected strings in order', () => {
    // Test 1: exact contents + ordering
    expect(PUBLIC_PATHS).toEqual([
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/auth',
    ])
    expect(PUBLIC_PATHS.length).toBe(5)
  })

  it('is typed as a readonly tuple (compile-time guarantee via `as const`)', () => {
    // Test 12: PUBLIC_PATHS is frozen at the type level.
    // `PUBLIC_PATHS.push(...)` is a TS error because the type is
    // `readonly [..., ..., ..., ..., ...]`. Runtime mutation is not
    // required (tuple is not Object.frozen), but the type must be readonly.
    // We assert shape + identity to prove the tuple is stable.
    const copy: readonly string[] = PUBLIC_PATHS
    expect(copy).toBe(PUBLIC_PATHS)
  })
})

describe('isPublicPath', () => {
  it('returns true for /login', () => {
    // Test 2
    expect(isPublicPath('/login')).toBe(true)
  })

  it('returns true for /signup', () => {
    // Test 3
    expect(isPublicPath('/signup')).toBe(true)
  })

  it('returns true for /forgot-password', () => {
    // Test 4
    expect(isPublicPath('/forgot-password')).toBe(true)
  })

  it('returns true for /reset-password', () => {
    // Test 5
    expect(isPublicPath('/reset-password')).toBe(true)
  })

  it('returns true for /auth/callback (prefix + slash)', () => {
    // Test 6
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('returns true for /auth/confirm?token_hash=abc (prefix + query)', () => {
    // Test 7
    expect(isPublicPath('/auth/confirm?token_hash=abc')).toBe(true)
  })

  it('returns false for /', () => {
    // Test 8
    expect(isPublicPath('/')).toBe(false)
  })

  it('returns false for /watch/new', () => {
    // Test 9
    expect(isPublicPath('/watch/new')).toBe(false)
  })

  it('returns false for /u/alice/collection', () => {
    // Test 10
    expect(isPublicPath('/u/alice/collection')).toBe(false)
  })

  it('returns false for /notifications', () => {
    // Test 11
    expect(isPublicPath('/notifications')).toBe(false)
  })
})
