---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Social Interaction
status: planning
last_updated: "2026-05-22T07:15:40.409Z"
last_activity: 2026-05-22
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19 — v5.1 milestone close)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 52 — option-d-cache-components-canonical-pattern-fix-for-u-userna

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-22 — Milestone v6.0 started

## Performance Metrics

- v5.1: 5 phases (43-47), 27 plans, 269 commits over 3 days
- 32/32 v5.1 requirements shipped
- Blockers encountered: 0
- Phase 49.1 P01: 3 min, 3 tasks, 3 files
- Phase 49.1 P06: 18 min, 2 tasks, 27 files
- Phase 49.1 P07: 4 min, 2 tasks, 2 files

## Accumulated Context

### Roadmap Evolution

- Phase 49.1 inserted after Phase 49: Remove genre surface — implements Phase 49 spike Ship-Now: YES verdict per ROADMAP SC#4 escape hatch (TAX-02) (URGENT)
- Phase 50.1 inserted after Phase 50: URL canonicalization — implements Phase 50 spike Ship-Now: YES verdict per ROADMAP SC#4 escape hatch (Variant B; ARCH-02) (URGENT)
- Phase 52 added: Option D — Cache Components canonical pattern fix for /u/[username]/[tab] (recurrence-4 React #419) — supersedes Phase 51 layout-fix; sourced from `.planning/audits/cache-components-2026-05-21-followup.md`

### Key Decisions

Full v5.1 decision log lives in PROJECT.md `## Key Decisions → v5.1`. Headline decisions:

- **In-app admin CMS** chosen over a third-party CMS — `/admin/*` routes reuse the existing auth + Server Action stack.
- **`assertOwner()` in every CMS Server Action**, not just the layout guard — Server Actions are HTTP-callable.
- **Two-layer RLS** for published CMS content — `USING (status = 'published')` + explicit DAL `WHERE`.
- **`revalidateTag('explore:hero', 'max')`** in all four Hero write paths — `revalidatePath` does not invalidate tag scopes.
- **Wave 0 test scaffolds for Phase 49.1 use `as unknown as CatalogTasteAttributes`** to express the post-removal shape — `CatalogTasteAttributes.primaryArchetype` is still required in `src/lib/types.ts:224` today, so the cast lets Wave 0 tests assert the post-49.1 contract without forcing a parallel type edit. Plan 05 removes the cast.
- **Phase 49.1 Plan 06 — D-39b-04 lockstep expanded to 4 sites (not 3).** The plan's `<interfaces>` enumerated 3 `CatalogTasteAttributes` projection sites (types.ts + catalog/[catalogId]/page.tsx + watches.ts LEFT JOIN). At execution we discovered `src/lib/verdict/composer.ts:107` builds a 4th projection (`candidateCatalogTaste`). Treated as Rule 3 (blocking) deviation and bundled into the Task 1 atomic commit. Pitfall 3 lockstep preserved by 4-site (not 3-site) atomic change.
- **Phase 49.1 Plan 06 — PRIMARY_ARCHETYPE_SET deleted, PRIMARY_ARCHETYPES kept.** Once the archetype block in `validateAndCleanTaste` was removed, `PRIMARY_ARCHETYPE_SET` had zero remaining consumers and was deleted. `PRIMARY_ARCHETYPES` const + `PrimaryArchetype` type re-export both retained per D-EXPLORE-02 (consumed by `/explore` CollectorArchetypes rail's SQL ANY() filter).
- **Phase 49.1 Plan 07 — drizzle-kit push deferred to main repo.** Claude Code worktrees do not include `.env.local`, so `DATABASE_URL` is unavailable inside the worktree and `drizzle-kit push` cannot connect to local Postgres. Schema.ts edit + 0012 SQL file are the source-of-truth artifacts; user runs `npx drizzle-kit push` in the main repo post-merge. `drizzle-kit check` already passes without the journal entry, confirming structural consistency. Manual edit of `drizzle/meta/_journal.json` rejected (T-49.1-16: drizzle-kit owns the file).
- **Phase 49.1 Plan 07 — bare `ALTER TABLE ... DROP COLUMN IF EXISTS` (no `DO $$` guard).** The 0011 analog wraps the statement in a `DO $$` block to guard a NOT NULL constraint check, which does not apply to a column drop. `IF EXISTS` alone provides full idempotency for the drop operation; the implicitly-dropped `watches_catalog_primary_archetype_check` CHECK constraint requires no explicit `DROP CONSTRAINT`.

### v5.2 Phase Structure

| Phase | Goal | Requirements |
|-------|------|--------------|
| 48 | Fix wishlist mislabel + dark-mode chip contrast | BUG-01, BUG-02 |
| 49 | Genre vs style taxonomy spike — written recommendation | TAX-01 |
| 49.1 | Remove genre surface (drop primary_archetype, delete /explore/genres, rebalance taste weights) | TAX-02 |
| 50 | Two watch-detail views architecture spike — written decision | ARCH-01 |
| Phase 49.1 P05 | 6 min | 1 tasks | 2 files |

### Deferred Items

Items acknowledged and deferred at v5.1 milestone close (2026-05-19):

| Category | Item | Status |
|----------|------|--------|
| audit (cosmetic) | 10 completed quick tasks flagged for missing SUMMARY frontmatter status | non-blocking — tasks complete & committed |
| audit (parser) | 3 resolved HUMAN-UAT files (43/45/46); 45 counts 6 numbered tests as "open" | non-blocking — files are `resolved` |
| audit (backlog) | 9 seeds (SEED-001..010) — future-milestone backlog | expected to persist |
| audit (misid) | `.planning/debug/knowledge-base.md` flagged as a debug session | non-blocking — reference doc, not a session |
| carryover | DEBT-12 — prod `drizzle.__drizzle_migrations` journal repair | ✅ resolved 2026-05-21 — ran `scripts/repair-drizzle-journal.ts --apply` against prod (11 rows inserted, table now 12, `drizzle-kit migrate` no-op) |
| carryover | Phase 39c UAT Issue 2 — stale `removeWatch` rail/projection state | small fix phase or debug session when ready |
| carryover | 31 v3.0 + Phase 35/41 human-verification UAT items | operator-approved deferral |
| carryover | Smaller: `LayoutProps` TS error, `useWatchSearchVerdictCache` signOut leak, Phase 999.1 directory archival, WatchForm unused imports, SMTP-06 staging sender split, WristOverlaySvg geometry redesign | tracked in PROJECT.md `## Requirements → Active` |

### Blockers/Concerns

None blocking.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260519-08p | Fix Next.js Image aspect-ratio console warnings on watch images | 2026-05-19 | 5524004 | [260519-08p-fix-next-js-image-aspect-ratio-console-w](./quick/260519-08p-fix-next-js-image-aspect-ratio-console-w/) |
| 260519-d69 | Fix 4 collection-path UI issues in PathCard desktop layout | 2026-05-19 | 432d5a7 | [260519-d69-fix-4-collection-path-ui-issues-in-pathc](./quick/260519-d69-fix-4-collection-path-ui-issues-in-pathc/) |
| 260519-g4v | FU-02 fix /explore/brands A–Z letter-anchor smooth scroll | 2026-05-19 | 8c7543e | [260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch](./quick/260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch/) |
| 260519-ga9 | FU-01 expose brand/era/genre/archetype facets in /search filters menu | 2026-05-19 | 9a6276d | [260519-ga9-fu-01-expose-brand-era-genre-archetype-f](./quick/260519-ga9-fu-01-expose-brand-era-genre-archetype-f/) |

### Pending Todos

None.

## Deferred Items

Items acknowledged and deferred at v5.2 milestone close on 2026-05-20:

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| debug | knowledge-base | resolved-index | False positive — `.planning/debug/knowledge-base.md` is the resolved-sessions index, not an open session |
| verification | Phase 49.1 | ✅ resolved 2026-05-21 | D-DEBT-02 cleared via `/gsd-audit-uat`: Gate 1 prod push verified applied+synced (`supabase migration list --linked`); Gates 3/4 code-verified; Gate 5 operator-confirmed `/explore/genres` → 404 |
| uat | Phase 48 | ✅ resolved 2026-05-21 | D-DEBT-03 dark-mode `/search` chip legibility operator-confirmed in real browser (5 chip groups post-49.1, not 7) |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | stale-slug | Stale quick-task reference; no `.planning/quick-tasks/` directory present |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | stale-slug | Stale quick-task reference |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | stale-slug | Stale quick-task reference |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | stale-slug | Stale quick-task reference |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | stale-slug | Stale quick-task reference |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | stale-slug | Stale quick-task reference |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | stale-slug | Stale quick-task reference |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | stale-slug | Stale quick-task reference |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | stale-slug | Stale quick-task reference |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | stale-slug | Stale quick-task reference |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant | Future milestone (planned v6+) |
| seed | SEED-002-hybrid-recommender | dormant | Future milestone (planned v6+) |
| seed | SEED-003-onboarding-cold-start-flow | dormant | Future milestone |
| seed | SEED-004-v5-discovery-north-star | dormant | Future milestone |
| seed | SEED-005-v6-market-value | dormant | Future v6.0 milestone |
| seed | SEED-007-market-pricing-api-spike | dormant | Future spike |
| seed | SEED-008-v5.1-explore-redesign | active | Active seed for next milestone (v5.1 → v5.2 reorder; revisit at /gsd-new-milestone) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant | Future v8 milestone |
| seed | SEED-012-v6.0-social-interaction | dormant | Future v6.0 milestone |
| seed | SEED-013-v7.0-watch-photos | dormant | Future v7.0 milestone |

23 items acknowledged. SEED-011 (this milestone) flipped to `implemented` separately.

## Session Continuity

Last activity: 2026-05-20 — Phase 49.1 Plan 07 complete (schema.ts dropped, drizzle/0012 migration authored, drizzle-kit push deferred to main repo).
Stopped at: Phase 52 context gathered
Next action: User runs `npx drizzle-kit push` in main repo to apply local DB drop, then execute Plan 08 (supabase prod migration push).

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
