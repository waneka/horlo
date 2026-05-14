---
phase: 40
slug: search-verdict-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in by the planner. Each task that delivers verifiable behavior gets a row with the chosen test command, requirement, and threat ref.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Planner adds any new test file stubs or fixtures the phase needs. The Phase 40 RESEARCH.md Validation Architecture section identifies these candidates:
> - `tests/static/search-dal.movement-type.test.ts` (new) — assert DAL query references `movement_type` (ROADMAP SC#4)
> - `tests/unit/lib/verdict/fit-delta.test.ts` (new) — pure helper, exercises 5-step algorithm
> - `tests/static/CollectionFitCard.no-engine.test.ts` (existing) — must remain green

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom-sheet open/close on mobile + URL share-link round-trip | SRCH-16 | Visual UX, share-link clipboard | Open `/search`, type `sub`, open Filter sheet, tap Movement=auto + Style=tool, copy URL, open in new tab — facets restored, results match |
| FIT-05 drill-down render on viewer with collection ≥ 1 + confidence ≥ 0.5 on both sides | FIT-05 | End-to-end verdict pipeline with real catalog taste | Sign in as twwaneka@gmail.com, navigate to `/search`, type Sub, expand a verdict row — Compare with the {Brand Model} you own section visible with 6 rows + delta phrase |
| FIT-05 hides cleanly when either side has null/low-confidence catalogTaste | FIT-05 D-15 | Module-absent-not-empty visual check | Find a watch where `catalogTaste IS NULL` in DB, search it — drill-down section does not render; rest of CollectionFitCard renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
