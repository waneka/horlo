---
phase: 56A
slug: wear-view-unification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 56A — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `56A-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.x (unit/integration) + Playwright 1.60.x (e2e) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e` |
| **Estimated runtime** | ~30–90 seconds (unit), e2e variable |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green (`npm run test && npm run test:e2e`)
- **Max feedback latency:** ~90 seconds (unit) before relying on a green signal

---

## Per-Task Verification Map

> Filled in during execution Wave 0 once PLAN.md task IDs are finalized. Mapped from the
> success-criteria / decision behaviors below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC-1 | — | auth-only route; tile tap → real `/wears/[username]` nav | e2e | `npm run test:e2e -- --grep "wears-lane"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2 | — | full-screen, no nav chrome, viewport-fit on mobile | e2e | `npm run test:e2e -- --grep "wears-lane"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-3 | — | `/wear/[id]` nav retained, scrollable, shared card | e2e | `npm run test:e2e -- --grep "wear-detail"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-4 | — | WearCard / LikeButton / comment host single-source | unit | `npm run test -- WearCard` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-5 | — | legacy WywtOverlay/WywtSlide removed; no URL-frozen path | e2e | `npm run test:e2e -- --grep "wears-lane"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-07 | — | 0 active wears → `redirect('/u/[username]')` | integration | `npm run test -- getActiveWearsForUser` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-09 | — | wishlist action hidden: own wear / owned / wishlisted | unit | `npm run test -- WearCard` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | F-2 | — | signed wear-photo URLs minted per-request, never cached | unit | `npm run test -- getActiveWearsForUser` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase56a-wears-lane.test.ts` — covers SC-1, D-07, SC-5
- [ ] `tests/components/wear/WearCard.test.tsx` — covers SC-4, D-09
- [ ] `tests/e2e/wears-lane.test.ts` — covers SC-1, SC-2, SC-3 via Playwright
- [ ] `getActiveWearsForUser` unit/integration test — covers D-07, F-2 (signed-URL freshness mock assertion)

*No new framework install needed — vitest + playwright already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom-sheet comment host pauses swipe + handles keyboard over photo | SC-2 / D-10 / D-11 | Touch-gesture + soft-keyboard interaction is impractical to assert reliably in headless e2e | On a real mobile device: open `/wears/[username]`, open the comment trigger → sheet slides up over photo, swipe is disabled while open, closing restores swipe |
| Full-screen viewport-fit (no page scroll) on real device | SC-2 | Viewport/safe-area behavior differs from headless Playwright viewport | Open `/wears/[username]` on a phone; confirm no page scroll and nav chrome absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
