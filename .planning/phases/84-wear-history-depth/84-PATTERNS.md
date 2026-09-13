# Phase 84: Wear history depth - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 11 (new/modified source) + 5 (new/extended tests)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/app/actions/wearEvents.ts` (new `logBackfillWear` export) | controller (Server Action) | request-response / CRUD | `logWearWithPhoto` in the same file (lines 139-274) | exact |
| `src/data/wearEvents.ts` (no new export needed; reuse `getWornTodayIdsForUser`, add insert helper if a dedicated one is preferred) | model/DAL | CRUD | `logWearEventWithPhoto` (lines 60-78) | exact |
| `src/lib/wear.ts` (add `WINDOW_DAYS`/rolling-window day constants) | utility | transform | existing `todayLocalISO`/`SLEEPING_BEAUTY_DAYS` in the same file | exact |
| `src/lib/stats.ts` (add `filterEventsByWindow` + `buildLeaderboard`) | utility | transform (batch/pure fn) | existing `wearCountByWatchMap`/`topMostWorn` in the same file | exact |
| `src/components/profile/WornTimeline.tsx` (wrap rows in `Link`) | component | request-response (client render) | `MostWornThisMonthCard.tsx` (whole-card-as-Link pattern) | role-match |
| `src/components/profile/WornCalendar.tsx` (wrap selected-day panel rows in `Link`) | component | request-response | same file's own selected-day `<li>` block (self-analog) + `MostWornThisMonthCard.tsx` for the Link-wrap idiom | exact (self) |
| `src/components/profile/LogTodaysWearButton.tsx` (rebuild as unified "Log a wear" form) | component (form/dialog) | request-response / CRUD | `src/components/home/WatchPickerDialog.tsx` (disabled-row preflight pattern) + `src/components/wywt/ComposeStep.tsx` (note counter, progressive disclosure) | role-match |
| `src/components/profile/WearLeaderboard.tsx` (new) | component | transform + request-response | `src/components/profile/ViewTogglePill.tsx` (visual/tablist reference) + `src/components/ui/tabs.tsx` (keyboard-nav primitive, UI-SPEC-preferred) + `MostWornThisMonthCard.tsx` (row-as-Link) | role-match |
| `src/components/profile/WornTabContent.tsx` (mount leaderboard above `ViewTogglePill` row) | component (orchestrator) | request-response | same file (self-analog, existing empty-state / layout branching) | exact (self) |
| `src/app/u/[username]/[tab]/page.tsx` (`tab === 'worn'` branch — thread extra props only, per Pitfall 5/7) | route/page (Server Component) | request-response | same file, `tab === 'collection'` branch (lines 348-424) for the `collectionPublic` gating pattern (Pitfall 5 fix) | role-match |
| `tests/actions/wearEventsBackfill.test.ts` (new) | test | request-response | `tests/actions/wearEventsVideo.test.ts` (full mock scaffold) | exact |
| `tests/components/profile/LogTodaysWearButton.test.tsx` (new) | test | request-response | `tests/components/profile/WornCalendar.test.tsx` (RTL component test shape) | role-match |
| `tests/components/profile/WearLeaderboard.test.tsx` (new) | test | transform | `tests/unit/WornTimeline.test.tsx` (RTL pure-render + fixture shape) | role-match |
| `tests/unit/WornTimeline.test.tsx` (extend) | test | request-response | self (existing file) | exact |
| `tests/components/profile/WornCalendar.test.tsx` (extend) | test | request-response | self (existing file) | exact |

## Pattern Assignments

### `src/app/actions/wearEvents.ts` — new `logBackfillWear` (controller, CRUD)

**Analog:** `logWearWithPhoto` in the same file (`src/app/actions/wearEvents.ts:139-274`), with the 23505-catch idiom cross-checked against `logWearWithVideo` (`:304-449`).

**Imports pattern** (file header, lines 1-12):
```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import * as profilesDAL from '@/data/profiles'
import { logActivity } from '@/data/activities'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actionTypes'
import type { WearVisibility } from '@/lib/wearVisibility'
```
For the new backfill action, additionally import `updateTag` (see Shared Patterns > Cache Invalidation below) — do NOT import `revalidateTag` for this specific action's owner-invalidation call.

