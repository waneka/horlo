---
phase: 85
slug: collection-lifecycle
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-13
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (jsdom default; `// @vitest-environment node` for fs-walking static guards) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <touched test file>` |
| **Full suite command** | `npm run test` + `npm run build` (build is the authoritative gate — baseline suites carry pre-existing failures) |
| **Estimated runtime** | ~5–20 seconds targeted; several minutes full suite + build |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file>` for touched files
- **After every plan wave:** Run `npm run test` + `npm run build`
- **Before `/gsd:verify-work`:** Build exit 0; no new test failures vs baseline; local-dev walk against local Supabase (DB-touching phase — CLAUDE.md Local-First gate)
- **Max feedback latency:** ~20 seconds (targeted runs)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 85-01-T1 | 01 | 1 | LIFE-01, LIFE-02 | T-85-01, T-85-03 | No destructive DDL; divergent post-flight predicates | static (grep) | `grep -v '^\s*--' supabase/migrations/20260913000000_phase85_collection_lifecycle.sql \| grep -ciE "drop (table\|type\|column\|constraint)"` → 0 | ❌ created by task | ⬜ pending |
| 85-01-T2 | 01 | 1 | LIFE-01, LIFE-02 | — | N/A | static (grep) | `grep -n "disposalReasonEnum = pgEnum('disposal_reason'" src/db/schema.ts` | ✅ | ⬜ pending |
| 85-01-T3 | 01 | 1 | LIFE-01, LIFE-02 | T-85-02, T-85-04 | Local-only apply; RLS policies re-created | SQL (local DB) [BLOCKING] | psql verify query prints `0\|3\|1` | n/a | ⬜ pending |
| 85-02-T1 | 02 | 2 | LIFE-02, LIFE-06 | T-85-05 | Visitor predicate IN ('owned','grail') | unit | `npx vitest run tests/data/getWatchByIdForViewer.test.ts src/data/__tests__/recommendations.test.ts tests/lib/previouslyOwnedExclusion.test.ts` | ✅ + ❌ new exclusion test | ⬜ pending |
| 85-02-T2 | 02 | 2 | LIFE-01 | T-85-06 | No divestments writes | unit + grep | `npx vitest run src/lib/watchFlow/destinations.test.ts tests/static/WatchCard.sold-badge.test.tsx` | ✅ | ⬜ pending |
| 85-02-T3 | 02 | 2 | LIFE-01 | — | N/A | grep + build | `grep -rn "'sold'" src tests \| grep -vi disposal` empty && `npm run build` | ✅ | ⬜ pending |
| 85-03-T1 | 03 | 3 | LIFE-03 | T-85-09 | Client owns today (260622-exo) | unit | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ✅ | ⬜ pending |
| 85-03-T2 | 03 | 3 | LIFE-02, LIFE-03 | T-85-08, T-85-09, T-85-10, T-85-13 | Owner-scoped; strict zod; future-date rejection | unit | `npx vitest run src/app/actions/__tests__/watches-lifecycle.test.ts -t markWatchPreviouslyOwned` | ❌ created by task | ⬜ pending |
| 85-03-T3 | 03 | 3 | LIFE-03, LIFE-04 | T-85-11, T-85-12 | D-07 guard; D-04 undo clears fields | unit + build | `npx vitest run src/app/actions/__tests__/watches-lifecycle.test.ts src/app/actions/__tests__/moveWishlistToCollection.test.ts && npm run build` | ✅ (extend) | ⬜ pending |
| 85-04-T1 | 04 | 3 | LIFE-05 | T-85-14, T-85-15 | Visitors receive [] and no notes rows | static (grep) | `grep -n "const previouslyOwnedWatches = isOwner" "src/app/u/[username]/[tab]/page.tsx"` | ✅ | ⬜ pending |
| 85-04-T2 | 04 | 3 | LIFE-05 | T-85-14 | Toggle owner-only, not persisted | component | `npx vitest run src/components/profile/__tests__/CollectionTabContent.test.tsx` | ✅ (extend) | ⬜ pending |
| 85-05-T1 | 05 | 3 | LIFE-05 | T-85-17 | No /w/ link when not linkable | component | `npx vitest run tests/components/wear/WearPhotoOverlays.linkable.test.tsx` | ❌ created by task | ⬜ pending |
| 85-05-T2 | 05 | 3 | LIFE-05 | T-85-17 | watchLinkable computed server-side | grep + build | `grep -n "wear.watchStatus !== 'previously_owned'" "src/app/wear/[wearEventId]/page.tsx" && npm run build` | ✅ | ⬜ pending |
| 85-06-T1 | 06 | 4 | LIFE-03 | T-85-19 | Client validation is UX only | unit + component | `npx vitest run src/lib/__tests__/disposal.test.ts src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx` | ❌ created by task | ⬜ pending |
| 85-06-T2 | 06 | 4 | LIFE-03, LIFE-05 | T-85-20, T-85-21 | Menu owner-only; trigger click defaultPrevented | component + build | `npx vitest run src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx && npm run build` | ❌ created by task | ⬜ pending |
| 85-07-T1 | 07 | 4 | LIFE-04 | T-85-SC | Package legitimacy human gate | checkpoint (blocking-human) | manual | n/a | ⬜ pending |
| 85-07-T2 | 07 | 4 | LIFE-04 | T-85-23 | Reduced motion skips confetti | unit | `npx vitest run src/lib/__tests__/celebrate.test.ts` | ❌ created by task | ⬜ pending |
| 85-07-T3 | 07 | 4 | LIFE-04 | T-85-22 | Celebrate only on server promoted flag | component + build | `npx vitest run src/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.celebration.test.tsx && npm run build` | ✅ + ❌ new | ⬜ pending |
| 85-08-T1 | 08 | 5 | LIFE-02, LIFE-03 | T-85-24, T-85-25, T-85-26 | No previously_owned option for non-disposed watches | component + build | `npx vitest run tests/components/watch/WatchForm.lifecycle.test.tsx && npm run build` | ❌ created by task | ⬜ pending |
| 85-09-T1 | 09 | 6 | LIFE-01..06 | — | Gates green before walk | build + unit + SQL | `npm run build` + targeted Phase 85 vitest + column query | n/a | ⬜ pending |
| 85-09-T2 | 09 | 6 | LIFE-01..06 | T-85-LEAK | Cross-user gating in two real sessions | manual walk | manual | n/a | ⬜ pending |
| 85-09-T3 | 09 | 6 | LIFE-01..04 | T-85-27 | Rename + D-04 invariants hold in SQL | SQL (local DB) | psql verify query prints `0\|0` | n/a | ⬜ pending |
| 85-09-T4 | 09 | 6 | LIFE-01, LIFE-02 | T-85-28 | Operator-only prod push before deploy | checkpoint (human-action) | manual | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test scaffolds are created inside the owning tasks (TDD tasks write RED tests first), so there is no separate Wave 0 plan:

- [ ] `src/app/actions/__tests__/watches-lifecycle.test.ts` — 85-03 T2/T3 (LIFE-02/03/04; replaces the suggested `src/app/actions/__tests__/watches.test.ts`, which does not exist)
- [ ] `src/lib/__tests__/celebrate.test.ts` — 85-07 T2 (LIFE-04)
- [ ] `src/app/actions/__tests__/moveWishlistToCollection.test.ts` — status literal in 85-02 T3; promoted shape in 85-03 T3
- [ ] `src/components/profile/__tests__/CollectionTabContent.test.tsx` — 85-04 T2 (LIFE-05)
- [ ] `tests/static/WatchCard.sold-badge.test.tsx` — repointed in 85-02 T2 (dead island)
- [ ] `tests/integration/phase37-rls.test.ts` — recordDivestment block removed in 85-02 T2
- [ ] Comments RLS: no dedicated phase53 comments-RLS integration test exists; the policy change is asserted by the migration's own post-flight block and by 85-01 T3's pg_policies query
- [ ] `tests/lib/previouslyOwnedExclusion.test.ts`, `src/lib/__tests__/disposal.test.ts`, `src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx`, `src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx`, `tests/components/wear/WearPhotoOverlays.linkable.test.tsx`, `tests/components/watch/WatchForm.celebration.test.tsx`, `tests/components/watch/WatchForm.lifecycle.test.tsx` — new, created by their owning tasks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applies cleanly; sold rows → previously_owned + reason=sold | LIFE-01/02 | DB-touching; mocks don't execute SQL | Apply migration to local Supabase; run pre/post-flight SQL assertions |
| Card ⋯ menu → dialog → card leaves grid + toast | LIFE-03 | End-to-end UI against real DB | `npm run dev`, sign in as seeded user, dispose an owned watch |
| Confetti + celebratory toast on wishlist/grail → owned | LIFE-04 | Visual/animation | Promote via edit form and via add-flow "Move to collection" |
| Toggle reveals muted badged cards; visitor sees none + 404 on /w/[id] | LIFE-05/06 | Cross-user gating | Walk as owner and as a second seeded user |
| Home rail doesn't recommend a previously-owned model | LIFE-06 | Recommender output against seeded data | Dispose a watch; reload home |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
