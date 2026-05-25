---
phase: 59
slug: unified-route-variant-c
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 59-RESEARCH.md "Validation Architecture". This phase is routing-layer only — no schema, no new visual UI.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured in `package.json` / `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/static/legacy-watch-routes.test.ts` (the CI guard; fast) |
| **Full suite command** | `npm run test` |
| **Build gate command** | `npm run build` (must trigger the guard via `prebuild` — see Wave 0) |
| **E2E command** | `npm run test:e2e` (Playwright; skips on empty test DB — see Manual-Only) |
| **Estimated runtime** | ~quick guard <5s; full suite varies |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/static/legacy-watch-routes.test.ts` (the guard)
- **After every plan wave:** Run `npm run test` (full Vitest suite)
- **Before `/gsd-verify-work`:** Full suite green + manual prod verification of `/w/[ref]` routing
- **Max feedback latency:** ~5s for the guard; full suite per wave

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| ROUTE-01 | `/w/[ref]` resolves per-user `watches.id` correctly | Integration (server) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-01 | `/w/[ref]` resolves `catalogId` correctly | Integration (server) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-01 | `same-user` framing when viewer is owner (both branches) | Integration (server) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-01 | `cross-user` framing when viewer is not owner | Integration (server) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-01/D-06 | owned-via-catalog-link renders full owned view in place (no redirect) | Integration (server) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-02 | `/watch/[id]/page.tsx` & `/catalog/[catalogId]/page.tsx` deleted (404 by absence) | Static (fs `existsSync`) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-03 | Build fails if any legacy `/watch/` or `/catalog/` link literal present (incl. template literals + computed return strings) | Static (source scan) | `npm run build` (via `prebuild`) | ❌ W0 | ⬜ pending |
| ROUTE-03 | Guard allowlists `/watch/new`; does not flag `/explore/lists/`, `/admin/lists/`, `/wear/` | Static (source scan) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-04 | All ~26 internal link literals (21 files) re-point to `/w/[ref]` | Static (source scan) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-04/D-12 | `NotificationRow.resolveHref` returns `/w/[ref]` (computed deep-link) | Unit | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-05/D-14 | Two-layer privacy gate unchanged — private watch 404s for non-owner | Integration | `npm run test` (DAL: existing `phase12-visibility-matrix.test.ts`; verify route-level) | ✅ DAL / ❌ W0 route | ⬜ pending |
| ROUTE-06/D-15 | `viewerCanEdit=false` for non-owners on unified route | Unit (prop check) | `npm run test` | ❌ W0 | ⬜ pending |
| ROUTE-06 | Edit/delete/mark-worn actions absent for non-owners | Manual (prod) | Human UAT | Human-needed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/static/legacy-watch-routes.test.ts` — ROUTE-03/04 source-scan guard (new file; follows existing `tests/static/` pattern). Bans `/watch/<id>` and `/catalog/<id>` literals + template literals + computed return strings; allowlists `/watch/new`; excludes `/explore/lists/`, `/admin/lists/`, `/wear/`.
- [ ] ROUTE-02 route-absence assertion — `existsSync` checks that the two legacy `page.tsx` files are gone (inline in the guard test or a sibling file).
- [ ] `tests/integration/phase59-unified-route.test.ts` — ROUTE-01 resolution coverage: per-user branch, catalog branch, owned-via-catalog D-06 branch, cross-user framing.
- [ ] `package.json` `"prebuild"` script — `vitest run tests/static/legacy-watch-routes.test.ts` so the guard fails the Vercel build (the only CI gate; no `.github/workflows`).

*No new test framework install needed — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edit/delete/mark-worn UI absent for non-owners on `/w/[ref]` | ROUTE-06 | Visual/owner-gated UI; project verifies UI on prod (empty local test DB skips e2e) | After deploy: visit another user's `/w/[ref]`, confirm no owner write actions render |
| `/w/[ref]` renders correctly on mobile (owned + cross-user framing) | ROUTE-01 | Mobile/visual behavior verified on prod per project convention | After deploy: navigate to `/w/[ref]` on device for both an owned and a cross-user watch |
| Legacy `/watch/[id]` & `/catalog/[id]` 404 on prod soft-nav (no Router Cache poisoning) | ROUTE-02 | Soft-nav cache behavior is prod-only (Next 16 Router Cache) | After deploy: soft-navigate to a stale legacy URL, confirm hard 404, no cache poisoning |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (guard test, integration test, prebuild hook)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (guard)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-05-25 (Phase 59 plans 01-03; Wave 0 in Plan 01)
