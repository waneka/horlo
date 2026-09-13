# Phase 85: Collection lifecycle - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make "left the collection" a first-class, honest state. Deliver:

1. A `previously_owned` `WatchStatus`, **replacing** the legacy `sold` value, with nullable `disposal_reason` / `sell_price` / `disposal_date` metadata (LIFE-01, LIFE-02).
2. An owner-only disposal flow from the collection card (LIFE-03).
3. A celebration moment when a wishlist or grail watch becomes owned (LIFE-04).
4. An owner-only "Show previously owned" toggle on the Collection tab, off by default (LIFE-05).
5. Previously-owned watches kept out of similarity and the recommender, including the recommender's candidate output (LIFE-06).

This is the first DB-touching phase of v9.0.

**Not in this phase:** a v2 "bring back into collection" flow (LIFE-V2-03), multi-currency sell price (LIFE-V2-01), aggregate previously-owned analytics (LIFE-V2-02), and Reorder mode (Phase 86).

</domain>

<decisions>
## Implementation Decisions

### Status migration (LIFE-01 / LIFE-02)
- **D-01:** **Replace `sold` with `previously_owned`.** Migrate every existing `watches.status = 'sold'` row to `status = 'previously_owned'` with `disposal_reason = 'sold'`. Then remove `'sold'` from everything that lists it: the `WatchStatus` union (`src/lib/types.ts`), the Drizzle column enum (`src/db/schema.ts` watches.status), `WATCH_STATUSES` (`src/lib/constants.ts`), the zod schema in `src/app/actions/watches.ts`, `StatusToggle`, `WatchCard` badge, `destinations.ts`, and the visibility SQL in `src/data/watches.ts`. The codebase ends with **one** status for anything that has left the collection.
- **D-02:** **Disposal metadata = three nullable columns on `watches`**: `disposal_reason` (enum `sold | lost | gifted | stolen | traded`), `sell_price` (numeric/real, single currency per LIFE-V2-01), `disposal_date` (date). They are **not** stored in `divestments`, which is keyed by `catalog_id` with no watch FK and so can't identify which copy was disposed of.
- **D-03:** **Stop writing `divestments`; leave the table and its rows in place.** Remove the owned→sold dual-write transaction from `editWatch` (`src/app/actions/watches.ts` ~L679–720) and retire `recordDivestment` (`src/app/actions/divestments.ts`). Do **not** drop the table in this phase. Dropping it is a later one-way cleanup.
- **D-04:** **Undo is allowed.** When a watch's status moves *out of* `previously_owned` (a mis-tap correction), the server nulls all three disposal fields. This is a correction path, not the v2 "bring back" feature. It needs no dedicated UI beyond the edit form (see D-07).

### Disposal flow & dialog (LIFE-03)
- **D-05:** **Entry point = owner-only ⋯ overflow menu on the collection card** (`ProfileWatchCard`, rendered via `CollectionTabContent`), containing "Mark as previously owned". The trigger must not activate the card's `<Link>` (stop propagation / sit outside the link hit area). Only the owner sees it, on owned cards. Phase 86 reorder mode will later need to suppress this menu, so don't design against that.
- **D-06:** **Dialog fields:** reason picker (Sold / Traded / Gifted / Lost / Stolen), **required**. Disposal date is **optional**, pre-filled with browser-local today, with `max` = today (no future dates; reuse `todayLocalISO()` from `src/lib/wear.ts`) and server-side rejection of future dates. Sell price is **optional**. All fields show for every reason, with no reason-specific hiding.
- **D-07:** **Edit form: `previously_owned` is NOT offered in the status dropdown** for watches that aren't already previously owned. The dialog is the only way to dispose of a watch, so a reason is always captured. When editing a watch that **is** previously owned, the form shows its current status and the disposal fields as editable. Changing the status back to owned/wishlist is the D-04 undo path.
- **D-08:** **After confirming:** stay on the Collection tab. The card leaves the grid (the toggle is off by default) and a sonner toast confirms, e.g. "Moved to previously owned". Invalidate the same way as other watch mutations: `revalidatePath` for `/` and the profile layout, `updateTag('viewer:${id}:recs')` (Phase 75 pattern), and `revalidateTag('explore', 'max')`.

