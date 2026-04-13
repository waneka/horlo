import { vi } from 'vitest'

/**
 * Shared helper to mock createSupabaseServerClient for unit tests.
 * Later plans import and extend this. Wave 0 just provides the module.
 */
export function mockSupabaseServerClient(
  overrides: {
    user?: { id: string; email: string } | null
    error?: Error | null
  } = {},
) {
  const { user = null, error = null } = overrides
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    },
  }
}
