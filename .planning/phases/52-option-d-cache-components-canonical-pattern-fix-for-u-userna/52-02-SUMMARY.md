---
phase: 52
plan: 02
status: complete
completed: 2026-05-21
tasks_completed: 4
tasks_total: 4
---

# Plan 52-02 SUMMARY — Playwright e2e infrastructure (reshaped)

## What was done

Established Playwright e2e infrastructure and a profile-route navigation regression guard. Executed AFTER the recurrence-5 fix landed, so the test was **reshaped** from the original `instant()` design (see Deviations).

**Task 0 (checkpoint — seeded test user):** Resolved as "reset twwaneka+1 via admin API." Local Supabase was already running. The local instance uses the new `sb_secret_`/`sb_publishable_` key format; the legacy service-role key in `.env.local` is stale (prod) and returned `invalid JWT`. Used the local `sb_secret_…` key (from `npx supabase status`) to set a known password on `twwaneka+1@gmail.com` (profile `twwaneka_1`) via `PUT /auth/v1/admin/users/{id}`. Confirmed sign-in works against local with the dev server's anon key (HTTP 200, access_token present). Credentials stored in gitignored `.env.local` as `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` / `TEST_USER_PROFILE`.

**Task 1 (install + config):** `npm install --save-dev @playwright/test@^1.60.0 @next/playwright@16.2.6` (`@next/playwright` resolved to `^16.2.6`); `npx playwright install chromium` (chromium-1223). Added `"test:e2e": "playwright test"` to package.json. Added `exclude: ['tests/e2e/**', …]` to vitest.config.ts. Appended Playwright artifacts to `.gitignore` (`tests/e2e/storageState.json`, `playwright-report/`, `test-results/`).

**Task 2 (config + auth-setup):** `playwright.config.ts` — local `npm run dev` webServer, baseURL `http://localhost:3000`, storageState, `setup`→`chromium` project chain, `dotenv` loads `.env.local`, 90s per-test timeout (Turbopack cold-compile + 14 navigations). `tests/e2e/auth-setup.ts` — signs in the seeded user via the `#email`/`#password` form, waits to leave `/login`, persists storageState; throws a clear error if `TEST_USER_*` env is unset.

**Task 3 (regression test):** `tests/e2e/profile-tab-nav.test.ts` — signed-in (owner) navigation across all owner-visible tabs (`collection`, `wishlist`, `worn`, `notes`, `stats`, `insights`; `common-ground` excluded — it legitimately `notFound()`s on self-view), asserting initial load is not a 404, the persistent chrome (heading + tablist) stays mounted across every tab swap, and no React #419 surfaces in the console/pageerror. Includes a `collection↔wishlist` ×4 intermittency probe (the prod bug failed ~20% of the time). Tab clicks target `[data-tab-id="…"]` (the bare href collides with the avatar link).

Commit: `<this-plan>` — `test(52-02): Playwright e2e infra + profile-tab-nav regression guard`

## Verification

- `npx playwright test` — **setup ✓ + chromium ✓ (2 passed)** against the fixed code (`unstable_instant = false`).
- `npm run test` (vitest) — **5252 pass / 325 skipped**, and vitest does NOT load `tests/e2e/**` (still 257 files; exclude confirmed).
- `tests/e2e/storageState.json` confirmed gitignored (absent from the commit).

## Fidelity — empirically characterized (important)

I tested the regression test against BOTH exports locally:
- `unstable_instant = false` (fixed) → test **passes**.
- `unstable_instant = { prefetch: 'runtime', samples }` (the recurrence-5-broken version) → test **also passes**.

**Conclusion:** local `next dev` does NOT reproduce the prod-only recurrence-5 failure (the secondary-prerender abort doesn't manifest in dev). So this suite is a **structural guard** — it catches hard 404s, chrome unmounting, dev-surfaced React errors, and nav regressions — but it is NOT a recurrence-5-specific guard. The prod-fidelity guard (a Vercel preview-deploy Playwright target) is deferred per D-52-07 and captured in SEED-014. This is documented in the test file header, the config header, and the commit message so no future reader mistakes a green run for proof that the prod-edge bug is gone.

## Deviations from PLAN.md

| Deviation | Why | Disposition |
|-----------|-----|-------------|
| Test reshaped from `@next/playwright` `instant()` helper to a direct nav-no-404/no-#419 assertion | The recurrence-5 fix set `unstable_instant = false`, so the route opts OUT of instant-navigation — the `instant()` contract no longer applies. A direct assertion of the bug class is the faithful test. | **Rule 3 (blocking deviation, resolved).** The plan's `instant()` design predates the recurrence-5 fix; reshaping is required for correctness. |
| Executed AFTER the structural fix + recurrence-5 fix (not as a pre-fix RED scaffold) | Plan 52-02 was deferred (operator remote) through Waves 0-4 and the recurrence-5 debug cycle. By the time the operator returned, the fix was already in prod. | **Rule 4 (defer→reorder).** The test is now a forward regression guard rather than a TDD RED scaffold. |
| `@next/playwright` pinned `^16.2.6` (caret) not exact `16.2.6` | `npm install` added the caret. Compatible with the 16.2.x line. | **Rule 1 (bypass with reason).** Minor; pin can be tightened later if needed. |
| Used local `sb_secret_` key for admin reset (not `.env.local`'s SUPABASE_SERVICE_ROLE_KEY) | `.env.local`'s service-role key is the prod key (invalid JWT against local). | **Rule 1 (bypass with reason).** Noted for future local admin operations — `.env.local` service-role key ≠ local key. |

## Files touched

| File | Change |
|------|--------|
| `package.json` | +`@playwright/test`, +`@next/playwright`, +`test:e2e` script |
| `package-lock.json` | dependency tree |
| `vitest.config.ts` | `exclude: ['tests/e2e/**', …]` |
| `.gitignore` | Playwright artifacts |
| `playwright.config.ts` | NEW — local-dev e2e config |
| `tests/e2e/auth-setup.ts` | NEW — storageState auth setup |
| `tests/e2e/profile-tab-nav.test.ts` | NEW — nav regression guard |
| `.env.local` | +`TEST_USER_*` (gitignored, not committed) |

## Self-Check

- [x] All 4 tasks executed
- [x] Committed (storageState.json correctly excluded)
- [x] SUMMARY.md created
- [x] REQ-52-06 (chrome-mounted nav invariant) + REQ-52-07 (auth-setup storageState) ✓
- [x] e2e suite green; vitest suite green with e2e excluded
- [x] Fidelity limits empirically characterized + documented (not overclaimed)

## Next

Phase 52 plan inventory is now complete (01, 03, 04, 05, 06, 07, 08, 09, 02 — all have SUMMARYs; 52-03 dev-overlay capture dropped as moot post-opt-out). Remaining: write 52-09 UAT-LOG, run code review, phase verification, roadmap close.
