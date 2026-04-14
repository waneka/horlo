---
doc_type: phase-context
phase: "05"
phase_name: zustand-cleanup-similarity-rewire-prod-db-bootstrap
gathered: 2026-04-13
status: ready-for-planning
source: discuss-phase interactive
---

# Phase 05: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap — Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 5` (interactive)

<domain>
## Phase Boundary

Phase 5 demotes Zustand from a persisted collection store to ephemeral filter-only state, converts the insights page to a Server Component so the similarity engine reads `collection` + `preferences` from props instead of `useWatchStore()` / `usePreferencesStore()`, and produces a verified, step-by-step runbook (`docs/deploy-db-setup.md`) that brings the existing prod Supabase project (ref `wdntzsckjaoqodsyscns`) and `horlo.app` Vercel deployment online.

**Requirement IDs in scope:** DATA-05, OPS-01

**Phase goal:** After this phase, `watchStore` no longer uses `persist`, no longer holds collection data, and exposes only filter state (status / tags / dial colors / price range). Pages that previously read from Zustand fetch from the DAL via Server Components and pass data down. The insights page renders server-side. A solo operator following `docs/deploy-db-setup.md` end-to-end yields a working authenticated prod environment on `horlo.app`.

**Explicitly out of scope (formerly MIG-01 / MIG-02):** No localStorage import banner, no self-service migration UX, no Zod-validated bulk import flow. These were dropped 2026-04-13 — the project has a single user (the developer) with no legacy localStorage data worth migrating. Phase 5 starts the cloud collection from scratch. See `.planning/REQUIREMENTS.md` "Out of Scope for v1".

</domain>

<decisions>
## Implementation Decisions

### Scope change (this phase)

- **D-01:** **MIG-01 and MIG-02 are removed from the requirements.** The "first-login banner offering to import localStorage" and the "Zod-validated bulk-insert Server Action" are no longer being built. Phase 5 starts the cloud collection empty for the developer-user; any prior localStorage state is abandoned, not migrated. This was decided 2026-04-13 during discuss-phase: the project has a single user with no legacy data worth a polished UI flow. Recorded in `REQUIREMENTS.md` under "Out of Scope for v1".
- **D-02:** **No localStorage cleanup code ships either.** Existing `localStorage` keys (`watch-collection`, `user-preferences`) become orphaned. No code attempts to read, migrate, or delete them. The browser will retain the data until the user clears site data manually. Acceptable because (a) the data is not used after Phase 5, and (b) auto-deletion in a phase that does not have user-facing migration UX would be silent data loss.

### Claude's Discretion (planner decides)

The user explicitly chose not to pre-discuss any of the remaining gray areas. The planner has full discretion on the items below, constrained only by prior-phase decisions and the success criteria.

**Zustand demotion shape**
- Exact final shape of `watchStore` after demotion: which filter keys remain, default values, whether `getFilteredWatches` becomes a pure helper (e.g., `filterWatches(watches, filters)` in `src/lib/filtering.ts`) or stays a store selector that takes `watches` as an argument. Success criterion 1 requires "ephemeral filter state (status, tags, dial colors)" — price range may stay or move at planner's discretion as long as filter behavior is preserved.
- Whether `watchStore` keeps a Zustand store at all, or whether filter state moves to URL search params / a tiny per-page `useState`. Pick whichever gives the smallest diff while still satisfying "no `persist` middleware, no CRUD, no collection data."
- Removal of `usePreferencesStore` entirely (it has no filter use) vs leaving it for Claude-discretion client-only consumers — recommendation: remove it, since preferences should flow from the DAL via Server Components per the same logic that drives DATA-05.
- The migration in `watchStore.ts` (`migrate: () => ({ watches: [] })`) and the persist `version: 2` block both go away with `persist`.

**Server-Component data flow (the Zustand replacement)**
- How each page that currently calls `useWatchStore()` gets its data. Candidate pattern: each `app/.../page.tsx` becomes a Server Component that calls `getCurrentUser()` + `watchDAL.getWatchesByUserId(user.id)` + `preferencesDAL.getPreferencesByUserId(user.id)` and passes the result to a thin client subtree. Existing client interactivity (status toggle, watch card actions, filters, forms) stays in client components that receive data via props.
- Mutation refresh path: client components call existing Server Actions from `src/app/actions/watches.ts` + `preferences.ts` (already wired with `revalidatePath('/')` per Phase 3 D-13). After a mutation succeeds, `router.refresh()` re-renders the Server Component subtree and re-fetches the latest data. No optimistic updates required at <500 watches.
- Loading / pending UI during mutations: `useTransition` + a pending boolean is sufficient; planner picks placement.
- Whether a single shared "collection provider" client component wraps the whole authenticated layout (cleaner) or each page passes its own slice (less coupling). Either is acceptable.
- Per-page filter state: Should filters reset on navigation between pages, or persist for the session? Recommendation: per-page `useState` (filters reset on nav) — simplest, no cross-page coupling, matches the "ephemeral" framing in the success criterion.

