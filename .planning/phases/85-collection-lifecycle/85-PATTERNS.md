# Phase 85: Collection lifecycle - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 22 (new + modified)
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260913HHMMSS_phase85_lifecycle.sql` (NEW) | migration | batch (DDL + UPDATE) | `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` (pre/post-flight assertion shape) + `supabase/migrations/20260511010000_phase37_layer_d.sql` (pgEnum + ADD COLUMN shape) | exact (composite of two exact analogs) |
| `src/db/schema.ts` (status enum + `disposalReasonEnum` + 3 columns) | model | CRUD | `src/db/schema.ts` `conditionGradeEnum`/`boxPapersStatusEnum` + `watches` table itself (lines 63-76, 100-147) | exact (in-file precedent) |
| `src/lib/types.ts` (`WatchStatus`, `Watch.disposalReason/sellPrice/disposalDate`, `DisposalReason`) | model | CRUD | `src/lib/types.ts` `ConditionGrade`/`BoxPapersStatus` + `Watch` interface provenance fields (lines 28-42, 111-118) | exact (in-file precedent) |
| `src/lib/constants.ts` (`WATCH_STATUSES`, `DISPOSAL_REASONS` + labels) | config | CRUD | `src/lib/constants.ts` `CONDITION_GRADES`/`CONDITION_GRADE_LABELS`, `BOX_PAPERS_STATUSES`/`BOX_PAPERS_LABELS` (lines 144-182) | exact (in-file precedent) |
| `src/app/actions/watches.ts` (zod schema extension, `editWatch` promotion/undo/disposal branches, `moveWishlistToCollection` promotion branch) | service (Server Action) | CRUD | same file's `isTransitioningToSold` block (~L678-729) + `moveWishlistToCollection`'s status-whitelist rejection (~L457-471) | exact (in-file precedent to replace/model) |
| `src/app/actions/divestments.ts` (`recordDivestment` retired) | service (Server Action) | CRUD | N/A — file being deprecated, not modeled | exact (deletion target, not an analog target) |
| `src/data/watches.ts` (`mapRowToWatch`/`mapDomainToRow` +3 fields, visitor-visibility predicate) | model (DAL) | CRUD | same file's `condition`/`boxPapers`/`purchaseDate` mapping (lines 51-58, 96-100) + `getWatchByIdForViewer` predicate (~L291-294) | exact (in-file precedent) |
| `src/data/recommendations.ts` (`excludeKey` exclusion set +`previously_owned`) | service (DAL/business logic) | batch | same file's exclusion loop (~L271-277) | exact (in-file precedent) |
| `src/components/profile/MarkPreviouslyOwnedDialog.tsx` (NEW) | component (dialog) | request-response | `src/components/watch/ConfirmStep.tsx` (radiogroup, lines 154-299) + `src/components/wear/WearDeleteDialog.tsx`-style owner-action dialog | role-match (composite) |
| `src/components/profile/ProfileWatchCard.tsx` (⋯ menu, muted card, badge, wear-line suppression) | component | request-response + event-driven | `src/components/wear/WearOverflowMenu.tsx` (⋯ menu shape) + own existing like/comment guard pattern (lines 83-109, 253-264) | exact (composite of cross-file + in-file precedent) |
| `src/components/profile/CollectionTabContent.tsx` (toggle state, previously-owned filter branch, empty-state gating) | component | request-response | own existing `activeChip`/`search` `useState`/`useMemo` filter machinery (lines 68-86) | exact (in-file precedent) |
| `src/components/profile/FilterChips.tsx` (unchanged; sibling toggle button copies its classes) | component | request-response | itself (lines 11-31) — style reference only, no structural change | exact |
| `src/components/watch/WatchForm.tsx` (status `<Select>` filter, disposal fields block) | component (form) | request-response | own existing status `<Select>` (lines 434-451) + `condition`/`boxPapers` `<Select>` blocks (~L621-655) | exact (in-file precedent) |
| `src/components/watch/WatchDetailHero.tsx` (celebration trigger on edit-save) | component | request-response | `src/components/watch/AddWatchFlow.tsx` `handleMoveToCollection` (lines 564-590) | role-match |
| `src/components/watch/AddWatchFlow.tsx` (`handleMoveToCollection` gains celebration branch) | component | request-response | itself (lines 564-590) — extend in place | exact (in-file precedent) |
| `src/lib/celebrate.ts` (NEW — confetti + reduced-motion wrapper) | utility | event-driven | No direct in-repo analog for confetti; closest shape precedent is a small pure-function utility module like `src/lib/wear.ts` (`todayLocalISO`, `daysSince`) | role-match |
| `src/app/u/[username]/[tab]/page.tsx` (owned/previously-owned split) | route (Server Component data loader) | request-response | own existing `ownedWatches` filter (~L382) | exact (in-file precedent) |
| `src/app/actions/__tests__/watches.test.ts` (extend) | test | CRUD | itself — existing test cases for `editWatch`/`addWatch` | exact |
| `src/app/actions/__tests__/moveWishlistToCollection.test.ts` (extend) | test | request-response | itself — existing `status: 'sold'` rejection-set test (~L190) | exact |
| `src/components/profile/__tests__/CollectionTabContent.test.tsx` (extend) | test | request-response | itself | exact |
| `src/lib/__tests__/celebrate.test.ts` (NEW) | test | event-driven | `matchMedia` mock precedent — no direct in-repo analog located; write fresh per RESEARCH §Wave 0 Gaps | none (new pattern) |
| `tests/static/WatchCard.sold-badge.test.tsx` (update/delete — dead component) | test | CRUD | itself (dead-island static guard) | exact |
| `tests/integration/phase37-rls.test.ts` (remove `recordDivestment`-calling assertions) | test | event-driven | itself | exact |

---

## Pattern Assignments

### `supabase/migrations/20260913HHMMSS_phase85_lifecycle.sql` (migration, batch)

**Analogs:** `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` (assertion shape) + `supabase/migrations/20260511010000_phase37_layer_d.sql` (pgEnum/ADD COLUMN shape) + `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` (RLS re-create shape)

**pgEnum + ADD COLUMN pattern** (from `20260511010000_phase37_layer_d.sql` lines 18-51):
```sql
BEGIN;

