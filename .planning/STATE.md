---
gsd_state_version: 1.0
milestone: v5.2
milestone_name: Polish + Taxonomy
status: completed
stopped_at: Phase 50 context gathered
last_updated: "2026-05-20T19:06:48.776Z"
last_activity: 2026-05-20 -- Phase 50.1 marked complete
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 22
  completed_plans: 22
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19 — v5.1 milestone close)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 50.1 — url-canonicalization

## Current Position

Phase: 50.1 — COMPLETE
Plan: 1 of 3
Status: Phase 50.1 complete
Last activity: 2026-05-20 -- Phase 50.1 marked complete

```
v5.2 Progress: [███████████████░░░░░] 75% (2/3 phases — Phase 48 + Phase 49 spike complete; Phase 49.1 7/8 plans)
```

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
| carryover | DEBT-12 — prod `drizzle.__drizzle_migrations` journal repair | opportunistic — fold into next prod-deploy phase needing `drizzle-kit migrate` |
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

## Session Continuity

Last activity: 2026-05-20 — Phase 49.1 Plan 07 complete (schema.ts dropped, drizzle/0012 migration authored, drizzle-kit push deferred to main repo).
Stopped at: Phase 50 context gathered
Next action: User runs `npx drizzle-kit push` in main repo to apply local DB drop, then execute Plan 08 (supabase prod migration push).

## Operator Next Steps

- ✅ Plan 07 complete: `src/db/schema.ts:390` removed; `drizzle/0012_phase49_1_drop_primary_archetype.sql` authored.
- ⏳ Local DB sync: user runs `cd /Users/tylerwaneka/Documents/horlo && npx drizzle-kit push` post-merge to drop the column on local dev DB and update `drizzle/meta/_journal.json`.
- Plan 08 owns `supabase/migrations/20260520xxxxxx_phase49_1_drop_primary_archetype.sql` authoring + prod `supabase db push --linked`.