### Celebration moment (LIFE-04)
- **D-09:** **Triggers:** every promotion from `wishlist` **or** `grail` to `owned`, on both paths: the edit form status change (`editWatch`) and the add-flow "Move to collection" (`moveWishlistToCollection` via `AddWatchFlow`). The server detects the transition from the prior row (as the old sold-transition detection did) and returns a `promoted`-style signal. The client celebrates based on that signal, not on its own guess.
- **D-10:** **Look = confetti burst plus a celebratory sonner toast** that reads differently from the normal "Saved" / "Moved to collection" toast. Adding a lightweight confetti dependency is approved (library choice is Claude's discretion). The celebration must survive the post-save `router.push` to the collection destination.
- **D-11:** **Grail → owned** uses the same moment with grail-specific copy (e.g. "Grail acquired"). Not a bigger effect.
- **D-12:** **Pure celebration: it asks for nothing.** No price-paid prompt and no photo links.

### Previously-owned visibility (LIFE-05 / LIFE-06)
- **D-13:** **Owner-only.** Only the owner sees the "Show previously owned" toggle and the previously-owned cards. Visitors never see disposal history (reason, price, date), even on a public collection.
- **D-14:** **Visitors get not-found on a previously-owned watch's `/w/[id]`.** Remove the status (formerly `'sold'`) from the non-owner visibility predicate in `src/data/watches.ts` (~L290–295). Visitors can still see existing wears of that watch on the Worn tab and `/wear/[id]` under normal wear visibility. Don't show visitors a link to the watch page from those surfaces if it would 404.
- **D-15:** **Toggle = switch or chip at the end of the existing `FilterChips` row** on the Collection tab. **Not persisted**: it resets to off on every visit.
- **D-16:** **Cards: mixed into the same grid, muted/dimmed, with a reason · date badge** (e.g. "Sold · Mar 2026"; reason only if there's no date). No wear or like actions on these cards. The owner's ⋯ menu stays, with an edit entry for correction/undo instead of "Mark as previously owned".
- **D-17:** **Worn tab keeps history.** Previously-owned watches' wears stay in Timeline and Calendar, linking to `/wear/[id]`. They are already excluded from the leaderboard and the log-a-wear picker (Phase 84 D-11 / Phase 83 POLISH-02 scope to `status === 'owned'`), and that stays unchanged.
- **D-18:** **Recommender excludes previously-owned models from the user's own recommendations.** Add `previously_owned` to the "already has" exclusion set in `src/data/recommendations.ts` (~L274, keyed via `excludeKey` on canonical brand|family). The taste seed is already owned-only and stays that way.
- **D-19:** **Similarity/verdict:** `analyzeSimilarity` already compares only `owned | grail` (`src/lib/similarity.ts` ~L311). Keep that allowlist. Research must **audit every status predicate** (see code_context) so that no denylist-style check (`!== 'wishlist'`, `IN ('owned','sold',...)`) treats `previously_owned` as owned. Owner counts, "X collectors own this", taste overlap, gap fill, insights, and header/bottom-nav counts must not count previously-owned watches.

### Claude's Discretion
- Confetti library choice (tiny, tree-shakeable, no runtime fetch). Under `prefers-reduced-motion` the confetti is skipped and the toast still shows.
- Exact celebration and toast copy, badge copy format, dialog layout (reuse existing `Dialog` + WAI-ARIA radiogroup pattern from Phase 68 / 82 for the reason picker).
- Mechanism for carrying the celebration signal across navigation (e.g. query param, sessionStorage one-shot, or firing before push). Watch the Router Cache stale-instance gotcha: reset one-shot state deliberately, not on mount.
- ⋯ menu component (base-ui Menu) and its exact items beyond D-05 / D-16.
- Whether the DB gets a CHECK constraint for status / disposal_reason (vs a pgEnum) and whether a CHECK ties disposal fields to `status = 'previously_owned'`. Planner decides, consistent with D-04's null-on-exit rule.
- Whether to backfill `disposal_date` / `sell_price` for migrated sold rows from matching `divestments` rows. Default: don't (divestments rows are empty-metadata and catalog-keyed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 85: goal and 4 success criteria
- `.planning/REQUIREMENTS.md` §LIFE: LIFE-01..06, LIFE-V2-01..03 (deferred), Out-of-Scope table (bring-back flow is one-way in v9.0)
- `.planning/PROJECT.md` §Current Milestone: v9.0 kickoff decisions (single status + reason enum; excluded from similarity and recommender)

### Prior phase context
- `.planning/phases/84-wear-history-depth/84-CONTEXT.md`: D-11 owned-only leaderboard scope, D-14 viewer gating on wears, D-15 `/wear/[id]` linking

### Legacy sold / divestments design (being superseded)
- `supabase/migrations/20260511010000_phase37_layer_d.sql`: `divestments` table + RLS (left in place per D-03)
- `src/app/actions/divestments.ts`: `recordDivestment` dual-write (retire per D-03)
- `src/db/schema.ts` watches table (~L90–110) and divestments table (~L628–670)

### DB migration rules (project memory — MUST follow)
- Drizzle push is **local only**; prod uses `supabase db push --linked`. Query `pg_depend` before enum/constraint cleanups.
- User tables are wipeable, but prefer an in-place `UPDATE` migration for sold → previously_owned. Post-flight ASSERTs must not reuse the gated operation's WHERE predicate.
- Local-first: verify in `npm run dev` against local Supabase before pushing (CLAUDE.md §Local-First Development).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sonner` toast (`src/components/ui/ThemedToaster.tsx`), already used for "Moved to collection" in `AddWatchFlow.tsx` ~L580
- `Dialog` primitives + the WAI-ARIA radiogroup pattern (ConfirmStep status picker, Phase 68; admin merge pre-flight, Phase 82) for the reason picker
- `todayLocalISO()` in `src/lib/wear.ts` for the date `max` (Phase 84 D-02 pattern)
- `FilterChips` (`src/components/profile/FilterChips.tsx`): toggle host
- Prior-row transition detection in `editWatch` (`src/app/actions/watches.ts` ~L679): the model for promotion detection (D-09), replacing the sold-transition branch

### Established Patterns
- Server Actions return `ActionResult<T>` (`src/lib/actionTypes.ts`); zod `safeParse` early return; ownership via `getWatchById(user.id, id)`
- Watch mutations fan out `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `updateTag('viewer:${id}:recs')`, `revalidateTag('explore','max')`
- Selected/active states use the `accent` token; outline Button bg overrides need a `dark:` variant
- Status checks are mostly allowlists (`=== 'owned'`), which exclude the new status automatically. Denylist and `IN (...)` checks are the risk.

### Integration Points (status-predicate audit list, non-exhaustive)
- `src/app/u/[username]/[tab]/page.tsx` ~L364/382/400/531: collection tab watch set (must now pass previously-owned watches for the owner only, gated by the toggle)
- `src/components/profile/CollectionTabContent.tsx`, `ProfileWatchCard.tsx`: toggle, muted card, ⋯ menu
- `src/data/watches.ts` ~L293: visitor visibility predicate (D-14)
- `src/data/recommendations.ts` ~L136/184/274/293: exclusion set (D-18) and owned-only seeds
- `src/lib/similarity.ts` ~L311, `src/lib/gapFill.ts` ~L68, `src/lib/tasteOverlap.ts` ~L59, `src/lib/wornTabScope.ts` ~L27
- `src/data/discovery.ts`, `src/data/follows.ts`, `src/data/catalog.ts` (~L457/703/857 badge logic): owner counts / viewer-state badges
- `src/app/wears/[username]/page.tsx` ~L116, `src/app/wear/[wearEventId]/page.tsx` ~L78: `owned || wishlist` checks
- `src/components/watch/WatchForm.tsx` ~L445: status dropdown uses `WATCH_STATUSES` (D-07)
- `src/components/watch/WatchDetailHero.tsx`: owner actions / badge for a previously-owned watch
- `src/components/watch/CollectionView.tsx` + `src/components/filters/StatusToggle.tsx`: possibly dead legacy UI (verify it's rendered before editing; see the "trace the rendered component" lesson from Phase 83)
- `src/app/actions/account.ts`: references divestments (check account deletion/export path)

</code_context>

<specifics>
## Specific Ideas

- Badge format example: "Sold · Mar 2026".
- Toast example: "Moved to previously owned".
- Grail celebration copy example: "Grail acquired".
- The "Speedmaster you sold no longer counts as owned for role-duplicate math" framing from PROJECT.md is the test case for LIFE-06.

</specifics>

<deferred>
## Deferred Ideas

- Dropping the `divestments` table (one-way prod change; after D-03 stops writes)
- Backfilling disposal metadata from `divestments` rows (default: no)
- Bring-back-into-collection flow (LIFE-V2-03), multi-currency sell price (LIFE-V2-01), previously-owned analytics (LIFE-V2-02): already in v2 requirements

### Reviewed Todos (not folded)
- `drizzle-kit-pg-net-introspection-bug.md`: matched only on the generic keyword "phase". Unrelated to lifecycle scope, though worth knowing about if Drizzle introspection trips during the schema change.

</deferred>

---

*Phase: 85-collection-lifecycle*
*Context gathered: 2026-09-13*