-- STEP 1: CREATE TYPE for new pgEnums.
-- MUST precede ALTER TABLE ADD COLUMN — ADD COLUMN with these types
-- fails if the type doesn't exist yet.
CREATE TYPE condition_grade AS ENUM ( ... );
CREATE TYPE currency_code AS ENUM ( ... );
CREATE TYPE box_papers_status AS ENUM ( ... );

ALTER TABLE watches
  ADD COLUMN serial               text,
  ADD COLUMN year_of_acquisition  integer,
  ADD COLUMN condition            condition_grade,
  ADD COLUMN box_papers           box_papers_status,
  ADD COLUMN service_history      text,
  ADD COLUMN paid_currency        currency_code,
  ADD COLUMN purchase_date        date;
```

**Pre/post-flight assertion pattern with DIVERGENT predicates** (from `20260626000000_phase80_catalog_brand_family_not_null.sql` lines 39-98 — critical per project memory `post_flight_assertion_predicate_divergence`: the post-flight check must NOT reuse the operation's own WHERE clause):
```sql
DO $$
DECLARE
  null_brand_count integer;
BEGIN
  SELECT count(*) INTO null_brand_count FROM watches_catalog WHERE brand_id IS NULL;
  IF null_brand_count > 0 THEN
    RAISE EXCEPTION 'Phase 80 aborted — % rows have brand_id IS NULL. ...', null_brand_count;
  END IF;
END $$;

ALTER TABLE watches_catalog ALTER COLUMN brand_id SET NOT NULL;

-- Post-flight uses information_schema (DIFFERENT predicate), not a re-run SELECT.
DO $$
DECLARE brand_id_nullable text;
BEGIN
  SELECT is_nullable INTO brand_id_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id';
  IF brand_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 80 failed — still nullable (got: %)', brand_id_nullable;
  END IF;
END $$;

COMMIT;
```
Apply this same divergent-predicate discipline to the `sold`→`previously_owned` backfill: pre-flight counts `WHERE status = 'sold'`; post-flight asserts `NOT EXISTS (SELECT 1 FROM watches WHERE status = 'sold')` (existence check, not a re-run of the same count) — RESEARCH.md's own template (§Pattern 1) already codifies this exact shape; follow it verbatim.

**RLS policy re-creation pattern** (from `20260522000000_phase53_likes_comments_rls.sql` lines 190-244 — idempotent `DROP POLICY IF EXISTS` + `CREATE POLICY`):
```sql
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
  FOR SELECT TO authenticated
  USING (
    wear_event_id IS NOT NULL
    OR (
      watch_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM watches w WHERE w.id = comments.watch_id
          AND ( w.status IN ('owned', 'sold', 'grail')  -- ← change 'sold' to 'previously_owned'
                OR w.user_id = (SELECT auth.uid())
                OR ( w.status = 'wishlist' AND EXISTS (...mutual follow...) ) )
      )
    )
  );
```
Both `comments_select` (line 192) and `comments_insert` (line 223) reference `'sold'` at lines 204 and 237 respectively — re-create both with `'previously_owned'` substituted, in the new migration, using the exact `DROP POLICY IF EXISTS` / `CREATE POLICY` idiom shown above.

**Error handling:** every `DO $$ ... RAISE EXCEPTION ... END $$;` block aborts the whole `BEGIN...COMMIT` transaction on failure — no try/catch needed, Postgres transactional DDL handles it.

---

### `src/db/schema.ts` (model, CRUD)

**Analog:** same file, `conditionGradeEnum`/`boxPapersStatusEnum` (lines 63-76) + `watches` table `status` column (line 100) + provenance columns (lines 140-147)

**pgEnum declaration pattern** (lines 63-76):
```typescript
// ----- Phase 37 D-02: condition grade pgEnum (CAT-18) -----
export const conditionGradeEnum = pgEnum('condition_grade', [
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor',
] as const)

