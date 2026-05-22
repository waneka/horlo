---
status: passed
phase: 52-option-d-cache-components-canonical-pattern-fix-for-u-userna
plan: 09
started: 2026-05-21
updated: 2026-05-21
---

# Phase 52 Plan 09 — Deploy + UAT Log

## Pre-deploy gates (at the time of the first deploy)

| Gate | Result |
|------|--------|
| `npm run test` (vitest) | ✅ 5252 pass / 325 skipped / 0 fail (212 files) |
| `npm run build` | ✅ exit 0, 33/33 static pages, `/u/[username]/[tab]` = ◐ Partial Prerender |
| `npx playwright test` | (deferred at first deploy; landed later in Plan 52-02 — setup + nav both green) |

## Deploy 1 — `unstable_instant = { prefetch: 'runtime', samples }` (D-52-DEV-01)

- Commit: `b5106db`. Vercel prod deploy `horlo-jgb6rup55` — Ready (build 1m).
- Branch B curl (anon `/u/twwaneka/collection`): ✅ `HTTP/2 307` + `cache-control: no-store` + `location: /login?next=…`. D-52-CF-01 intact.
- **Operator UAT: FAILED — recurrence-5.** Signed-in profile pages threw React #419 on page load (ALL profile pages), plus intermittent per-tab/per-device 404s on `/collection` and `/wishlist` (~20% fail rate). Materially different from recurrences 1-4 (which were consistent all-tab 404s), but not resolved.

## Debug cycle — recurrence-5

- Debug session `profile-404-419-recurrence-5` (resolved). Root cause: `prefetch: 'runtime'` triggers a secondary server-side prerender (`finalRuntimeServerPrerender`) that aborts before `ProfileTabContent`'s async work completes → #419 + incomplete cached RSC segment → intermittent 404s. Traced through Next 16.2.3 source.
- Empirically established that `prefetch: 'static'` cannot be used either (fails the build on this two-dynamic-param route — debug evidence E-00; the build gate caught it before deploy).
- Fix: `export const unstable_instant = false` (opt out of the validator; keep the Plan 04/05 structural fix). Commit `83499c8`.

## Deploy 2 — `unstable_instant = false` (recurrence-5 fix)

- Commit: `83499c8`. Vercel prod deploy `horlo-6n7pnfdpu` — Ready (build 59s).
- Branch B curl: ✅ anon `/u/twwaneka/collection` AND `/u/twwaneka/wishlist` both `HTTP/2 307` + `cache-control: no-store`. D-52-CF-01 intact.
- **Operator UAT: PASSED.**
  - Page-load console: React #419 **gone** on all profile pages.
  - Signed-in tab navigation: **zero 404s** across all tabs.
  - **Cache-window verification:** held clean through TWO full 300s `cacheLife` rollovers — operator checked at ~10 min post-deploy (clean) and again at ~20 min post-deploy (clean). This is the exact window recurrence-4 slipped through (it broke ~10 min post-deploy). Clearing it twice is the recurrence-prevention proof.

## Outcome

✅ **Phase 52 goal achieved in prod.** The recurrence-4 React #419 + 404 class is eliminated on authenticated `/u/[username]/[tab]` navigation, verified through the cache-revalidation window that defeated every prior fix. The Phase 51 Branch B contract (anon `/u/*` → 307 + `no-store`) is preserved.

## Notes / accepted residuals

- **Build-time validator opted out** on this route (`unstable_instant = false`) — it's unusable here in either mode (`runtime` breaks prod, `static` breaks the build). Regression protection is the Plan 52-02 Playwright structural nav test + the source-grep invariants in `tests/profile-route-51.test.ts`.
- **Prod-fidelity e2e** (Vercel preview-deploy Playwright target) deferred to SEED-014 — the local e2e test cannot reproduce the prod-only failure mode.
- **52-03 dev-overlay capture** dropped as moot (validator opted out → no dev overlay validator errors to capture).
