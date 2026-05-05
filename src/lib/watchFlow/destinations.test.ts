import { describe, it, expect } from 'vitest'
import {
  RETURN_TO_REGEX,
  validateReturnTo,
  defaultDestinationForStatus,
  canonicalize,
} from './destinations'

describe('RETURN_TO_REGEX (Phase 28 D-11 — auth-callback parity)', () => {
  it('matches the auth-callback regex source verbatim (literal fixture)', () => {
    // VERBATIM from src/app/auth/callback/route.ts:60-61.
    // .source escapes the forward slashes and backslashes:
    //   regex literal /^\/(?!\/)[^\\\r\n\t]*$/
    //   .source       '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'
    // If the regex is ever altered, this assertion fails — making the
    // auth-callback parity contract a code-level invariant rather than an
    // escape-fragile cross-file grep.
    expect(RETURN_TO_REGEX.source).toBe('^\\/(?!\\/)[^\\\\\\r\\n\\t]*$')
  })
})

describe('validateReturnTo (Phase 28 D-11 — open-redirect-safe whitelist)', () => {
  it('accepts a valid same-origin path', () => {
    expect(validateReturnTo('/search?q=tudor')).toBe('/search?q=tudor')
    expect(validateReturnTo('/u/twwaneka/collection')).toBe('/u/twwaneka/collection')
    expect(validateReturnTo('/')).toBe('/')
  })

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(validateReturnTo('//evil.com')).toBeNull()
    expect(validateReturnTo('//evil.com/path')).toBeNull()
  })

  it('rejects backslash and control chars (header-injection vectors)', () => {
    expect(validateReturnTo('/path\\evil')).toBeNull()
    expect(validateReturnTo('/path\rHeader')).toBeNull()
    expect(validateReturnTo('/path\nHeader')).toBeNull()
    expect(validateReturnTo('/path\tHeader')).toBeNull()
  })

  it('rejects self-loop (?returnTo=/watch/new...)', () => {
    expect(validateReturnTo('/watch/new')).toBeNull()
    expect(validateReturnTo('/watch/new?returnTo=/foo')).toBeNull()
    expect(validateReturnTo('/watch/new/manual')).toBeNull()
  })

  it('rejects non-string values', () => {
    expect(validateReturnTo(undefined)).toBeNull()
    expect(validateReturnTo(null)).toBeNull()
    expect(validateReturnTo(42)).toBeNull()
    expect(validateReturnTo([])).toBeNull()
  })

  it('rejects empty string and bare-non-slash strings', () => {
    expect(validateReturnTo('')).toBeNull()
    expect(validateReturnTo('search')).toBeNull() // no leading slash
    expect(validateReturnTo('http://evil.com')).toBeNull() // h is not /
  })
})

describe('defaultDestinationForStatus (Phase 28 D-02/D-13)', () => {
  it('routes wishlist / grail to /u/{username}/wishlist', () => {
    expect(defaultDestinationForStatus('wishlist', 'twwaneka')).toBe('/u/twwaneka/wishlist')
    expect(defaultDestinationForStatus('grail', 'twwaneka')).toBe('/u/twwaneka/wishlist')
  })

  it('routes owned / sold to /u/{username}/collection', () => {
    expect(defaultDestinationForStatus('owned', 'twwaneka')).toBe('/u/twwaneka/collection')
    expect(defaultDestinationForStatus('sold', 'twwaneka')).toBe('/u/twwaneka/collection')
  })

  it('returns / as soft fallback when username is null', () => {
    expect(defaultDestinationForStatus('wishlist', null)).toBe('/')
    expect(defaultDestinationForStatus('owned', null)).toBe('/')
  })
})

describe('canonicalize (Phase 28 D-05/D-06 path canonicalization)', () => {
  it('resolves /u/me/ shorthand to actual username', () => {
    expect(canonicalize('/u/me/wishlist', 'twwaneka')).toBe('/u/twwaneka/wishlist')
    expect(canonicalize('/u/me/collection', 'twwaneka')).toBe('/u/twwaneka/collection')
  })

  it('strips query string', () => {
    expect(canonicalize('/u/me/wishlist?filter=role', 'twwaneka')).toBe('/u/twwaneka/wishlist')
    expect(canonicalize('/search?q=tudor', 'twwaneka')).toBe('/search')
  })

  it('strips trailing slash when path length > 1', () => {
    expect(canonicalize('/u/twwaneka/wishlist/', 'twwaneka')).toBe('/u/twwaneka/wishlist')
    expect(canonicalize('/', 'twwaneka')).toBe('/') // length 1 — preserved
  })

  it('returns path unchanged when viewerUsername is null', () => {
    expect(canonicalize('/u/me/wishlist', null)).toBe('/u/me/wishlist')
    expect(canonicalize('/search?q=tudor', null)).toBe('/search?q=tudor')
  })

  it('does NOT alter paths that do not start with /u/me/', () => {
    expect(canonicalize('/u/other/wishlist', 'twwaneka')).toBe('/u/other/wishlist')
    expect(canonicalize('/explore', 'twwaneka')).toBe('/explore')
  })
})