// ----- Phase 37 D-05: box/papers status pgEnum (CAT-18) -----
export const boxPapersStatusEnum = pgEnum('box_papers_status', [
  'none', 'box_only', 'papers_only', 'full_set',
] as const)
```
Model `disposalReasonEnum` the same way: `pgEnum('disposal_reason', ['sold','lost','gifted','stolen','traded'] as const)`.

**Status column change** (line 100):
```typescript
status: text('status', { enum: ['owned', 'wishlist', 'sold', 'grail'] }).notNull(),
```
→ replace `'sold'` with `'previously_owned'` in the enum array (D-01). No CHECK/pgEnum conversion needed on `status` itself (RESEARCH confirms it's plain `text{enum:[...]}`, TypeScript-only narrowing).

**New nullable columns pattern** (mirrors lines 140-147 provenance-field block):
```typescript
condition: conditionGradeEnum('condition'),
boxPapers: boxPapersStatusEnum('box_papers'),
serviceHistory: text('service_history'),
paidCurrency: currencyCodeEnum('paid_currency'),
purchaseDate: date('purchase_date'),
```
→ add: `disposalReason: disposalReasonEnum('disposal_reason'), sellPrice: real('sell_price'), disposalDate: date('disposal_date'),` inside the same `watches` table object (after `purchaseDate`, before `catalogId`, or wherever the planner groups the D-02 disposal block).

---

### `src/lib/types.ts` (model, CRUD)

**Analog:** same file, `ConditionGrade`/`BoxPapersStatus` (lines 28-42) + `Watch` provenance fields (lines 111-118)

```typescript
// Phase 37 D-02: collector-grade condition pgEnum mirror (CAT-18)
export type ConditionGrade =
  | 'mint' | 'near_mint' | 'excellent' | 'good' | 'fair' | 'poor'
```
→ add `export type DisposalReason = 'sold' | 'lost' | 'gifted' | 'stolen' | 'traded'` in the same style, and change line 1:
```typescript
export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'
```
→ `'owned' | 'wishlist' | 'previously_owned' | 'grail'`.

**Watch interface field addition** (mirrors lines 111-118):
```typescript
  // Phase 37 D-01..D-08 — collector provenance fields (all nullable; CAT-18)
  serial?: string
  ...
  purchaseDate?: string   // ISO date string 'YYYY-MM-DD' — matches <input type="date"> + Postgres date type
```
→ add a Phase-85-commented block: `disposalReason?: DisposalReason`, `sellPrice?: number`, `disposalDate?: string`.

---

### `src/lib/constants.ts` (config, CRUD)

**Analog:** same file, `CONDITION_GRADES`/`CONDITION_GRADE_LABELS` and `BOX_PAPERS_STATUSES`/`BOX_PAPERS_LABELS` (lines 144-182)

```typescript
export const CONDITION_GRADES = [
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor',
] as const

export const CONDITION_GRADE_LABELS: Record<ConditionGrade, string> = {
  mint:        'Mint',
  near_mint:   'Near Mint',
  ...
}
```
→ add `DISPOSAL_REASONS = ['sold','traded','gifted','lost','stolen'] as const` (UI-SPEC's exact radiogroup order — Sold, Traded, Gifted, Lost, Stolen) and a matching `DISPOSAL_REASON_LABELS: Record<DisposalReason, string>` Title-Case map (needed for the reason·date badge copy per D-16/UI-SPEC "Reason rendered Title Case").

`WATCH_STATUSES` (lines 131-136):
```typescript
export const WATCH_STATUSES = [
  'owned',
  'wishlist',
  'sold',
  'grail',
] as const
```
→ `['owned', 'wishlist', 'grail', 'previously_owned']` per RESEARCH's Must-Change table (order matters for `WatchForm` iteration — `previously_owned` last, filtered out per D-07 in the form itself, not here).

---

### `src/app/actions/watches.ts` (service/Server Action, CRUD)

**Analog:** same file — `isTransitioningToSold` block (lines 678-729) is the model to REPLACE; `moveWishlistToCollection`'s status-whitelist (lines 457-471) is the model to EXTEND.

**Imports pattern** (lines 18-33) — no change needed to the import block itself except removing `divestments` from the schema import once D-03 lands:
```typescript
import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { divestments, watches } from '@/db/schema'   // ← drop `divestments` after D-03
import * as watchDAL from '@/data/watches'
...
```

**Zod enum pattern to extend** (line 41):
```typescript
status: z.enum(['owned', 'wishlist', 'sold', 'grail']),
```
→ `z.enum(['owned', 'wishlist', 'grail', 'previously_owned'])`; add optional fields mirroring the provenance block (lines 67-73):
```typescript
serial: z.string().optional(),
...
purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
```
→ add `disposalReason: z.enum(['sold','lost','gifted','stolen','traded']).optional(), sellPrice: z.number().optional(), disposalDate: isoCalendarDate-style string, today: <client-supplied bound>`.

**Prior-row transition detection pattern — the model for D-09/D-04** (lines 610-620, 678-691, exact text to model on, NOT copy — this branch is being REMOVED per D-03):
```typescript
// Phase 37 — single hoisted fetch. priorRow is used by: ...
const priorRow = await watchDAL.getWatchById(user.id, watchId)
if (!priorRow) {
  return { success: false, error: 'Watch not found' }
}
...
// Phase 37 D-11 + CRITICAL OVERRIDE #2 — owned→sold transition detection.
const isTransitioningToSold =
  updatePayload.status === 'sold' && priorRow.status !== 'sold'
```
Model D-09 (promotion) and D-04 (undo) the same way, per RESEARCH §Pattern 3:
```typescript
const isPromotionToOwned =
  (priorRow.status === 'wishlist' || priorRow.status === 'grail') &&
  updatePayload.status === 'owned'
