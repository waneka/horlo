---
phase: 39
slug: audit-driven-discovery-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `39-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 + @testing-library/react ^16.3.2 + jsdom ^25.0.1 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts tests/app/common-ground-fallback.test.tsx` |
| **Full suite command** | `npm test` (alias for `vitest run` — runs all matched tests) |
| **Estimated runtime** | ~10 seconds for quick run; ~60 seconds for full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts tests/app/common-ground-fallback.test.tsx`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds (quick), 60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-XX-01 | TBD | 0 | DISC-11 / NSV-12 | T-39-01 (privacy split — see RESEARCH Pitfall 1) | `!overlap` (gate failure) → 404; `!overlap.hasAny` → 200 with fallback Card | integration | `npx vitest run tests/app/common-ground-fallback.test.tsx` | ❌ W0 | ⬜ pending |
| 39-XX-02 | TBD | 1 | DISC-11 / NSV-01 + NSV-15 | — | N/A (no auth/data path) | grep + static guard | `grep -nE "<Link" src/components/insights/CollectionFitCard.tsx` AND `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ | ⬜ pending |
| 39-XX-03 | TBD | 1 | DISC-11 / NSV-08 | — | N/A (verify-and-patch only) | grep evidence in SUMMARY | `grep -nE "<Link\|<a " src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` | ✅ (both ALREADY wrap per RESEARCH) | ⬜ pending |
| 39-XX-04 | TBD | 1 | DISC-11 / NSV-12 (200 + 404 branches) | T-39-01 | Privacy boundary preserved (anon/private-collection viewers still 404) | integration | `npx vitest run tests/app/common-ground-fallback.test.tsx` | Created Wave 0 | ⬜ pending |
| 39-XX-05 | TBD | 1 | Phase 20 D-04 invariant | — | CollectionFitCard has no engine imports after edit | static guard | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs will be assigned by planner. Wave column reflects planner's expected ordering: Wave 0 = test file creation; Wave 1 = code patches.*

---

## Wave 0 Requirements

- [ ] `tests/app/common-ground-fallback.test.tsx` — Vitest + RTL + jsdom integration test covering:
  - 200 branch: viewer follows owner, overlap.hasAny === false → fallback Card renders with "No shared watches yet." title and two CTAs (`/u/{username}/collection`, `/explore`)
  - 404 branch A: `!overlap` (gate failure — anonymous viewer / private collection / viewer not following) → `notFound()` thrown (mock `next/navigation.notFound` to throw `NEXT_NOT_FOUND`)
  - 404 branch B: `!profile` → `notFound()` thrown
  - Pattern: mirror `tests/app/profile-tab-insights.test.tsx` (mocks DAL modules, walks returned React element tree via `findInTree` helper from `tests/app/layout.test.tsx:23-36`)

*No framework install needed — vitest already in repo. No shared fixtures needed — inline per-test mock setup per project convention.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NSV-08 audit-row closure documentation | DISC-11 / NSV-08 | D-08 mandates grep evidence captured in plan SUMMARY, not a test file — the "verify-before-patch" protocol is auditable via SUMMARY text, not assertions | Plan SUMMARY captures: (1) grep command output proving both sections wrap at HEAD; (2) audit-row closure note "shipped before Phase 39 began"; (3) no fabricated patches written |
| NSV-01 + NSV-15 hover/click affordance on real `/watch/{id}` and `/catalog/{id}` pages | DISC-11 / NSV-01 + NSV-15 | UI hover state + cursor behavior not asserted by static guard or integration test; requires `npm run dev` and visual confirmation | Start dev server; navigate to `/watch/{any id}` and `/catalog/{any catalogId}`; hover mostSimilar list items → background tint should appear (accent token); click → should navigate to `/watch/{watchId}` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/app/common-ground-fallback.test.tsx`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (quick) / < 60s (full)
- [ ] `nyquist_compliant: true` set in frontmatter after planner approves task→test mapping

**Approval:** pending
