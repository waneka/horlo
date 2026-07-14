---
phase: 81
slug: recommender-display-server-action-swap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- src/data/__tests__/recommendations.test.ts src/lib/__tests__/recommendations.test.ts` |
| **Full suite command** | `npm run build && npm run test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to touched files
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RECO-01..04, DISP-01/02 | — | Canonical brand/model rendered + exclusion keyed on FK ids | unit + integration + local-first UAT | populated by planner | ✅ existing test files present | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/data/__tests__/recommendations.test.ts` — extend for exclusion-key format + brandNameLookup wiring
- [ ] `src/lib/__tests__/recommendations.test.ts` — extend for `topBrandOf` signature change (or add if missing)
- [ ] `src/app/actions/__tests__/watches.test.ts` — extend for DISP-01/02 auto-overwrite (or add if missing)
- [ ] Local drift-fixture SQL (per D-81-04) — script/README under `scripts/` or per-test `beforeAll` — NOT committed as a migration

*Wave 0 depends on planner's split between unit-level and integration-level tests; the drift fixture is a Wave 0 blocker for the RECO local-walkthrough.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Home rail excludes the viewer's own catalog family via canonical `brand_id` (drift-fixture walk) | RECO-01 | Requires seeded local Supabase + specific drift row + peer collector with multi-brand ownership | Sign in as `viewer@horlo.test`, load `/`, assert `Hamilton Watch`-branded catalog row is NOT in "From Collectors Like You" |
| Rail rationale renders canonical brand string (`Hamilton`) not drift denorm (`Hamilton Watch`) | RECO-04 | Requires the same fixture; assertion is on rendered DOM text | Same walk as above; assert `Fans of Hamilton love this` (not `Fans of Hamilton Watch`) |
| `addWatch` server-side overwrite persists canonical `brand` | DISP-01 | Requires actual Server Action call round-trip, DB inspection | Add a watch via `/watch/new`, type `Hamilton Watch`, save, `SELECT brand FROM watches WHERE id = ...` → expects `Hamilton` |
| `editWatch` server-side overwrite persists canonical `brand` on edit | DISP-02 | Same as DISP-01 for edit flow | Edit that watch, retype `Hamilton Watch`, save, re-query → expects `Hamilton` |
| No measurable p95 regression on home rail load | Success criterion #5 | No baseline artifact exists; comparison is prose per RESEARCH.md open question #10 | Load `/` a few times on prod post-deploy; subjective compare against pre-deploy latency |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
