---
phase: 62
slug: public-wear-pics-on-watch-detail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (jsdom default) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/unit/ -x` |
| **Full suite command** | `npx vitest run && npm run build` |
| **Estimated runtime** | ~30–60 seconds (unit) + build |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/ -x`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd-verify-work`:** `npm run build` exits 0 (authoritative gate — MEMORY `project_baseline_not_green_build_is_gate`)
- **Max feedback latency:** ~60 seconds (unit); build adds ~1–2 min

---

## Per-Task Verification Map

> Populated during planning/execution as task IDs are assigned. Seed mapping below derived from RESEARCH.md Validation Architecture.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WPIC-01 | Public wear pic appears in carousel union | unit (DAL) | `npx vitest run tests/unit/getPublicWearPicsForWatch.test.ts -x` | ❌ W0 | ⬜ pending |
| WPIC-05 | Non-public (followers/private) wear pic NOT in union result | unit (DAL) | `npx vitest run tests/unit/getPublicWearPicsForWatch.test.ts -x` | ❌ W0 | ⬜ pending |
| WPIC-02 | Owner hide sets `hidden_from_detail=true`; pic excluded from subsequent union | unit (DAL + action) | `npx vitest run tests/unit/hideWearPic.test.ts -x` | ❌ W0 | ⬜ pending |
| WPIC-02 | Un-hide restores wear pic to the union | unit (DAL) | `npx vitest run tests/unit/hideWearPic.test.ts -x` | ❌ W0 | ⬜ pending |
| WPIC-03 | WornTimeline/WornCalendar prefer `event.photoUrl` over `watch.imageUrl` | unit (component) | `npx vitest run tests/unit/WornTimeline.test.tsx -x` | ❌ W0 | ⬜ pending |
| WPIC-04 | `getWearRailForViewer` WHERE clause + 48h window unchanged | unit (DAL) | `npx vitest run tests/unit/wearRail.test.ts -x` | ❌ W0 | ⬜ pending |
| WPIC-06 | Like + comment layer renders on a wear-pic slide | integration/visual | prod human UAT (mobile behavior) | human_needed | ⬜ pending |
| (gate) | `npm run build` exits 0 | build | `npm run build` | ✅ existing | ⬜ pending |
| (gate) | Static link guard — no legacy watch/catalog routes | static | `npm run build` (prebuild vitest) | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/getPublicWearPicsForWatch.test.ts` — WPIC-01 + WPIC-05 (public filter + `hidden_from_detail` exclusion + non-public never returned)
- [ ] `tests/unit/hideWearPic.test.ts` — WPIC-02 (hide/unhide action + DAL re-query, ownership re-check)
- [ ] `tests/unit/WornTimeline.test.tsx` — WPIC-03 (`photoUrl` preferred over `imageUrl`, catalog fallback when absent)
- [ ] `tests/unit/wearRail.test.ts` — WPIC-04 (assert `getWearRailForViewer` predicate + 48h window unchanged — guardrail regression)
- [x] `tests/shims/server-only.ts` — already exists (vitest alias)

---

## Manual-Only Verifications

> Mobile/touch behavior verifies on **prod** (Vercel), not locally — empty test DB skips e2e (MEMORY `feedback_mobile_ui_verify_on_prod`). Classify `human_needed`, build-gate, bundle into one deploy.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swipe between owner slides and wear-pic slides | WPIC-01 | embla swipe is touch-only; e2e skips on empty DB | On prod, open a `/w/[ref]` for a watch with public wear pics; swipe through carousel — owner uploads first, then wear pics newest-first |
| Eye/hide toggle in Edit mode | WPIC-02 | owner-gated touch interaction | As owner, enter "Edit photos"; tap eye on a wear-pic thumbnail → it greys/"Hidden"; reload → still hidden in carousel but present in Wears tab; toggle back |
| Bottom-sheet wear-pic comment thread | WPIC-06 | sheet open/swipe-dismiss is touch behavior | Tap comment count on a wear-pic slide → sheet opens with that pic's thread; post + dismiss returns to carousel |
| "Worn · [date]" badge renders without hydration flash | WPIC-01 (D-07) | React #418 hydration is prod-cache-fill dependent | On prod after cache fills, confirm badge shows correct UTC date, no flash/mismatch |
| Non-public wear pic never surfaces for any viewer | WPIC-05 | requires a 2nd (non-owner) account | View target watch detail as a non-owner; confirm only public, non-hidden wear pics appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
