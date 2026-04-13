import { describe, it } from 'vitest'

describe('POST /api/extract-watch auth gate — AUTH-04', () => {
  it.todo('returns 401 { error: "Unauthorized" } when session is missing')
  it.todo('returns 401 before running SSRF validation (auth check runs first)')
  it.todo('proceeds to SSRF check when session is present')
})
