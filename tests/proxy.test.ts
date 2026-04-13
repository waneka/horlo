import { describe, it } from 'vitest'

describe('proxy.ts — AUTH-02', () => {
  it.todo('redirects unauthenticated request on protected path to /login?next=<path>')
  it.todo('preserves search params in the next query')
  it.todo('allows unauthenticated request on /login')
  it.todo('allows unauthenticated request on /signup')
  it.todo('allows unauthenticated request on /forgot-password')
  it.todo('allows unauthenticated request on /reset-password')
  it.todo('allows unauthenticated request on /auth/callback')
  it.todo('lets authenticated request through with refreshed Set-Cookie headers')
})
