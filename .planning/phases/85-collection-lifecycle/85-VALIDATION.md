---
phase: 85
slug: collection-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (jsdom default; `// @vitest-environment node` for fs-walking static guards) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <touched test file>` |
| **Full suite command** | `npm run test` + `npm run build` (build is the authoritative gate — baseline suites carry pre-existing failures) |
| **Estimated runtime** | ~5–20 seconds targeted; several minutes full suite + build |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file>` for touched files
- **After every plan wave:** Run `npm run test` + `npm run build`
- **Before `/gsd:verify-work`:** Build exit 0; no new test failures vs baseline; local-dev walk against local Supabase (DB-touching phase — CLAUDE.md Local-First gate)
- **Max feedback latency:** ~20 seconds (targeted runs)

---

## Per-Task Verification Map

*Populated by the planner/executor once PLAN.md task IDs exist. Requirement → test map from RESEARCH.md §Validation Architecture:*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LIFE-01 | — | N/A | static/type | `npm run build` + updated `tests/static/WatchCard.sold-badge.test.tsx` | ✅ (update/delete) | ⬜ pending |
| TBD | TBD | TBD | LIFE-02 | — | N/A | unit | `npx vitest run src/app/actions/__tests__/watches.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFE-03 | IDOR / future-date tampering | Owner-scoped fetch; server rejects future disposalDate; reason required; undo nulls fields | unit | `npx vitest run src/app/actions/__tests__/watches.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFE-04 | — | N/A | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | LIFE-04 | — | Reduced-motion skips confetti | unit | `npx vitest run src/lib/__tests__/celebrate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFE-05 | Info disclosure | Non-owner never receives previously_owned rows; toggle owner-only | component | `npx vitest run src/components/profile/__tests__/CollectionTabContent.test.tsx` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | LIFE-06 | Info disclosure | Visitor notFound on previously-owned /w/[id] | unit (DAL) | `npx vitest run tests/data/getWatchByIdForViewer.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | LIFE-06 | — | N/A | unit | similarity + recommendations excludeKey tests | ✅ + ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `src/app/actions/__tests__/watches.test.ts` — disposal-field round-trip, future-date rejection, undo-nulling (LIFE-02/03)
- [ ] `src/lib/__tests__/celebrate.test.ts` — confetti wrapper + reduced-motion (LIFE-04)
- [ ] Extend `src/app/actions/__tests__/moveWishlistToCollection.test.ts` — promoted/promotedFrom shape; repoint `sold` rejection case (LIFE-04)
- [ ] Extend `src/components/profile/__tests__/CollectionTabContent.test.tsx` — toggle + owner gating (LIFE-05)
- [ ] Update/delete `tests/static/WatchCard.sold-badge.test.tsx` (dead component island)
- [ ] Update `tests/integration/phase37-rls.test.ts` — drop `recordDivestment` assertions, keep table-shape assertions
- [ ] Locate and extend comments-RLS integration coverage for the `previously_owned` policy update

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applies cleanly; sold rows → previously_owned + reason=sold | LIFE-01/02 | DB-touching; mocks don't execute SQL | Apply migration to local Supabase; run pre/post-flight SQL assertions |
| Card ⋯ menu → dialog → card leaves grid + toast | LIFE-03 | End-to-end UI against real DB | `npm run dev`, sign in as seeded user, dispose an owned watch |
| Confetti + celebratory toast on wishlist/grail → owned | LIFE-04 | Visual/animation | Promote via edit form and via add-flow "Move to collection" |
| Toggle reveals muted badged cards; visitor sees none + 404 on /w/[id] | LIFE-05/06 | Cross-user gating | Walk as owner and as a second seeded user |
| Home rail doesn't recommend a previously-owned model | LIFE-06 | Recommender output against seeded data | Dispose a watch; reload home |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
