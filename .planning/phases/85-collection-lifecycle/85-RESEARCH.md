# Phase 85: Collection lifecycle - Research

**Researched:** 2026-09-13
**Domain:** Drizzle/Supabase schema migration (status rename + new columns), Next.js 16 Server Actions, Cache Components (PPR) collection tab, base-ui Menu, canvas-based celebration UI
**Confidence:** HIGH

## Summary

This phase renames the legacy `sold` status to `previously_owned`, adds three nullable disposal columns, and threads that new status through every read path that touches watch status. The codebase is in an unusually favorable position for this rename: `watches.status` is a plain Drizzle `text(... {enum:[...]})` column with **no DB-level CHECK constraint or pgEnum type** `[VERIFIED: supabase/migrations grep — no CHECK/pgEnum found on watches.status]`, so the rename requires no type-cast DDL — only an `ADD COLUMN` for the 3 new fields, a `CREATE TYPE disposal_reason` pgEnum (matching the project's `condition_grade`/`box_papers_status`/`currency_code` precedent), and an in-place `UPDATE watches SET status='previously_owned', disposal_reason='sold' WHERE status='sold'`. The full exhaustive audit below found that most status predicates in `src/` are **allowlists** (`status === 'owned'`, `IN ('owned','wishlist','grail')`) that already exclude `sold` today and will automatically exclude `previously_owned` tomorrow with zero code change — the recommender, similarity engine, gap-fill, taste-overlap, owner-count, and roster queries all fall into this safe category. The actual required-change surface is much smaller: the `WatchStatus` union, `WATCH_STATUSES` constant, the zod schemas, one denylist-style SQL fragment (`src/data/watches.ts` visitor-visibility predicate), one RLS policy pair (`comments_select`/`comments_insert` in `20260522000000_phase53_likes_comments_rls.sql`), the `editWatch`/`recordDivestment` dual-write, and a handful of display/dead-code sites.

A second major finding: **`CollectionView.tsx`, `WatchCard.tsx`, `WatchGrid.tsx`, `StatusToggle.tsx`, `FilterBar.tsx`, `src/store/watchStore.ts`, and `src/lib/filtering.ts` form a dead component island** — not imported from any file under `src/app/`, last touched 2026-04-13 (pre-Phase-27). The **live** Collection tab is `CollectionTabContent.tsx` + `ProfileWatchCard.tsx`, reached via `src/app/u/[username]/[tab]/page.tsx`. This matters directly for D-05 (⋯ menu placement) and D-16 (muted card + badge) — build against `ProfileWatchCard`/`CollectionTabContent`, not `WatchCard`/`CollectionView`, repeating the Phase 83 "dead island" lesson from `[[watchdetail-dead-island]]`. The dead files still need their `'sold'` references removed for `WATCH_STATUSES`-type compilation to succeed, but need zero UI verification.

Third: promotion-celebration and disposal-dialog mechanics both reuse existing, already-proven patterns rather than needing new primitives. `editWatch` already has an `isTransitioningToSold`-style prior-row-diff branch to model D-09's promotion detection and D-04's undo-nulling off of; a `DropdownMenu` (`@base-ui/react/menu`, already wired in `src/components/ui/dropdown-menu.tsx`) with the exact `WearOverflowMenu.tsx` shape is the direct precedent for D-05's ⋯ menu; and the safest transport for the celebration signal (Claude's Discretion) is "fire before `router.push`" — sonner's toast is proven to survive a Next 16 soft-navigation in this codebase already (`AddWatchFlow.tsx`'s "Moved to collection" toast), and `canvas-confetti` paints to a canvas appended directly to `document.body` outside React's tree, so it survives the same navigation for the same reason. This sidesteps the Router Cache stale-instance gotcha entirely (`[[router-cache-stale-instance]]`) because no destination-page mount-effect is involved.

