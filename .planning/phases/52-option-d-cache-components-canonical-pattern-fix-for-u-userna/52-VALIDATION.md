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

> Populated by the planner; status flips as execution proceeds. Schema columns: Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 0 | REQ-52-01, REQ-52-03a, REQ-52-03b, REQ-52-04 | T-52-01-01 | Source-grep regression contract: post-refactor invariants asserted, expected to FAIL on current main | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ | ✅ green (3 fail/2 pass on main; ae57fa4) |
| 52-02-00 | 02 | 0 | REQ-52-07 (Task 0) | T-52-02-02 | Operator confirms seeded test user availability before auth-setup is written | manual (operator) | n/a (checkpoint) | n/a | ⬜ pending |
| 52-02-01 | 02 | 0 | REQ-52-07 | T-52-02-01, T-52-02-02 | Playwright auth setup writes storageState.json; credentials from env only; gitignored | e2e (setup) | `npx playwright test --project=setup` | ❌ → ✅ after install | ⬜ pending |
| 52-02-02 | 02 | 0 | REQ-52-06 | T-52-02-03 | Profile chrome stays mounted during instant() tab navigation | e2e (instant) | `npx playwright test tests/e2e/profile-tab-instant.test.ts` | ❌ on current main (contract) | ⬜ pending |
| 52-03-01 | 03 | 1 | REQ-52-01 | — | unstable_instant export present at the top of [tab]/page.tsx | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts -t unstable_instant` | ✅ | ✅ green (Test 4 PASS; 14e1bff) |
| 52-03-02 | 03 | 1 | REQ-52-02 (probe) | T-52-03-02 | Validator output captured verbatim into 52-03-VALIDATOR-OUTPUT.md — ground truth for Wave 2 | manual (operator) | inspect 52-03-VALIDATOR-OUTPUT.md | ❌ (probe; gate green only after Wave 2) | ⚠ partial — build-mode captured (d0a6720); dev-mode overlay capture deferred to operator |
| 52-04-01 | 04 | 2 | REQ-52-04 (part 1 — ProfileChrome) | T-52-04-01 | ProfileChrome is uncached async runtime-API consumer; no ProfileShellResolver in code | unit (source-grep) + tsc | `grep -n "ProfileShellResolver" src/app/u/[username]/profile-chrome.tsx` (only comments) ; `npx tsc --noEmit` on file = 0 errors | ✅ | ✅ green (90ad227) |
| 52-04-02 | 04 | 2 | REQ-52-03a + REQ-52-03b | T-52-04-02, T-52-04-04 | Layout sync + Suspense around ProfileChrome | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` Test 1 PASS | ✅ | ✅ green (1f57d70 — 4/5 pass) |
| 52-05-01 | 05 | 2 | REQ-52-04 (part 2 — ProfileTabContent inner) + REQ-52-01 + REQ-52-02 | T-52-05-01..04 | Outer sync + inner async with verbatim body; notFound ordering preserved; validator green via D-52-DEV-01 typed-annotation form | unit (source-grep) + build | `npx vitest run tests/profile-route-51.test.ts` (5/5 pass) + `npm run build` (exit 0, 33/33 pages) | ✅ | ✅ green (291b966) |
| 52-06-01 | 06 | 2 | REQ-52-02 + REQ-52-05 | T-52-06-01, T-52-06-02 | Cross-route validator no-op confirmation + SEED-014 hand-off | build + manual (FINDINGS.md inspection) | `npm run build` exit 0; `52-06-FINDINGS.md` records empty surfaced-violations table | ✅ | ✅ green (FINDINGS.md committed; no source changes needed) |
| 52-04-01 | 04 | 2 | REQ-52-04 (part 1 — ProfileChrome) | T-52-04-01 | ProfileChrome is uncached async runtime-API consumer; no ProfileShellResolver call | unit (source-grep) + tsc | `grep -c ProfileShellResolver src/app/u/[username]/profile-chrome.tsx` returns 0; `npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 52-04-02 | 04 | 2 | REQ-52-03a + REQ-52-03b | T-52-04-02, T-52-04-04 | Layout sync + Suspense around ProfileChrome | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts -t "layout must be sync"` | ✅ | ⬜ pending |
| 52-05-01 | 05 | 2 | REQ-52-04 (part 2 — ProfileTabContent inner) | T-52-05-01, T-52-05-02, T-52-05-03 | Outer sync + inner async with verbatim body; notFound ordering preserved | unit (source-grep) + build | `npx vitest run tests/profile-route-51.test.ts` (5/5 pass) + `npm run build` (exit 0) | ✅ | ⬜ pending |
| 52-06-00 | 06 | 2 | REQ-52-05 (Task 0) | — | Operator confirms cross-route opt-out scope (or no-op) | manual (operator) | n/a (checkpoint) | n/a | ⬜ pending |
| 52-06-01 | 06 | 2 | REQ-52-05 | T-52-06-01 | Each surfaced route has unstable_instant=false + cite comment | unit (grep) | `grep -l unstable_instant <files>` returns the resolved file list | ✅ | ⬜ pending |
| 52-06-02 | 06 | 2 | REQ-52-02 (final — build-time validator green globally) | — | npm run build exit code | build | `npm run build && echo OK` | ✅ | ⬜ pending |
| 52-07-01 | 07 | 3 | REQ-52-09 (CR-01 comment) | T-52-07-01 | proxy.ts comment accurately attributes the no-store header as THE safety mechanism | unit (source-grep) + behavioral | `npx vitest run tests/proxy.test.ts` exits 0 + `grep -c Cache-Control src/proxy.ts` >= 2 | ✅ | ⬜ pending |
| 52-07-02 | 07 | 3 | REQ-52-09 (script delete) | T-52-07-02 | scripts/assert-phase-51-build.mjs deleted; no active references | filesystem | `test ! -f scripts/assert-phase-51-build.mjs` | ✅ | ⬜ pending |
| 52-07-03 | 07 | 3 | REQ-52-10 (SEED-014 creation per D-52-04) | T-52-07-03 | SEED-014 created with full body + hand-off populated from FINDINGS.md | filesystem + grep | `test -f .planning/seeds/SEED-014-cache-components-canonical-sweep.md` + section grep | ✅ | ⬜ pending |
| 52-08-01 | 08 | 3 | REQ-52-09 (D-52-11 reversal in [tab]/page.tsx) | T-52-08-02 | Comment block reflects validator-not-runtime-feature framing | unit (source-grep) | `grep -c "REMOVED 2026-05-14" src/app/u/[username]/[tab]/page.tsx` returns 0 | ✅ | ⬜ pending |
| 52-08-02 | 08 | 3 | REQ-52-09 (D-52-14 loading.tsx rewrite) | T-52-08-02 | Three-boundary description present | unit (source-grep) | `grep -c "three-boundary\|three boundaries" src/app/u/[username]/loading.tsx` >= 1 | ✅ | ⬜ pending |
| 52-08-03 | 08 | 3 | REQ-52-09 (profile-gate.tsx attribution) | T-52-08-02 | ProfileChrome named as caller in JSDoc | unit (source-grep) | `grep -c ProfileChrome src/app/u/[username]/profile-gate.tsx` >= 1 | ✅ | ⬜ pending |
| 52-08-04 | 08 | 3 | REQ-52-09 (D-52-11 annotation in 51-CONTEXT.md + D-52-12 grep) | T-52-08-01 | Phase 51 CONTEXT preserved + annotated; no .continue-here.md anti-pattern | grep | `grep -c "REVERSED by Phase 52" .planning/phases/51-.../51-CONTEXT.md` >= 1 | ✅ | ⬜ pending |
| 52-09-01 | 09 | 4 | REQ-52-02 (pre-deploy build) | — | npm run build exits 0 pre-deploy | build | `npm run build && echo OK` | ✅ | ⬜ pending |
| 52-09-02 | 09 | 4 | REQ-52-06 (pre-deploy e2e) | — | Playwright chrome-mounted invariant green | e2e | `npm run test:e2e` | ✅ | ⬜ pending |
| 52-09-03 | 09 | 4 | REQ-52-08 (Branch B contract preserved) | T-52-09-01 | Anon → 307 + no-store | manual (curl) | curl on prod | ✅ | ⬜ pending |
| 52-09-04 | 09 | 4 | REQ-52-08 (recurrence-4 prevention — 15-min UAT) | T-52-09-02 | Second UAT cycle post-15-min: zero React #419 | manual (operator) | inspect 52-09-UAT-LOG.md | ✅ | ⬜ pending |

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

## Wave 0 Requirements (planned in Plans 01 + 02)

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
