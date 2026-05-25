---
phase: 56
slug: like-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `56-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x + React Testing Library |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- LikeButton.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10–20 seconds (unit suite; jsdom) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- LikeButton.test.tsx` (targeted fast loop)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are assigned at plan time (`/gsd-plan-phase`). Until then this map is keyed by
> requirement + behavior. The planner/executor links each row to a concrete `{N}-PP-TT`
> task and the Nyquist auditor reconciles file existence.
> Precedent test file to mirror: `tests/components/profile/FollowButton.test.tsx`.

| Task ID | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-------------|----------|-----------|-------------------|-------------|--------|
| TBD | LIKE-01 | Watch-target `LikeButton` toggles liked state immediately (optimistic flip) on click | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-02 | Wear-target `LikeButton` toggles for authenticated viewer; anon (`viewerId=null`) click → `router.push('/login?next=...')`, no `toggleLikeAction` call | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-03 | Optimistic flip reflects before action resolves; `disabled`/`aria-busy` set during transition | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-03 | Server Action failure → rollback to pre-click `liked`/`count`; no error toast (`console.error` only) | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-04 | Count hidden when `count===0 && !liked`; shown when `liked || count>0` | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-04 | Count reconciles to server-confirmed `result.data.count`, not the local optimistic increment | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | SC#4 | Idempotent re-like (double-click) → `disabled={pending}` blocks the second fire; no error surfaced | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | LIKE-01/02 (a11y) | `aria-pressed={liked}`, `aria-busy={pending}`, `aria-label` toggles `Like`/`Unlike` | unit | `npm test -- LikeButton.test.tsx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/components/shared/LikeButton.test.tsx` — covers LIKE-01, LIKE-02, LIKE-03, LIKE-04, SC#4, a11y (mirror `FollowButton.test.tsx`: mock `toggleLikeAction` + `next/navigation`)
- [ ] `src/components/shared/` directory must exist (no files there yet — created by the LikeButton plan)

*Vitest is already installed and configured (`vitest.config.ts`) — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Overlay CSS chain renders on the **signed-photo** path (overlays at top + bottom edges, 4:5 aspect) | D-08 | Absolute-overlay + aspect-ratio/object-fit positioning is not observable in jsdom — needs a browser | `rm -rf .next && npm run dev`; visit `/wear/[id-with-photo]`; confirm avatar+timestamp top-left and brand/model bottom-left over a scrim |
| Overlay CSS chain renders on the **no-photo `bg-muted` fallback** path (overlays visible, NO centered brand/model text) | D-08 | Same jsdom limitation; the fallback is the Phase 30 regression surface ([[feedback_ui_spec_css_chain_blind_spot]]) | Visit a wear page whose photo failed / has no signed URL; confirm overlays render with `text-foreground` and the old centered `{brand} {model}` text is gone |
| All 4 `relative` callsites patched (and the L94 site not double-applied) | D-08 | Structural grep is the backstop for the "stop early" failure mode | `grep -n "aspect-\[4/5\]" src/components/wear/WearDetailHero.tsx src/components/wear/WearPhotoClient.tsx` — every matching container class string must begin with `relative ` |
| Cross-viewer cache isolation (viewer A's like not leaking to viewer B) | SEC-05 (carried from Phase 55) | True cross-request cache fan-out is observable only against a running app + cache layer | After deploy, like a target as A, load same target as B in a separate session; B must not see A's liked state. The `viewerId` arg keys the `'use cache'` entry — this is the runtime confirmation |

*The optimistic flip, rollback, count-hide, server-reconcile, anon bounce, and a11y attributes ARE automatable as unit assertions (see map). The rows above are the residual visual/runtime checks that jsdom cannot cover.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (1 test file + 1 new directory)
- [ ] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