**Auth + zod ordering pattern** (lines 149-159, `logWearWithPhoto`):
```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}

const parsed = logWearWithPhotoSchema.safeParse(input)
if (!parsed.success) {
  return { success: false, error: 'Invalid input' }
}
```
Auth always runs BEFORE zod parse across every action in this file — preserve that order.

**IDOR ownership check** (lines 161-167):
```typescript
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) {
  return { success: false, error: 'Watch not found' }
}
```

**Core insert + 23505 catch pattern** (lines 202-238, adapted — drop the Storage probe/cleanup since WEAR-02 is photo-less by design; photoUrl is always `null`):
```typescript
const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

try {
  await wearEventDAL.logWearEventWithPhoto({
    id: parsed.data.wearEventId,
    userId: user.id,
    watchId: parsed.data.watchId,
    wornDate: parsed.data.wornDate,   // NOT `today` — this is the whole point of backfill
    note,
    photoUrl: null,                  // WEAR-02: always photo-less
    visibility: parsed.data.visibility,
  })
} catch (err) {
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') {
    return { success: false, error: 'Already logged this watch on that date.' }
  }
  console.error('[logBackfillWear] insert failed:', err)
  return { success: false, error: "Couldn't log that wear." }
}
```
Use `logWearWithPhoto`'s explicit-insert + explicit-23505-catch shape, NOT `markAsWorn`'s `logWearEvent`/`onConflictDoNothing` shape (Pitfall 6 — the latter silently swallows duplicates but still logs an activity).

**Server-side future-date rejection** (new — no direct analog exists yet; this is the D-02 server gate):
```typescript
if (parsed.data.wornDate > parsed.data.today) {
  return { success: false, error: "Can't log a wear for a future date." }
}
```
Place this check immediately after the IDOR ownership check, before the insert, following the same "reject early with a friendly error" idiom used throughout this file. Both `wornDate` and `today` must be independently regex-validated by zod (`/^\d{4}-\d{2}-\d{2}$/`, matching `markAsWornSchema`/`logWearWithPhotoSchema`) — never derive `today` with `new Date()` inside the action (260622-exo invariant, `src/lib/wear.ts:31-40`).

**Conditional activity logging (D-06)** — adapts the fire-and-forget pattern at lines 253-262:
```typescript
if (parsed.data.wornDate === parsed.data.today) {
  try {
    await logActivity(user.id, 'watch_worn', parsed.data.watchId, {
      brand: watch.brand, model: watch.model, imageUrl: watch.imageUrl ?? null,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    console.error('[logBackfillWear] activity log failed (non-fatal):', err)
  }
}
```

**Preflight wrapper — call with the chosen date, not `today`** (`getWornTodayIdsForUserAction`, lines 462-480, unchanged signature):
```typescript
export async function getWornTodayIdsForUserAction(
  input: { userId: string; today: string },
): Promise<string[]> {
  const parsed = preflightSchema.safeParse(input)
  if (!parsed.success) return []
  let user
  try { user = await getCurrentUser() } catch { return [] }
  if (user.id !== parsed.data.userId) return []
  const set = await wearEventDAL.getWornTodayIdsForUser(user.id, parsed.data.today)
  return [...set]
}
```
No DAL/action signature change is needed — the client call site simply passes the form's currently-selected date as `today` instead of `todayLocalISO()`.

---

### `src/data/wearEvents.ts` — DAL insert helper (model, CRUD)

**Analog:** `logWearEventWithPhoto` (`src/data/wearEvents.ts:60-78`).
```typescript
export async function logWearEventWithPhoto(input: {
  id: string
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
}): Promise<void> {
  await db.insert(wearEvents).values({
    id: input.id,
    userId: input.userId,
    watchId: input.watchId,
    wornDate: input.wornDate,
    note: input.note,
    photoUrl: input.photoUrl,
    visibility: input.visibility,
  })
}
```
Reuse this helper verbatim for the backfill insert (`photoUrl: null`) — no new DAL export is required unless the plan prefers a differently-named function for traceability (e.g. `logBackfillWearEvent`), in which case copy this shape exactly (no `onConflictDoNothing`, caller catches 23505).

