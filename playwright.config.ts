import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Phase 52-02 — Playwright e2e config (D-52-05, D-52-07).
//
// Target: local `npm run dev` server (D-52-07 — fastest CI feedback). The
// acknowledged limitation is that local dev does NOT reproduce the
// Vercel-edge prefetch/cache behavior that produced the recurrence-5
// prod-only bug (#419 + intermittent 404). This suite is therefore a
// PARTIAL regression guard: it catches chrome-unmounting, hard 404s,
// console React errors, and structural nav regressions locally. The
// higher-fidelity guard (a Vercel preview-deploy target) is deferred to a
// separate infra phase per D-52-07 and SEED-014.
//
// Auth: a single setup project signs in a seeded local user
// (TEST_USER_EMAIL / TEST_USER_PASSWORD from .env.local — gitignored) and
// saves storageState; the chromium project reuses it via `dependencies`.
loadEnv({ path: '.env.local' })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  // Local `next dev` compiles the route on first hit (Turbopack cold start),
  // and the nav test does ~14 navigations — give it room beyond the 30s default.
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/e2e/storageState.json',
  },
  projects: [
    { name: 'setup', testMatch: /auth-setup\.ts/, use: { storageState: { cookies: [], origins: [] } } },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