**Primary recommendation:** Rename `sold`→`previously_owned` via a single additive Drizzle/Supabase migration (no CHECK-constraint or pgEnum conversion on `status` itself); add a `disposal_reason` pgEnum + `sell_price`/`disposal_date` nullable columns; reuse `editWatch` for both the disposal-dialog commit and the D-04 undo-nulling; fire the celebration (confetti + distinct toast) client-side immediately before the existing `router.push`, gated on a server-returned `promoted` flag from `editWatch`/`moveWishlistToCollection`; and build the ⋯ menu + muted card treatment on the live `ProfileWatchCard`/`CollectionTabContent` pair, not the dead `CollectionView` island.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status rename + disposal columns (DDL) | Database / Storage | — | Schema change; Drizzle mirrors, Supabase migration is authoritative for prod |
| Disposal flow validation (reason required, date not-future) | API / Backend (Server Action) | Browser (date `max` attr, UX only) | Zod + server-side date-plausibility check is the trust boundary; client `max` is UX only |
| Promotion detection (wishlist/grail → owned) | API / Backend (Server Action) | — | D-09 locks this server-side; client must not guess from possibly-stale props |
| Celebration UI (confetti + toast) | Browser / Client | — | Purely presentational; fires from the resolved Server Action promise, before navigation |
| Collection tab toggle + previously-owned card rendering | Browser / Client (CollectionTabContent) | Frontend Server (page.tsx passes the data) | Toggle state is ephemeral (D-15 not persisted) — pure client state; data-inclusion gate (owner-only) is server-computed |
| Visitor visibility on `/w/[id]` | API / Backend (`src/data/watches.ts` predicate) | Database (RLS is defense-in-depth, not the real gate per `[[rls-subquery-caller-rls]]`) | Service-role Drizzle connection bypasses RLS; the DAL WHERE clause is the actual gate |
| Recommender / similarity exclusion | API / Backend (`src/data/recommendations.ts`, `src/lib/similarity.ts`) | — | Pure server-side computation over DAL-fetched rows |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Status migration (LIFE-01 / LIFE-02)**
- D-01: Replace `sold` with `previously_owned`. Migrate every existing `watches.status = 'sold'` row to `status = 'previously_owned'` with `disposal_reason = 'sold'`. Then remove `'sold'` from everything that lists it: `WatchStatus` union, Drizzle column enum, `WATCH_STATUSES`, the zod schema in `src/app/actions/watches.ts`, `StatusToggle`, `WatchCard` badge, `destinations.ts`, and the visibility SQL in `src/data/watches.ts`. One status for anything that has left the collection.
- D-02: Disposal metadata = three nullable columns on `watches`: `disposal_reason` (enum `sold|lost|gifted|stolen|traded`), `sell_price` (numeric/real, single currency), `disposal_date` (date). NOT stored in `divestments` (catalog-keyed, no watch FK, can't identify which copy).
- D-03: Stop writing `divestments`; leave the table and its rows in place. Remove the owned→sold dual-write transaction from `editWatch` (~L679–720) and retire `recordDivestment`. Do NOT drop the table.
- D-04: Undo is allowed. When status moves OUT of `previously_owned`, the server nulls all three disposal fields. Correction path only, no dedicated UI beyond the edit form.

**Disposal flow & dialog (LIFE-03)**
- D-05: Entry point = owner-only ⋯ overflow menu on the collection card (`ProfileWatchCard`, via `CollectionTabContent`), "Mark as previously owned". Trigger must not activate the card's `<Link>`. Owner-only, owned cards only. Phase 86 reorder mode will later need to suppress this menu — don't design against that.
- D-06: Dialog fields: reason picker (Sold/Traded/Gifted/Lost/Stolen), required. Disposal date optional, pre-filled browser-local today, `max`=today (reuse `todayLocalISO()`), server-side rejection of future dates. Sell price optional. No reason-specific field hiding.
- D-07: Edit form: `previously_owned` NOT offered in the status dropdown for watches not already previously owned. The dialog is the only way to dispose of a watch. When editing an already-previously-owned watch, the form shows current status + disposal fields as editable. Changing status back is the D-04 undo path.
- D-08: After confirming: stay on Collection tab. Card leaves the grid (toggle off by default), sonner toast confirms ("Moved to previously owned"). Invalidate same as other watch mutations: `revalidatePath('/')`, `/u/[username]` layout, `updateTag('viewer:${id}:recs')`, `revalidateTag('explore','max')`.

**Celebration moment (LIFE-04)**
- D-09: Triggers on every promotion from `wishlist` OR `grail` to `owned`, on both paths: edit form status change (`editWatch`) and add-flow "Move to collection" (`moveWishlistToCollection`). Server detects the transition from the prior row and returns a `promoted`-style signal. Client celebrates based on that signal, not its own guess.
- D-10: Look = confetti burst + celebratory sonner toast distinct from normal "Saved"/"Moved to collection" toast. Lightweight confetti dependency approved (library = Claude's discretion). Must survive the post-save `router.push`.
- D-11: Grail → owned uses the same moment with grail-specific copy ("Grail acquired"). Not a bigger effect.
- D-12: Pure celebration — asks for nothing. No price-paid prompt, no photo links.

**Previously-owned visibility (LIFE-05 / LIFE-06)**
- D-13: Owner-only. Only the owner sees the toggle and the previously-owned cards. Visitors never see disposal history, even on a public collection.
- D-14: Visitors get not-found on a previously-owned watch's `/w/[id]`. Remove the status from the non-owner visibility predicate in `src/data/watches.ts` (~L290–295). Visitors can still see existing wears on the Worn tab and `/wear/[id]` under normal wear visibility — don't link to a page that would 404.
- D-15: Toggle = switch or chip at the end of the existing `FilterChips` row on the Collection tab. NOT persisted — resets to off every visit.
- D-16: Cards mixed into the same grid, muted/dimmed, with a reason·date badge (e.g. "Sold · Mar 2026"; reason only if no date). No wear/like actions on these cards. Owner's ⋯ menu stays, with an edit entry for correction/undo instead of "Mark as previously owned".
- D-17: Worn tab keeps history. Previously-owned watches' wears stay in Timeline/Calendar, linking to `/wear/[id]`. Already excluded from leaderboard + log-a-wear picker (Phase 84/83 scope to `status === 'owned'`) — unchanged.
- D-18: Recommender excludes previously-owned models from the user's own recommendations. Add to the "already has" exclusion set in `src/data/recommendations.ts` (~L274, `excludeKey`). Taste seed already owned-only, stays that way.
- D-19: Similarity/verdict: `analyzeSimilarity` already compares only `owned|grail` (`~L311`). Keep that allowlist. Audit every status predicate so no denylist-style check treats `previously_owned` as owned. Owner counts, "X collectors own this", taste overlap, gap fill, insights, header/bottom-nav counts must not count previously-owned watches.

### Claude's Discretion
- Confetti library choice (tiny, tree-shakeable, no runtime fetch). Under `prefers-reduced-motion`, confetti is skipped and the toast still shows.
- Exact celebration and toast copy, badge copy format, dialog layout (reuse `Dialog` + WAI-ARIA radiogroup pattern from Phase 68/82 for the reason picker).
- Mechanism for carrying the celebration signal across navigation (query param, sessionStorage one-shot, or firing before push). Watch the Router Cache stale-instance gotcha: reset one-shot state deliberately, not on mount.
- ⋯ menu component (base-ui Menu) and its exact items beyond D-05/D-16.
- Whether the DB gets a CHECK constraint for status/disposal_reason (vs pgEnum) and whether a CHECK ties disposal fields to `status='previously_owned'`. Consistent with D-04's null-on-exit rule.
- Whether to backfill `disposal_date`/`sell_price` for migrated sold rows from matching `divestments` rows. Default: don't.

### Deferred Ideas (OUT OF SCOPE)
- Dropping the `divestments` table (one-way prod change; after D-03 stops writes).
- Backfilling disposal metadata from `divestments` rows (default: no).
- Bring-back-into-collection flow (LIFE-V2-03), multi-currency sell price (LIFE-V2-01), previously-owned analytics (LIFE-V2-02) — v2 requirements.
- v2 "bring back into collection" flow, Reorder mode (Phase 86).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Watch can carry `previously_owned` `WatchStatus` value | §Standard Stack (migration), §Architecture Pattern 1 (status rename mechanics) confirm no DB CHECK constraint exists — pure additive/rename migration |
| LIFE-02 | Previously-owned watch stores optional `disposal_reason`/`sell_price`/`disposal_date` | §Architecture Pattern 1 gives the exact `ADD COLUMN` + pgEnum template (Phase 37 Layer D precedent); §Code Examples gives the `mapRowToWatch`/`mapDomainToRow`/zod extension points |
| LIFE-03 | Owner can mark owned watch as previously-owned from collection card, capturing reason + optional price/date | §Architecture Pattern 2 (⋯ menu on live `ProfileWatchCard`), §Common Pitfalls 1 (Link click-swallow), §Common Pitfalls 5 (server-side future-date validation pattern) |
| LIFE-04 | Promoting wishlist→owned shows a distinguishing celebration | §Architecture Pattern 3 (promotion detection + celebration transport), §Common Pitfalls 3 (Router Cache), §Don't Hand-Roll (confetti library) |
| LIFE-05 | "Show previously owned" toggle on Collection view, hidden by default | §Architecture Pattern 4 (toggle + data flow through the Cache-Components-constrained tab route) |
| LIFE-06 | Previously-owned excluded from similarity + recommender | §Status-Predicate Audit table — confirms `analyzeSimilarity`/`gapFill`/recommender exclusion sets are already-safe allowlists; only 2 real code sites need a change |

</phase_requirements>

## Standard Stack

No new runtime dependencies are required for LIFE-01/02/03/05/06. LIFE-04's celebration effect needs exactly one small library.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | (repo-pinned) | Column shape mirror for `disposal_reason`/`sell_price`/`disposal_date` | Existing project ORM; Phase 37 Layer D is the exact precedent for adding nullable provenance columns |
| zod | `^4.3.6` `[VERIFIED: package.json]` | Extend `insertWatchSchema`/`updateWatchSchema` with the 3 new optional fields + reason enum | Existing hand-written zod schema convention in `src/app/actions/watches.ts` |
| `@base-ui/react` (Menu) | `^1.3.0` `[VERIFIED: package.json]` | ⋯ overflow menu on the collection card | Already wired via `src/components/ui/dropdown-menu.tsx`; `WearOverflowMenu.tsx` is a direct, proven precedent for an owner-only card menu |
| sonner | `^2.0.7` `[VERIFIED: package.json]` | Celebration toast + existing "Moved to previously owned" / "Moved to collection" toasts | Already the project's only toast library; proven to survive Next 16 soft navigation |

### Supporting (new)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `canvas-confetti` | `1.9.4` `[ASSUMED — package name sourced from training knowledge, not Context7/official docs; registry existence + slopcheck OK do not upgrade this to VERIFIED per provenance rule]` | D-10 confetti burst on promotion | Fire on promotion signal; skip under `prefers-reduced-motion`; no React wrapper needed — call directly from a client-component event handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `canvas-confetti` | `react-confetti`, `party-js`, `js-confetti` | `canvas-confetti` has no React dependency, no continuous full-viewport re-render loop, and is the most widely used (~6.3M weekly downloads at research time `[VERIFIED: npm registry — npm view + downloads API]`); the others add either a React wrapper layer or a larger/less battle-tested surface for a one-shot burst effect |
| pgEnum for `disposal_reason` | plain `text` + CHECK constraint | Drizzle 0.45.2 in this repo cannot express CHECK constraints in the pg-core DSL (per existing `src/db/schema.ts` Phase 45 comment) — CHECK requires hand-written raw SQL in the Supabase migration either way; pgEnum matches the existing `condition_grade`/`box_papers_status`/`currency_code` precedent exactly and is Drizzle-native |
| Converting `watches.status` itself to a pgEnum | Leave `status` as `text(...{enum:[...]})` | No CHECK/pgEnum exists today on `status` (verified — see Architecture Pattern 1) and no locked decision requires adding one; converting a live NOT NULL text column with existing data to a pgEnum type is nontrivial DDL risk for zero required benefit in this phase |

**Installation:**
```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

**Version verification:** `npm view canvas-confetti version` → `1.9.4`, last published 2025-10-25, ~6.3M weekly downloads `[VERIFIED: npm registry, checked 2026-09-13]`. Repository: `github.com/catdad/canvas-confetti`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|--------------|-----------|-------------|
| `canvas-confetti` | npm | ~8 yrs (long-established; last publish 2025-10-25) | ~6.3M/week | `github.com/catdad/canvas-confetti` | `[OK]` | Approved — but tagged `[ASSUMED]` per provenance rule (package name recalled from training knowledge, not discovered via Context7/official docs; slopcheck+registry confirmation does not upgrade provenance) |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

Note on method: `slopcheck install canvas-confetti` was run to verify the registry verdict. That command performs a REAL `npm install` as a side effect (not a dry-run) — it was reverted (`git checkout -- package.json package-lock.json`) immediately after the verdict was captured, since research must not leave working-tree side effects. The planner's actual install step should re-run `npm install canvas-confetti` for real during implementation. Because the package name itself is `[ASSUMED]`, the planner should gate the real install behind a `checkpoint:human-verify` per the package-legitimacy protocol, even though the registry check passed.

## Architecture Patterns

### Pattern 1: Status rename migration (LIFE-01/LIFE-02)

**What:** `watches.status` is `text('status', { enum: ['owned','wishlist','sold','grail'] })` in `src/db/schema.ts` (~L100) — Drizzle's `{enum:[...]}` option is TypeScript-only narrowing; it does **not** emit a Postgres CHECK constraint or a pgEnum type `[VERIFIED: grepped all of supabase/migrations/*.sql for CHECK/pgEnum tied to watches.status — none found; only RLS policies and one 2026-05-04 one-time backfill migration reference status values]`. This means the rename requires zero DDL on the `status` column itself — only a data `UPDATE`.

**When to use:** This exact phase's migration.

**Template (mirrors `20260626000000_phase80_catalog_brand_family_not_null.sql`'s pre/post-flight-assertion shape and `20260511010000_phase37_layer_d.sql`'s pgEnum + nullable-column-add shape):**
```sql
-- New migration: 20260913HHMMSS_phase85_lifecycle.sql
BEGIN;

-- 1. New pgEnum for disposal_reason (matches condition_grade/box_papers_status precedent)
CREATE TYPE disposal_reason AS ENUM ('sold', 'lost', 'gifted', 'stolen', 'traded');

-- 2. Three new nullable columns (LIFE-02)
ALTER TABLE watches
  ADD COLUMN disposal_reason disposal_reason,
  ADD COLUMN sell_price      real,
  ADD COLUMN disposal_date   date;

-- 3. Pre-flight count (divergent predicate per [[post-flight-assertion-predicate-divergence]])
DO $$
DECLARE sold_count integer;
BEGIN
  SELECT count(*) INTO sold_count FROM watches WHERE status = 'sold';
  RAISE NOTICE 'Phase 85: migrating % sold rows to previously_owned', sold_count;
END $$;

-- 4. In-place backfill (project memory: prefer UPDATE over destructive rewrite)
UPDATE watches
   SET status = 'previously_owned', disposal_reason = 'sold'
 WHERE status = 'sold';

-- 5. Post-flight assertion — DIFFERENT predicate from the UPDATE's WHERE (existence check,
--    not a re-run of the same count)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM watches WHERE status = 'sold') THEN
    RAISE EXCEPTION 'Phase 85 aborted — rows with status=sold still exist after backfill';
  END IF;
END $$;

COMMIT;
```

A **second** migration (or the same one) must update the only DB-level `'sold'` reference outside this table: the `comments_select`/`comments_insert` RLS policies in `20260522000000_phase53_likes_comments_rls.sql` (lines 204, 237) use `w.status IN ('owned', 'sold', 'grail')`. These must be re-`CREATE POLICY`'d (via `DROP POLICY IF EXISTS` + `CREATE POLICY`, matching that file's own idempotent pattern) with `'previously_owned'` substituted for `'sold'`.

**Do NOT touch:** `20260504120000_phase27_sort_order.sql` — it is a one-time historical backfill migration that already executed against prod; it references `status IN ('owned','sold')` but this is now dead historical code, not a live function. Leave it as-is (editing historical migration files that have already run risks the `pg_depend`/idempotency issues the project memory warns about, for zero benefit).

**Also do NOT touch:** `20260427000001_phase17_pg_cron.sql`'s `refresh_watches_catalog_counts()` — it already filters `status IN ('owned','grail')` for `owners_count` (excludes `sold`/`previously_owned` already, by design) and `status = 'wishlist'` for `wishlist_count`. This function is **already correct** for LIFE-06's counting requirements with zero change needed.

### Pattern 2: ⋯ overflow menu on the LIVE collection card (LIFE-03, D-05)

**What:** The Collection tab (`/u/[username]/collection`) renders `CollectionTabContent.tsx` → `ProfileWatchCard.tsx` directly (NOT `SortableProfileWatchCard` — that dnd-kit wrapper is only used by the Wishlist tab today; Phase 86 will introduce it to Collection). `ProfileWatchCard`'s entire visual card is wrapped in a single Next.js `<Link href={/w/${watch.id}}>`. The component ALREADY has two nested interactive elements inside that `<Link>` that must not trigger navigation — the like and comment chips — and both use the exact same guard:
```tsx
// Source: src/components/profile/ProfileWatchCard.tsx L83-85 (existing, proven pattern)
function handleLikeClick(e: React.MouseEvent) {
  e.preventDefault() // D-02: stop <Link> navigation
  e.stopPropagation()
  ...
}
```
The `WatchCommentSheet` dialog itself is deliberately rendered **outside** the `<Link>` (as a sibling in the returned fragment) "so the portaled sheet's clicks... don't React-bubble through the React tree into the Link's onClick."

**When to use:** Building the D-05 ⋯ menu trigger + D-16 edit-entry menu on previously-owned cards.

**Recommended shape** — mirror `WearOverflowMenu.tsx` (`src/components/wear/WearOverflowMenu.tsx`) almost verbatim, which is the exact "owner-only ⋯ menu on a card" precedent already proven in this codebase:
```tsx
// Source: src/components/wear/WearOverflowMenu.tsx (adapt for ProfileWatchCard)
<DropdownMenu open={open} onOpenChange={handleOpenChange}>
  <DropdownMenuTrigger
    aria-label="More options"
    onClick={(e) => { e.preventDefault(); e.stopPropagation() }} // REQUIRED: nested inside <Link>
    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
  >
    <MoreHorizontal className="size-5" aria-hidden />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {isOwner && watch.status === 'owned' && (
      <DropdownMenuItem onClick={handleMarkPreviouslyOwnedSelect}>
        Mark as previously owned
      </DropdownMenuItem>
    )}
    {isOwner && watch.status === 'previously_owned' && (
      <DropdownMenuItem render={<Link href={`/w/${watch.id}/edit`} />}>
        Edit
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
{/* Dialog rendered OUTSIDE the <Link>, like WatchCommentSheet, for the same portal-bubbling reason */}
<MarkPreviouslyOwnedDialog open={dialogOpen} onOpenChange={setDialogOpen} watchId={watch.id} />
```
`@base-ui/react/menu`'s `Trigger` does not itself call `stopPropagation` on the underlying anchor's click listener — an explicit `onClick` guard is required, exactly as the existing like/comment chips already demonstrate. `DropdownMenuTrigger`/`DropdownMenuContent` forward arbitrary props (`MenuPrimitive.Trigger.Props`), so adding `onClick` is a type-safe, zero-friction addition.

### Pattern 3: Promotion detection + celebration transport (LIFE-04, D-09/D-10/D-11)

**What:** Two Server Actions can produce a wishlist/grail→owned transition: `editWatch` (`src/app/actions/watches.ts`) and `moveWishlistToCollection` (same file). Both already fetch `priorRow` via `watchDAL.getWatchById` before writing, and `editWatch` already has a working example of "detect a status transition off the prior row and branch on it" in its (soon-to-be-removed) `isTransitioningToSold` block:
```ts
// Source: src/app/actions/watches.ts L688-689 (existing pattern to model D-09's detection on)
const isTransitioningToSold =
  updatePayload.status === 'sold' && priorRow.status !== 'sold'
```
Model the promotion detection the same way, in both functions:
```ts
const isPromotionToOwned =
  (priorRow.status === 'wishlist' || priorRow.status === 'grail') &&
  updatePayload.status === 'owned'
const wasGrail = priorRow.status === 'grail'
```
D-04's undo-nulling uses the mirror-image check:
```ts
const isExitingPreviouslyOwned =
  priorRow.status === 'previously_owned' &&
  updatePayload.status !== undefined &&
  updatePayload.status !== 'previously_owned'
if (isExitingPreviouslyOwned) {
  updatePayload = { ...updatePayload, disposalReason: null, sellPrice: null, disposalDate: null }
}
```
Both signals need to reach the client. `ActionResult<Watch>` is the project-wide Server Action contract (`src/lib/actionTypes.ts`) — widening its generic ONLY for `editWatch`/`moveWishlistToCollection` to `ActionResult<{ watch: Watch; promoted: boolean; promotedFrom?: 'wishlist' | 'grail' }>` is additive-safe: grepping every non-test importer of both functions (`WatchDetailHero.tsx`, `WatchForm.tsx`, `AddWatchFlow.tsx`) shows none of them destructure fields off `result.data` in the edit/promotion branches except the CREATE-mode `'id' in result.data` check in `WatchForm.tsx`, which is on `addWatch`'s return, not `editWatch`'s — unaffected.

**Transport across `router.push` — recommended approach (Claude's Discretion, resolved):** fire the confetti + celebratory toast **before** calling `router.push`, directly in the two call sites that already do exactly this for the non-celebration toast today:
```tsx
// Source: src/components/watch/AddWatchFlow.tsx handleMoveToCollection (existing proven shape)
if (actionHref) {
  toast.success('Moved to collection', { action: { label: 'View', onClick: () => router.push(actionHref) } })
}
setUrl('')
setState({ kind: 'search-idle' })
router.push(dest)  // <-- toast fires BEFORE this and is proven to survive it (portal-mounted sonner)
```
Do the identical thing for the celebration: `if (result.data.promoted) { fireConfettiIfAllowed(); toast.success(result.data.promotedFrom === 'grail' ? 'Grail acquired' : 'Added to your collection!') }` then the existing `router.push(dest)` unchanged. **Do not** use a query param or `sessionStorage` flag read on the destination page's mount — this project has a documented Router Cache gotcha (`[[router-cache-stale-instance]]`): "Next 16 restores same stale client instance on revisit; reset one-shot state on onPointerDown, not mount," meaning a mount-effect on the destination tab may not re-fire if that route instance is already cached from a prior visit. Firing before the push sidesteps this: no destination-page code is needed at all, and canvas-confetti's canvas element is appended directly to `document.body` (outside the React tree it was called from), so it is not torn down by the Next.js soft-navigation that follows.

**`prefers-reduced-motion` gate (Claude's Discretion resolved):**
```ts
function fireConfettiIfAllowed() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
}
```

### Pattern 4: Collection tab toggle + owner-only previously-owned data flow (LIFE-05)

**What:** `/u/[username]/[tab]/page.tsx` is a `unstable_instant = false` Cache-Components route with a locked structural invariant (D-52-16 / recurrence-5 fix, per project memory `[[phase-52-in-progress]]`): "outer sync / inner async / Suspense" — the outer page component is a pure sync JSX scaffold; ALL runtime API access (params await, `getCurrentUser`, the `ProfileShellResolver` call) lives inside the async `ProfileTabContent` that the `<Suspense>` boundary wraps. The `collection` branch (~L384-395) already has `rawWatches`/`watches` (ALL statuses, already fetched) in scope and computes `ownedWatches = watches.filter(w => w.status === 'owned')` before passing to `CollectionTabContent`.

**When to use:** Implementing LIFE-05's data flow.

**Required change is a pure JS filter widening — no new `await`, no structural risk to the Suspense/`unstable_instant` contract:**
```ts
// Source: src/app/u/[username]/[tab]/page.tsx ~L382 (existing) — additive change only
const ownedWatches = watches.filter((w) => w.status === 'owned')
const previouslyOwnedWatches = isOwner
  ? watches.filter((w) => w.status === 'previously_owned')
  : []  // D-13: non-owners never receive these rows, not even filtered client-side
// pass BOTH to CollectionTabContent; the toggle (D-15, not persisted) is pure
// client useState inside CollectionTabContent that decides which array feeds the grid
```
`CollectionTabContent` is already `'use client'` with existing `useState`/`useMemo` filter machinery (`activeChip`, `search`) — the toggle is one more `useState<boolean>(false)` combined into the same `filtered` memo, plus appending a toggle control to the existing `<FilterChips>` row (D-15: "switch or chip at the end of the existing FilterChips row"). No `Switch` UI primitive exists in `src/components/ui/` today — reuse the `FilterChips` chip visual style (`bg-accent text-accent-foreground` active state, per the project's "accent is the active/selected token" convention) for a toggle-shaped sibling button rather than introducing a new dependency.

### Recommended Project Structure
```
src/
├── app/actions/watches.ts          # editWatch gains isPromotionToOwned + isExitingPreviouslyOwned branches; new markPreviouslyOwned wraps editWatch OR reuses it directly
├── app/actions/divestments.ts      # recordDivestment REMOVED (D-03)
├── components/profile/
│   ├── ProfileWatchCard.tsx        # gains ⋯ menu (owner-only), muted styling + badge for previously_owned
│   ├── CollectionTabContent.tsx    # gains toggle state + previously-owned filter branch
│   ├── FilterChips.tsx             # gains an appended toggle chip (or sibling toggle button)
│   └── MarkPreviouslyOwnedDialog.tsx  # NEW — reason radiogroup + optional date/price, calls editWatch
├── components/watch/
│   ├── WatchForm.tsx                # status <Select> options filtered per D-07
│   └── AddWatchFlow.tsx             # handleMoveToCollection fires celebration before router.push
├── lib/
│   ├── types.ts                     # WatchStatus union, Watch.disposalReason/sellPrice/disposalDate
│   ├── constants.ts                 # WATCH_STATUSES
│   └── celebrate.ts                 # NEW — tiny confetti + reduced-motion wrapper
├── db/schema.ts                     # status enum list, new disposalReasonEnum + 3 columns
└── data/
    ├── watches.ts                   # mapRowToWatch/mapDomainToRow gain 3 fields; visitor predicate (D-14)
    └── recommendations.ts           # excludeKey exclusion set gains previously_owned (D-18)
supabase/migrations/
└── 20260913HHMMSS_phase85_lifecycle.sql   # NEW — status backfill + new columns + RLS policy update
```

### Anti-Patterns to Avoid
- **Building on `CollectionView.tsx`/`WatchCard.tsx`/`StatusToggle.tsx`:** confirmed dead — zero importers under `src/app/` `[VERIFIED: grep -rn "CollectionView" src/app → no matches; git log shows last touch 2026-04-13, pre-Phase-27]`. `useWatchStore` (Zustand) is likewise only referenced by this same dead island (`FilterBar.tsx`, `WatchGrid.tsx`). They still need their `'sold'` literal removed for the `WatchStatus`/`WATCH_STATUSES` type change to compile, but need zero UAT — repeats the exact "trace the rendered component" lesson from Phase 83's `WatchDetail.tsx` dead-island bug (`[[watchdetail-dead-island]]`).
- **Calling `todayLocalISO()` inside a Server Action:** the function's own header comment is explicit — "do NOT call this helper inside a Server Action body. Server Actions run on the Vercel runtime where the process zone is UTC." For D-06's "server-side rejection of future dates," follow the `logBackfillWear` precedent exactly (see Pitfall 5) — the client sends its own computed `today`, the server bounds-checks it for plausibility, then does a lexical string comparison. Never derive "today" server-side.
- **Widening `ActionResult<Watch>` globally:** only widen the `data` shape for `editWatch`/`moveWishlistToCollection` specifically (or add a sibling non-generic field) — do not touch the shared `ActionResult<T>` type or `addWatch`'s return shape, which other call sites depend on unchanged.
- **Guarding the previously-owned transition with a `catalogId` requirement:** the OLD sold-transition code required `priorRow.catalogId` because it inserted a `divestments` row (FK to `watches_catalog`). D-03 removes that dual-write entirely — the new previously-owned transition needs no `catalogId` guard and no `db.transaction()`; it's a plain single-table `updateWatch` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confetti burst animation | Custom canvas/CSS particle system | `canvas-confetti` | Battle-tested, zero-dependency, ~6.3M weekly downloads, handles device-pixel-ratio scaling and canvas cleanup already |
| ⋯ overflow menu | Custom popover/portal logic | `@base-ui/react/menu` via existing `src/components/ui/dropdown-menu.tsx` wrapper | Already the project's menu primitive; `WearOverflowMenu.tsx` proves the exact "card overflow menu" shape works |
| Reason radiogroup | New generic `RadioGroup` UI primitive | The hand-rolled WAI-ARIA `role="radiogroup"` + roving-tabindex pattern in `ConfirmStep.tsx` (Phase 68) | No `radio-group.tsx` exists in `src/components/ui/`; the project has already solved and tested this exact accessibility pattern twice (Phase 68, Phase 82) |
| "Is this date in the future" server check | A new server-side "get today" helper | The `isPlausibleClientToday` + lexical string-compare pattern in `src/app/actions/wearEvents.ts` (~L166, ~L590) | This exact problem (client-local date vs. server-UTC date) already caused a shipped incident (260622-exo) that this pattern was written to fix |

**Key insight:** every mechanism this phase needs (overflow menu, radiogroup, prior-row transition detection, future-date validation, toast-survives-navigation) already has a proven, shipped precedent somewhere in this codebase. The work is adaptation, not invention.

## Status-Predicate Audit (exhaustive)

Every `'sold'` occurrence and every status-predicate site found via `grep -rn` across `src/`, `supabase/migrations/`, `scripts/`, and `tests/`. Classified by required action.

### Must change — literal `'sold'` removal (type/schema layer)
| File:Line | Current | Required Change |
|-----------|---------|------------------|
| `src/lib/types.ts:1` | `WatchStatus = 'owned' \| 'wishlist' \| 'sold' \| 'grail'` | → `'owned' \| 'wishlist' \| 'previously_owned' \| 'grail'`; add `disposalReason?: DisposalReason`, `sellPrice?: number`, `disposalDate?: string` to `Watch` interface |
| `src/lib/constants.ts:131-136` | `WATCH_STATUSES = ['owned','wishlist','sold','grail']` | → `['owned','wishlist','grail','previously_owned']` (order matters for WatchForm iteration if unfiltered elsewhere) |
| `src/db/schema.ts:100` | `status: text('status', {enum:[...,'sold',...]})` | → replace `'sold'` with `'previously_owned'`; add `disposalReasonEnum` pgEnum export + 3 new columns |
| `src/app/actions/watches.ts:41` | `z.enum(['owned','wishlist','sold','grail'])` | → `z.enum(['owned','wishlist','grail','previously_owned'])`; add `disposalReason`/`sellPrice`/`disposalDate` optional fields to both zod schemas |
| `src/components/filters/StatusToggle.tsx:14` | `{ value: 'sold', label: 'Sold' }` | Dead code (see below) — update for type-compile only, no UAT needed |
| `src/components/watch/WatchCard.tsx:52` | `watch.status === 'sold' ? 'secondary' : 'outline'` | Dead code (see below) — update for type-compile only |
| `src/lib/watchFlow/destinations.ts:34` (docstring) + `destinations.test.ts:69` | comment + test literal reference `'sold'` | Update comment; update test assertion to `previously_owned` — logic itself (`status==='wishlist'||'grail' ? wishlist : collection`) is already correct (allowlist inverse) |

### Must change — denylist/allowlist logic requiring real edits
| File:Line | Current | Required Change |
|-----------|---------|------------------|
| `src/data/watches.ts:293` | `sql\`(...OR (${watches.status} IN ('owned','sold','grail') AND collectionPublic))\`` | D-14: remove `previously_owned` (renamed from `sold`) from this non-owner branch entirely — visitors should NOT match on it. New: `IN ('owned','grail')` for the non-owner OR-branch (owner short-circuit via `eq(watches.userId, viewerId)` already covers the owner's own previously-owned reads) |
| `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql:204,237` | `w.status IN ('owned', 'sold', 'grail')` (comments RLS) | New migration re-creates `comments_select`/`comments_insert` policies with `'previously_owned'` substituted for `'sold'` |
| `src/app/actions/watches.ts:679-729` (`editWatch` dual-write) | `isTransitioningToSold` + `db.transaction` + `divestments` insert | D-03: remove entirely; replace with plain `updateWatch` call carrying the new disposal fields; add `isExitingPreviouslyOwned` null-out branch (D-04) |
| `src/app/actions/divestments.ts` (whole file) | `recordDivestment` exported | D-03: retire the export (delete function or leave file empty/deprecated-only) |
| `src/app/actions/watches.ts:458-471` (`moveWishlistToCollection` status whitelist) | rejects `sold`/`grail` explicitly with a T-70-03 error message | Rejection set becomes `previously_owned`/`grail` — update the error-message interpolation (already dynamic: `` `Cannot move ${priorRow.status} watch to collection` ``, needs no logic change, just the status value itself changes at the data layer) |
| `src/components/watch/WatchForm.tsx` status `<Select>` (~L438-449) | iterates `WATCH_STATUSES` unconditionally | D-07: filter out `'previously_owned'` unless `watch?.status === 'previously_owned'` |

### Already safe — allowlists that automatically exclude `previously_owned` (NO code change needed)
| File:Line | Pattern | Why it's safe |
|-----------|---------|----------------|
| `src/lib/similarity.ts:311-314` | `status === 'owned' \|\| status === 'grail'` | Allowlist; D-19 explicitly says keep as-is |
| `src/lib/gapFill.ts:68` | `status === 'owned' \|\| status === 'grail'` | Allowlist |
| `src/lib/tasteOverlap.ts:59-60` | `status === 'owned'` | Allowlist |
| `src/lib/wornTabScope.ts:27` | `status === 'owned'` | Allowlist (Phase 84 already scoped this) |
| `src/lib/recommendations.ts:141,172,186` + `src/data/recommendations.ts:136,184,293` | `status === 'owned'` | Allowlist |
| `src/data/recommendations.ts:274` | `status === 'owned' \|\| 'wishlist' \|\| 'grail'` (viewer exclusion set) | **Needs D-18 addition**: add `\|\| v.status === 'previously_owned'` here — this is the ONE recommendations.ts site that needs a real edit (viewer's own previously-owned watches must also be excluded from being re-recommended to themselves) |
| `src/data/discovery.ts:96,115` | `inArray(status, ['owned','wishlist','grail'])` | Allowlist; comment already says "exclude sold" — automatically excludes `previously_owned` too |
| `src/data/follows.ts:174-175,304,331` | `FILTER (WHERE status='owned')`, `IN ('wishlist','grail')`, `IN ('owned','wishlist','grail')` | All allowlists |
| `src/data/catalog.ts:704-713,858-867` | badge resolution `if (status==='owned') ... else if (status==='wishlist' && prior!=='owned')` — sold/grail "fall through" | Allowlist-by-omission; `previously_owned` will fall through identically to how `sold` did |
| `src/data/watches.ts:347,469,547,571` | `inArray(status, ['wishlist','grail'])`, caller-parameterized `statuses` | Allowlists, no `sold` reference |
| `src/data/comments.ts:82`, `src/data/reactions.ts:220,254` | `status !== 'wishlist'` | Allowlist-inverse; previously-owned watches remain "visible" to this predicate exactly as sold ones did — see Open Question 1 for the residual defense-in-depth gap this leaves |
| `src/app/wears/[username]/page.tsx:116`, `src/app/wear/[wearEventId]/page.tsx:78` | `status === 'owned' \|\| status === 'wishlist'` (viewer's OWN watch-has check) | Allowlist; correct behavior — a viewer who sold their own copy should see "Add to wishlist" again |
| `src/app/page.tsx:95`, `profile-gate.tsx:129-131`, `BottomNavServer.tsx:42`, `Header.tsx:44`, insights components (`SleepingBeautiesSection`, `GoodDealsSection`, `PersonalInsightsGrid`, `InsightsTabContent`), `src/lib/tasteTags.ts:23`, `[tab]/page.tsx:364,382,531` (Stats tab) | `status === 'owned'` / `'wishlist'\|\|'grail'` | All allowlists — headers, bottom-nav counts, Stats tab aggregates, taste tags all already exclude `sold` and will exclude `previously_owned` automatically |
| `supabase/migrations/20260427000001_phase17_pg_cron.sql` `refresh_watches_catalog_counts()` | `COUNT(*) FILTER (WHERE status IN ('owned','grail'))` for owners_count | Already excludes `sold`; excludes `previously_owned` automatically — **zero migration needed for this function** |

### Historical / do-not-touch
| File | Why leave alone |
|------|------------------|
| `supabase/migrations/20260504120000_phase27_sort_order.sql` | One-time backfill migration that already executed against prod (2026-05-04). References `status IN ('owned','sold')` for a sort_order backfill that already ran. Editing historical migrations that already applied is unnecessary and risks confusing the migration history — leave verbatim. |

### Tests needing updates (non-exhaustive but complete for `'sold'` literal grep)
`src/app/actions/__tests__/watches-recs-invalidation.test.ts`, `src/app/actions/__tests__/moveWishlistToCollection.test.ts:190`, `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx:148`, `src/components/watch/ConfirmStep.test.tsx`, `src/components/watch/AddWatchFlow.test.tsx:265`, `tests/static/WatchCard.sold-badge.test.tsx` (dead-component static guard — either delete or repoint at the still-dead file with updated literal), `tests/integration/phase37-rls.test.ts` (calls `recordDivestment` directly — **will fail to compile once D-03 retires the export**; must be updated to stop calling it, while keeping the divestments-table-shape assertions which remain valid since the table isn't dropped), `tests/lib/tasteTags.test.ts:32`, `tests/data/comments.test.ts:113`, `tests/data/searchCatalogWatches.test.ts:233`, `tests/data/getWatchByIdForViewer.test.ts:182,191`, `tests/data/getFollowedOwnersForCatalog.test.ts:108,293,298`, `tests/data/getCollectorsForCatalog.test.ts:102,260,265`.

## Common Pitfalls

### Pitfall 1: Menu trigger nested inside `<Link>` swallows the click into navigation
**What goes wrong:** Clicking the new ⋯ trigger navigates to `/w/[id]` instead of opening the menu.
**Why it happens:** `ProfileWatchCard`'s whole card is one `<Link>`. Next.js `Link` fires navigation on click unless `e.preventDefault()` was called somewhere in the bubble chain before it reaches the anchor.
**How to avoid:** Copy the exact pattern already used by the like/comment chips in the same file: `onClick={(e) => { e.preventDefault(); e.stopPropagation(); ... }}` on the `DropdownMenuTrigger`.
**Warning signs:** Manual click test navigates away instead of opening the popup; unit test asserting `router.push` was NOT called on trigger click.

### Pitfall 2: Menu popup content torn down mid-interaction if nested inside `<Link>`
**What goes wrong:** The dialog opened from a menu item (e.g. the disposal dialog) unmounts unexpectedly because it was rendered inside the same subtree the menu's close-on-select behavior tears down.
**Why it happens:** `WatchCommentSheet` was deliberately pulled OUTSIDE the `<Link>` in `ProfileWatchCard` for exactly this reason (documented in-file: "so the portaled sheet's clicks... don't React-bubble through the React tree into the Link's onClick").
**How to avoid:** Render `MarkPreviouslyOwnedDialog` as a sibling to the `<Link>` in `ProfileWatchCard`'s returned fragment, controlled by lifted `useState`, exactly mirroring the `WatchCommentSheet` placement.
**Warning signs:** Dialog flickers or closes immediately after opening from the menu.

### Pitfall 3: Celebration signal lost across `router.push` if read from a destination-page mount effect
**What goes wrong:** Confetti/toast never appears, or appears inconsistently on repeat visits.
**Why it happens:** Project memory `[[router-cache-stale-instance]]`: "Next 16 restores same stale client instance on revisit" — a `useEffect`-on-mount that reads a query param or `sessionStorage` flag on the destination page may not re-fire if the Router Cache serves an already-mounted instance of that route.
**How to avoid:** Fire the celebration (confetti call + `toast.success(...)`) in the SAME client component that already awaits the Server Action result, immediately before the existing `router.push(dest)` call — do not defer it to the destination page at all.
**Warning signs:** Celebration works the first time a user promotes a watch in a session but not on subsequent promotions without a full page reload.

### Pitfall 4: `todayLocalISO()` called server-side for future-date validation
**What goes wrong:** A user near a timezone midnight boundary gets an incorrect "future date" rejection or an incorrect acceptance, because the Server Action computed "today" using the Vercel process's UTC clock instead of the user's local calendar day.
**Why it happens:** This exact bug already shipped once (260622-exo incident, documented in `src/lib/wear.ts`'s `todayLocalISO` header) and is why `logBackfillWear` in `src/app/actions/wearEvents.ts` takes BOTH `wornDate` and `today` from the client and does a lexical string comparison server-side, bounded by `isPlausibleClientToday` (±14h of server UTC) so a crafted `today` can't be gamed.
**How to avoid:** The disposal dialog's client-side date input computes `todayLocalISO()` for its `max` attribute (fine — this is client-side). The Server Action commit (whichever action ends up handling the dialog's submit — `editWatch` reused, or a thin wrapper) must accept the client's own `today` value alongside `disposalDate` and replicate the `isPlausibleClientToday` + lexical-compare pattern, or export/reuse that helper from `wearEvents.ts` if it's made shareable.
**Warning signs:** Disposal-date rejection tests pass in UTC-based CI but fail for a manually-tested user in e.g. US Pacific time near midnight.

### Pitfall 5: Widening `ActionResult<Watch>` breaks an unexpected caller
**What goes wrong:** `editWatch`/`moveWishlistToCollection`'s return shape changes from `ActionResult<Watch>` to `ActionResult<{watch, promoted, promotedFrom}>`, and some overlooked caller destructures `result.data.id` or `result.data.status` directly, breaking at compile or runtime.
**Why it happens:** `ActionResult<T>` is used project-wide; a shape change to `T` for these two functions is safe ONLY if every call site is re-verified.
**How to avoid:** `npm run build` is the authoritative gate (per project memory `[[baseline-not-green-build-is-gate]]`) — TypeScript will surface every broken destructure at compile time since `Watch` and the new wrapper shape are structurally distinct. Grep confirmed only 3 non-test importers of these two functions before this research (`WatchDetailHero.tsx`, `WatchForm.tsx`, `AddWatchFlow.tsx`) — re-verify this count at plan time in case anything changed.
**Warning signs:** `npm run build` fails with a property-does-not-exist error on `result.data`.

### Pitfall 6: Forgetting the `divestments`-retirement ripple into `tests/integration/phase37-rls.test.ts`
**What goes wrong:** `npm run build` or `npm run test` fails because a DB-gated integration test still imports and calls `recordDivestment`, which D-03 removes.
**Why it happens:** `recordDivestment` is retired per D-03, but its integration test (which also validates the still-valid `divestments` table SHAPE via raw SQL) calls the function directly to exercise the dual-write transaction rollback behavior (T-37-TXN-01) — behavior that no longer exists once the dual-write is removed.
**How to avoid:** Update `tests/integration/phase37-rls.test.ts` to drop the `recordDivestment`-calling `describe` block while keeping the table-shape/RLS-policy-count assertions (V-04 through V-07), which remain valid since the table is NOT dropped in this phase.
**Warning signs:** TypeScript import error on `recordDivestment` in this test file; or (if left importing a stub) a test that asserts dual-write behavior nothing in the codebase performs anymore.

## Runtime State Inventory

This phase is a rename + additive migration, not a full rebrand/refactor, but the rename touches a status value referenced outside the `watches` table row itself. Checked against the canonical question: *after every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 205 (prod scale, per project memory) `watches` rows with `status='sold'`; local dev DB seed rows (`supabase/seed.sql` + any test fixtures) with `status: 'sold'` | Data migration (the `UPDATE` in the new Supabase migration) handles prod + local via `supabase db push` / `drizzle-kit push`. Any hardcoded `'sold'` fixture literals in `supabase/seed.sql` or test seed data need a values update — checked: no `'sold'` literal found in `supabase/seed.sql` at research time (grep returned no hits in that file specifically; the `'sold'` hits found were all in `src/`/`tests/`/`supabase/migrations/`) |
| Live service config | None found — no n8n/Datadog/Tailscale/Cloudflare-style external service references `watches.status` string values | None |
| OS-registered state | None — no Task Scheduler/pm2/launchd/systemd entries reference watch status | None |
| Secrets/env vars | None — no env var name or SOPS key references `'sold'`/`status` | None |
| Build artifacts / installed packages | None — no compiled binary or egg-info-style artifact caches the status enum | None |
| DB-level RLS (not a standard rename category, but load-bearing here) | `comments_select`/`comments_insert` policies in `20260522000000_phase53_likes_comments_rls.sql` hardcode `'sold'` in a `w.status IN (...)` predicate | New migration must re-`CREATE POLICY` both with `'previously_owned'` substituted (see Pattern 1) |

**Nothing found in the OS-registered / secrets / build-artifact categories** — verified by grep across the categories' typical locations (no matches for `'sold'` outside `src/`, `tests/`, `supabase/`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canvas-confetti` is the right package name/library for the celebration effect | Standard Stack, Don't Hand-Roll | If the name is wrong or the library has changed API shape since training, `npm install` would 404 or the call signature (`confetti({...})`) could differ — mitigated by the registry+slopcheck check already run (both passed), but the RECOMMENDATION itself is training-derived, so verify the actual API via its README/`npm view canvas-confetti readme` at implementation time before wiring calls |
| A2 | No project skill files or additional lint rules constrain confetti/celebration UI patterns beyond what CLAUDE.md states | Standard Stack | Low — `.claude/skills`/`.agents/skills` were confirmed absent for this repo at research time |

## Open Questions (RESOLVED)

1. **Comments/reactions on a previously-owned watch remain reachable if a non-owner already has the `watch_id` (e.g., a stale bookmark or an old notification link), even though `/w/[id]` itself will 404 for that non-owner per D-14.**
   - What we know: `src/data/comments.ts:82` (`status !== 'wishlist'`) and `src/data/reactions.ts:220,254` are allowlist-inverse checks that treat `previously_owned` exactly like `sold`/`owned`/`grail` today — i.e., comment/reaction visibility for a previously-owned watch is unaffected by this phase and stays "visible if not wishlist."
   - What's unclear: Since the watch detail PAGE itself 404s for non-owners on a previously-owned watch (D-14), a non-owner can no longer discover the `watch_id` through normal navigation — but any pre-existing comment thread, notification, or direct link a non-owner already holds could still resolve if the comments/reactions endpoints are hit directly (defense-in-depth question, not a UI-reachable path under normal use).
   - RESOLVED: Recommendation: Out of this phase's locked scope (D-14 only requires the `/w/[id]` page itself to 404). Flag as a candidate defense-in-depth follow-up for a future phase; do not block Phase 85 on it since D-13/D-14 as literally stated only govern the watch detail page and the toggle, not the comments/reactions data-layer predicates.

2. **Whether `disposal_reason`/`sell_price`/`disposal_date` should get a DB CHECK constraint tying their non-null-ness to `status='previously_owned'` (Claude's Discretion per CONTEXT.md).**
   - What we know: Drizzle 0.45.2 in this repo cannot express CHECK constraints in its pg-core DSL (confirmed via existing `src/db/schema.ts` Phase 45 comment) — any such constraint requires hand-written raw SQL in the Supabase migration, mirroring the `path_type_check`/`cms_settings_single_row` precedent from Phase 45.
   - What's unclear: D-04's undo path already handles nulling server-side on every status-exit from `previously_owned` via the Server Action — a DB CHECK would be a second, redundant enforcement layer (defense-in-depth vs. added migration complexity).
   - RESOLVED: Recommendation: Skip the CHECK constraint. The Server Action is the sole write path (no direct client DB access), D-04's null-out logic is deterministic, and the existing precedent shows CHECK constraints are used in this codebase for un-bypassable structural invariants (e.g., `cms_settings_single_row`), not defense-in-depth on already-server-gated fields.

## Environment Availability

No new external services, CLIs, or runtimes are required by this phase — `canvas-confetti` is a pure client-side npm package with no native build step, and all DB work uses the existing local Supabase + Drizzle toolchain already required by CLAUDE.md's Local-First Development gate. Skipping this section's table per the "no external dependencies" condition (Docker/Supabase/Node/npm are already covered by the existing project-wide setup, not phase-specific).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (`vitest run`), jsdom environment by default, `environment: 'node'` override available per-file |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <file>` (targeted) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | `previously_owned` is a valid `WatchStatus`; `sold` removed | unit (static/type) | `npx vitest run tests/static/WatchCard.sold-badge.test.tsx` (update or delete) + `npm run build` (TS union exhaustiveness) | ✅ (needs update) |
| LIFE-02 | `disposal_reason`/`sell_price`/`disposal_date` round-trip through `mapRowToWatch`/`mapDomainToRow` | unit | `npx vitest run src/app/actions/__tests__/watches.test.ts` (extend) | ❌ Wave 0 — new assertions needed |
| LIFE-03 | Server Action rejects future `disposalDate`; requires `disposalReason`; nulls fields on undo | unit | `npx vitest run src/app/actions/__tests__/watches.test.ts` (extend with disposal-flow cases) | ❌ Wave 0 |
| LIFE-04 | `editWatch`/`moveWishlistToCollection` return `promoted: true` on wishlist/grail→owned, `false` otherwise; grail sets `promotedFrom: 'grail'` | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` (extend) | ✅ (extend existing file) |
| LIFE-04 | Confetti skipped under `prefers-reduced-motion` | unit (jsdom `matchMedia` mock) | `npx vitest run src/lib/__tests__/celebrate.test.ts` | ❌ Wave 0 — new file |
| LIFE-05 | Non-owner never receives `previously_owned` rows from `[tab]/page.tsx`; toggle shows/hides cards client-side | unit + component (RTL) | `npx vitest run src/components/profile/__tests__/CollectionTabContent.test.tsx` (extend) | ✅ (extend existing file) |
| LIFE-06 | `analyzeSimilarity`/recommender exclude `previously_owned` | unit | `npx vitest run tests/lib/similarity.taste-present.test.ts` + a new `excludeKey` assertion in recommendations tests | ✅ + ❌ (new assertion) |
| LIFE-06 | Visitor gets `notFound()` on previously-owned `/w/[id]` | unit (DAL) | `npx vitest run tests/data/getWatchByIdForViewer.test.ts` (extend the existing `status:'sold'` test case to assert `previously_owned` behaves identically) | ✅ (extend existing file, line 182/191) |
| RLS (comments) | `comments_select`/`comments_insert` allow `previously_owned` the same as `owned`/`grail` | integration (DB-gated) | `npx vitest run tests/integration/phase37-rls.test.ts` and any comments-RLS integration test — search for a phase53-comments-RLS integration file at plan time | Needs confirmation at plan time — not directly located in this research pass |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the file(s) touched.
- **Per wave merge:** `npm run test` (full suite) + `npm run build`.
- **Phase gate:** Full suite green + local-dev walk against local Supabase (per CLAUDE.md's Local-First Development gate — this phase is DB-touching, so `npm run dev` verification against a locally-migrated Supabase instance is REQUIRED before prod push, matching the `workflow.use_worktrees=false` + no-worktree-when-DB-touching project rule).

### Wave 0 Gaps
- [ ] Extend `src/app/actions/__tests__/watches.test.ts` — LIFE-02/LIFE-03 disposal-field round-trip + future-date rejection + undo-nulling cases.
- [ ] `src/lib/__tests__/celebrate.test.ts` — new file for the confetti/reduced-motion wrapper (LIFE-04).
- [ ] Extend `src/app/actions/__tests__/moveWishlistToCollection.test.ts` — `promoted`/`promotedFrom` return-shape assertions (LIFE-04); update the existing `status: 'sold'` rejection-set test (line 190) to `previously_owned`.
- [ ] Extend `src/components/profile/__tests__/CollectionTabContent.test.tsx` — toggle show/hide + owner-only gating (LIFE-05).
- [ ] Update `tests/static/WatchCard.sold-badge.test.tsx` — either delete (dead component) or repoint the literal to `previously_owned` for type-compile parity.
- [ ] Update `tests/integration/phase37-rls.test.ts` — remove `recordDivestment`-calling assertions per Pitfall 6; keep table-shape assertions.
- [ ] Locate (at plan time) the phase53 comments-RLS integration test, if one exists beyond `phase37-rls.test.ts`, and extend it for the `previously_owned` RLS policy update.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — existing `getCurrentUser()` gate on all Server Actions |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | Owner-only mutation via existing `watchDAL.getWatchById(user.id, watchId)` ownership-scoped fetch pattern (two-layer IDOR gate already established project-wide); D-13/D-14 visibility gates enforced in `src/data/watches.ts` DAL WHERE clause (service-role bypasses RLS — DAL is the real gate per `[[rls-subquery-caller-rls]]`) |
| V5 Input Validation | Yes | zod `safeParse` on the extended `updateWatchSchema` (reason enum, price/date shape); server-side future-date rejection via the `isPlausibleClientToday` pattern, not client trust |
| V6 Cryptography | No | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-owner marks another user's watch as previously-owned (IDOR) | Tampering | Existing two-layer gate: Server Action `getCurrentUser()` + DAL `getWatchById(user.id, watchId)` scoping (already proven pattern across every mutation in `watches.ts`) — no new mitigation needed, just apply the same pattern to the new disposal fields |
| Crafted future `disposalDate` to misrepresent collection history | Tampering | `isPlausibleClientToday`-style bounds check + lexical string compare server-side (Pitfall 4) |
| Non-owner reads disposal reason/price/date via a stale link or API probe | Information Disclosure | D-14's `/w/[id]` 404 for non-owners covers the primary surface; Open Question 1 flags the residual comments/reactions surface as an accepted, explicitly out-of-locked-scope gap |
| RLS policy drift after rename (comments RLS still allowlisting old `'sold'` string, silently degrading to deny) | Tampering / availability regression | New migration explicitly re-creates both `comments_select`/`comments_insert` policies with `'previously_owned'` substituted — do not rely on the DB layer self-correcting |

## Sources

### Primary (HIGH confidence — verified directly in this codebase)
- `src/db/schema.ts`, `src/data/watches.ts`, `src/app/actions/watches.ts`, `src/app/actions/divestments.ts` — direct read, full file/section review
- `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`, `20260511010000_phase37_layer_d.sql`, `20260427000001_phase17_pg_cron.sql`, `20260504120000_phase27_sort_order.sql`, `20260522000000_phase53_likes_comments_rls.sql` — direct read
- `src/components/profile/ProfileWatchCard.tsx`, `CollectionTabContent.tsx`, `SortableProfileWatchCard.tsx`, `FilterChips.tsx` — direct read
- `src/components/wear/WearOverflowMenu.tsx`, `src/components/ui/dropdown-menu.tsx` — direct read (menu precedent)
- `src/app/actions/wearEvents.ts` (`isPlausibleClientToday`, `logBackfillWear`) — direct read (future-date validation precedent)
- `src/lib/wear.ts` (`todayLocalISO` header warning) — direct read
- `src/components/watch/AddWatchFlow.tsx`, `WatchForm.tsx`, `WatchDetailHero.tsx` — direct read
- `src/app/u/[username]/[tab]/page.tsx` — direct read (Cache Components structural constraint)
- Exhaustive `grep -rn "'sold'"` and status-predicate greps across `src/`, `supabase/migrations/`, `tests/`
- `npm view canvas-confetti version|time.modified`, npm downloads API, `slopcheck install canvas-confetti` — registry verification (side effect reverted, see Package Legitimacy Audit note)

### Secondary (MEDIUM confidence)
- None — all findings in this research were verified directly against the codebase or the npm registry.

### Tertiary (LOW confidence)
- `canvas-confetti` as the specific package recommendation — training-knowledge-derived (see Assumptions Log A1); registry existence and slopcheck verdict confirmed, but the recommendation itself is `[ASSUMED]` per the package-name provenance rule.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing dependencies verified in `package.json`; the one new dependency's registry existence and slopcheck verdict verified directly, only its provenance (training knowledge) keeps it at `[ASSUMED]`
- Architecture: HIGH — every pattern cited was read directly from the live codebase, not inferred
- Pitfalls: HIGH — every pitfall traces to either a project memory entry (documented past incident) or a directly-observed code comment/warning in this codebase

**Research date:** 2026-09-13
**Valid until:** 30 days (stable internal codebase research; re-verify `canvas-confetti` version/API at implementation time since that single external fact ages independently)