const wasGrail = priorRow.status === 'grail'

const isExitingPreviouslyOwned =
  priorRow.status === 'previously_owned' &&
  updatePayload.status !== undefined &&
  updatePayload.status !== 'previously_owned'
if (isExitingPreviouslyOwned) {
  updatePayload = { ...updatePayload, disposalReason: null, sellPrice: null, disposalDate: null }
}
```
**Do NOT reuse the `db.transaction()` + `divestments` insert wrapper** (lines 706-729) — D-03 removes the dual-write entirely; the new previously-owned transition is a single-table `watchDAL.updateWatch(...)` call, same as the `else` branch (line 735) already does for non-transition edits.

**`moveWishlistToCollection` status-whitelist to extend** (lines 458-471):
```typescript
if (priorRow.status !== 'wishlist') {
  if (priorRow.status === 'owned') {
    return { success: true, data: priorRow }
  }
  return {
    success: false,
    error: `Cannot move ${priorRow.status} watch to collection`,
  }
}
```
No logic change needed — the interpolated `${priorRow.status}` already renders whatever the new status value is; this is a data-layer change only (per RESEARCH's Must-Change table).

**Cache invalidation pattern (apply to every mutation in this file)** (lines 549-561, 739-761 — identical fan-out in both functions):
```typescript
revalidatePath('/')
updateTag(`viewer:${user.id}:recs`)
revalidatePath('/u/[username]', 'layout')
const ownerProfile = await getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
revalidateTag('explore', 'max')
```
D-08 requires exactly this fan-out on the disposal commit.

**`ActionResult<T>` widening (D-09) — additive-safe pattern**: `editWatch`/`moveWishlistToCollection` currently `return { success: true, data: watch }` where `watch: Watch`. Widen to `return { success: true, data: { watch, promoted: isPromotionToOwned, promotedFrom: wasGrail ? 'grail' as const : undefined } }` — verify all 3 non-test call sites (`WatchDetailHero.tsx`, `WatchForm.tsx`, `AddWatchFlow.tsx`) via `npm run build` per Pitfall 5.

**Error handling pattern** (lines 764-770, consistent across the file):
```typescript
} catch (err) {
  console.error('[editWatch] unexpected error:', err)
  if (err instanceof Error && err.message.includes('not found or access denied')) {
    return { success: false, error: 'Not found' }
  }
  return { success: false, error: 'Failed to update watch' }
}
```

**Future-date server validation** — do NOT compute "today" server-side. Reuse the `isPlausibleClientToday` pattern from `src/app/actions/wearEvents.ts` (see below) for `disposalDate`.

---

### `src/data/watches.ts` (model/DAL, CRUD)

**Analog:** same file — `mapRowToWatch`/`mapDomainToRow` (lines 17-100), `getWatchByIdForViewer` predicate (lines 258-299)

**Row-mapping pattern to extend** (lines 51-59, 96-100):
```typescript
// Phase 37 D-01..D-08 — collector provenance fields (all nullable; CAT-18)
serial: row.serial ?? undefined,
yearOfAcquisition: row.yearOfAcquisition ?? undefined,
condition: row.condition ?? undefined,
boxPapers: row.boxPapers ?? undefined,
serviceHistory: row.serviceHistory ?? undefined,
paidCurrency: row.paidCurrency ?? undefined,
purchaseDate: row.purchaseDate ?? undefined,
```
→ add `disposalReason: row.disposalReason ?? undefined, sellPrice: row.sellPrice ?? undefined, disposalDate: row.disposalDate ?? undefined,` to `mapRowToWatch`.

`mapDomainToRow` (lines 97-99 pattern, note the `'key' in data` idiom used for nullable-on-explicit-presence fields):
```typescript
if ('sortOrder' in data && data.sortOrder !== undefined) row.sortOrder = data.sortOrder
```
→ use the same `'field' in data` idiom (not `!== undefined`) for `disposalReason`/`sellPrice`/`disposalDate` so D-04's explicit `null` writes (undo path) actually clear the DB columns — a plain `!== undefined` check would silently skip a `null` value. This is the load-bearing detail for D-04.

**Visitor-visibility predicate to change (D-14)** (lines 291-294):
```typescript
sql`(
  (${watches.status} = 'wishlist' AND ${profileSettings.wishlistPublic} = true)
  OR (${watches.status} IN ('owned','sold','grail') AND ${profileSettings.collectionPublic} = true)
)`,
```
→ per D-14, remove the renamed status entirely from the non-owner OR-branch: `IN ('owned','grail')` (NOT `'owned','previously_owned','grail'`) — the owner short-circuit (`eq(watches.userId, viewerId)`, line 286) already covers the owner's own previously-owned reads; visitors must never match on `previously_owned` here at all.

---

### `src/data/recommendations.ts` (service/DAL, batch)

**Analog:** same file — exclusion loop (lines 271-277)

```typescript
const norm = excludeKey
const excluded = new Set<string>()
for (const v of viewerWatches) {
  if (v.status === 'owned' || v.status === 'wishlist' || v.status === 'grail') {
    excluded.add(norm(v))
  }
}
```
→ per D-18, add `|| v.status === 'previously_owned'` to this allowlist condition (RESEARCH pinpoints this as the ONE real edit site in this file — every other `status === 'owned'` check, e.g. lines 136, 184, 293, is already a safe allowlist that auto-excludes `previously_owned`).

---

### `src/components/profile/ProfileWatchCard.tsx` (component, request-response + event-driven)

**Analog (cross-file, ⋯ menu shape):** `src/components/wear/WearOverflowMenu.tsx` (full file, 194 lines)

**Analog (in-file, Link-guard + portal-placement pattern):** same file, `handleLikeClick`/`handleCommentClick` (lines 83-109) and `WatchCommentSheet` placement (lines 253-264)

**Imports pattern** (lines 1-15):
```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon, Heart, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'
import { toggleLikeAction } from '@/app/actions/reactions'
import { WatchCommentSheet } from '@/components/watch/WatchCommentSheet'
import type { Watch } from '@/lib/types'
```
→ add `MoreHorizontal` to the lucide import, `DropdownMenu*` from `@/components/ui/dropdown-menu`, and `MarkPreviouslyOwnedDialog`.

**Link-swallow guard pattern (Pitfall 1) — MUST copy verbatim** (lines 83-85):
```tsx
function handleLikeClick(e: React.MouseEvent) {
  e.preventDefault() // D-02: stop <Link> navigation
  e.stopPropagation()
  ...
}
```
Apply the identical two-line guard to the new ⋯ `DropdownMenuTrigger`'s `onClick`, per `WearOverflowMenu.tsx`'s own trigger shape below.

**⋯ menu shape to adapt (from `WearOverflowMenu.tsx` lines 123-179)**:
```tsx
<DropdownMenu open={open} onOpenChange={handleOpenChange}>
  <DropdownMenuTrigger
    aria-label="More options"
    className={cn(
      'inline-flex items-center justify-center min-h-[44px] min-w-[44px]',
      onPhoto ? 'text-white' : 'text-foreground',
    )}
  >
    <MoreHorizontal className="size-5" aria-hidden />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" finalFocus={() => (deleteSelectedRef.current ? false : true)}>
    <DropdownMenuItem onClick={handleCopyLink}>...</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
