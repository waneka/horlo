---
title: WYWT Video supersedes v9.0 Catalog Expansion as next priority
date: 2026-06-22
context: /gsd-explore session 2026-06-22 — operator stated "this is the next priority, i'd like to implement it asap"
related: [seed SEED-020-wywt-video-3s, seed SEED-009-v5.2-catalog-expansion (deferred), .planning/STATE.md]
---

# WYWT Video supersedes v9.0 Catalog Expansion

## Decision

On 2026-06-22, during a `/gsd-explore` session, the operator reprioritized the upcoming milestone trajectory:

- **Was:** `Between milestones (v8.2 archived)` → **next:** `v9.0 Catalog Expansion (SEED-009)`
- **Now:** `Between milestones` → **next:** **WYWT 3-Second Video Capture (SEED-020)** → v9.0 Catalog Expansion deferred to follow

## Why this matters for future sessions

1. `STATE.md`'s "Operator Next Steps" still says "Start the next milestone with `/gsd-new-milestone`" with v9.0 Catalog Expansion implied — that implication is now wrong.
2. `MEMORY.md` references the v8.1 → v9.0 trajectory (`project_v8_1_complete.md`). That memory should be updated when the new milestone kicks off.
3. SEED-009 stays planted with `status: active` but is no longer the next-up. SEED-020 is.

## Routing for the new priority

- Spike iOS MediaRecorder feasibility first (1-day timebox; throwaway code).
- If the spike passes, kick off a new milestone or single phase using SEED-020 as the input artifact.
- v9.0 Catalog Expansion follows.

## Pre-kickoff housekeeping still applies

The seed-status mis-classification noted in `STATE.md` (6 already-shipped seeds with stale `status: active`) still needs cleanup before the next `/gsd-new-milestone` runs `phases.clear --confirm`. Already a known recurrence per `feedback_milestone_close_phase_dir_archival_miss`.