**Affected files (Zustand consumers — 12 files identified during scout):**
- `src/app/page.tsx` — main grid, currently `useWatchStore`
- `src/app/insights/page.tsx` — currently `'use client'`, must become Server Component (DATA-05)
- `src/app/preferences/page.tsx` — currently `usePreferencesStore`
- `src/app/watch/[id]/page.tsx` — currently `useWatchStore` for detail lookup
- `src/app/watch/[id]/edit/page.tsx` — currently `useWatchStore` for edit form
- `src/components/filters/FilterBar.tsx` — filter state consumer
- `src/components/filters/StatusToggle.tsx` — filter state consumer
- `src/components/insights/SimilarityBadge.tsx` — currently `useWatchStore` (DATA-05)
- `src/components/watch/WatchDetail.tsx` — currently uses store actions (`updateWatch`, `markAsWorn`, etc.)
- `src/components/watch/WatchCard.tsx` — currently `useWatchStore`
- `src/components/watch/WatchGrid.tsx` — filter consumer
- `src/components/watch/WatchForm.tsx` — currently calls `addWatch` / `updateWatch` from the store

Each of these needs to be classified by the planner: (a) becomes Server Component reading DAL, (b) stays client component receiving props, or (c) stays client and calls a Server Action directly.

**Insights page conversion (DATA-05)**
- The full body of `src/app/insights/page.tsx` is currently a single client component computing distributions, wear insights, and collection value with `useMemo`. Pure-function math (no DOM, no event handlers) — moves cleanly to a Server Component. The only client surface needed is the final rendered cards, which are static.
- `BalanceChart` (currently `src/components/insights/BalanceChart.tsx`) already takes `data` as a prop — no rewire needed for it; it just receives data computed server-side.
- `SimilarityBadge` currently calls `useWatchStore()` internally to access the comparison collection. The rewire: it accepts `collection: Watch[]` and `preferences: UserPreferences` as props. All call sites must be updated to pass these. Planner identifies callers and updates them; recommend also passing `targetWatch` if any callers do not already.
- `GoodDealsSection` and `SleepingBeautiesSection` already take `watches` as a prop in the current insights page — no change.
- `useIsHydrated()` and the `hydrated ? storedWatches : []` dance disappears when the page is a Server Component — server rendering is naturally consistent with what client renders next.