**Date-parameterized preflight** (`getWornTodayIdsForUser`, lines 35-44) — already accepts an arbitrary date string; do not touch:
```typescript
export async function getWornTodayIdsForUser(
  userId: string,
  today: string,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ watchId: wearEvents.watchId })
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.wornDate, today)))
  return new Set(rows.map((r) => r.watchId))
}
```

**Viewer-gated reads (unchanged, consume-only)** — `getWearEventsForViewer` (lines 208-272) is the single source of truth for leaderboard + Timeline + Calendar data. Do not write a second gating function (Don't Hand-Roll in RESEARCH.md). The three-tier predicate composition to mirror if a NEW gated query is ever required:
```typescript
const visibilityPredicate = viewerFollowsActor
  ? or(eq(wearEvents.visibility, 'public'), eq(wearEvents.visibility, 'followers'))
  : eq(wearEvents.visibility, 'public')
// ...
.where(and(
  eq(wearEvents.userId, profileUserId),
  eq(profileSettings.profilePublic, true), // G-4 outer gate
  visibilityPredicate,
))
```

---

### `src/lib/wear.ts` — rolling-window constants (utility, transform)

**Analog:** same file's existing `SLEEPING_BEAUTY_DAYS` constant + `todayLocalISO` (lines 42-47):
```typescript
export function todayLocalISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const SLEEPING_BEAUTY_DAYS = 30
```
Add `WINDOW_DAYS` alongside `SLEEPING_BEAUTY_DAYS` (module-level exported const, no new file). Never compute "today" inside a Server Action — the file's own header comment (lines 9-41) is the canonical warning to cite in any new comment block here.

---

### `src/lib/stats.ts` — leaderboard pure functions (utility, transform)

**Analog:** `wearCountByWatchMap` (lines 153-159) + `topMostWorn`/`topLeastWorn` (lines 40-60), same file:
```typescript
export function wearCountByWatchMap(
  events: Array<{ watchId: string }>,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of events) m.set(e.watchId, (m.get(e.watchId) ?? 0) + 1)
  return m
}

export function topMostWorn(
  watches: Watch[],
  wearCountByWatch: Map<string, number>,
  limit = 3,
): Array<{ watch: Watch; count: number }> {
  return watches
    .map((w) => ({ watch: w, count: wearCountByWatch.get(w.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
```
Extend with `filterEventsByWindow` (string-lexical `wornDate` comparison — the column is `text`, per Pitfall 4, never SQL date arithmetic) and `buildLeaderboard` (D-13 tie-break: count desc → most-recent wornDate desc → Brand+Model A→Z, zero-wear rows sorted A→Z). Full reference implementation is already spelled out in RESEARCH.md "Pattern 3" — copy it verbatim into this file, it was written specifically as an extension of `wearCountByWatchMap`.

---

### `src/components/profile/WornTimeline.tsx` (component, request-response) — wrap rows in `Link`

**Analog:** `src/components/home/MostWornThisMonthCard.tsx:19-24` (whole-card-as-`Link` idiom):
```typescript
<Link
  href={`/w/${watch.id}`}
  aria-label={`View ${watch.brand} ${watch.model}`}
  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
```
Existing row shell to preserve exactly (`src/components/profile/WornTimeline.tsx:70-93`):
```typescript
<li key={e.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
  <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
    {safe ? (
      <Image src={safe} alt="" fill sizes="40px" className="object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        <WatchIcon className="size-4 text-muted-foreground/40" />
      </div>
    )}
  </div>
  <div className="text-sm">
    {watch ? `${watch.brand} ${watch.model}` : 'Unknown watch'}
  </div>
</li>
```
New shape: wrap this content in `<Link href={`/wear/${e.id}`} className="flex items-center gap-3 rounded-lg border bg-card p-2 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">`, move the `flex items-center gap-3 ...` classes onto the `Link` itself (drop from `<li>`), and append a trailing `<ChevronRight className="ml-auto size-4 text-muted-foreground/40" aria-hidden />` (icon already imported in `WornCalendar.tsx` for month-nav — new usage here, add the import).

---

### `src/components/profile/WornCalendar.tsx` (component, request-response) — wrap selected-day panel rows

**Analog:** same file's existing selected-day-panel `<li>` (lines 273-296) — self-analog, only the panel rows below the grid change; day-cell click-to-select (lines 212-253) is untouched:
```typescript
<li key={event.id} className="flex items-start gap-3">
  <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
    {safe && <Image src={safe} alt="" fill sizes="48px" className="object-cover" />}
  </div>
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-semibold text-foreground">
      {watch?.brand} {watch?.model}
    </p>
    {event.note && <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>}
  </div>
</li>
```
`ChevronRight` is already imported at the top of this file (`import { ChevronLeft, ChevronRight } from 'lucide-react'`, line 5) for month-nav — reuse the same import for the new trailing chevron on each panel row; do not add a duplicate import.

---

### `src/components/profile/LogTodaysWearButton.tsx` (component/form, CRUD) — unified "Log a wear"

**Analog 1 (disabled-row preflight):** `src/components/home/WatchPickerDialog.tsx:186-224`:
```typescript
{filtered.map((w) => {
  const isWornToday = wornTodayIds?.has(w.id) ?? false
  return (
    <li key={w.id}>
      <button
        type="button" role="option"
        aria-selected={selectedId === w.id}
        aria-disabled={isWornToday}
        disabled={isWornToday}
        onClick={() => { if (isWornToday) return; setSelectedId(w.id) }}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
          isWornToday ? 'opacity-50 cursor-not-allowed'
            : selectedId === w.id ? 'bg-muted' : 'hover:bg-muted/40'
        }`}
      >
        <span className="text-sm font-semibold">{w.brand}</span>
        <span className="text-sm text-muted-foreground">{w.model}</span>
        {isWornToday && (
          <span className="text-xs text-muted-foreground ml-auto">Worn today</span>
        )}
      </button>
    </li>
  )
})}
```
**IMPORTANT (RESEARCH Pitfall 1):** `LogTodaysWearButton` today is a bare `<Select>` (`src/components/profile/LogTodaysWearButton.tsx:68-82`) with NO preflight logic at all — there is nothing to "extend." Port the pattern above into a rebuilt component; do not assume existing wiring.

**Analog 2 (date-aware preflight re-run on date change):** RESEARCH.md Pattern 2 — new `useEffect` keyed on the date field:
```typescript
useEffect(() => {
  let cancelled = false
  getWornTodayIdsForUserAction({ userId: viewerId, today: wornDate }).then((ids) => {
    if (!cancelled) setWornOnDateIds(new Set(ids))
  })
  return () => { cancelled = true }
}, [wornDate, viewerId])
```

**Analog 3 (existing dialog shell to keep):** `src/components/profile/LogTodaysWearButton.tsx:50-105` — keep the `Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter` structure, the `Button` trigger with `bg-accent text-accent-foreground` (per UI-SPEC this specific accent usage on the trigger stays — the CTA itself uses `variant="default"`/`bg-primary` per the UI-SPEC's "accent is reserved for active/selected state" rule, so verify against UI-SPEC Color section before reusing `bg-accent` on the trigger button), and the `pending`/`error` state shape (`useTransition`, `role="alert" text-destructive`).

**Analog 4 (native date input):** `src/components/watch/WatchForm.tsx:805` — the only native `<input type="date">` precedent in the codebase; use `max={todayLocalISO()}`, no `min`.

**Analog 5 (note field + counter):** `src/components/wywt/ComposeStep.tsx` — progressive-disclosure "+ Add a note" toggle (`noteOpen` state) and the 0/200 counter turning destructive at 200 (lines ~662-693 region: `maxLength={200}`, `counterAt200 = note.length >= 200`, `{note.length}/200`).

**Analog 6 (visibility control):** `src/components/wywt/VisibilitySegmentedControl.tsx` (full file, 104 lines) — reuse as-is, do not fork:
```typescript
export function VisibilitySegmentedControl({
  value, onChange, disabled,
}: { value: WearVisibility; onChange: (v: WearVisibility) => void; disabled?: boolean }) {
  // role="group" aria-label="Post visibility"; 3 buttons Private/Followers/Public;
  // active button: bg-accent text-accent-foreground; aria-pressed
}
```

---

### `src/components/profile/WearLeaderboard.tsx` (new component, transform + request-response)

**Analog 1 (segmented window control — UI-SPEC/RESEARCH recommendation):** `src/components/ui/tabs.tsx` (full file, 82 lines) is the **favored** choice per both UI-SPEC ("Use `src/components/ui/tabs.tsx` ... OR clone `ViewTogglePill` — planner's choice, but whichever is used MUST implement WAI-ARIA roving-tabindex") and RESEARCH.md Pitfall 3 / Don't Hand-Roll ("Prefer `ui/tabs.tsx` for the window-control ... it very likely satisfies the WAI-ARIA requirement with zero new keyboard code"). It wraps `@base-ui/react/tabs`'s `Tabs.List`/`Tabs.Tab` primitives with no custom keyboard code layered on top — the primitive itself is expected to implement roving-tabindex + arrow-key nav (MEDIUM confidence, verify in local-dev manual walk per RESEARCH Open Question 1):
```typescript
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
// TabsList / TabsTrigger are thin cva-styled wrappers; TabsTrigger's default
// classes include font-medium (UI-SPEC carve-out: shadcn base components
// already using font-medium internally are left as-is — do not strip it,
// but do not add NEW font-medium in this phase's own JSX).
```
**Analog 2 (fallback / visual-shape reference only, NOT preferred):** `src/components/profile/ViewTogglePill.tsx` (full file, 44 lines) — `role="tablist"`/`role="tab"` with `aria-selected`, click-only handlers, **NO** `tabIndex` management or `onKeyDown` (confirmed by direct read — this is exactly why RESEARCH.md Pitfall 3 says cloning it verbatim will NOT satisfy the UI-SPEC's roving-tabindex requirement). If a design reason forces this shape instead of `ui/tabs.tsx`, port `ConfirmStep.tsx`'s keyboard handler (below) onto it.
```typescript
<div role="tablist" aria-label={ariaLabel} className="inline-flex items-center rounded-full border bg-background p-1">
  {options.map((opt) => (
    <button
      key={opt.value} role="tab" aria-selected={value === opt.value} type="button"
      onClick={() => onChange(opt.value)}
      className={cn('rounded-full px-3 py-1 text-xs font-normal transition-colors',
        value === opt.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
    >{opt.label}</button>
  ))}
</div>
```
**Analog 3 (roving-tabindex keyboard handler, if `ViewTogglePill` clone is chosen instead of `ui/tabs.tsx`):** `src/components/watch/ConfirmStep.tsx:163-191` (WAI-ARIA radiogroup pattern, Phase 68 lesson):
```typescript
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
    const nextValue = next
    requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${nextValue}"]`)?.focus()
    })
  }
}
```
Adapt for 5 window values (1mo/3mo/6mo/12mo/all) if `ui/tabs.tsx` turns out NOT to implement keyboard nav (verify first — don't build this speculatively).

**Analog 4 (row-as-Link, whole-row tap target):** `src/components/home/MostWornThisMonthCard.tsx:19-39` (already cited above for WornTimeline) — same idiom, target `/w/${watch.id}` per D-12:
```typescript
<Link href={`/w/${watch.id}`} aria-label={`View ${watch.brand} ${watch.model}`}
  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
  {/* rank, thumbnail, brand/model, count, bar */}
