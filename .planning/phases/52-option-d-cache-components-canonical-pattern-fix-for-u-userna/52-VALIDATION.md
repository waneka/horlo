---
phase: 52
slug: option-d-cache-components-canonical-pattern-fix-for-u-userna
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `52-RESEARCH.md` § Validation Architecture; planner fills the Per-Task Verification Map after PLAN.md tasks are enumerated.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (existing)** | vitest `^2.1.9` + `@testing-library/react` `^16.3.2` (jsdom env, `server-only` shim) |
| **Framework (new in Phase 52)** | `@playwright/test` + `@next/playwright` (Wave 0 installs) |
| **Existing config** | `vitest.config.ts` |
| **New config** | `playwright.config.ts` (new file, Wave 0) |
| **Vitest quick run** | `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts` |
| **Vitest full suite** | `npm run test` |
| **E2E quick run** | `npx playwright test tests/e2e/profile-tab-instant.test.ts` |
| **E2E full suite** | `npm run test:e2e` |
| **Build-time validator gate** | `npm run build` (must exit 0 — `unstable_instant` validator enforces structural invariants) |
| **Estimated runtime** | ~15s vitest quick / ~90s vitest full / ~30s e2e / ~60s build |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts`
- **After Wave 1 (Step 1 probe):** Run `npm run dev` + `npm run build` — capture validator output as ground truth for Wave 2 scope
- **After Wave 2 (refactor complete):** Run `npm run build` — must exit 0 with no validator errors on `/u/[username]/[tab]`
- **After Wave 3 (e2e ready):** Run `npm run test:e2e` — full Playwright suite
- **After Wave 4 (cleanups):** Run `npm run test` (full vitest)
- **Before `/gsd-verify-work`:** Full vitest + `npm run build` + `npm run test:e2e` all green
- **Max feedback latency:** ~90s (vitest full) — well under 5-min cache window

---

## Per-Task Verification Map

> **Placeholder — planner fills this in after PLAN.md tasks are enumerated.** Schema:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-XX-XX | XX | N | REQ-52-XX | T-52-XX / — | {expected secure behavior or N/A} | unit / e2e / build | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Map (from RESEARCH.md)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-52-01 | `[tab]/page.tsx` exports `unstable_instant = { prefetch: 'static' }` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 4 added to existing file) |
| REQ-52-02 | Validator produces no errors on `/u/[username]/[tab]` | build-time | `npm run build` exits 0 | ✅ (build CI gate) |
| REQ-52-03a | `layout.tsx` does NOT directly `await getCurrentUser` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 1 inverted) |
| REQ-52-03b | `layout.tsx` HAS `<Suspense>` around `ProfileChrome` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 1 positive assertion added) |
| REQ-52-04 | `ProfileTabContent` async component exists inside page's `<Suspense>` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ❌ Wave 0 gap |
| REQ-52-05 | Cross-route `unstable_instant = false` opt-outs applied where validator surfaces violations | build-time | `npm run build` exits 0 | ✅ (build gate) |
| REQ-52-06 | Profile chrome (heading + tablist) stays mounted across tab navigation | e2e (`instant()`) | `npx playwright test tests/e2e/profile-tab-instant.test.ts` | ❌ Wave 0 gap |
| REQ-52-07 | Playwright auth setup produces valid `storageState.json` | e2e (setup) | `npx playwright test tests/e2e/auth-setup.ts` | ❌ Wave 0 gap |
| REQ-52-08 | Post-deploy: anon `/u/*` → 307 + `Cache-Control: no-store`; 15-min revalidation does not trigger React #419 | manual (operator UAT + curl) | See `scripts/verify-phase-51-prod.sh` + operator UAT | ✅ (existing curl from Phase 51) |
| REQ-52-09 | CR-01 comment corrected in `src/proxy.ts` | unit (source-grep) | `npx vitest run tests/proxy.test.ts` | ✅ (existing proxy test) |

---

## Wave 0 Requirements

- [ ] `tests/profile-route-51.test.ts` — Test 1 inversion (REQ-52-03a), Test 1 positive Suspense assertion (REQ-52-03b), Test 4 addition (REQ-52-01), Test 5 addition for `ProfileTabContent` source-grep (REQ-52-04)
- [ ] `tests/e2e/auth-setup.ts` — covers REQ-52-07 (seeded-user storageState pattern)
- [ ] `tests/e2e/profile-tab-instant.test.ts` — covers REQ-52-06 (chrome-mounted invariant via `@next/playwright` `instant()`)
- [ ] `playwright.config.ts` — config infrastructure for e2e (webServer config spawning `npm run dev`, baseURL, projects)
- [ ] `package.json` — add `test:e2e` script + `@playwright/test` + `@next/playwright` devDeps
- [ ] Build-time gate — `npm run build` is the implicit Wave 0 / per-commit check after Wave 1 lands the `unstable_instant` export

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Post-deploy operator UAT (no React #419 after 15-min cache revalidation) | REQ-52-08 | Requires prod deploy + real-time observation across the 300s `cacheLife` window | (1) Push to main → wait ~3 min Vercel deploy → (2) curl Branch B contract per Phase 51 protocol → (3) sign in → click all 6 tabs through 2 full cycles → (4) wait 15+ min → click again → assert no 404s and no console React #419 |
| Anon `/u/*` 307 + `Cache-Control: no-store` Branch B contract preserved | REQ-52-08 | Prod-only behavior; `Cache-Control` header is the real safety mechanism | `curl -s -o /dev/null --cookie-jar /dev/null --cookie /dev/null -w "STATUS=%{http_code}\n" -D /tmp/h "https://www.horlo.app/u/twwaneka/collection" && grep -i cache-control /tmp/h` — must show `STATUS=307` and `cache-control: no-store` |
| Diagnosis-reversal documentation updates land | D-52-11 (CONTEXT.md) | Doc-only change; no runtime invariant to test | Reviewer manually inspects `src/app/u/[username]/[tab]/page.tsx` comment + Phase 51 `51-CONTEXT.md` `<decisions>` annotation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills per-task map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 items listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (vitest full)
- [ ] Build-time validator gate is hard CI (D-52-03)
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills per-task map and plan-checker verifies

**Approval:** pending — planner + plan-checker
