---
phase: 50-watch-detail-architecture-spike
plan: "04"
subsystem: documentation
tags: [architecture, spike, watch-detail, recommendation, ship-now, url-canonicalization]

# Dependency graph
requires:
  - phase: 50-watch-detail-architecture-spike
    plan: "03"
    provides: "50-SPIKE.md §5 v7.0 Lens + §6 Decision Matrix — evidence base for §8 recommendation + §9 ship-now verdict"
provides:
  - 50-SPIKE.md §8 Recommendation — Variant B (URL canonicalization) named as primary verdict with evidence-cited rationale
  - 50-SPIKE.md §9 Ship-now Eligibility — Verdict YES; ARCH-02 trigger + Phase 50.1 named
  - Complete 50-SPIKE.md: all 9 D-SKEL-02 sections in order (1-9)
affects:
  - "REQUIREMENTS.md — ARCH-02 to be added via /gsd-phase --insert flow"
  - "Phase 50.1 implementation wave — triggered by ARCH-02 + Phase 50.1 /gsd-phase --insert"
  - "v7.0 Watch Photos milestone — inherits Variant B as the route architecture context for carousel placement"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "§8 Recommendation structure: primary verdict line (bolded, named variant) + 8.1 rationale (why this / why not others / what it solves / what it exposes) + Sub-recommendation omitted when no clear secondary exists"
    - "§9 Ship-now format: ROADMAP SC#4 verbatim blockquote + Primary recommendation eligibility subsection + Verdict line + Strongly favored / Cheap / Trigger blocks — mirrors 49-SPIKE.md §9 for v5.2 mid-milestone requirement-add flow"

key-files:
  created: []
  modified:
    - ".planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md"

key-decisions:
  - "Variant B (URL canonicalization) selected as primary recommendation — highest §6 matrix total (28), only variant scoring 5 on both cost criteria (entry-point disruption + migration cost), directly retires Phase 48 BUG-01 maintenance tax"
  - "Sub-recommendation omitted — no Phase 50 equivalent of Phase 49's unify-archetype-surface cheap standalone sub-action; Variant C is v7.0 target architecture, not a v5.2 sub-recommendation"
  - "§9 Ship-now Verdict: YES — Variant B clears both strongly-favored (matrix score 28, BUG-01 evidence) and cheap (1-2 files, zero migrations, zero entry-point rewrites) bars"
  - "ARCH-02 named as next requirement ID; Phase 50.1 named as implementation wave — mirrors Phase 49 → 49.1 precedent"
  - "Variant C identified as v7.0 target architecture in §8.1 rationale — sequential relationship: ship B in v5.2, revisit for C at v7.0 carousel implementation phase"

patterns-established:
  - "50-SPIKE.md §9 ship-now block is now the format template for future v5.2+ mid-milestone requirement-adds (alongside 49-SPIKE.md §9)"

requirements-completed: [ARCH-01]

# Metrics
duration: 8min
completed: 2026-05-20
---

# Phase 50 Plan 04: Watch-Detail Architecture Spike §8 + §9 Summary

**§8 Recommendation (Variant B — URL canonicalization, primary verdict with BUG-01 evidence) + §9 Ship-now Eligibility (Verdict YES, ARCH-02 trigger, Phase 50.1) appended; 50-SPIKE.md complete with all 9 D-SKEL-02 sections**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T17:40:09Z
- **Completed:** 2026-05-20T17:48:00Z
- **Tasks:** 2
- **Files modified:** 1 (50-SPIKE.md only — D-GUARD-01 enforcement)

## Accomplishments

### Task 1: §8 Recommendation

Appended `## 8. Recommendation` after §7's closing `---` separator. Structure:

**Primary verdict line (bolded):** `**Primary recommendation: Variant B — URL canonicalization**`

**§8.1 Rationale (4 paragraphs):**
1. **Why Variant B** — §6 matrix score 28 (3/4/4/3/5/5/4), highest total; only variant scoring 5 on both cost criteria; v7.0 lens (§5.B) is weaker than Variant C on carousel fit (3 vs 5) but cost differential is decisive for v5.2; BUG-01 maintenance tax retirement is the concrete production-bug evidence.
2. **Why not other variants** — Variant A (27): keeps framing flip intact, delta fully explained by per-user data shape score. Variant C (23): 1/1 cost scores (19 entry-point rewrites) — v7.0 target not v5.2 action. Variant D (23): 12 entry-point rewrites + open OtherOwnersRoster UI-SPEC decision. Variant E (21): UUID-dispatch fragility + 7 rewrites.
3. **What Variant B solves** — retires Phase 48 BUG-01 bug class in full by removing the in-route framing flip at `src/app/catalog/[catalogId]/page.tsx:107-115`; implementation is 1-2 files (`catalog/[catalogId]/page.tsx` + 1 test file); confirms all A-E variants preserve `getWatchByIdForViewer` two-layer privacy gate (`src/data/watches.ts:193`).
4. **What Variant B exposes for v6.0/v7.0** — v6.0 social (SEED-012): owner write surface cleanly on `/watch/[id]`; v7.0 (SEED-013): owner carousel has single render site but catalog route still needs read-only carousel — Variant C remains the v7.0 target; recommends `TODO: revisit for Variant C in v7.0` comment at Phase 50.1 implementation site.

