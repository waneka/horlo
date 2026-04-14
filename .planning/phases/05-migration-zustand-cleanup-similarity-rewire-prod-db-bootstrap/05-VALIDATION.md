---
phase: 05
slug: zustand-cleanup-similarity-rewire-prod-db-bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Phase 2) |
| **Config file** | `vitest.config.ts` (verify exists; otherwise `vitest.config.mjs`) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Build check command** | `npm run build` |
| **Estimated runtime** | ~30 seconds for unit suite; ~60 seconds for `npm run build` |

---

## Sampling Rate

- **After every task commit:** `npm run build` (catches TypeScript breakage from each file conversion immediately)
- **After every plan wave:** `npm test -- --run` (full unit suite — similarity engine regression check)
- **Before `/gsd-verify-work`:** `npm run build` clean + all grep acceptance criteria pass + operator has executed the OPS-01 runbook end-to-end against prod
- **Max feedback latency:** ~60 seconds (build time)

---

## Per-Task Verification Map

> Populated by the planner during Step 8. Each task in each PLAN.md must have an `<automated>` block whose command appears below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD by planner | — | — | DATA-05 / OPS-01 | — | — | grep/build/manual | TBD | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Grep-Verifiable Acceptance Criteria

These commands must all return **no output** (or the documented expected output) before Phase 5 can be marked complete. Plans MUST embed them as `<automated>` blocks on the relevant tasks.

```bash
# 1. watchStore has no persist, no CRUD, no collection data
grep -E "persist|addWatch|deleteWatch|markAsWorn|updateWatch|watches\s*:" src/store/watchStore.ts
# expected: no output

# 2. insights page is a Server Component
grep "'use client'" src/app/insights/page.tsx
# expected: no output

# 3. SimilarityBadge has no store imports
grep -E "useWatchStore|usePreferencesStore" src/components/insights/SimilarityBadge.tsx
# expected: no output

# 4. useIsHydrated is gone from all converted pages
grep -rn "useIsHydrated" src/app/
# expected: no output

# 5. No 'use client' on any converted page
grep "'use client'" src/app/page.tsx src/app/insights/page.tsx src/app/preferences/page.tsx
# expected: no output

# 6. Build is clean
npm run build
# expected: exit 0, no type errors

# 7. Existing similarity unit tests still green
npm test -- --run src/lib/similarity
# expected: exit 0
```

---

## Wave 0 Requirements

- No new test files required. Phase 5 is a refactor with structural/grep verification plus manual smoke tests. The existing similarity unit suite (Phase 2) is the regression net.
- If `vitest.config.ts` is missing or `npm test` exits non-zero on a clean checkout, planner must add a Wave 0 task to repair it before any conversion task runs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-browser parity | DATA-05 (success criterion 3) | Requires two real browser sessions with the same authenticated account | (1) Log in on Browser A. (2) Log in on Browser B with same credentials. (3) Add a watch in Browser A. (4) Refresh Browser B. (5) Confirm new watch appears. |
| Prod signup + logout smoke test | OPS-01 (success criterion 4) | Hits the live Vercel deployment + Supabase project | (1) Visit `https://horlo.app/signup`. (2) Create test user. (3) Confirm logged-in state. (4) Click logout. (5) Confirm redirect to `/login`. (6) Delete test user from Supabase dashboard. |
| OPS-01 runbook execution | OPS-01 (entire criterion) | The runbook is "verified" only if a real operator runs it against the real prod project | Plan must include an explicit checkpoint task with `autonomous: false` that pauses execution and asks the user to run `docs/deploy-db-setup.md` end-to-end and report results. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or appear in the Manual-Only table
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 gaps closed (or explicitly waived as "none")
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency ≤ 60s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the verification map

**Approval:** pending
