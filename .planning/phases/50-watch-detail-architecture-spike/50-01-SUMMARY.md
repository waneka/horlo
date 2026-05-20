---
phase: 50-watch-detail-architecture-spike
plan: "01"
subsystem: documentation
tags: [architecture, spike, watch-detail, route-analysis, audience-matrix]

# Dependency graph
requires:
  - phase: 48-user-facing-bug-fixes
    provides: BUG-01 fix (findViewerWatchByCatalogId status='owned' scope) — cited as maintenance-tax evidence in §3.3
  - phase: 49-genre-vs-style-taxonomy-spike
    provides: 49-SPIKE.md structural pattern (frontmatter shape, voice, section format) mirrored by 50-SPIKE.md
provides:
  - 50-SPIKE.md §1 Domain — restates ARCH-01, 5 variant names A-E, D-GUARD-01 guardrail, ROADMAP SC#4 verbatim
  - 50-SPIKE.md §2 Audience Matrix — viewer-state × ref-identity 2D matrix per D-AUDIENCE-01; anonymous-visitor cell flagged forward-compat
  - 50-SPIKE.md §3 Route Reality Today — what each route does; 7 catalog + 12 watch entry points with file:line; BUG-01 maintenance-tax evidence; truncation framed as by-design
affects:
  - "50-02-PLAN.md — §4 Variants A-E, §5 v7.0 Lens, §6 Decision Matrix, §7 Cost Estimate append against the §2 viewer-state cells and §3 entry-point counts"
  - "50-03-PLAN.md and 50-04-PLAN.md — §8 Recommendation + §9 Ship-Now reference §2 matrix for per-viewer-state merge impact"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "viewer-state × ref-identity 2D matrix as the audience analysis frame for route architecture spikes"
    - "anonymous-visitor forward-compat cell pattern for auth-gated routes"

key-files:
  created:
    - ".planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md"
  modified: []

key-decisions:
  - "D-AUDIENCE-01 matrix confirms /watch/[id] is NOT owner-only — getWatchByIdForViewer serves cross-user viewers via framing dispatch at src/app/watch/[id]/page.tsx:58"
  - "Anonymous-visitor cell is forward-compat placeholder only — not reachable today due to getCurrentUser() auth gate; no route changes implied"
  - "Phase 48 BUG-01 (wishlist mislabeled as owned on /catalog/[catalogId]) is the load-bearing maintenance-tax evidence for the merge case — any variant retiring the in-route D-08 framing flip retires this bug class"
  - "Routes split on ref-identity (watches.id vs watches_catalog.id), NOT on viewer audience — the ROADMAP SC#1 mixed-axis framing is inaccurate at the code level"

patterns-established:
  - "Spike §2 Audience Matrix: rows = viewer-state, columns = ref-identity; each cell cites file:line for the code path served"
  - "Plan 02 append point: add ## 4. Variants A-E after the trailing --- in 50-SPIKE.md"

requirements-completed: [ARCH-01]

# Metrics
duration: 2min
completed: 2026-05-20
---

# Phase 50 Plan 01: Watch-Detail Architecture Spike §1-3 Summary

**Viewer-state × ref-identity 2D matrix (§2) and 19-entry-point route map (§3) establishing the framing scaffold for Plans 02-04 of the watch-detail architecture spike**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-20T17:18:25Z
- **Completed:** 2026-05-20T17:21:15Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `50-SPIKE.md` with frontmatter mirroring `49-SPIKE.md` (phase, plan range, date, author, requirement: ARCH-01) per D-SKEL-01
- §1 Domain restates ARCH-01 question, names all 5 variants A-E per D-VARIANTS-01, cites D-GUARD-01 hard guardrail, quotes ROADMAP SC#4 verbatim
- §2 Audience Matrix uses viewer-state × ref-identity 2D matrix per D-AUDIENCE-01 (NOT ROADMAP SC#1 labels); anonymous-visitor row explicitly flagged "not reachable today (auth-gated)" as forward-compat placeholder; corrects the implicit ROADMAP assumption that `/watch/[id]` is owner-only
- §3 Route Reality Today describes both routes with grep-verifiable file:line citations; enumerates 7 `/catalog/[catalogId]` entry points and 12 `/watch/[id]` entry points; names Phase 48 BUG-01 explicitly as the maintenance-tax evidence for the in-route framing flip; frames truncation as by-design asymmetry per REQUIREMENTS line 48

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Scaffold 50-SPIKE.md + write §1 Domain + §2 Audience Matrix + §3 Route Reality Today** - `88c8fb5` (docs)

**Plan metadata:** (to be committed with this SUMMARY.md)

## Files Created/Modified

- `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` — Created; contains frontmatter + §1 Domain + §2 Audience Matrix + §3 Route Reality Today; 113 lines; Plan 02 appends §4+ after the trailing `---`

## Decisions Made

- Both tasks combined into one atomic commit because they both write to the same file (`50-SPIKE.md`) and §3 appends to §1-2 — splitting would have required two separate commits to the same file with Task 2 being a pure append, which is still a clean atomic operation but adds commit noise without meaningful isolation benefit.
- Tables in §3.2 use `file:line` inline format (e.g., `src/components/search/WatchSearchRow.tsx:31`) rather than separate File | Line columns to satisfy the grep-verifiable citations requirement (`src/components/.*/\.tsx:[0-9]+` pattern).

## Deviations from Plan

None — plan executed exactly as written. The only structural deviation is that Tasks 1 and 2 were committed together rather than separately, since both write to the same file and the combined commit is cleaner. Both tasks' done criteria are fully satisfied in the single commit.

## Known Stubs

The `anonymous-visitor` cell in §2's Audience Matrix contains the text "Forward-compat placeholder for v6.0 social / v7.0 photo readers." This is intentional per D-AUDIENCE-01 (locked decision), not a data stub — the cell must exist as a forward-compat marker precisely because the anonymous-visitor viewer-state is auth-gated today. Plans 02-04 will not wire any data to this cell; it documents the gap that v6.0/v7.0 will address.

## Issues Encountered

Entry-point citations initially used a two-column `File | Line(s)` table format that failed the `src/components/.*/\.tsx:[0-9]+` grep check (file and line were in separate columns). Fixed by converting to `File:Line | Surface` single-column format before committing — the `file:line` co-location is required for grep-verifiability per plan `must_haves.truths`.

## Threat Flags

None. This plan writes only to `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md`. No new network endpoints, auth paths, file access patterns, or schema changes introduced. D-GUARD-01 enforcement confirmed via post-commit check: zero files outside `.planning/` modified.

## Next Phase Readiness

- `50-SPIKE.md` now has §1-3 complete with the section separator `---` after §3 signaling Plan 02's append point
- Plan 02 (`50-02-PLAN.md`) should append `## 4. Variants A-E`, `## 5. v7.0 Watch Photos Lens`, `## 6. Decision Matrix`, `## 7. Cost Estimate per Variant` after the trailing `---`
- §2 viewer-state cells (owner, non-owner-with-collection, non-owner-empty-collection, wishlist-holder, sold-this, anonymous-visitor) and §3 entry-point counts (12 + 7) are the load-bearing references Plans 02-04 cite
- No blockers

---
*Phase: 50-watch-detail-architecture-spike*
*Completed: 2026-05-20*
