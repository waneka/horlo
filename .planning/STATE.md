---
gsd_state_version: 1.0
milestone: v5.1
milestone_name: Explore Page Redesign
status: executing
stopped_at: Phase 44 context gathered
last_updated: "2026-05-17T19:32:21.518Z"
last_activity: 2026-05-17 -- Phase 44 planning complete
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 8
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16 — v5.0 milestone close)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 43 — polish-pass

## Current Position

Phase: 999.1
Plan: Not started
Status: Ready to execute
Last activity: 2026-05-17 -- Phase 44 planning complete

[==========          ] 0% — 0/5 phases complete

## Performance Metrics

- Phases completed this milestone: 0
- Plans completed this milestone: 0
- Blockers encountered: 0

## Accumulated Context

### Key Decisions

- **CMS approach (2026-05-16):** In-app admin routes (`/admin/*`) chosen over third-party CMS (Sanity, Contentlayer). No external dependency; fits single-user / free / personal-first stance.
- **New runtime dependency:** `react-markdown@^10.1.0` — lightest viable markdown renderer, React 19 compatible, no editor runtime.
- **Phase ordering is non-negotiable:** Enrichment (44) before Browse/Archetypes (46); CMS model (45) before Rail/Hero (47). Hard data dependencies drive this order.
- **Claude model ID:** `claude-sonnet-4-6` is the current ID; `claude-sonnet-4-20250514` is deprecated June 15, 2026. Update in Phase 43.
- **Avatar storage:** New `avatars` public Supabase Storage bucket; reuse existing EXIF-strip / ≤1080px JPEG upload path from the add-watch flow.
- **Hero cache invalidation:** Must use `revalidateTag('explore:hero')` in all four write paths (`setPinnedHero`, `clearPinnedHero`, `publishList`, `unpublishList`) — NOT `revalidatePath`.
- **RLS pattern:** `USING (status = 'published')` for public reads on `curated_lists`, plus explicit `WHERE status = 'published'` in every DAL public-read function. Two-layer defense against draft leaks.
- **`assertOwner()` in every CMS Server Action:** Owner check in `AdminLayout` alone is insufficient — Server Actions are HTTP-callable endpoints that bypass layout gates.
- **Supabase SECDEF grants (Phase 45):** Any SECURITY DEFINER functions added in the migration require explicit `REVOKE EXECUTE FROM anon, authenticated` — see `project_supabase_secdef_grants.md` memory note.
- **Where Collections Go mobile layout (Phase 47):** 360px layout is underspecified — vertical stacking with numbered progression indicator is recommended; prototype before finalizing the component.

### Open Items Carried from v5.0

- **DEBT-12** — repair prod's `drizzle.__drizzle_migrations` journal (1 row vs N expected). Unscheduled / opportunistic — fold into the next prod-deploy phase that needs `drizzle-kit migrate` to run cleanly.
- **Phase 39c UAT Issue 2** — `removeWatch` leaves stale state in the home "from collectors like you" rail. Tracked in `.planning/phases/39c-profile-layout-next-16-conformance/39c-UAT.md` Issue 2.
- **Phase 35 + Phase 41 human-verification items** — operator-approved at v5.0 close. See respective `*-HUMAN-UAT.md` files.
- **31 v3.0 deferred human-verification UAT items** — iOS device tests, multi-session flows, FOUC checks.
- Smaller carryover: pre-existing `LayoutProps` TS error, `useWatchSearchVerdictCache` signOut leak, Phase 999.1 directory archival, WatchForm unused imports, SMTP-06 staging sender split, WristOverlaySvg geometry redesign.

### Blockers/Concerns

None blocking.

Research flags to address during planning:

- **Phase 45 plan:** Verify Supabase SECDEF REVOKE pattern for any DB functions added in the 5-table migration; verify enum ordering before writing enum-bound dependent columns (4 prod-push gotchas from `project_drizzle_supabase_db_mismatch.md`).
- **Phase 47 plan:** Where Collections Go 360px mobile layout is underspecified — prototype vertical stacking with numbered progression indicator before finalizing `CollectionPathsModule`.

### Pending Todos

None.

## Session Continuity

Last session: 2026-05-17T18:33:58.408Z
Last activity: 2026-05-16 — ROADMAP.md written, STATE.md updated, REQUIREMENTS.md traceability populated
Stopped at: Phase 44 context gathered
Resume file: .planning/phases/44-catalog-enrichment/44-CONTEXT.md
Next action: `/gsd-plan-phase 43`
