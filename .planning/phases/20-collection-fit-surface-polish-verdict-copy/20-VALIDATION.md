---
phase: 20
slug: collection-fit-surface-polish-verdict-copy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `20-RESEARCH.md` § "Validation Architecture". Filled by gsd-planner during plan creation; re-verified by gsd-plan-checker.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (verified in research — Phase 19 setup carries over) |
| **Config file** | `vitest.config.ts` + `vitest.setup.ts` (per RESEARCH.md) |
| **Quick run command** | `npx vitest run --reporter=basic` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~{TBD by planner — composer + aggregate functions are pure, expect <5s for unit, <30s for full} |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=basic`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30s

---

## Per-Task Verification Map

> Filled by gsd-planner during plan creation. Each PLAN.md task with an `<automated>` verify command must have a corresponding row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | FIT-XX      | —          | —               | unit      | `npx vitest run --reporter=basic <file>` | ❌ W0      | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test stubs and fixtures that must exist before per-task automated verifies can be written. Inventory comes from RESEARCH.md.

- [ ] `src/lib/verdict/composer.test.ts` — composer determinism + roadmap-example template hits + null-tolerance
- [ ] `src/lib/verdict/aggregate.test.ts` — viewer aggregate taste profile pure function + NULL skip semantics
- [ ] `src/lib/verdict/shims.test.ts` — `catalogEntryToSimilarityInput` mapper coverage
- [ ] `src/lib/verdict/confidence.test.ts` — Phase 19.1 D-14 gating thresholds (0.5 / 0.7) for fallback / hedged / contextual
- [ ] `src/components/insights/CollectionFitCard.test.tsx` — pure-renderer invariant (no `analyzeSimilarity`/composer imports), framing branches (same-user, cross-user, self-via-cross-user)
- [ ] `src/app/api/_actions/getVerdictForCatalogWatch.test.ts` (or co-located) — Server Action auth, viewer-empty-collection branch (D-07), viewer-owns-watch branch (D-08)
- [ ] `src/components/search/WatchSearchRow.test.tsx` (extend existing if present) — accordion one-at-a-time + ESC + keyboard nav
- [ ] `vitest.setup.ts` — confirm shared fixtures cover Phase 20 surfaces (mock catalog rows with NULL taste columns; mock empty-collection viewer)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdict copy reads naturally | FIT-02 | Subjective tone — automated check verifies template hit, not tone | Click 5 catalog rows in `/search?tab=watches` covering `core fit / role duplicate / hard mismatch / partial overlap / heritage echo`. Confirm contextual phrasings sound like the four roadmap examples and don't read as templated noise. |
| Accordion expand animation feels right | FIT-04 | Visual smoothness | Manually expand/collapse rows in `/search?tab=watches`. Confirm transition (per Claude's Discretion choice) is consistent with rest of app. |
| Cross-user `/watch/[id]` empty-collection layout | FIT-03 / D-07 | Layout regression risk when card is hidden | Sign in as a viewer with 0 watches, navigate to `/u/{otherUser}/collection` → click a watch. Confirm CollectionFitCard is absent and surrounding sections (specs, photos) reflow correctly. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
