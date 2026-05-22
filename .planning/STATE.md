---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Social Interaction
status: executing
stopped_at: Completed 55-01 Wave 0 test scaffolds
last_updated: "2026-05-22T20:34:37.201Z"
last_activity: 2026-05-22
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 13
  completed_plans: 10
  percent: 77
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22 — v6.0 milestone started)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 55 — Server Actions + Notification Dedup

## Current Position

Phase: 55 (Server Actions + Notification Dedup) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-05-22

Progress: [████████░░] 77%

## Performance Metrics

- v5.2: 5 phases (48-50 + 49.1 + 50.1), 21 plans, 34 tasks over 2 days
- 6/6 v5.2 requirements shipped
- Phase 52 (post-v5.2 hotfix): 9 plans, recurrence-4/5 React #419 eliminated
- Blockers encountered: 0

## Accumulated Context

### Roadmap Evolution

- Phase 49.1 inserted after Phase 49: Remove genre surface — implements Phase 49 spike Ship-Now: YES verdict per ROADMAP SC#4 escape hatch (TAX-02) (URGENT)
- Phase 50.1 inserted after Phase 50: URL canonicalization — implements Phase 50 spike Ship-Now: YES verdict per ROADMAP SC#4 escape hatch (Variant B; ARCH-02) (URGENT)
- Phase 52 added: Option D — Cache Components canonical pattern fix for /u/[username]/[tab] (recurrence-4 React #419) — supersedes Phase 51 layout-fix; sourced from `.planning/audits/cache-components-2026-05-21-followup.md`
- v6.0 roadmap created 2026-05-22: 6 phases (53-58), 34 requirements mapped 34/34

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
- **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT (Phase 52).** `prefetch:'runtime'` fires an aborting secondary prerender (React #419); `prefetch:'static'` fails at build time on a two-dynamic-param route. Do NOT re-enable. Real fix is structural: sync layout + Suspense + ProfileChrome + inner ProfileTabContent.
- **v6.0 data model choice deferred to Phase 53 discuss/spec.** SUMMARY.md recommends per-target tables (separate `watch_likes`, `wear_likes`) over polymorphic; final decision is made during Phase 53 planning, not locked in the roadmap.
- **v6.0 comment order is newest-first (operator decision 2026-05-22).** Overrides SUMMARY.md oldest-first suggestion. Compose box sits above the list.
- **v6.0 character limit is 500 (operator decision via REQUIREMENTS.md).** Consistent across Zod, DB CHECK, and `<Textarea maxLength>`.
- **Likes do NOT generate feed activities (operator decision).** Likes surface only in bell notifications; only comments generate Network Activity feed entries (FEED-06).

### v6.0 Phase Structure

| Phase | Goal | Requirements |
|-------|------|--------------|
| 53 | Interaction tables, constraints, RLS, enum extension | SEC-01, SEC-04, SEC-06, LIKE-05, GATE-02 |
| 54 | DAL with mutual-follow gate and two-layer enforcement | GATE-01, GATE-04, GATE-05, SEC-02 |
| 55 | Server Actions with Zod validation, dedup, notification fan-out | SEC-03, SEC-05, NOTIF-11, NOTIF-12, NOTIF-13, NOTIF-14 |
| 56 | LikeButton UI on watch and wear detail pages | LIKE-01, LIKE-02, LIKE-03, LIKE-04 |
| 57 | Comment compose/list/edit/delete, gate UI, feed extension, grid counts | CMNT-01..09, GATE-03, FEED-06, FEED-07, DISP-01 |
| 58 | Bell/inbox for new notification types, Settings opt-out toggles | NOTIF-15, NOTIF-16 |
| Phase 53-schema-rls-enum-extension P01 | 6 | 3 tasks | 5 files |
| Phase 53-schema-rls-enum-extension P02 | 127 | 2 tasks | 0 files |
| Phase 54 P01 | 156 | 2 tasks | 2 files |
| Phase 54 P02 | 144 | 2 tasks | 2 files |
| Phase 54 P03 | 287 | 2 tasks | 1 files |
| Phase 55-server-actions-notification-dedup P01 | 4 | 3 tasks | 3 files |
| Phase 55 P03 | 256 | 2 tasks | 3 files |

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

Open pre-flights for Phase 53 discuss/spec:

- **Data model choice** — per-target tables (SUMMARY recommendation) vs. polymorphic; must be decided before schema migration is authored.
- **`follows` SELECT RLS policy** — check Phase 7-9 migrations; if absent, add policy or use SECDEF helper (triggers REVOKE/GRANT requirement).
- **`ALTER TYPE ... ADD VALUE` outside transaction block** — four `watch_like`, `wear_like`, `watch_comment`, `wear_comment` values; must be standalone statements in the migration file.
- **Wishlist → owned grandfather policy** — existing comments from non-mutual-followers when a watch moves to wishlist; simplest: grandfather (keep rows, gate only new writes). Document before writing `getCommentsForTarget`.

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
| seed | SEED-005-v6-market-value | dormant | Future milestone (after v8.0) |
| seed | SEED-007-market-pricing-api-spike | dormant | Future spike |
| seed | SEED-010-v5.3-add-watch-redesign | dormant | Future v8 milestone |
| seed | SEED-012-v6.0-social-interaction | active | This milestone |
| seed | SEED-013-v7.0-watch-photos | dormant | Future v7.0 milestone |

## Session Continuity

Last activity: 2026-05-22 — v6.0 roadmap created (6 phases, 34/34 requirements mapped)
Stopped at: Completed 55-01 Wave 0 test scaffolds
Next action: Run `/gsd-plan-phase 53` to begin Phase 53 (Schema + RLS + Enum Extension)

## Operator Next Steps

- Run `/gsd-plan-phase 53` to plan Phase 53 (Schema + RLS + Enum Extension)
- Discuss/spec during Phase 53 planning must resolve: data model choice (per-target vs. polymorphic) + `follows` RLS pre-flight
