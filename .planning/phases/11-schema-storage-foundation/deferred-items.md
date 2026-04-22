# Phase 11 Deferred Items

## Pre-existing Test Failures (out of Phase 11 scope)

Discovered during Plan 05 full-suite regression check. Confirmed pre-existing via git stash.

| File | Failures | Root cause suspected |
|------|----------|----------------------|
| tests/data/getFeedForUser.test.ts | 11/19 | Phase 10 feed DAL — likely needs specific DB state from Phase 10 full reset |
| tests/data/getWearRailForViewer.test.ts | ~2 | Phase 10 WYWT DAL |
| tests/data/getSuggestedCollectors.test.ts | ~1 | Phase 9 collector suggestions |
| tests/data/getRecommendationsForViewer.test.ts | ~1 | Phase 9 recommendations |
| tests/data/getWatchByIdForViewer.test.ts | ~1 | Phase 10 watch detail viewer |

These failures are NOT caused by Phase 11 migrations. They existed at the same commit before and after the Phase 11 schema push. Do not fix in Phase 11. Surface to next planning session.