Adapted per UI-SPEC: trigger placed `absolute top-2 right-2 z-10`, with the required `onClick={(e) => { e.preventDefault(); e.stopPropagation() }}` (WearOverflowMenu's trigger does NOT need this because it's not inside a `<Link>` — ProfileWatchCard's IS, so this guard is the one addition beyond the WearOverflowMenu template). Menu items: `isOwner && watch.status === 'owned'` → "Mark as previously owned" (opens dialog, does not submit itself); `isOwner && watch.status === 'previously_owned'` → "Edit" via `DropdownMenuItem render={<Link href={`/w/${watch.id}/edit`} />}`.

**Dialog-outside-`<Link>` placement pattern (Pitfall 2) — MUST copy verbatim** (lines 253-264, comment included):
```tsx
{/* Compose-only bottom sheet (D-06/GRID-04) — rendered OUTSIDE the <Link> so the portaled
    sheet's clicks (Post / overlay / close) don't React-bubble through the React tree into
    the Link's onClick and navigate to /w/[ref]. State/handlers stay in this component. */}
{!isOwner && (
  <WatchCommentSheet
    open={sheetOpen}
    onOpenChange={setSheetOpen}
    watch={watch}
    viewerId={viewerId ?? null}
    onSuccess={handleCommentSuccess}
  />
)}
```
→ render `<MarkPreviouslyOwnedDialog>` the same way, as a sibling to `</Link>` inside the returned `<>...</>` fragment, controlled by lifted `useState`.

**CSS-chain pattern to extend (D-16, `isWishlistLike` precedent)** (lines 64-72, 143-154, 216-218):
```tsx
const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
...
{/* Wear badge — OWNED watches only (D-12, PLSH-03) */}
{!isWishlistLike && (isWornToday || isStale) && (
  <span className={cn('absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-normal', ...)}>
    {isWornToday ? 'Worn today' : 'Not worn recently'}
  </span>
)}
...
{/* Wear line — OWNED watches only (D-12, PLSH-03) */}
{!isWishlistLike && (
  <p className="text-xs text-muted-foreground">{lastWornLabel}</p>
)}
```
→ per UI-SPEC's explicit CSS-chain contract: add `const isPreviouslyOwned = watch.status === 'previously_owned'`; wrap `<Card>` with `cn(..., isPreviouslyOwned && 'opacity-60')`; change the wear-badge conditional to `isPreviouslyOwned ? <ReasonDateBadge .../> : (!isWishlistLike && (isWornToday || isStale) && <WearBadge/>)`; change the wear-line conditional to `!isWishlistLike && !isPreviouslyOwned && <p>...</p>`. Price line (lines 65-72) stays unchanged — `previously_owned` is not wishlist-like, so `primary = watch.pricePaid` still renders "Paid: $X".

**Error handling pattern (optimistic-with-rollback, from `handleLikeClick` lines 90-102)** — reusable model if the disposal dialog needs client-side optimistic UI (likely not needed; dialog awaits the Server Action before closing per UI-SPEC).

---

### `src/components/profile/MarkPreviouslyOwnedDialog.tsx` (NEW — component, request-response)

**Analog (radiogroup):** `src/components/watch/ConfirmStep.tsx` lines 154-299

**WAI-ARIA radiogroup + roving-tabindex pattern to copy** (lines 157-191, 260-298):
```tsx
const groupRef = useRef<HTMLDivElement>(null)

function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  const values = OPTIONS_FOR_VIEWER.map(o => o.value)
  const idx = values.indexOf(status)
  let next: typeof values[number] | null = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next = values[(idx + 1) % values.length] }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); next = values[(idx + values.length - 1) % values.length] }
  else if (e.key === 'Home') { e.preventDefault(); next = values[0] }
  else if (e.key === 'End') { e.preventDefault(); next = values[values.length - 1] }
  if (next !== null) {
    onStatusChange(next)
    requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus()
    })
  }
}

<div ref={groupRef} role="radiogroup" aria-label="Watch status" className="flex gap-2" onKeyDown={handleKeyDown}>
  {OPTIONS_FOR_VIEWER.map(({ value, label }) => (
    <Button
      key={value} type="button" role="radio"
      aria-checked={status === value}
      tabIndex={status === value ? 0 : -1}
      data-value={value}
      variant="outline"
      className={cn('min-h-[44px]', status === value &&
        'border-accent bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground dark:border-accent dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground')}
      onClick={() => onStatusChange(value)}
    >
      {label}
    </Button>
  ))}
</div>
```
Adapt directly for the 5-option reason radiogroup (Sold, Traded, Gifted, Lost, Stolen per UI-SPEC exact order). The `dark:` variant pairing on `bg-accent` is REQUIRED per project convention (`feedback_button_outline_dark_override`).

**Date input `max` pattern (Pitfall 4):**
```tsx
import { todayLocalISO } from '@/lib/wear'
<input type="date" max={todayLocalISO()} ... />
```
Client-side only — never call `todayLocalISO()` in the Server Action.

**Dialog shell:** use `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` from `@/components/ui/dialog` (already installed, per UI-SPEC Registry Safety table) — same primitive as `WatchDetailHero`'s delete dialog and `LogTodaysWearButton`.

---

### `src/components/profile/CollectionTabContent.tsx` (component, request-response)

**Analog:** same file — `activeChip`/`search` state + `filtered` memo (lines 68-86), empty-state branch (lines 88-156), toolbar row (lines 158-186)

**Filter-state pattern to extend** (lines 68-86):
```tsx
const [activeChip, setActiveChip] = useState('All')
const [search, setSearch] = useState('')

const filtered = useMemo(() => {
  const s = search.trim().toLowerCase()
  return watches.filter((w) => {
    if (activeChip !== 'All') {
      const hasTag = (w.roleTags ?? []).some((r) => r.toLowerCase() === activeChip.toLowerCase())
      if (!hasTag) return false
    }
    if (!s) return true
    return w.brand.toLowerCase().includes(s) || w.model.toLowerCase().includes(s)
  })
}, [watches, activeChip, search])
```
→ add `const [showPreviouslyOwned, setShowPreviouslyOwned] = useState(false)` (D-15 — not persisted) and a new prop `previouslyOwnedWatches: Watch[]`. Extend the memo (or add a second one) to apply the SAME `activeChip`/search filters to `previouslyOwnedWatches` when the toggle is on, then append the results after `ownedWatches`'-filtered list (D-16: "always sorted after all owned cards, never interleaved").

**Empty-state gating fix required (UI-SPEC explicit gap)** — current guard (line 88):
```tsx
if (watches.length === 0) {
```
→ must become `if (ownedWatches.length === 0 && previouslyOwnedWatches.length === 0)` for the owner branch (so an owner who disposed of their only watch still sees the toolbar + toggle), while the non-owner branch keeps checking only the array it actually receives.

**Toolbar row to extend** (lines 158-186) — append the toggle chip after `<FilterChips>` and before the search `<Input>`:
```tsx
<div className="mb-4 flex items-center gap-2">
  <FilterChips options={chipOptions} active={activeChip} onChange={setActiveChip} />
  {/* NEW: toggle chip, reusing FilterChips' own class strings verbatim */}
  {isOwner && (
    <button
      type="button"
      onClick={() => setShowPreviouslyOwned((v) => !v)}
      className={cn(
        'ml-2 shrink-0 rounded-full border px-3 py-1 text-xs font-normal uppercase tracking-wide transition-colors min-h-[44px]',
        showPreviouslyOwned
          ? 'bg-accent text-accent-foreground border-accent'
          : 'bg-background text-muted-foreground border-border hover:text-foreground',
      )}
    >
      {showPreviouslyOwned ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {previouslyOwnedWatches.length > 0
        ? `Show previously owned (${previouslyOwnedWatches.length})`
        : 'Show previously owned'}
    </button>
  )}
  <div className="relative ml-auto w-48 shrink-0">...</div>
</div>
```

---

### `src/components/profile/FilterChips.tsx` (component, no change — style reference only)

**Analog:** itself (full file, 31 lines)

```tsx
className={cn(
  'shrink-0 rounded-full border px-3 py-1 text-xs font-normal uppercase tracking-wide transition-colors',
  active === opt
    ? 'bg-accent text-accent-foreground border-accent'
    : 'bg-background text-muted-foreground border-border hover:text-foreground',
)}
```
Per UI-SPEC: "keep `FilterChips` a pure presentational list — do not overload its `options`/`active` contract with a boolean concept." The toggle chip in `CollectionTabContent.tsx` copies these exact class strings rather than importing/extending this component.

---

### `src/components/watch/WatchForm.tsx` (component/form, request-response)

**Analog:** same file — status `<Select>` (lines 434-451)

```tsx
<Select
  value={formData.status}
  onValueChange={(value) => {
    if (!value) return
    setFormData((prev) => ({ ...prev, status: value as WatchStatus }))
  }}
>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {WATCH_STATUSES.map((status) => (
      <SelectItem key={status} value={status}>
        <span className="capitalize">{status}</span>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```
→ per D-07, filter the iterated array: `WATCH_STATUSES.filter((s) => s !== 'previously_owned' || watch?.status === 'previously_owned')`. When `formData.status === 'previously_owned'`, render the same disposal-fields block used by `MarkPreviouslyOwnedDialog` (extract a shared subcomponent per UI-SPEC's explicit "do not fork a second copy of the field markup" instruction) plus the D-04 helper text when the user changes status away from `previously_owned`.

There's also an existing **locked read-only status chip pattern** just above (lines 425-432) worth noting as a style precedent for rendering `aria-readonly` states, though it's a different code path (used when status is locked entirely, not this phase's conditional-filter case).

---

### `src/components/watch/AddWatchFlow.tsx` (component, request-response)

**Analog:** same file — `handleMoveToCollection` (lines 564-590)

```tsx
const handleMoveToCollection = useCallback(async () => {
  if (state.kind !== 'confirming' || !state.dupeContext || state.dupeContext.existingStatus !== 'wishlist') return
  const captured = state
  const existingWatchId = captured.dupeContext!.existingWatchId
  setState({ ...captured, pending: true })

  const result = await moveWishlistToCollection(existingWatchId)
  if (!result.success) {
    toast.error(result.error)
    setState({ ...captured, pending: false })
    return
  }

  const dest = initialReturnTo ?? defaultDestinationForStatus('owned', viewerUsername)
  const actionHref = viewerUsername ? `/u/${viewerUsername}/collection` : null
  if (actionHref) {
    toast.success('Moved to collection', {
      action: { label: 'View', onClick: () => router.push(actionHref) },
    })
  }
  setUrl('')
  setState({ kind: 'search-idle' })
  router.push(dest)
}, [state, initialReturnTo, viewerUsername, router])
```
→ per D-09/D-10, insert the celebration BEFORE the final `router.push(dest)` (and before/instead of the existing "Moved to collection" toast branch, per D-10 "visually and textually distinct"):
```tsx
if (result.data.promoted) {
  fireConfettiIfAllowed()
  toast.success(result.data.promotedFrom === 'grail' ? 'Grail acquired!' : 'Added to your collection!')
} else if (actionHref) {
  toast.success('Moved to collection', { action: { label: 'View', onClick: () => router.push(actionHref) } })
}
setUrl('')
setState({ kind: 'search-idle' })
router.push(dest)  // fires AFTER the toast/confetti call — proven to survive in this exact spot
```
This exact "fire toast then `router.push`" ordering is the load-bearing proof-of-survival pattern (Pitfall 3) — do not move the celebration call to a destination-page effect.

---

### `src/lib/celebrate.ts` (NEW — utility, event-driven)

No direct structural analog exists in-repo (first confetti/canvas usage); style precedent is a small pure-function utility module like `src/lib/wear.ts` (top-level exported functions, no class, no React import, JSDoc header explaining a past-incident rationale where relevant).

```ts
import confetti from 'canvas-confetti'

export function fireConfettiIfAllowed() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
}
```
Test analog: no existing `matchMedia` mock in this repo was located during this pass — `src/lib/__tests__/celebrate.test.ts` will need a fresh jsdom `window.matchMedia` mock (Vitest `vi.stubGlobal` or a manual `Object.defineProperty(window, 'matchMedia', ...)`).

---

### `src/app/u/[username]/[tab]/page.tsx` (route/Server Component, request-response)

**Analog:** same file — `ownedWatches` filter (~L382, per RESEARCH §Pattern 4)

```ts
const ownedWatches = watches.filter((w) => w.status === 'owned')
```
→ add:
```ts
const previouslyOwnedWatches = isOwner
  ? watches.filter((w) => w.status === 'previously_owned')
  : []  // D-13: non-owners never receive these rows, not even filtered client-side
```
Pass both to `<CollectionTabContent>`. This is a pure JS filter widening inside the existing async `ProfileTabContent` — no new `await`, no change to the locked "outer sync / inner async / Suspense" structural invariant (`unstable_instant = false` per project memory `phase_52_in_progress`).

---

## Shared Patterns

### Two-layer ownership/IDOR gate (apply to every new/modified Server Action)
**Source:** `src/app/actions/watches.ts` (every existing mutation, e.g. `moveWishlistToCollection` lines 428-455)
```typescript
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
...
const priorRow = await watchDAL.getWatchById(user.id, watchId)  // scoped to user.id — 2nd IDOR layer
if (!priorRow) {
  return { success: false, error: 'Watch not found' }
}
```
**Apply to:** the disposal-commit path (whether it reuses `editWatch` or a thin wrapper), any new Server Action this phase introduces.

### Cache invalidation fan-out (apply to every watch-mutating Server Action)
**Source:** `src/app/actions/watches.ts` lines 549-561 / 739-761 (identical in both functions)
```typescript
revalidatePath('/')
updateTag(`viewer:${user.id}:recs`)
revalidatePath('/u/[username]', 'layout')
const ownerProfile = await getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
revalidateTag('explore', 'max')
```
**Apply to:** the disposal-commit action (D-08 requires exactly this fan-out) and the D-04 undo path.

### Future-date server-side validation (client owns "today", server bounds-checks it)
**Source:** `src/app/actions/wearEvents.ts` lines 145-169 (`isoCalendarDate` zod refine + `isPlausibleClientToday`)
```typescript
const isoCalendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, 'Invalid calendar date')

const TODAY_TOLERANCE_MS = 14 * 60 * 60 * 1000
function isPlausibleClientToday(today: string, nowMs: number = Date.now()): boolean {
  const minPlausible = new Date(nowMs - TODAY_TOLERANCE_MS).toISOString().slice(0, 10)
  const maxPlausible = new Date(nowMs + TODAY_TOLERANCE_MS).toISOString().slice(0, 10)
  return today >= minPlausible && today <= maxPlausible
}
```
**Apply to:** the disposal dialog's `disposalDate` server-side rejection (D-06 "server-side rejection of future dates") — the commit action must accept the client's own `today` alongside `disposalDate` and do a lexical string comparison (`disposalDate > today` → reject), never compute "today" itself. Never call `todayLocalISO()` (`src/lib/wear.ts` line 42) inside a Server Action body — its own header comment forbids this (UTC-vs-local incident precedent, 260622-exo).

### `⋯` overflow menu shape (owner-only card actions)
**Source:** `src/components/wear/WearOverflowMenu.tsx` (full file)
**Apply to:** `ProfileWatchCard.tsx`'s new D-05/D-16 menu — see full excerpt above.

### WAI-ARIA radiogroup + roving-tabindex (reason/status pickers)
**Source:** `src/components/watch/ConfirmStep.tsx` lines 154-299
**Apply to:** `MarkPreviouslyOwnedDialog.tsx`'s reason picker. No generic `RadioGroup` primitive exists in `src/components/ui/` — do not introduce one; hand-roll per this precedent (already used twice: Phase 68 `ConfirmStep`, Phase 82 admin merge pre-flight).

### `accent` token for selected/active state, with mandatory `dark:` pairing
**Source:** `src/components/watch/ConfirmStep.tsx` line 284
```
'border-accent bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground
 dark:border-accent dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground'
```
**Apply to:** every `bg-accent` override on an `outline`-variant button in this phase (reason radiogroup buttons). The `FilterChips`-style toggle chip does NOT need a separate `dark:` pairing (its classes already resolve per-theme via CSS variables, per UI-SPEC Color contract).

### Toast-before-`router.push` survives Next 16 soft navigation
**Source:** `src/components/watch/AddWatchFlow.tsx` lines 580-589
**Apply to:** the celebration toast + confetti call in both `AddWatchFlow.handleMoveToCollection` and `WatchDetailHero`'s edit-save handler — fire immediately before the existing `router.push`, never on a destination-page mount effect (Router Cache stale-instance gotcha, project memory `router_cache_stale_instance`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/celebrate.ts` | utility | event-driven | First confetti/canvas integration in this codebase — no in-repo precedent for a canvas-appended-to-`document.body` effect. Structural style borrowed from `src/lib/wear.ts` (small exported pure functions); the confetti call itself follows the RESEARCH-documented `canvas-confetti` API (`confetti({ particleCount, spread, origin })`), not a codebase pattern. |
| `src/lib/__tests__/celebrate.test.ts` | test | event-driven | No existing `matchMedia`/`prefers-reduced-motion` mock found in the test suite during this pass — write fresh (`vi.stubGlobal('matchMedia', ...)` or `Object.defineProperty`). |

---

## Metadata

**Analog search scope:** `src/db/schema.ts`, `src/lib/types.ts`, `src/lib/constants.ts`, `src/app/actions/watches.ts`, `src/app/actions/divestments.ts`, `src/app/actions/wearEvents.ts`, `src/data/watches.ts`, `src/data/recommendations.ts`, `src/components/profile/*`, `src/components/watch/*`, `src/components/wear/WearOverflowMenu.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/lib/wear.ts`, `src/app/u/[username]/[tab]/page.tsx`, `supabase/migrations/*.sql` (targeted: Phase 37, 53, 80)
**Files scanned:** 22 read directly (full or targeted-offset reads), plus grep sweeps across `src/`, `supabase/migrations/`, `tests/`
**Pattern extraction date:** 2026-09-13
**Confirmed dead component island (excluded from mapping per orchestrator note):** `src/components/watch/CollectionView.tsx`, `WatchCard.tsx`, `WatchGrid.tsx`, `src/components/filters/StatusToggle.tsx`, `FilterBar.tsx`, `src/store/watchStore.ts`, `src/lib/filtering.ts` — zero importers under `src/app/`, last touched 2026-04-13 pre-Phase-27. These files still need their `'sold'` literal removed for `WATCH_STATUSES`/`WatchStatus` type-compile parity (`npm run build` gate) but require zero UI verification and zero pattern mapping — they are not building blocks for any new file in this phase.