**Sub-recommendation:** Omitted. No clear secondary winner meriting standalone v5.2 action. Variant C is v7.0 target; Variants D/E require entry-point rewrites and open UI-SPEC decisions.

### Task 2: §9 Ship-now Eligibility

Appended `## 9. Ship-now Eligibility` after §8's closing `---` separator. Verbatim format from `49-SPIKE.md` §9 (lines 429-463) with Phase 50 substitutions.

**Structure (mirrors 49-SPIKE.md §9 exactly):**
- ROADMAP SC#4 verbatim blockquote: "No consolidation or removal implementation is shipped in this phase unless the spike specifically flags it as cheap and strongly favored — in which case a new requirement is added mid-milestone"
- `---` separator
- `### Primary recommendation eligibility (Variant B — URL canonicalization)` subsection
- `**Verdict: YES**` line (downstream grep anchor preserved)
- `**Strongly favored:**` block — cites §6 scores 3/4/4/3/5/5/4; matrix leadership; BUG-01 live production evidence
- `**Cheap:**` block — 1-2 files, zero migrations, zero entry-point rewrites per §7; `watches_catalog` NOT-wipeable carve-out explicitly cleared (no catalog schema work in any A-E variant)
- `**Trigger:**` block — ARCH-02 named; `/gsd-phase --insert` Phase 50.1 verbatim

No sub-recommendation eligibility block (§8 omitted sub-recommendation).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Append §8 Recommendation — Variant B primary verdict | b42d5a0 | `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |
| 2 | Append §9 Ship-now Eligibility — Verdict YES, ARCH-02 trigger | 9fde0f6 | `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |

## Variant B Selection Evidence Summary

The following is the input the next `/gsd-discuss-phase` (or the immediate `/gsd-phase --insert` flow) would consume:

**Winner:** Variant B — URL canonicalization

**Matrix score:** 28 (3/4/4/3/5/5/4 across UX clarity / schema stability / per-user data shape / v7.0 carousel fit / entry-point disruption / migration cost / irreversibility)

**Ship-now verdict:** YES

**Trigger:** ARCH-02: URL canonicalization — redirect `/catalog/[catalogId]` to `/watch/[id]` at the page layer when the viewer owns the catalog ref, retiring the in-route D-08 framing flip and the Phase 48 BUG-01 maintenance tax. Add to REQUIREMENTS.md and `/gsd-phase --insert` Phase 50.1.

**Implementation scope (per §7):** 1-2 files (`src/app/catalog/[catalogId]/page.tsx` + 1 test file). Zero entry-point rewrites. Zero migrations. The implementation is a server-level `redirect()` from `next/navigation` — the correct Next.js 16 App Router page-layer canonicalization API.

**v7.0 trajectory note:** Variant C (unified `/w/[ref]`, score 23) is the correct long-term target architecture — single render site, single carousel composition, zero viewer-state duplication. The Variant B Phase 50.1 implementation should carry a `TODO: revisit for Variant C in v7.0` comment at the carousel composition site so the v7.0 milestone inherits an explicit decision anchor.

## Files Created/Modified

- `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` — §8 Recommendation + §9 Ship-now Eligibility appended; spike now complete with all 9 D-SKEL-02 sections

## Decisions Made

- Variant B selected as primary recommendation: matrix score 28 (highest), only variant scoring 5/5 on cost criteria, directly retires Phase 48 BUG-01 maintenance tax
- Sub-recommendation omitted: no cheap standalone secondary action exists for Phase 50 (unlike Phase 49's `unify-archetype-surface`)
- §9 Verdict YES: both strongly-favored and cheap bars cleared; ARCH-02 + Phase 50.1 named
- Variant C explicitly named as v7.0 target architecture in §8.1 to give future v7.0 planning an explicit decision anchor

## Deviations from Plan

None — plan executed exactly as written.

- §8 structure matches spec: bolded primary verdict line + 4-paragraph rationale + sub-recommendation omitted (per plan: "omit this subsection entirely — do NOT force a sub-recommendation for symmetry's sake")
- §9 format matches 49-SPIKE.md §9 verbatim: ROADMAP SC#4 blockquote + `**Verdict:**` + `**Strongly favored:**` + `**Cheap:**` + `**Trigger:**` block labels preserved exactly
- ARCH-02 named as next sequential requirement ID (ARCH-01 is the spike requirement)
- Phase 50.1 named as implementation wave (mirroring Phase 49 → Phase 49.1 precedent)
- `/gsd-phase --insert` invocation language verbatim in Trigger block
- No files outside `.planning/phases/50-watch-detail-architecture-spike/` modified — D-GUARD-01 confirmed

## Known Stubs

None. This plan produces documentation-only content (decision spike synthesis). No data stubs, no empty components, no placeholder text in the deliverable.

## Threat Flags

None. D-GUARD-01 enforcement confirmed — zero files outside `.planning/phases/50-watch-detail-architecture-spike/` modified. The §8 rationale explicitly confirms all five variants in A-E preserve the `getWatchByIdForViewer` two-layer privacy gate (`src/data/watches.ts:193`), satisfying the threat model requirement that the recommendation must not weaken the privacy gate.

---
*Phase: 50-watch-detail-architecture-spike*
*Completed: 2026-05-20*