</Link>
```

**Analog 5 (wear-count plural copy):** `src/components/home/MostWornThisMonthCard.tsx:33-35`:
```typescript
<p className="text-sm text-muted-foreground">
  {wearCount} wear{wearCount === 1 ? '' : 's'}
</p>
```

**Pure-function data source:** `filterEventsByWindow` + `buildLeaderboard` from `src/lib/stats.ts` (see above) — this component's window-state + row rendering is the sole consumer; do not add a new DAL call (Pitfall 7 — do not add any await above the page's existing `<Suspense>` boundary).

---

### `src/components/profile/WornTabContent.tsx` (orchestrator, request-response) — mount leaderboard

**Analog:** self (existing file, `src/components/profile/WornTabContent.tsx:132-160`) — the leaderboard section (D-08) mounts as a new sibling block ABOVE the existing `ViewTogglePill`/`Select`/`LogTodaysWearButton` row:
```typescript
return (
  <div className="flex flex-col gap-4">
    {/* NEW: <WearLeaderboard events={events} ownedWatches={ownedWatches} /> here, D-08 */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <ViewTogglePill options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Worn view" />
        {/* watch filter Select — unchanged, does not affect leaderboard per D-08 */}
      </div>
      {isOwner && <LogTodaysWearButton watches={watchOptions} />}
    </div>
    {view === 'timeline' ? <WornTimeline events={filtered} watchMap={watchMap} /> : <WornCalendar events={filtered} watchMap={watchMap} />}
  </div>
)
```
The leaderboard must render OUTSIDE (above) the `events.length === 0` early-return block (lines 94-130) since D-11 requires it to always render owned watches even with zero wears in the selected window — check whether `ownedWatches` (not `events`) should gate leaderboard visibility instead of the empty-events branch.

---

### `src/app/u/[username]/[tab]/page.tsx` (`tab === 'worn'` branch) — gating fix (Pitfall 5)

**Analog:** the file's own `tab === 'collection'` gate (lines 295-307), which the worn-tab leaderboard's zero-wear rows must mirror for non-owner viewers:
```typescript
if (tab === 'collection' && !isOwner && !settings.collectionPublic) {
  return (
    <LockedTabCard tab="collection" displayName={displayName} username={profile.username}
      viewerId={viewerId} targetUserId={profile.id} initialIsFollowing={initialIsFollowing}
      currentPath={currentPath} />
  )
}
```
The worn tab's OWN tab-level lock was intentionally removed (comment at lines 321-325: "the tab-level lock is unreachable now that per-row gating runs at the DAL layer") — do NOT reintroduce a full `LockedTabCard` gate on `tab === 'worn'` itself (that would break WEAR-01/D-14's "visitors see the leaderboard too" requirement). Instead, gate ONLY the zero-wear-row source: `settings` is already destructured near the top of `ProfileTabContent` (same object used at line 295), so no new fetch is needed — thread a `collectionPublic: settings.collectionPublic` boolean prop into `WornTabContent`/`WearLeaderboard`, and when `!isOwner && !collectionPublic`, either omit the leaderboard or derive its owned-watch list from `events` only (watches the viewer has already seen a wear for) rather than the unconditional `watches.filter(w => w.status === 'owned')` at line 493. Do not add any new `await` above the file's `<Suspense>` boundary (Pitfall 7 — this fix reuses `settings`, already in scope, no new DAL call).

---

## Shared Patterns

### Cache Invalidation — `updateTag` for the NEW backfill action's owner-invalidation path

**Source:** `src/app/actions/profile.ts:32-41` and `src/app/actions/notifications.ts` (header comment lines 14-50; call sites at lines 76, 116, 152).
```typescript
// src/app/actions/profile.ts
const profile = await profilesDAL.getProfileById(user.id)
if (profile?.username) {
  updateTag(`profile:${profile.username}`)
}
```
**Apply to:** the new `logBackfillWear` action's owner-invalidation call ONLY. This is a genuine read-your-own-writes case (owner submits a backfill wear, expects to see it on their own next render of the Worn tab) — use `updateTag(`profile:${username}`)`, NOT `revalidateTag(tag, 'max')`. Keep `revalidatePath('/')` unchanged for the home feed fan-out (matches every existing wear action).

**Contrast — do NOT copy this shape for the new action** (`markAsWorn`/`logWearWithPhoto`/`logWearWithVideo`, e.g. `src/app/actions/wearEvents.ts:63-71`):
```typescript
revalidatePath('/')
const ownerProfile = await profilesDAL.getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max') // SWR — wrong for a genuine RYO case
}
```
This is a pre-existing inconsistency in the three existing wear actions (RESEARCH.md Pitfall 2) — out of scope to fix retroactively, but the phase's new action must not propagate it.

### Auth + IDOR + Zod ordering (every Server Action in `wearEvents.ts`)

**Source:** `src/app/actions/wearEvents.ts` (`markAsWorn` lines 19-42, `logWearWithPhoto` lines 149-167) — identical 3-step order across all four existing actions in the file:
```typescript
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

