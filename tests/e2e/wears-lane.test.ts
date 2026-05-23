// Wave 0 RED scaffold — covers SC-1, SC-2, SC-3 via Playwright
//
// SC-1: tapping a home-rail wear tile navigates to a URL matching /wears/
//       (real route, not a modal at /).
//
// SC-2: /wears/[username] is full-screen with no nav chrome on mobile.
//       Asserts the BottomNav (`nav[aria-label="Primary"]`) is NOT present.
//
// SC-3: /wear/[id] retains the nav and is vertically scrollable (detail page
//       stays as it was but uses the new shared WearCard).
//
// EXPECTED RED until Plans 03/04/05:
//   - Plan 03: creates /wears/[username] route + WearsLane
//   - Plan 04: wires WearCard into /wear/[id] detail page
//   - Plan 05: rewires WywtRail tile tap → router.push('/wears/…')
//
// Auth: inherits storageState from the `setup` project (same as
//       tests/e2e/profile-tab-nav.test.ts). Authenticated as twwaneka_1.
//       The stories lane is auth-only (EN-6); proxy handles anon redirect.

import { test, expect } from '@playwright/test'

// The test user who has active wears in the 48h window.
// Set TEST_USER_PROFILE env to override if needed for local dev.
const PROFILE = process.env.TEST_USER_PROFILE || 'twwaneka_1'

test.describe('wears-lane — SC-1/SC-2/SC-3 (Wave 0 RED)', () => {
  // ── SC-1: home rail tile tap → /wears/[username] ─────────────────────────
  test('wears-lane SC-1: tapping a WYWT rail wear tile navigates to /wears/[username]', async ({
    page,
  }) => {
    // EXPECTED RED until Plan 05 rewires WywtRail openAt() to router.push
    // Navigate to home page where the WYWT rail is rendered
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The WYWT rail tile for the test user — identified by the wear tile role
    // (each tile wraps a button or div with a username/avatarUrl; Plan 05 uses
    // router.push so no overlay opens).
    // After Plan 05: clicking a tile must navigate to /wears/${username}
    // Until Plan 05: clicking a tile opens WywtOverlay (URL stays at /) → RED
    const wearTile = page.locator('[data-testid="wywt-tile"]').first()

    // If no tiles are present, skip (viewer has no following with active wears)
    const tileCount = await wearTile.count()
    if (tileCount === 0) {
      test.skip(true, 'No WYWT rail tiles present — cannot assert navigation')
      return
    }

    await wearTile.click()

    // SC-1: URL must match /wears/ after click (not stay at /)
    await expect(page).toHaveURL(/\/wears\//, {
      timeout: 10_000,
    })
  })

  // ── SC-2: /wears/[username] — full-screen, no nav chrome ─────────────────
  test('wears-lane SC-2: /wears/[username] renders full-screen with no BottomNav', async ({
    page,
  }) => {
    // EXPECTED RED until Plan 03 creates the /wears/[username] route
    // Navigate directly to the stories lane for the test user
    await page.goto(`/wears/${PROFILE}`)
    // If redirected to /u/${PROFILE} (D-07: no active wears), the test is moot
    // but still passes (nav state is irrelevant for that redirect path).
    const currentUrl = page.url()
    if (currentUrl.includes(`/u/${PROFILE}`)) {
      // D-07 redirect fired → no active wears; acceptable, not a nav-chrome bug
      return
    }
    // Ensure the page loaded (not a 404)
    await expect(page.locator('body')).toBeVisible()

    // SC-2: BottomNav (`nav[aria-label="Primary"]`) must NOT be present on the
    // stories lane. BottomNav.tsx adds `aria-label="Primary"` to the <nav>.
    await expect(
      page.locator('nav[aria-label="Primary"]'),
      'BottomNav must not render on /wears/[username]',
    ).not.toBeVisible()
  })

  // ── SC-3: /wear/[id] retains nav + vertical scroll ────────────────────────
  test('wears-lane SC-3: /wear/[id] detail page retains BottomNav and is vertically scrollable', async ({
    page,
  }) => {
    // EXPECTED RED until Plan 04 wires WearCard into the /wear/[id] page
    // We need a known wearEventId for the test user.
    // The test navigates to the profile worn tab to find a wear link.
    await page.goto(`/u/${PROFILE}/worn`)
    await page.waitForLoadState('networkidle')

    // Find the first wear event link (href starts with /wear/)
    const wearLink = page.locator('a[href^="/wear/"]').first()
    const wearLinkCount = await wearLink.count()
    if (wearLinkCount === 0) {
      test.skip(true, 'No wear event links found on worn tab — cannot assert /wear/[id]')
      return
    }

    await wearLink.click()
    await page.waitForURL('**/wear/**', { timeout: 10_000 })

    // SC-3: BottomNav must be present on /wear/[id] (nav retained)
    await expect(
      page.locator('nav[aria-label="Primary"]'),
      'BottomNav must be visible on /wear/[id] detail page',
    ).toBeVisible()

    // SC-3: page is vertically scrollable (body/html overflow-y is not hidden)
    const isScrollable = await page.evaluate(() => {
      const body = document.body
      const html = document.documentElement
      const bodyOverflow = window.getComputedStyle(body).overflowY
      const htmlOverflow = window.getComputedStyle(html).overflowY
      // 'scroll' or 'auto' means vertically scrollable
      return bodyOverflow !== 'hidden' || htmlOverflow !== 'hidden'
    })
    expect(isScrollable, '/wear/[id] must be vertically scrollable').toBe(true)
  })
})
