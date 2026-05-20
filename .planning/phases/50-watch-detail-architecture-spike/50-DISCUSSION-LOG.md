# Phase 50: Watch-Detail Architecture Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 50-watch-detail-architecture-spike
**Areas discussed:** Audience matrix accuracy, Merge variant breadth, v7.0 Watch Photos lens depth, SPIKE.md skeleton + ship-now check

---

## Audience matrix accuracy

| Option | Description | Selected |
|--------|-------------|----------|
| Re-frame as viewer-state × ref-identity matrix | Spike opens by explicitly correcting the ROADMAP framing — builds a 2D matrix of viewer-state (owner / non-owner-with-collection / non-owner-empty / wishlist-holder / sold-this) × ref-identity (per-user watches.id / catalog watches_catalog.id). Each cell describes the framing + UI shape today. Anonymous-visitor flagged as a 5th cell 'not reachable today (auth-gated)' for v6.0/v7.0 readers. | ✓ |
| Keep ROADMAP framing verbatim | Treat 'owner / wishlist-holder / anonymous / cross-user' as the audience axis as written; for each label, describe which route serves it and how. Faster; risks spike conclusion sitting on top of a frame that doesn't match code reality. | |
| Re-frame AND quantify with route-reachability evidence | Same as Option 1, plus a 'reachability proof' subsection naming the actual code path that reaches each cell. Heavier write; gives planner a callsite map for free. | |

**User's choice:** Re-frame as viewer-state × ref-identity matrix
**Notes:** Locked as D-AUDIENCE-01. Discoveries that drove the re-frame: `/watch/[id]` already serves cross-user via `getWatchByIdForViewer` (line 58: `framing: isOwner ? 'same-user' : 'cross-user'`); neither route is reachable anonymously today (both require auth); "wishlist-holder" is a viewer-state slice, not a routing axis. The ROADMAP labels mix two different axes.

---

## Merge variant breadth

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 variants (A–E) | Same breadth as Phase 49. Each scored on UX clarity, schema/URL stability, per-user data shape, v7.0 photo carousel fit, entry-point disruption, migration cost, irreversibility. Forces the spike to weigh URL stability (D and E both break inbound links) against UI simplicity. Most likely to surface a non-obvious winner. | ✓ |
| Trim to 3 — A (keep), B (canonicalize), and one merge variant | Score A vs B vs whichever of C/D/E reads as cleanest after a first-pass cost estimate. Faster spike; risks missing the non-obvious winner the way scoring 'all 5' caught it for Phase 49. | |
| Binary — A (keep) vs one chosen merge variant | Pick one merge variant up front based on a quick gut-check, then weigh keep-vs-merge as a 2-option matrix. Fastest; weakest evidence base. | |
| All 5 — PLUS a 6th 'UI-only merge, keep both URLs' variant | Same as Option 1, plus an explicit variant that keeps both URLs but factors more shared rendering into a single component tree. Useful if the cost of touching entry points is the main blocker. | |

**User's choice:** All 5 variants (A–E)
**Notes:** Locked as D-VARIANTS-01 (variants) and D-VARIANTS-02 (scoring criteria). Variants defined inline in CONTEXT.md: A keep-separate, B URL-canonicalization (307 to /watch when owned), C single-unified-route /w/[ref], D absorb /watch into /catalog, E absorb /catalog into /watch. Scoring criteria locked from option description.

---

## v7.0 Watch Photos lens depth

| Option | Description | Selected |
|--------|-------------|----------|
| Deep — per-variant sketch of photos + wear-pic surfacing | For each of variants A–E, the spike sketches: (1) where the carousel renders, (2) the data joins for catalog photos + owner wear-pics + other-owners' public wear-pics, (3) the writability axis, (4) Variant × Viewer-State cell interaction. v7.0 milestone inherits an architecture decision, not a re-decision. | ✓ |
| Medium — single 'v7.0 implications' section per variant | For each variant, one paragraph naming the data joins + writability axis under v7.0. No per-cell sketch. Faster; v7.0 may need a second mini-spike to lock per-cell behavior. | |
| Light — single 'v7.0 lens' section at the end | One section that lists v7.0 implications generically. Variants share the same v7.0 paragraph. Risks SC#2 reading as box-checked rather than substantively considered. | |

**User's choice:** Deep — per-variant sketch
**Notes:** Locked as D-V7-LENS-01. Spike does NOT pre-decide SEED-013's own open questions (per-person cap, opt-in/opt-out, ordering, storage bucket strategy) — those stay open for the v7.0 discuss step.

---

## SPIKE.md skeleton + ship-now check

| Option | Description | Selected |
|--------|-------------|----------|
| Lock all 9 sections + Phase 49 ship-now format | Skeleton is mandatory; section ordering is the planner's call. Ship-now eligibility uses the same YES/NO/NEEDS-DISCUSSION verdict + 'cheap AND strongly favored' gate Phase 49 used — verbatim, so the v5.2 mid-milestone requirement-add flow plugs in cleanly. | ✓ |
| Lock all 9 sections; ship-now format left to planner | Skeleton is mandatory; planner decides ship-now format. Risk: a different format breaks symmetry with Phase 49's escape-hatch flow. | |
| Lock the skeleton + add a 10th 'Anti-Patterns to Avoid' section | Same as Option 1, plus an explicit anti-patterns section: things the recommendation must NOT do. Heavier write; gives executor concrete guard-rails. | |
| Lock 9 sections + drop the Cost Estimate (move into Variants) | Fold cost estimate into each variant's subsection so cost lives next to the variant. Reads more linearly; cost numbers no longer comparable side-by-side. | |

**User's choice:** Lock all 9 sections + Phase 49 ship-now format
**Notes:** Locked as D-SKEL-01 and D-SKEL-02. Cost Estimate stays as its own Section 7 (not folded into Variants) explicitly so cost numbers stay comparable side-by-side. Phase 49's `49-SPIKE.md` ship-now section is the verbatim format reference.

---

## Claude's Discretion

- Exact ordering of sections within `50-SPIKE.md` (skeleton in D-SKEL-02 is mandatory; sequencing is the planner's call).
- Format of the Decision Matrix (numeric scores vs ✓/✗ vs prose) — planner picks whatever reads clearest.
- Whether the v7.0 per-variant sketches live as Section 5 or interleaved with each Variant subsection in Section 4. D-V7-LENS-01 mandates depth, not location.
- Whether the cost estimate distinguishes "data-migration cost" from "code-change cost." Recommended if any variant touches the schema.
- Whether to query prod for any evidence (e.g. how many catalog rows the user currently owns). Optional; this is a route/UI architecture spike not a data spike.

## Deferred Ideas

- Any merge/canonicalization implementation in this phase (explicitly forbidden by ROADMAP SC#4)
- v7.0 photo data model (multi-photo schema, public/private wear-pic policy, per-person cap, ordering, storage bucket strategy)
- v6.0 social layer interaction (likes/comments wiring on the merged surface)
- Auth-gating relaxation (making either route reachable to anonymous visitors)
- Entry-point reshuffle (part of the resulting implementation phase if D or E win, not this spike)