const parsed = someSchema.safeParse(input)
if (!parsed.success) return { success: false, error: 'Invalid input' } // or 'Watch not found' for markAsWorn's early shape

const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) return { success: false, error: 'Watch not found' }
```
**Apply to:** the new `logBackfillWear` action, in this exact order (auth → zod → IDOR → D-02 future-date check → insert).

### Client-supplied date invariant (260622-exo)

**Source:** `src/lib/wear.ts` header comment (lines 9-41) and every action's inline comment (e.g. `src/app/actions/wearEvents.ts:44-48`, `:195-199`).
```typescript
// WR-02 (2026-06-22 fix): client supplies `today` as their local calendar
// day (computed by the browser-side wear helper). The server MUST NOT compute
// `today` itself — on Vercel the process zone is UTC ...
```
**Apply to:** every new client component/action touching a wear date (`LogTodaysWearButton` form, `logBackfillWear` action, `WearLeaderboard` window math). Both `today` and `wornDate` must be client-supplied and independently regex-validated server-side.

### React #418 date-formatting guard

**Source:** `src/components/profile/WornTimeline.tsx:25-37` (`formatDateHeading`) and `WornCalendar.tsx:134-136` (`monthLabel`):
```typescript
const d = new Date(yyyyMmDd + 'T00:00:00Z')
return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
```
**Apply to:** any new date display in `WearLeaderboard` (e.g. a "last worn" label, if added) or the backfill form.

### Styling guardrails (UI-SPEC-confirmed)

**Source:** `src/app/globals.css` OKLCH tokens + `ConfirmStep.tsx:284` (`dark:` paired accent example) + `ViewTogglePill.tsx:34` (`bg-accent text-accent-foreground` as the sole active-state pattern).
- `bg-accent`/`text-accent-foreground` = active/selected token only (window-control active segment, leaderboard bar fill) — never for the "Log a wear" CTA button (`variant="default"`/`bg-primary`).
- No `font-medium`/`font-bold` in new JSX this phase; shadcn `Button`/`TabsTrigger` internals are exempt (already `font-medium`, left as-is).
- `font-semibold` for rank/Brand+Model/active window label; `font-normal` for counts/meta.

## No Analog Found

None — every file in scope has at least a role-match analog in the existing codebase (this phase is explicitly "wiring existing pieces correctly" per RESEARCH.md's own framing; no genuinely new architectural pattern is introduced).

## Metadata

**Analog search scope:** `src/app/actions/`, `src/data/`, `src/lib/`, `src/components/profile/`, `src/components/home/`, `src/components/wywt/`, `src/components/watch/`, `src/components/ui/`, `src/app/u/[username]/[tab]/`, `tests/actions/`, `tests/unit/`, `tests/components/profile/`
**Files scanned/read directly:** `src/app/actions/wearEvents.ts`, `src/data/wearEvents.ts`, `src/lib/wear.ts`, `src/lib/stats.ts`, `src/components/profile/{WornTimeline,WornCalendar,LogTodaysWearButton,ViewTogglePill,WornTabContent}.tsx`, `src/components/home/{WatchPickerDialog,MostWornThisMonthCard}.tsx`, `src/components/wywt/VisibilitySegmentedControl.tsx` (+ grep on `ComposeStep.tsx`), `src/components/watch/ConfirmStep.tsx`, `src/components/ui/tabs.tsx`, `src/app/actions/{profile,notifications}.ts`, `src/app/u/[username]/[tab]/page.tsx` (worn + collection branches), `tests/actions/wearEventsVideo.test.ts`, `tests/unit/WornTimeline.test.tsx`, `tests/components/profile/WornCalendar.test.tsx`
**Pattern extraction date:** 2026-09-12
