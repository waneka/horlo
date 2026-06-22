---
gsd_state_version: 1.0
milestone: v8.3
milestone_name: WYWT Video
status: planning
last_updated: "2026-06-22T22:03:31.565Z"
last_activity: 2026-06-22
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10 — v8.2 Discovery Freshness SHIPPED; see §Current State)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** v8.3 WYWT Video — extend WYWT posts with optional 3-second wrist-rotation video capture (SEED-020, Spike 001 VALIDATED). Either-or per post (one photo OR one video); static poster in feed/rail tiles tapping into full-frame autoplay-muted-loop view at `/wear/{id}`. v9.0 Catalog Expansion deferred per operator decision 2026-06-22.

## Current Position

Phase: 76 (next to start)
Plan: —
Status: Roadmap created; ready to plan Phase 76
Last activity: 2026-06-22 — Roadmap created (2 phases: 76 Schema/Storage/Server-Action, 77 Capture/Display UI)

## Deferred Items

Items acknowledged and deferred at v8.2 milestone close on 2026-06-09 (carries forward v8.1's list — SEED-017 dropped because it shipped THIS milestone; SEED-008/012/013/015/016 re-classification still pending separately):

| Category | Item | Status |
|----------|------|--------|
| debug | knowledge-base | unknown |
| debug | mobile-title-above-fold | diagnosed |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | missing |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | missing |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | missing |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | missing |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | missing |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | missing |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | missing |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | missing |
| quick_task | 260530-e55-srch-03-followup-popup-stay-open-fix | missing |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant |
| seed | SEED-002-hybrid-recommender | dormant (v8.2 SEED-017 was its lightweight precursor; still dormant as a future paid-feature candidate per `project_monetization_stance_2026_05_06`) |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant (v5.0 shipped) |
| seed | SEED-005-v6-market-value | dormant (next post-v9.0 candidate; needs SEED-007 spike first) |
| seed | SEED-007-market-pricing-api-spike | dormant (precursor to SEED-005) |
| seed | SEED-008-v5.1-explore-redesign | active — flagged for re-classification (v5.1 shipped) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant — flagged for re-classification (v8.0 shipped this) |
| seed | SEED-012-v6.0-social-interaction | active — flagged for re-classification (v6.0 shipped) |
| seed | SEED-013-v7.0-watch-photos | dormant — flagged for re-classification (v7.0 shipped) |
| seed | SEED-014-cache-components-canonical-sweep | dormant — still future work; v7.0 Phase 61 + Phase 52 only covered specific routes |
| seed | SEED-015-inline-grid-engagement | dormant — flagged for re-classification (v7.0 Phase 63 shipped) |
| seed | SEED-016-watch-detail-redesign | dormant — flagged for re-classification (v7.0 Phase 64 shipped) |

Total: 27 items (2 debug + 11 quick_task + 14 seed). SEED-017 (recommendations-freshness) is the one v8.2 just shipped — marked `status: shipped, shipped_in: v8.2` in `.planning/seeds/SEED-017-recommendations-freshness.md` and excluded from this list. The 14 seeds represent the forward roadmap + re-classification backlog, not operational debt; SEED-001/002/003/005/007/014 are genuine future work; SEED-008/010/012/013/015/016 are already shipped and need their seed-file `status:` field flipped to `shipped:`. Quick tasks are long-tail backlog (oldest from April 2026) consistent with the `project_next_clear_operational_debt` pattern across v6.0 / v7.0 / v8.0 / v8.1 closes.

## Performance Metrics

- v8.2: 1 phase (75), 2 plans, ~2h code, 14 commits, 2/2 reqs (close held 10 days for DISC-RECS-VARIATION rotation observation)
- v8.1: 3 phases (72-74), 5 plans, 1 day, 47 commits, 6/6 reqs (all bundled prod UAT items passed)
- v8.0: 6 phases (66-71), 22 plans, 2 days, 150 commits, 39/39 reqs
- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

**v8.3 WYWT Video — locked decisions from SEED-020 + Spike 001:**

- **D-01 (SEED-020)**: Wrist-rotation is linear motion — NOT a boomerang. Accept a visible loop snap on `/wear/{id}` autoplay-muted-loop; no ping-pong post-processing.
- **D-02 (SEED-020)**: Static poster + play-icon overlay in all feed/rail surfaces; tap navigates to `/wear/{id}` which autoplays inline. No in-feed autoplay.
- **D-03 (SEED-020)**: Either-or per post — `media_type: 'photo' | 'video'` column on `wear_events`; never both.
- **D-04 (SEED-020)**: Hard 3-second cap; auto-stop via `setTimeout(stop, 3000)` client-side + ~5 MB server-side size cap.
- **D-05 (SEED-020)**: Audio disabled — `MediaRecorder` configured with `audio: false`.
- **D-06 (SEED-020)**: WYWT-only in v8.3; watch-detail-page carousel (`/w/[ref]`) stays photo-only.
- **D-07 (SEED-020)**: Storage paths: `{userId}/{wearEventId}.mp4` + `{userId}/{wearEventId}-poster.jpg` in existing `wear-photos` bucket. Server constructs paths — client never supplies them (Phase 15 T-15-17 pattern).
- **D-08 (SEED-020 + Spike 001)**: Poster frame default = `currentTime = video.duration * 0.75` (3/4 through clip = "completed angle" moment for wrist rotation). User-pick scrubber deferred to v2.
- **D-09 (SEED-020 + Spike 001)**: Codec = H.264 mp4 (`video/mp4;codecs=avc1`). Force mp4 on Chrome 121+ via mimeType; webm fallback only if mp4 MediaRecorder unsupported. Storage extension `.mp4` always.
- **Spike 001 empirical results**: iOS 26.6 Safari — `mp4+avc1: true`; clip = `video/mp4; codecs=avc1.42000a` (Baseline Profile L1.0); auto-stop at 3010ms (10ms overshoot — within tolerance); poster canvas JPEG = 169KB at 720×1280; file size = 3.6 MB for 3s 720p portrait; autoplay-muted-loop+playsInline confirmed inline (no fullscreen takeover).
- **`playsInline` is mandatory**: MUST be set on every `<video>` rendering wear-event videos — in feed/rail tiles AND on `/wear/{id}` — or iOS goes fullscreen on play.
- **Phase 76 is DB-touching**: `workflow.use_worktrees=false` already set globally (per `project_next_clear_operational_debt`); applies here. Migration uses `supabase db push --linked` for prod (per `project_drizzle_supabase_db_mismatch`).
- **Phase 15 threat-model analogs**: T-15-04 (probe both Storage objects before INSERT) → VID-08; T-15-17 (server-constructed path only) → VID-16; T-15-18 (best-effort delete on INSERT failure) → VID-10.
- **Spike cleanup**: `src/app/spike-mr-capture/` must be deleted in Phase 77 (or earlier — throwaway code per Spike 001 README cleanup instructions).

### Pending Todos

None.

### Blockers/Concerns

None.

## Quick Tasks Completed

(carried forward from v8.1 close; v8.2 added no quick tasks. Phase 75 P01/P02 entries removed — they were standard plan execution, not ad-hoc quick tasks, and the CLI mis-categorized them.)

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |
| 260620-gk9 | Backfill 18 prod `watches_catalog.image_url` rows + delete rogue test/test row (now 0/193 missing) | daf3e03c, b8b2af2d | 2026-06-20 |
| 260620-lbn | SEED-018 surgical slice: "Add from URL" affordance + admin-gated catalog-only save path | b1c20ddd, 9e0ee504 | 2026-06-20 |
| 260622-exo | Fix wear-event duplicate-day false positive across UTC midnight — thread client `today` into markAsWorn + logWearWithPhoto Server Actions | 25708a84, edf204f6 | 2026-06-22 |

## Session Continuity

Last activity: 2026-06-22 — Roadmap created for v8.3 WYWT Video. 2 phases defined (76: Schema/Storage/Server Action, 77: Capture/Display UI). 16/16 VID-NN requirements mapped. REQUIREMENTS.md traceability filled. STATE.md total_phases set to 2.

Next action: `/gsd-plan-phase 76` to plan Phase 76 (Video Schema, Storage Paths + Server Action — DB-touching phase; run with use_worktrees=false which is already the global default).

## Operator Next Steps

- Plan Phase 76 with /gsd-plan-phase 76
