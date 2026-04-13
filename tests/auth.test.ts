import { describe, it } from 'vitest'

describe('getCurrentUser (src/lib/auth.ts) — AUTH-01, AUTH-02', () => {
  it.todo('returns { id, email } when supabase.auth.getUser returns a user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns null user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns an error')
  it.todo('UnauthorizedError is instanceof Error and has name "UnauthorizedError"')
})
