import { test, expect, type ConsoleMessage } from '@playwright/test'

// Phase 52-02 — profile tab-navigation regression test (REQ-52-06).
//
// This is the recurrence-5 guard, RESHAPED from the original Plan 52-02
// `instant()` design. The route now exports `unstable_instant = false`
// (recurrence-5 fix — debug session profile-404-419-recurrence-5), so it
// is no longer an instant-navigation route and the `@next/playwright`
// `instant()` helper no longer applies. Instead we assert the bug class
// directly: signed-in navigation across every profile tab must NOT 404,
// must NOT throw React #419, and the persistent chrome (heading + tablist)
// must stay mounted across tab swaps.
//
// FIDELITY CAVEAT (D-52-07): this runs against local `npm run dev`, which
// does not reproduce the Vercel-edge prefetch/cache behavior that produced
// the prod-only recurrence-5. So a PASS here does not prove prod is clean —
// it guards structural / chrome-mount / console-error regressions. The
// prod-fidelity guard (Vercel preview-deploy target) is deferred per
// D-52-07 + SEED-014.
//
// Auth: inherits storageState from the `setup` project (twwaneka+1 / profile
// twwaneka_1). As the profile OWNER, every tab renders (no privacy-gate
// 404s), so any 404 here is the bug, not a permission gate.

const PROFILE = process.env.TEST_USER_PROFILE || 'twwaneka_1'

// Owner-visible tabs that render deterministically. `common-ground` is
// intentionally excluded — it legitimately notFound()s for a self-view
// (no viewer/owner overlap), which is correct behavior, not the bug.
const TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats', 'insights'] as const

const REACT_419 = /Minified React error #419|error #419|could not finish this Suspense boundary/i

test('profile chrome survives tab navigation — no 404, no React #419 (REQ-52-06)', async ({
  page,
}) => {
  // Capture any React #419 (or other page errors) surfaced during the run.
  const reactErrors: string[] = []
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && REACT_419.test(msg.text())) reactErrors.push(msg.text())
  }
  page.on('console', onConsole)
  page.on('pageerror', (err) => {
    if (REACT_419.test(err.message)) reactErrors.push(err.message)
  })

  // Initial load — must render the chrome, not 404. Assert the h1 by role
  // only (ProfileHeader renders `displayName ?? @username`, so matching the
  // username text is fragile if the test user ever gets a display name).
  const firstResp = await page.goto(`/u/${PROFILE}/collection`)
  expect(firstResp?.status(), 'initial /collection load must not be 404').toBeLessThan(400)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist')).toBeVisible()

  // Navigate every tab via its tab-strip trigger (data-tab-id is unambiguous;
  // the bare href collides with the avatar link). Chrome must stay mounted.
  for (const tab of TABS) {
    await page.locator(`[data-tab-id="${tab}"]`).click()
    await page.waitForURL(`**/u/${PROFILE}/${tab}`, { timeout: 15_000 })
    // Persistent-chrome invariant: heading + tablist remain visible across nav.
    await expect(
      page.getByRole('heading', { level: 1 }),
      `profile heading (h1) must stay mounted on /${tab}`,
    ).toBeVisible()
    await expect(
      page.getByRole('tablist'),
      `tablist must stay mounted on /${tab}`,
    ).toBeVisible()
  }

  // Intermittency probe: the prod bug failed ~20% of the time, so bounce
  // between collection and wishlist several times to shake out flaky 404s.
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-tab-id="collection"]').click()
    await page.waitForURL(`**/u/${PROFILE}/collection`, { timeout: 15_000 })
    await expect(page.getByRole('tablist')).toBeVisible()
    await page.locator('[data-tab-id="wishlist"]').click()
    await page.waitForURL(`**/u/${PROFILE}/wishlist`, { timeout: 15_000 })
    await expect(page.getByRole('tablist')).toBeVisible()
  }

  page.off('console', onConsole)
  expect(reactErrors, `React #419 surfaced during navigation:\n${reactErrors.join('\n')}`).toEqual(
    [],
  )
})