**Prod DB bootstrap runbook (OPS-01)**
- File location: `docs/deploy-db-setup.md` (success criterion 4 names the path — locked).
- Format: numbered bash command blocks with expected output snippets the operator can compare against. Single-pass, top-to-bottom.
- Migration command in prod: planner picks `drizzle-kit migrate` (Phase 3 D-16 names it as "production migrations"). Runbook must walk through `drizzle-kit generate` first if any pending migrations exist beyond `20260413000000_sync_auth_users.sql`. Verify the existing `supabase/migrations/` directory contents before assuming.
- Supabase CLI link step: `supabase link --project-ref wdntzsckjaoqodsyscns` followed by `supabase db push` — confirm against current Supabase CLI docs if the syntax has changed.
- Vercel env var setup: three vars per success criterion 4 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`). Document where in the Supabase dashboard to find the URL/anon key, and what shape `DATABASE_URL` should take (pooled connection string, IPv4 vs IPv6 caveats are common gotchas). Use `vercel env add` CLI commands so the runbook is copy-pasteable.
- Verification: smoke test signup + logout against `horlo.app` after the env vars are set and a redeploy is triggered. The runbook explicitly walks the operator through "create test user → confirm logged in → click logout → confirm redirect to /login" and then suggests deleting the test user from the Supabase dashboard. Planner decides whether to also smoke-test add-watch, but the success criterion only requires signup + logout.
- Rollback/safety: include a "what to do if something goes wrong" section. At minimum: how to drop and recreate the Supabase schema if a migration fails; how to wipe the test user if signup gets stuck; how to roll back Vercel to the previous deployment.
- The runbook must be **executed end-to-end by the user** during phase execution — this is what "verified runbook" in the goal means. The plan should include a checkpoint where the executor pauses and asks the user to actually run the steps and report results, not just trust the documentation. Without that, "verified" is vapor.

**Cross-browser parity (success criterion 3)**
- "A logged-in user on two different browsers sees the same collection, and changes in one browser appear in the other after refresh" is naturally satisfied once Zustand is no longer the source of truth and Server Components fetch from the DAL. Planner does not need to design a separate sync mechanism — the demotion + Server Component conversion is the mechanism. Verification at execution time: log in on two browsers, add a watch in one, refresh the other, see the new watch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Next.js 16 docs (CRITICAL — this is not the Next you know)
- `node_modules/next/dist/docs/01-app/01-getting-started/` — Server Components, Server Actions, data fetching patterns. Phase 5 turns multiple `'use client'` pages into Server Components — the rules around what can and cannot live in a Server Component (no hooks, no event handlers, async by default) are framework-version-sensitive. Read before converting any page.
- `node_modules/next/dist/docs/01-app/03-api-reference/` — `revalidatePath`, `router.refresh()`, `useTransition` reference. The mutation-then-refresh flow depends on these.

### Project context
- `.planning/PROJECT.md` — personal-first constraint, Next.js 16 no-rewrite, <500 watches target
- `.planning/REQUIREMENTS.md` — DATA-05 and OPS-01 acceptance criteria; "Out of Scope for v1" entry documenting the dropped MIG-01/02
- `CLAUDE.md` + `AGENTS.md` — Next.js 16 warning, project-instruction enforcement

### Phase 3 artifacts (data layer this phase consumes)
- `.planning/phases/03-data-layer-foundation/03-CONTEXT.md` — D-13 (`revalidatePath('/')` after watch mutations), D-19 (Phase 5 does the Zustand demotion and UI rewire — this is that phase)
- `src/data/watches.ts` — `getWatchesByUserId(userId)` and friends; the read API Server Components will call
- `src/data/preferences.ts` — `getPreferencesByUserId(userId)`; the preferences read API
- `src/app/actions/watches.ts` — Server Actions already exist; client components call these unchanged
- `src/app/actions/preferences.ts` — same

### Phase 4 artifacts (auth this phase relies on)
- `.planning/phases/04-authentication/04-CONTEXT.md` — D-01 (`getCurrentUser()` in `src/lib/auth.ts`), D-02 (Server Actions read userId from session), D-12 (proxy denies by default)
- `src/lib/auth.ts` — `getCurrentUser()` and `UnauthorizedError`. Every Server Component that fetches data calls this first.
- `src/lib/supabase/server.ts` — `createSupabaseServerClient()` — the cookie-aware client used inside `getCurrentUser()`

### Existing code (this phase rewrites)
- `src/store/watchStore.ts` — currently 150 lines with `persist`, CRUD, filters, getters. After this phase: filters only, no `persist`, no collection data.
- `src/store/preferencesStore.ts` — currently 47 lines with `persist`, `updatePreferences`, `resetPreferences`. After this phase: removed entirely (preferences flow from DAL via Server Components).
- `src/app/insights/page.tsx` — currently `'use client'`, must become a Server Component (success criterion 2)
- `src/components/insights/SimilarityBadge.tsx` — accepts collection + preferences as props (DATA-05)
- `src/components/insights/BalanceChart.tsx` — already prop-driven, just receives server-computed data
- All 12 files listed under "Affected files" above

### Supabase / deployment (OPS-01)
- `supabase/migrations/20260413000000_sync_auth_users.sql` — Phase 4's shadow-user trigger; the runbook must walk the operator through applying this against the prod Supabase project
- Supabase CLI docs (latest, via context7) — `supabase link`, `supabase db push`, `drizzle-kit migrate` against a remote Postgres
- Vercel CLI docs (latest, via context7) — `vercel env add`, `vercel --prod` for the redeploy step
- Prod Supabase project ref: `wdntzsckjaoqodsyscns` (locked in success criterion 4)
- Prod app URL: `horlo.app`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/watches.ts` and `src/data/preferences.ts` — DAL is fully wired. Server Components in this phase call these directly (with the userId from `getCurrentUser()`). No DAL changes needed.
- `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` — Server Actions are already session-gated (Phase 4 D-02, D-04). Client components keep calling them unchanged through the demotion.
- `src/lib/auth.ts` — `getCurrentUser()` is the only function any new Server Component needs to call before fetching.
- `src/lib/similarity.ts` — Pure functions taking `(targetWatch, collection, preferences)`. Already designed for prop-passing; the DATA-05 rewire just cuts the Zustand-reading wrapper above it.
- `BalanceChart`, `GoodDealsSection`, `SleepingBeautiesSection` — already accept their data as props; no changes for the insights conversion.

