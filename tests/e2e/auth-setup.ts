import { test as setup, expect } from '@playwright/test'

// Phase 52-02 — Playwright auth setup (D-52-06).
//
// Signs in a SEEDED LOCAL user once and persists the session to
// storageState.json (gitignored). All e2e tests reuse it via the
// chromium project's `dependencies: ['setup']` chain.
//
// Credentials come from .env.local (loaded by playwright.config.ts):
//   TEST_USER_EMAIL / TEST_USER_PASSWORD  — twwaneka+1 (profile twwaneka_1)
//   TEST_USER_PROFILE                     — the username to navigate
// The password was set on the local twwaneka+1 account via the Supabase
// admin API (sb_secret key from `supabase status`) during Plan 52-02
// setup. NEVER hard-code credentials here — read from process.env.
//
// The login form (src/app/login/login-form.tsx) uses
// supabase.auth.signInWithPassword and `#email` / `#password` inputs +
// a submit button, then `router.push(next)`.

const STORAGE_STATE = 'tests/e2e/storageState.json'

setup('authenticate as seeded local user', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Set TEST_USER_EMAIL + TEST_USER_PASSWORD in .env.local for Phase 52 e2e tests ' +
        '(see tests/e2e/auth-setup.ts header / Plan 52-02 SUMMARY).',
    )
  }

  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // The form calls router.push(next) on success; wait until we leave /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  })

  // Persist + sanity-check in one call: storageState({ path }) writes to disk
  // AND returns the state, so the cookie round-trip is verified without a
  // second call.
  const state = await page.context().storageState({ path: STORAGE_STATE })
  expect(state.cookies.length).toBeGreaterThan(0)
})