### Established Patterns
- Server Actions return `ActionResult<T>`; client callers handle `success` / `error` (Phase 3 D-12, Phase 4 D-15).
- DAL throws on not-found / unauthorized; actions catch and shape (Phase 3 D-08).
- `revalidatePath('/')` after watch mutations, `revalidatePath('/preferences')` after preference mutations (Phase 3 D-13). After demotion, this is what makes the next Server Component render see fresh data.
- `'use client'` only on components with state, refs, or event handlers. Layout and pages default to Server Components (per Phase 4's `Header` refactor).
- Zustand `persist` is the legacy pattern being removed — no other persisted stores exist in the codebase.

### Integration Points
- Each affected page (`/`, `/insights`, `/preferences`, `/watch/[id]`, `/watch/[id]/edit`) becomes a Server Component shell that fetches via DAL and renders a client subtree.
- `Header.tsx` is already a Server Component (Phase 4 D-XX) — no change.
- `proxy.ts` is unchanged — auth gating already covers all routes.
- `docs/` directory may not exist yet — the runbook may need `mkdir docs/` as part of the plan.

</code_context>

<specifics>
## Specific Ideas

- The single hardest reviewer-trap in this phase is the difference between "the page is a Server Component" and "the page is async and fetches in a `useEffect`." The success criterion specifically says "is a Server Component" — meaning the file has no `'use client'` and the data fetch happens during server render. Planner must call this out so the executor does not regress to a client component.
- `useIsHydrated()` and the `hydrated ? storedWatches : []` workaround in `src/app/insights/page.tsx` exists today specifically to suppress hydration mismatch from Zustand's localStorage rehydration. After demotion, this hook becomes unnecessary on any page that is a Server Component. Planner should sweep for `useIsHydrated()` usages and remove dead ones.
- The watch detail page (`src/app/watch/[id]/page.tsx`) currently looks up the watch by ID in the Zustand store. After demotion, it becomes a Server Component that calls `watchDAL.getWatchById(user.id, params.id)`. If that DAL function does not exist, the planner adds it.
- `WatchForm.tsx` currently calls `useWatchStore().addWatch(...)` synchronously. After demotion, it calls the existing Server Action `addWatch(formData)` and on success uses `router.refresh()` + `router.push('/')` (or similar). This is a mechanical rewire across 12 files — the plan should sequence it so the app builds at every step, not just at the end.
- The OPS-01 runbook must be **actually executed by the user** during phase execution to qualify as "verified." The plan should include an explicit checkpoint: "Stop. Run the runbook end-to-end against the real prod Supabase project. Confirm signup + logout work on horlo.app. Then resume." Anything less is just writing documentation.
- `DATABASE_URL` in prod is the single most common Supabase footgun: the Supabase dashboard offers a "Connection Pooling" string (port 6543) and a "Direct Connection" string (port 5432). For Drizzle migrations you usually want the direct connection; for serverless app reads you usually want the pooled one. The runbook must pick a side per command and explain why.

</specifics>

<deferred>
## Deferred Ideas

- **localStorage import banner / self-service migration flow** (former MIG-01) — dropped 2026-04-13, not deferred. Single-developer project with no legacy data worth migrating. Not coming back unless the project gains additional users with localStorage state.
- **Zod-validated bulk import Server Action** (former MIG-02) — dropped with MIG-01, same reason. The DAL's existing single-watch `createWatch` is sufficient for any future need; no bulk path needed.
- **Optimistic UI updates after mutations** — `router.refresh()` is sufficient at <500 watches and a single user. Revisit if the app ever feels laggy after a mutation.
- **Filter state persistence across navigation** — explicit non-goal per success criterion 1 ("ephemeral filter state"). Revisit only if user feedback specifically asks for it.
- **Multi-environment runbook (staging + prod)** — Phase 5 only documents the prod bootstrap. Staging environments are out of scope.
- **CI/CD pipeline for Vercel deploys** — out of scope. The runbook is for a manual one-time bootstrap, not ongoing automation.
- **Shared "collection provider" context wrapping the whole authenticated layout** — recommended above as one of two acceptable approaches; deferred to planner discretion.
- **Per-watch checkboxes for any future selective import** — moot, the entire import flow is dropped.

</deferred>

---

*Phase: 05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap*
*Context gathered: 2026-04-13 via `/gsd-discuss-phase 5`*
*Note: phase directory name retains the legacy "migration-..." slug from when MIG-01/02 were in scope; the renamed phase title in ROADMAP.md is "Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap"*
