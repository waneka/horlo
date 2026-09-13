# Phase 84: Wear history depth - Research

**Researched:** 2026-09-12
**Domain:** Next.js 16 Server Actions + Drizzle/Postgres wear-event logging, viewer-gated read paths, client-side rolling-window aggregation
**Confidence:** HIGH

## Summary

Phase 84 is additive UI + one extended/new Server Action on top of a mature, well-documented `wear_events` subsystem — no schema change. The three things a collector gets (tap-through to `/wear/[id]`, photo-less backfill, and a windowed leaderboard) all sit on existing primitives: `getWearEventsForViewer` (viewer-gated reads, already returns everything the leaderboard needs), `wear_events_unique_day` (the duplicate-day backstop), and `todayLocalISO()` (the client-supplies-the-date invariant). CONTEXT.md and the approved UI-SPEC already resolved almost every design question (D-01..D-15) — this research exists to verify the code those decisions reference still matches reality, and to flag two places where it diverges from what CONTEXT.md assumed.

Two load-bearing discoveries: (1) `LogTodaysWearButton` — the component CONTEXT.md describes as "owned-only picker" — is currently a bare `<Select>` with **no** worn-today preflight disabling at all (that logic lives only in the separate `WatchPickerDialog`, which this phase does not reuse per the UI-SPEC). The date-aware preflight (D-05) must be built into `LogTodaysWearButton` from scratch, using `WatchPickerDialog`'s disabled-row pattern as the reference, not by importing/reusing that preflight in-place. (2) The three existing wear-logging Server Actions (`markAsWorn`, `logWearWithPhoto`, `logWearWithVideo`) all invalidate the owner's own profile cache with `revalidateTag(tag, 'max')` (stale-while-revalidate) even though the caller IS the owner — a read-your-own-writes case that the project's own `profile.ts`/`notifications.ts` actions correctly handle with `updateTag(tag)` instead. This looks like a pre-existing latent inconsistency (not something Phase 84 needs to fix retroactively per CONTEXT.md's discretion note), but the **new** backfill action should use `updateTag` for the owner-invalidation path so a submitted backfill wear appears in the Worn tab immediately on next render, not after an unpredictable stale-while-revalidate window.

**Primary recommendation:** Extend `logWearWithPhoto`'s shape into a new photo-less action (or add a `wornDate` param to it — see Don't Hand-Roll) that carries both `today` and `wornDate`, gates activity logging on `wornDate === today`, rejects `wornDate > today` server-side, and reuses the exact `wear_events_unique_day` 23505 → friendly-error catch already proven in `logWearWithPhoto`. Compute the leaderboard client-side in `WornTabContent` from the already-loaded `events` prop (no new DAL query) per CONTEXT.md's discretion default, using `wearCountByWatchMap` from `src/lib/stats.ts` extended with a window filter and the D-13 tie-break.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One entry point. The existing owner-only log-wear button on the Worn tab (`LogTodaysWearButton`, owned-only picker per Phase 83 POLISH-02) opens a form with a **date field defaulting to today**. There is no separate "Log past wear" button and no calendar-cell entry point.
- **D-02:** Date range is **any past date, never future**. Use native `<input type="date">` with `max` = browser-local today (`todayLocalISO()` from `src/lib/wear.ts`) and no lower bound. The server must also reject a future `wornDate`. Reason: the client supplies the date (260622-exo invariant), so the server can't trust the client's `max`.
- **D-03:** Form fields: **watch (owned only) + date + optional note (200-char limit, same as the photo flow) + visibility selector (public / followers / private)**. No photo.
- **D-04:** Visibility **defaults to Public**. This matches today's quick-log (`markAsWorn` always writes public) and the photo-flow default. Nothing is remembered between sessions.
- **D-05:** Duplicates are prevented up front. When the date changes, the picker re-checks which owned watches are already worn **on the selected date** (make the existing `getWornTodayIdsForUserAction` preflight date-aware) and disables them. The server keeps the `wear_events_unique_day(user_id, watch_id, worn_date)` constraint as the backstop and returns a friendly "Already logged this watch on that date." error if one slips through.
- **D-06:** Only wears dated **today** (`wornDate === browser-local today`) write the `watch_worn` activity. Past-date wears write **no activity**, so a backfill session doesn't show followers old wears as new. Backfilled wears still appear on the Worn tab, the calendar, the leaderboard and `/wear/[id]`. The home WYWT rail already excludes them (48h `wornDate` window).
- **D-07:** **One form for both today and past dates.** "Log a wear" always opens the form, so today's quick-log gains note and visibility at the cost of one extra tap versus pick-and-go. The Worn-tab button's label/copy should reflect "log a wear" rather than "today" (exact copy is Claude's discretion or a UI-SPEC call).
- **D-08:** **Section above the Timeline/Calendar toggle**, always visible (not collapsible, not a third view). Timeline, Calendar and the watch filter below are unchanged, and the filter does not affect the leaderboard.
- **D-09:** Default window is **3 mo**. Use the existing `ViewTogglePill` (`role="tablist"`) pattern or `ui/tabs` for the segmented control.
- **D-10:** Row: **rank, small watch thumbnail, Brand Model, wear count, thin proportional bar** scaled to the top watch's count. The bar uses the **accent** token (`bg-accent`, paired `dark:` utility per project conventions); no raw palette classes, no `font-medium`.
- **D-11:** Rows cover **all owned watches, zero-wear included** (sorted to the bottom, labelled "0 wears"). Show the **top 5**, then a "Show all" expander. "Owned" means `status === 'owned'`. Wears of non-owned watches (wishlist/grail, or demoted) are excluded from rows.
- **D-12:** Tapping a row opens the watch detail page `/w/[id]`.
- **D-13:** Windows are **rolling days through browser-local today, inclusive**: 1 mo = 30, 3 mo = 90, 6 mo = 182, 12 mo = 365, All = no lower bound. Tie-break: **most recent wear date desc**, then **Brand Model A→Z**. Zero-wear rows are sorted A→Z.
- **D-14:** **Visitors see the leaderboard too, computed only from wears they're allowed to see.** That's the same per-row gating as `getWearEventsForViewer`: owner sees all; otherwise `profile_public` required, public wears, plus followers-only when following. Private or hidden-from-viewer wears must never contribute to counts. Zero-count rows list the owner's owned watches, which is acceptable because that list is already visible to the visitor on the Collection tab. The planner must confirm that holds under the Collection tab's privacy gating, and mirror it if it doesn't.
- **D-15:** **Every wear row links to `/wear/[id]`** in both **Timeline entries** (`WornTimeline`) and the **Calendar's selected-day panel** (`WornCalendar`). Calendar day cells keep their select-a-day behavior. `/wear/[id]` already applies viewer gating and renders photo-less wears (falls back to watch image), so no changes there.

### Claude's Discretion

- How to implement the unified log action: extend `markAsWorn` with `wornDate`/note/visibility, reuse `logWearWithPhoto({hasPhoto:false})`, or add a dedicated action. Whatever is chosen must carry both the client's `today` and the chosen `wornDate` so the server can enforce D-02 (no future) and D-06 (activity only when `wornDate === today`), and keep the 260622-exo rule that the server never computes "today" itself.
- Fix the existing `markAsWorn` quirk where `onConflictDoNothing` swallows a duplicate but **still logs an activity**, if the new path touches it.
- Mobile presentation of the form (dialog vs sheet), empty states for the leaderboard ("No wears in this window" while zero rows still list owned watches), and loading states. A UI-SPEC (`/gsd-ui-phase 84`) may lock these.
- Whether leaderboard counts are computed in JS from the already-fetched wear events (the page already loads `getWearEventsForViewer`) or via a new aggregate DAL query. Per the <500 watches/user constraint, JS is fine unless research finds a reason otherwise.
- Cache invalidation for the new/extended action, matching existing wear actions (`revalidatePath('/')`, `revalidateTag('profile:<username>','max')`; `updateTag` for read-your-own-writes per project memory).

### Deferred Ideas (OUT OF SCOPE)

None. Discussion stayed within phase scope. Reviewed-but-not-folded: `drizzle-kit-pg-net-introspection-bug` (unrelated tooling bug).

Also out of scope per REQUIREMENTS.md / kickoff decisions: photo capture on backfilled wears, per-watch aggregates on the watch detail page, any new wear-detail route.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEAR-01 | User can tap any entry in the Worn tab to open that wear's `/wear/[id]` detail page | `/wear/[wearEventId]/page.tsx` already exists, auth-gated, viewer-gated via `getWearEventByIdForViewer`, renders photo-less wears via watch-image fallback. `WornTimeline`/`WornCalendar` rows are currently plain `<li>` with no `<Link>` — see Code Examples for the exact wrap pattern the UI-SPEC locks. |
| WEAR-02 | User can log a wear on a past date without a photo, via a backfill affordance on the Worn tab | `logWearWithPhoto` is the closest existing action shape (photo optional today via `hasPhoto: false`); extend/parallel it with a `wornDate` field, D-02/D-06 server checks, and D-05's date-aware preflight. See Architecture Patterns + Code Examples. |
| WEAR-03 | Worn tab shows a wear-count aggregate section with a 1/3/6/12/All segmented window control | `ViewTogglePill` is the reusable visual reference; UI-SPEC requires roving-tabindex keyboard behavior the existing `ViewTogglePill` does NOT implement (see Common Pitfalls). `todayLocalISO()` + plain day-math give rolling windows without a date library. |
| WEAR-04 | Leaderboard of owned watches ranked by wear count within the selected window | `wearCountByWatchMap` (`src/lib/stats.ts`) is the base; needs a window-filtered variant + D-13 tie-break + zero-wear inclusion for ALL owned watches (not just watches with events). Data source: `getWearEventsForViewer` (already viewer-gated, already loaded by the Worn tab page). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tap-through wear row → `/wear/[id]` | Browser / Client | — | Pure `<Link>` wrap of existing rows in `WornTimeline`/`WornCalendar` (Client Components); no data change. |
| Backfill wear logging (form + validation) | API / Backend (Server Action) | Browser / Client (form state, date `max`) | Server is authoritative for "no future date" and "activity only if today" (client-supplied date can't be trusted — 260622-exo invariant). Client owns form UX + preflight display. |
| Duplicate-day preflight (disable already-logged watches for the chosen date) | Browser / Client (call site) | API / Backend (`getWornTodayIdsForUserAction`, made date-aware) | Preflight is a UX nicety; the DB `wear_events_unique_day` unique constraint is the real backstop (already exists, unchanged). |
| Window-control state (1/3/6/12/All) | Browser / Client | — | Pure client UI state; rolling-window math uses `todayLocalISO()` (browser-local), never server-computed "today" per project invariant. |
| Leaderboard aggregation (count + rank + tie-break) | Browser / Client | — | Computed in JS from the already-fetched, already viewer-gated `events` array (CONTEXT.md discretion resolved to JS; dataset is <500 watches/user, bounded per PROJECT.md). No new DAL query needed. |
| Viewer-gated wear-event read | API / Backend (DAL) | Database / Storage (RLS is off locally; DAL is the real gate) | `getWearEventsForViewer` already implements the three-tier visibility + `profile_public` outer gate (G-4) + self-bypass (G-5). Leaderboard and Timeline/Calendar all consume this same gated array — no new gating logic should be written. |
| `/wear/[id]` detail render | API / Backend (page.tsx) + Database | — | Unchanged by this phase (D-15 confirms). |
| Cache invalidation (Worn tab reflects new backfill immediately) | API / Backend (Server Action) | — | `updateTag`/`revalidateTag` choice made in the Server Action, not in components. |

## Standard Stack

No new dependencies. This phase is 100% implemented with packages already in `package.json`.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 (installed; verify via `npm view` below) | Server Actions, `updateTag`/`revalidateTag`, App Router | Already the project's framework; AGENTS.md requires consulting `node_modules/next/dist/docs/` before using any Next API — done for `updateTag` and `revalidatePath` in this research. |
| Drizzle ORM | installed (see `package.json`) | `wear_events` table access | Existing DAL pattern (`src/data/wearEvents.ts`) — no new tables/columns needed for this phase. |
| zod | installed | Server Action input validation | Matches existing schema pattern (`markAsWornSchema`, `logWearWithPhotoSchema`). |
| @base-ui/react + shadcn primitives | installed | `dialog`, `tabs`, `select`, `input`, `textarea`, `label`, `button`, `card` — all already in `src/components/ui/` | UI-SPEC confirms `components.json` registry has all needed primitives; no `npx shadcn add` needed. |

**Version verification:**
```bash
npm view next version   # sanity check against installed 16.2.3
```
No new packages are installed by this phase — the Package Legitimacy Audit below is empty by design.

### Supporting
None new. Icon: `ChevronRight` from `lucide-react` (already a project dependency, already imported elsewhere in `WornCalendar` for month-nav chevrons — UI-SPEC reuses the same icon import).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<input type="date">` | A date-picker library (e.g. react-day-picker) | Project has zero date-picker libraries and an explicit precedent (`WatchForm.tsx:805`) of using the native input. CONTEXT.md D-02 locks native input. Do not introduce a library. |
| Client-side JS leaderboard aggregation | New SQL aggregate query (`GROUP BY watch_id` with window filter) | CONTEXT.md leaves this to discretion but defaults to JS given <500 watches/user. A SQL aggregate would need to independently reimplement the three-tier visibility gate that `getWearEventsForViewer` already encapsulates — duplicating security-relevant logic for a marginal perf gain that doesn't exist at this scale. JS is the better choice; see Don't Hand-Roll. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All work uses libraries already present in `package.json` and `components.json`.

## Architecture Patterns

### System Architecture Diagram

```
Worn tab page load
  src/app/u/[username]/[tab]/page.tsx  (tab === 'worn' branch)
        │
        ├─ getWearEventsForViewer(viewerId, profile.id)   [DAL, three-tier gate]
        │        │
        │        ▼
        │   events[] (already viewer-gated: owner sees all;
        │              visitor sees public/followers-if-following,
        │              only if profile_public)
        │
        ├─ signCoverUrls(resolved.watches) → watchMap, ownedWatches (status==='owned')
        │
        ▼
  <WornTabContent events watchMap isOwner ownedWatches ... />
        │
        ├─ NEW: <WearLeaderboard events ownedWatches /> ── client-side:
        │        1. filter events to selected window (rolling days from todayLocalISO())
        │        2. wearCountByWatchMap(windowedEvents)
        │        3. join onto ownedWatches (zero-wear rows included)
        │        4. sort per D-13 tie-break
        │        5. render top 5 + "Show all" expander
        │        6. row click → <Link href={`/w/${watch.id}`}>
        │
        ├─ <ViewTogglePill> Timeline/Calendar (unchanged)
        │
        ├─ isOwner && <LogTodaysWearButton watches={watchOptions} />
        │        │  (renamed copy: "Log a wear")
        │        │  onOpen → date-aware preflight:
        │        │     getWornTodayIdsForUserAction({userId, today: selectedDate})
        │        │     → disables already-worn-that-day watches in the <Select>
        │        │
        │        └─ onConfirm → NEW Server Action (logBackfillWear or extended
        │                        logWearWithPhoto variant)
        │                 │
        │                 ▼
        │        'use server' action:
        │          1. auth (getCurrentUser)
        │          2. zod parse {watchId, wornDate, today, note, visibility}
        │          3. reject wornDate > today (server-side, D-02)
        │          4. IDOR check: watchDAL.getWatchById(user.id, watchId)
        │          5. DAL insert (mirrors logWearEventWithPhoto, photoUrl: null)
        │             catch 23505 → "Already logged this watch on that date."
        │          6. if wornDate === today: logActivity('watch_worn', ...) (D-06)
        │             else: skip activity entirely
        │          7. revalidatePath('/') + updateTag(`profile:${username}`)
        │                 (RYO: this IS the owner's own next render)
        │
        └─ <WornTimeline> / <WornCalendar>
                 each row wrapped in <Link href={`/wear/${e.id}`}> (D-15)
                          │
                          ▼
                 src/app/wear/[wearEventId]/page.tsx (UNCHANGED)
                   getWearEventByIdForViewer → notFound() if denied/missing
                   renders WearCard, photo-less falls back to watch image
```

### Recommended Project Structure
```
src/
├── app/actions/wearEvents.ts       # extend with logBackfillWear (or param on logWearWithPhoto)
├── data/wearEvents.ts              # extend getWornTodayIdsForUser(userId, date) — already date-parameterized, just needs preflight action to pass a non-"today" date; NO signature change needed (it already takes `today: string` positionally — just stop assuming it's literally today)
├── lib/stats.ts                    # add windowed wear-count helper + D-13 tie-break sort
├── lib/wear.ts                     # reuse todayLocalISO/daysSince; add rolling-window day constants (30/90/182/365) alongside SLEEPING_BEAUTY_DAYS
├── components/profile/
│   ├── WornTabContent.tsx          # mount new leaderboard section above ViewTogglePill row
│   ├── WornTimeline.tsx            # wrap <li> content in <Link href={`/wear/${e.id}`}>
│   ├── WornCalendar.tsx            # wrap selected-day-panel <li> in <Link> (day-cell click unchanged)
│   ├── LogTodaysWearButton.tsx     # becomes unified "Log a wear" — gains date/note/visibility + date-aware preflight
│   └── WearLeaderboard.tsx         # NEW — window control + ranked rows + Show all expander
└── ...
```

### Pattern 1: Extending an existing photo-optional Server Action rather than forking one
**What:** `logWearWithPhoto` already supports `hasPhoto: false` (no-photo wear). The backfill path needs the same insert shape plus a `wornDate` that can differ from `today`, plus conditional activity logging.
**When to use:** Any time a new wear-logging entry point is "the same insert, different gating rules" — extend the schema + branch inside, don't fork a fourth near-identical action (mirrors the project's own `logWearWithVideo` "direct structural parallel...7 documented divergences" comment style for traceability).
**Example:**
```typescript
// Source: src/app/actions/wearEvents.ts (existing logWearWithPhotoSchema, adapted)
const logBackfillWearSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  wornDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // the chosen date (D-02)
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),    // client's local "today" — server derives nothing
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
})

export async function logBackfillWear(
  input: z.infer<typeof logBackfillWearSchema>,
): Promise<ActionResult<{ wearEventId: string }>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = logBackfillWearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  // D-02: server-side future-date rejection — never trust the client <input max>.
  if (parsed.data.wornDate > parsed.data.today) {
    return { success: false, error: "Can't log a wear for a future date." }
  }

  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) return { success: false, error: 'Watch not found' }

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

  // D-06: activity only when backfilling "today" — never for genuinely past dates.
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

  revalidatePath('/')
  const ownerProfile = await profilesDAL.getProfileById(user.id)
  if (ownerProfile?.username) {
    // RYO: caller IS the profile owner about to re-render the Worn tab —
    // updateTag (not revalidateTag(tag,'max')) so the new row is guaranteed
    // fresh on the very next request, matching the project's own
    // profile.ts/notifications.ts RYO pattern (see Common Pitfalls #2).
    updateTag(`profile:${ownerProfile.username}`)
  }
  return { success: true, data: { wearEventId: parsed.data.wearEventId } }
}
```

### Pattern 2: Date-aware duplicate preflight (extends existing D-13-from-Phase-15 pattern)
**What:** `getWornTodayIdsForUser(userId, today)` already accepts a date string parameter — it's not hardcoded to "today" internally, it's just always been *called* with today's date. Making the preflight date-aware for the backfill form requires zero DAL changes — only the Server Action wrapper and its call site need to pass the *chosen* date instead of always `todayLocalISO()`.
**When to use:** Whenever the backfill form's date field changes.
**Example:**
```typescript
// Source: src/app/actions/wearEvents.ts getWornTodayIdsForUserAction (existing, unchanged signature)
// Client call site inside the unified log-wear dialog:
const wornIdsForSelectedDate = await getWornTodayIdsForUserAction({
  userId: viewerId,
  today: selectedDate, // NOT todayLocalISO() — this is the date field's current value
})
// -> feed into a WatchPickerDialog-style disabled-row render (see WatchPickerDialog.tsx
//    lines ~200-235 for the exact disabled/aria-disabled/"Worn today" label pattern —
//    change the trailing label copy to reflect the selected date, not literally "today",
//    when selectedDate !== todayLocalISO()).
```

### Pattern 3: Client-side windowed leaderboard aggregation
**What:** Compute rank + count + tie-break entirely in the browser from data already fetched for the Timeline/Calendar views.
**When to use:** Bounded per-user datasets (<500 watches, PROJECT.md constraint) where a dedicated SQL aggregate would only duplicate the visibility-gating logic already applied upstream by `getWearEventsForViewer`.
**Example:**
```typescript
// Source: extends src/lib/stats.ts wearCountByWatchMap
export const WINDOW_DAYS = { '1mo': 30, '3mo': 90, '6mo': 182, '12mo': 365, all: null } as const
export type WindowKey = keyof typeof WINDOW_DAYS

export function filterEventsByWindow(
  events: Array<{ wornDate: string }>,
  window: WindowKey,
  todayISO: string, // caller passes todayLocalISO() — never computed here
): typeof events {
  const days = WINDOW_DAYS[window]
  if (days === null) return events
  const cutoff = new Date(todayISO + 'T00:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1)) // inclusive of today (D-13)
  const cutoffISO = cutoff.toISOString().slice(0, 10)
  return events.filter((e) => e.wornDate >= cutoffISO)
}

export interface LeaderboardRow {
  watch: { id: string; brand: string; model: string; imageUrl: string | null }
  count: number
  mostRecentWornDate: string | null
}

export function buildLeaderboard(
  ownedWatches: Array<{ id: string; brand: string; model: string; imageUrl: string | null }>,
  windowedEvents: Array<{ watchId: string; wornDate: string }>,
): LeaderboardRow[] {
  const countMap = wearCountByWatchMap(windowedEvents)
  const mostRecentMap = new Map<string, string>()
  for (const e of windowedEvents) {
    const prev = mostRecentMap.get(e.watchId)
    if (!prev || e.wornDate > prev) mostRecentMap.set(e.watchId, e.wornDate)
  }
  return ownedWatches
    .map((w) => ({
      watch: w,
      count: countMap.get(w.id) ?? 0,
      mostRecentWornDate: mostRecentMap.get(w.id) ?? null,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count // count desc
      if (a.count === 0) {
        // D-13: zero-wear rows sorted A→Z (no recency to tie-break on)
        return `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`)
      }
      const recencyCmp = (b.mostRecentWornDate ?? '').localeCompare(a.mostRecentWornDate ?? '')
      if (recencyCmp !== 0) return recencyCmp // most recent desc
      return `${a.watch.brand} ${a.watch.model}`.localeCompare(`${b.watch.brand} ${b.watch.model}`) // A→Z
    })
}
```

### Anti-Patterns to Avoid
- **Re-deriving "today" on the server inside the new action:** The 260622-exo incident happened exactly this way — Vercel's process zone is UTC, diverging from the user's local calendar day near midnight. Both `today` (for the future-date check) and `wornDate` (the chosen date) must come from the client, validated with the `/^\d{4}-\d{2}-\d{2}$/` regex, never computed with `new Date()` in the action body.
- **Writing a `watch_worn` activity for every backfilled wear:** Violates D-06 explicitly and would flood followers' feeds with stale-looking "just worn" activity for dates that aren't today.
- **Building a new SQL aggregate for the leaderboard that re-implements visibility gating:** `getWearEventsForViewer` is the single source of truth for who can see which wears; any second gating implementation is a drift risk (exactly the class of bug the project's `[[reexport-only-doesnt-bind-locally]]` and `[[rls-subquery-caller-rls]]` lessons warn about — the DAL is the real gate, not a duplicate one).
- **Assuming `LogTodaysWearButton` already has worn-today disabling:** It does not (verified by reading the file — see Pitfall 1). Don't write a plan step that says "extend the existing preflight" as if it's wired up; it must be added.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate-day prevention | A new client-side Set-tracking mechanism | `getWornTodayIdsForUserAction` (made date-parameterized at the call site) + the existing `wear_events_unique_day` DB constraint | Already implements the exact race-condition-safe pattern (preflight UI hint + DB backstop + friendly 23505 catch) this phase needs, just called with a different date. |
| Rolling date-window math | A date library (date-fns, dayjs) | Plain UTC-anchored day arithmetic off `todayLocalISO()` (see Pattern 3) | Project has zero date libraries; windows are simple day-counts (30/90/182/365) with no calendar-month semantics, no timezone conversion needed beyond the existing UTC-pinned formatting pattern. |
| Viewer-aware wear visibility for the leaderboard | A parallel gating function | `getWearEventsForViewer` (already returns exactly the rows a viewer is allowed to see) | Re-implementing three-tier visibility (public/followers/private) + the `profile_public` outer gate + self-bypass is a security-relevant duplication risk; the DAL function is the canonical single source. |
| Segmented tab control with keyboard nav | A hand-rolled `<div onKeyDown>` from scratch | Either shadcn's `ui/tabs.tsx` (already installed, likely already implements WAI-ARIA tab keyboard behavior out of the box) OR clone `ViewTogglePill`'s visual shape and ADD the roving-tabindex handler modeled on `ConfirmStep.tsx`'s existing radiogroup pattern | UI-SPEC explicitly requires roving-tabindex + arrow keys (Phase 68 lesson); `ViewTogglePill` today does NOT have this (see Common Pitfalls) — check `ui/tabs.tsx` first since it may already satisfy the requirement with zero new code. |

**Key insight:** This phase's implementation risk is almost entirely in *wiring existing pieces correctly* (date-aware preflight, RYO cache invalidation, viewer-gated data reuse) rather than in building new logic. Every "Don't Hand-Roll" row above has a working reference implementation already in the codebase from Phase 11/12/15/25/39c/62/68 — the research value here is pointing at the exact file/line to copy from.

## Common Pitfalls

### Pitfall 1: Assuming `LogTodaysWearButton` already has date-aware (or even same-day) preflight disabling
**What goes wrong:** A plan that says "extend the existing worn-today preflight in `LogTodaysWearButton`" will fail at execution because there is no preflight logic in that file today — it's a bare `<Select>` with no `wornTodayIds` concept at all. That logic exists only in the separate `WatchPickerDialog` (used by the WYWT rail + top-nav `+ Wear` flow), which the UI-SPEC explicitly says NOT to reuse directly for this surface ("its empty-state Dialog shape... is the copy precedent only").
**Why it happens:** CONTEXT.md's canonical-refs section describes `LogTodaysWearButton` as "owned-only picker per Phase 83 POLISH-02" — true for the *watch list* (POLISH-02 scoped `watchOptions` to owned watches in `WornTabContent`), but that's a different guarantee from worn-today disabling, which was never built into this component.
**How to avoid:** Plan a dedicated task to port `WatchPickerDialog`'s disabled-row rendering (lines ~200-235: `aria-disabled`, `disabled`, opacity/cursor styling, trailing micro-label) into the rebuilt `LogTodaysWearButton`, wired to a date-aware preflight call (Pattern 2) rather than assuming it can be "extended."
**Warning signs:** A task verification step that greps for `wornTodayIds` inside `LogTodaysWearButton.tsx` and expects a match pre-implementation — it won't exist until this phase adds it.

### Pitfall 2: Copying `markAsWorn`'s `revalidateTag(tag, 'max')` pattern for the new backfill action
**What goes wrong:** All three existing wear-logging actions (`markAsWorn`, `logWearWithPhoto`, `logWearWithVideo`) invalidate the owner's own profile cache with `revalidateTag(`profile:${username}`, 'max')` — the stale-while-revalidate profile, appropriate for cross-user fan-out but NOT for the caller's own immediate next render. Following that exact pattern for the new backfill action would mean a user submits a backfilled wear and doesn't reliably see it appear on the Worn tab on the very next render (serves stale while revalidating in the background).
**Why it happens:** It's the path of least resistance — copy-paste the nearest existing action. But the project's OWN `profile.ts` (`updateProfile`) and `notifications.ts` actions correctly distinguish this: they use `updateTag(tag)` (no profile arg) specifically because "caller IS the viewer whose UI is being invalidated" — a read-your-own-writes case, per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` ("Designed for read-your-own-writes scenarios... immediately expires the cached data... next request will wait to fetch fresh data rather than serving stale content").
**How to avoid:** Use `updateTag(`profile:${username}`)` (not `revalidateTag(..., 'max')`) for the owner-invalidation in the new backfill action — this is a genuine RYO scenario (owner logs a wear, expects to see it immediately). Keep `revalidatePath('/')` unchanged (still correct for the home feed). This is a pre-existing inconsistency in `markAsWorn`/`logWearWithPhoto`/`logWearWithVideo` that is OUT OF SCOPE to retroactively fix (CONTEXT.md doesn't ask for it), but the NEW action Phase 84 adds should not propagate the same bug.
**Warning signs:** A manual local-dev test where you log a backfilled wear, the Server Action returns success, but the Worn tab (same session, same tab) doesn't show the new row without a hard refresh or several seconds' wait.

### Pitfall 3: `ViewTogglePill` does not implement the WAI-ARIA roving-tabindex pattern the UI-SPEC requires — but `ui/tabs.tsx` likely already does
**What goes wrong:** The UI-SPEC's Interaction Contract requires the window-control to implement "the WAI-ARIA roving-tabindex + arrow-key pattern already established for the radiogroup/tab convention in this project (Phase 68 lesson)." Reading `ViewTogglePill.tsx` directly shows it's `role="tablist"` / `role="tab"` buttons with `aria-selected`, click handlers, and NO `tabIndex` management, NO `onKeyDown`, and NO arrow-key cycling. If the leaderboard's window-control is built by literally cloning `ViewTogglePill`'s current code, it will NOT satisfy the UI-SPEC's own stated requirement.
**Why it happens:** The UI-SPEC's phrase "already established... in this project" is accurate for `ConfirmStep.tsx`'s **radiogroup** pattern (verified: `handleKeyDown` with ArrowRight/Left/Up/Down/Home/End + `requestAnimationFrame`-deferred focus move + `data-value` attribute lookup) but NOT for `ViewTogglePill`, which predates that Phase 68 pattern and was never retrofitted.
**Resolves Open Question 1 / Assumption A1:** `src/components/ui/tabs.tsx` was read directly in this research pass. It wraps `Tabs as TabsPrimitive from '@base-ui/react/tabs'` — `TabsList`/`TabsTrigger` are thin styling wrappers around Base UI's own `Tabs.List`/`Tabs.Tab` primitives with no custom keyboard code layered on top. Base UI's Tabs primitive (like Radix, which it is API-compatible with) implements the WAI-ARIA tabs pattern (roving tabindex + arrow-key/Home/End navigation) internally, inside the primitive itself — this was NOT independently confirmed by fetching Base UI's own docs/source in this session, so treat "keyboard nav works out of the box" as MEDIUM confidence, not verified fact.
**How to avoid:** Prefer `src/components/ui/tabs.tsx` (`Tabs`/`TabsList`/`TabsTrigger`) for the window-control over cloning `ViewTogglePill` — it very likely satisfies the WAI-ARIA requirement with zero new keyboard code, at the cost of adopting `TabsTrigger`'s existing Tailwind classes (which use `font-medium` internally per the UI-SPEC's own carve-out: "shadcn base components like `Button` already use `font-medium` internally and are left as-is"). If a design reason forces cloning `ViewTogglePill`'s simpler visual shape instead, port `ConfirmStep.tsx`'s `handleKeyDown` (lines ~163-191) pattern verbatim (adapted for 5 values), including the `data-value` attribute + `requestAnimationFrame` focus-move technique. Either way, verify actual arrow-key behavior in the local-dev manual walk (Validation Architecture) — don't assume the primitive works without touching it.
**Warning signs:** A plan verification step that says "keyboard nav matches ViewTogglePill" without acknowledging ViewTogglePill itself needs the same fix, or arrow-key press events silently doing nothing in a manual local-dev walk.

### Pitfall 4: `wear_events.worn_date` is a `text` column storing a bare `YYYY-MM-DD` string, not a real date/timestamp type
**What goes wrong:** Treating `wornDate` comparisons as anything other than lexical string comparison (which works correctly for zero-padded ISO dates, but only if every write path zero-pads consistently) or attempting to do SQL-side date arithmetic (`INTERVAL`, `NOW() - wornDate`) will hit type-mismatch errors since the column is `text`, not `date`/`timestamptz`.
**Why it happens:** `src/db/schema.ts` line 303: `wornDate: text('worn_date').notNull()`. The comment confirms: "ISO date string, e.g. '2026-04-19'". This was a deliberate Phase 15 (WR-02/260622-exo) choice specifically to avoid timezone-conversion bugs from a real `date`/`timestamptz` column interacting with Vercel's UTC process zone.
**How to avoid:** Do all window filtering client-side as plain string comparison (`e.wornDate >= cutoffISO`) as shown in Pattern 3 — this works correctly ONLY because ISO `YYYY-MM-DD` strings sort lexically identically to chronological order. Never introduce a SQL `CAST(worn_date AS date)` or interval-based query for the leaderboard; it would depart from the project's explicit design choice and reintroduce the exact timezone bug class 260622-exo fixed.
**Warning signs:** Any new code with `sql`\`${wearEvents.wornDate}::date\`` or `INTERVAL '90 days'` in a WHERE clause.

### Pitfall 5: D-14's assumption that zero-wear rows are "already visible... on the Collection tab" needs verification against the SAME viewer, not just the owner
**What goes wrong:** CONTEXT.md explicitly flags this as unverified: "The planner must confirm that holds under the Collection tab's privacy gating, and mirror it if it doesn't." A leaderboard that lists a private-collection owner's watch names to an anonymous or non-following visitor (via the zero-wear rows) when that same visitor would get a `LockedTabCard` on the Collection tab is a privacy leak — the owned-watch list must not be MORE visible via the leaderboard than via Collection.
**Why it happens:** The leaderboard's row source (`ownedWatches`, passed into `WornTabContent` from `signCoverUrls(resolved.watches)`) is currently computed unconditionally in `[tab]/page.tsx` for ANY viewer reaching the `worn` tab branch — there is no `collectionPublic` check gating it today (the worn tab's own gate was removed in Phase 12 per the comment at line ~321-325: "the tab-level lock is unreachable now that per-row gating runs at the DAL layer"). Collection tab, by contrast, DOES gate on `settings.collectionPublic` for non-owners (line ~295-307).
**How to avoid:** Before rendering leaderboard rows for a non-owner viewer, apply the same `settings.collectionPublic` check the Collection tab already uses. If `collectionPublic` is false and viewer isn't the owner, either (a) omit the leaderboard section entirely for that viewer, or (b) render leaderboard rows using ONLY watches present in the viewer's already-gated `events` (i.e., watches the visitor has actually seen a wear for) rather than the full `ownedWatches` array — CONTEXT.md's own hedge ("mirror it if it doesn't [hold]") anticipates exactly this fix.
**Warning signs:** A manual local-dev walk as a non-following visitor on a profile with `collectionPublic: false` where the Worn tab (which has no tab-level gate) still shows a leaderboard listing every owned watch by name.

### Pitfall 6: `onConflictDoNothing` in `logWearEvent` silently swallows duplicates but the caller (`markAsWorn`) still logs an activity — CONTEXT.md flags this as an existing quirk, not something Phase 84 must touch unless the new path reuses it
**What goes wrong:** `wearEventDAL.logWearEvent` (used only by `markAsWorn`, NOT by `logWearWithPhoto`/`logWearWithVideo`, which insert without `onConflictDoNothing` and catch 23505 explicitly instead) will silently no-op on a duplicate-day insert, but `markAsWorn`'s activity-logging block runs unconditionally afterward regardless of whether the insert actually happened.
**Why it happens:** `logWearEvent`'s `.onConflictDoNothing()` was written before the three-tier visibility/activity system existed and was never revisited.
**How to avoid:** The new backfill action should follow `logWearWithPhoto`'s pattern (explicit insert, no `onConflictDoNothing`, explicit 23505 catch) — NOT `markAsWorn`'s `logWearEvent` pattern. This sidesteps the bug entirely by construction rather than requiring a fix to `markAsWorn`. If the unified action approach chosen by the planner extends `markAsWorn` itself (CONTEXT.md's Claude's Discretion explicitly allows this), then the `onConflictDoNothing` + always-log-activity bug MUST be fixed as part of that extension (CONTEXT.md discretion note: "Fix the existing `markAsWorn` quirk... if the new path touches it").
**Warning signs:** A duplicate-day submission through the new unified form that returns a generic success (because `onConflictDoNothing` no-op'd) instead of the "Already logged this watch on that date." error — verify this doesn't happen by testing the actual insert path chosen, not just the schema.

### Pitfall 7: Next 16 `unstable_instant = false` + `await connection()` structural pattern on `/u/[username]/[tab]` must NOT be touched
**What goes wrong:** The Worn tab's data-loading branch inside `ProfileTabContent` (the `tab === 'worn'` block, `[tab]/page.tsx` lines ~426-495) sits inside a carefully-documented structural pattern (outer sync `ProfileTabPage` → `await connection()` → `<Suspense>` → inner async `ProfileTabContent`) that exists specifically to prevent a recurring React #419 / stale-cache bug (5 documented recurrences). Adding the leaderboard's data (which is fully derivable from `events` and `watches`, already fetched in this branch) is safe — but restructuring this file's control flow, adding a new top-level await before the `<Suspense>` boundary, or wrapping the worn-tab branch in its own `'use cache'` would risk recurrence #6.
**Why it happens:** The temptation to "clean up" this file while touching it for the leaderboard wiring.
**How to avoid:** Add the leaderboard exclusively by (a) passing more/different derived props into `WornTabContent` from the EXISTING `tab === 'worn'` branch (no new awaits added above the `<Suspense>` line), and (b) doing all window/tie-break computation client-side inside `WearLeaderboard.tsx`. Do not add a new DAL call inside the `worn` branch unless absolutely required (Pitfall 5's fix, if needed, reuses `settings.collectionPublic` which is already destructured at the top of `ProfileTabContent` — no new fetch needed).
**Warning signs:** A diff to `[tab]/page.tsx` that changes anything above line 168 (the `unstable_instant`/`connection()` block) or converts any part of the worn-tab branch to `async function ... { 'use cache' }`.

## Code Examples

### Wrapping existing Timeline/Calendar rows in `<Link>` (WEAR-01, D-15)
```typescript
// Source: adapting src/components/profile/WornTimeline.tsx (existing <li> shell, verified in this research)
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
// ... inside the dayEvents.map():
return (
  <li key={e.id}>
    <Link
      href={`/wear/${e.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-2 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* existing thumbnail + brand/model content, unchanged */}
      <ChevronRight className="ml-auto size-4 text-muted-foreground/40" aria-hidden />
    </Link>
  </li>
)
```

### Date-aware `getWornTodayIdsForUserAction` call (no DAL signature change needed)
```typescript
// Source: src/app/actions/wearEvents.ts getWornTodayIdsForUserAction (existing, verified —
// the `today` param is just a string; nothing inside the function assumes it IS today's date).
// New backfill dialog re-runs this on every date-field change:
useEffect(() => {
  let cancelled = false
  getWornTodayIdsForUserAction({ userId: viewerId, today: wornDate }).then((ids) => {
    if (!cancelled) setWornOnDateIds(new Set(ids))
  })
  return () => { cancelled = true }
}, [wornDate, viewerId])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single "Log Today's Wear" quick-log button, no note/visibility/date | Unified "Log a wear" form with date/note/visibility (D-07) | This phase (84) | Today's quick-log gains one extra tap (note+visibility fields visible, even if collapsed/defaulted) in exchange for one entry point instead of two. |
| `revalidateTag(tag, 'max')` used uniformly across all wear-logging actions | `updateTag(tag)` for genuine read-your-own-writes cases (already the pattern in `profile.ts`/`notifications.ts`, Next 16 canonical form) | Next 16 (already adopted elsewhere in this codebase, not yet in wearEvents.ts) | New backfill action should adopt `updateTag`; existing three actions are out of scope to retrofit per CONTEXT.md. |

**Deprecated/outdated:** `revalidateTag` single-arg form is deprecated in Next 16 for non-RYO cases per `project_next16_revalidatetag_deprecated` memory — already correctly avoided everywhere in this codebase (`revalidateTag(tag, 'max')` two-arg form is used throughout, including in the actions this phase touches).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/components/ui/tabs.tsx` wraps `@base-ui/react/tabs`'s `Tabs.List`/`Tabs.Tab` primitives with no custom keyboard code layered on top (confirmed by direct read); Base UI's own primitive is assumed to implement WAI-ARIA roving-tabindex + arrow-key navigation internally, satisfying the UI-SPEC's requirement with zero custom keyboard code — this INNER assumption (that Base UI's Tabs primitive itself has correct keyboard behavior) was not verified against Base UI's own docs/source in this session | Common Pitfalls #3, Don't Hand-Roll | If Base UI's Tabs primitive does NOT implement full keyboard nav (unlikely for a Radix-compatible primitives library, but unverified), the planner must budget a task for porting `ConfirmStep.tsx`'s roving-tabindex pattern onto a `ViewTogglePill`-style clone instead — a 5-minute manual keyboard check in the local-dev walk (arrow keys / Home / End on a `<Tabs>` instance) resolves this before it becomes a blocked task. |
| A2 | `getWearEventsForViewer`'s returned array (already loaded for Timeline/Calendar) is sufficient for the leaderboard for ALL viewer types (owner + visitor), i.e., no additional watch metadata is needed beyond what `watchMap`/`ownedWatches` already carry | Architecture Patterns, Pattern 3 | If the leaderboard needs `imageUrl` for watches with zero wears that aren't already in `watchMap` (unlikely — `watchMap` is built from `resolved.watches`, which includes ALL the owner's watches, not just ones with events), an extra prop-threading step would be needed. Low risk — verified `watchMap` construction includes every watch, not just wear-event-bearing ones. |

**Note:** Package-name provenance is N/A (no new packages). Both assumptions above are implementation-detail risks, not compliance/security/retention claims — neither requires user confirmation before planning, but A1 should be resolved by reading `src/components/ui/tabs.tsx` at plan time (one file read, not a research-blocking unknown).

## Open Questions

1. **Does Base UI's `Tabs` primitive (underlying `src/components/ui/tabs.tsx`) actually implement roving-tabindex keyboard nav?**
   - What we know: `src/components/ui/tabs.tsx` was read directly — it's a thin styling wrapper (`TabsList`/`TabsTrigger`) around `@base-ui/react/tabs`'s `Tabs.List`/`Tabs.Tab` primitives, with zero custom `onKeyDown`/`tabIndex` code in the wrapper itself. Radix-compatible primitive libraries (which Base UI is designed to be) conventionally bake WAI-ARIA tab keyboard behavior into the primitive.
   - What's unclear: This research did not fetch Base UI's own docs or inspect its primitive source to CONFIRM the keyboard behavior is actually implemented (vs. e.g. an early-stage primitive missing this feature).
   - Recommendation: Prefer `ui/tabs.tsx` for the window-control (Pattern/Pitfall 3) and confirm arrow-key/Home/End behavior in the local-dev manual walk (Validation Architecture) rather than blocking planning on it — the fallback (port `ConfirmStep`'s keyboard handler onto a `ViewTogglePill` clone) is cheap and already fully specified if needed.

2. **Exact mechanism for D-05's date-aware preflight disabled-row copy when `selectedDate !== today`**
   - What we know: `WatchPickerDialog`'s existing disabled-row label is the literal string "Worn today" — hardcoded, not date-aware.
   - What's unclear: UI-SPEC doesn't explicitly lock copy for the disabled-row label when the chosen date isn't today (e.g., "Already logged on Apr 3" vs generic "Already logged").
   - Recommendation: Default to a generic "Already logged" (or reuse "Already logged this watch on that date." style) rather than inventing new copy not covered by the UI-SPEC's Copywriting Contract — flag for a quick confirm during planning/UAT rather than blocking.

## Environment Availability

Skipped — this phase has no new external dependencies (no new packages, no new services, no new CLI tools). All work is against the existing local Supabase Postgres instance and existing npm dependencies, per the Local-First Development workflow already mandated in `./CLAUDE.md`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3 (via `vitest run`), jsdom environment (default in `vitest.config.ts`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run tests/components/profile/WornTimeline.test.tsx tests/components/profile/WornCalendar.test.tsx tests/actions/wearEvents*.test.ts` (targeted, per-plan) |
| Full suite command | `npm run test` (== `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEAR-01 | Timeline row wraps in `<Link href="/wear/[id]">`, focus-visible ring present | unit (RTL) | `npx vitest run tests/unit/WornTimeline.test.tsx` | ✅ (file exists, extend with a new link-href assertion — Wave 0) |
| WEAR-01 | Calendar selected-day-panel row wraps in `<Link href="/wear/[id]">`, day-cell click-to-select unchanged | unit (RTL) | `npx vitest run tests/components/profile/WornCalendar.test.tsx` | ✅ (file exists, extend — Wave 0) |
| WEAR-02 | Server rejects `wornDate > today` | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ Wave 0 (new file, mirror `tests/actions/wearEventsVideo.test.ts` shape) |
| WEAR-02 | Duplicate-day insert on the SAME date returns "Already logged this watch on that date." | unit (action, mocked DAL 23505) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ Wave 0 (same file) |
| WEAR-02 | Activity logged only when `wornDate === today`; skipped for genuinely past dates | unit (action, spy on `logActivity`) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ Wave 0 (same file) |
| WEAR-02 | Date-aware preflight: `getWornTodayIdsForUserAction` called with the selected date, not literally today | unit (component, mocked action) | `npx vitest run tests/components/profile/LogTodaysWearButton.test.tsx` | ❌ Wave 0 (new file; no existing test for this component per `find tests -iname "*LogToday*"`) |
| WEAR-03 | Window control renders 5 segments, defaults to 3 mo, arrow-key cycles selection | unit (RTL, keyboard events) | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` | ❌ Wave 0 (new file) |
| WEAR-04 | `buildLeaderboard`/window-filter pure functions: count + D-13 tie-break + zero-wear inclusion + sort | unit (pure fn) | `npx vitest run tests/unit/stats.test.ts` (or new `tests/unit/leaderboard.test.ts`) | Check `tests/unit/` for an existing `stats.test.ts` at plan time — if absent, new file |
| WEAR-04 | Visitor with `profile_public: false` and not following does not see leaderboard rows / sees only DAL-gated watches (Pitfall 5 fix) | integration (DAL + gating) | `npx vitest run tests/data/getWearEventsForViewer.test.ts` (extend) or new `tests/integration/phase84-leaderboard-gating.test.ts` | Check `tests/data/` for existing `getWearEventsForViewer` coverage at plan time |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed test files>`
- **Per wave merge:** `npm run test` (full suite) + `npm run build`
- **Phase gate:** Full suite green + `npm run build` exit 0 before `/gsd:verify-work`. Per `./CLAUDE.md` Local-First Development: `npm run build` exit 0 is authoritative; `vitest`/`tsc` carry pre-existing baseline failures elsewhere in the repo — do not chase unrelated red tests to zero.

### Wave 0 Gaps
- [ ] `tests/actions/wearEventsBackfill.test.ts` — covers WEAR-02 (future-date rejection, duplicate-day error, conditional activity logging)
- [ ] `tests/components/profile/LogTodaysWearButton.test.tsx` — covers WEAR-02 (date-aware preflight, unified form, no existing test file for this component today)
- [ ] `tests/components/profile/WearLeaderboard.test.tsx` — covers WEAR-03/WEAR-04 (new component, no existing coverage)
- [ ] Confirm/create `tests/unit/leaderboard.test.ts` or extend `tests/unit/stats.test.ts` for the pure window-filter + tie-break functions (WEAR-04)
- [ ] Extend `tests/unit/WornTimeline.test.tsx` and `tests/components/profile/WornCalendar.test.tsx` with link-href assertions (WEAR-01) — both files exist already, no new file needed, just new `it()` blocks

**Also required per CLAUDE.md Local-First Development (not a vitest gap, but a phase-gate requirement):** a manual `npm run dev` walk against local Supabase, signed in as a seeded user (e.g. `vintage-anna@horlo.test` / `password123`), exercising: (1) tap a Timeline row → lands on `/wear/[id]`; (2) tap a Calendar selected-day row → same; (3) open "Log a wear", pick a past date, submit without a photo, confirm it appears in Timeline/Calendar dated correctly and does NOT appear as a new activity on the home feed; (4) toggle the 1/3/6/12/All window control and confirm the leaderboard ranking changes; (5) view the SAME profile as a different signed-in seeded user (e.g. `modern-mike@horlo.test`) to exercise the visitor-gating path from Pitfall 5.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | `getCurrentUser()` try/catch pattern, identical to every existing wear action — no change needed, just preserve the pattern in the new action. |
| V3 Session Management | no | No session-handling change in this phase. |
| V4 Access Control | yes | IDOR defense: `watchDAL.getWatchById(user.id, watchId)` ownership check BEFORE any write (existing pattern in `markAsWorn`/`logWearWithPhoto`, reused verbatim). Viewer-gated reads via `getWearEventsForViewer` (existing, reused, not reimplemented — see Don't Hand-Roll). Leaderboard zero-wear-row visibility must respect `collectionPublic` (Pitfall 5). |
| V5 Input Validation | yes | zod `.safeParse` on all new Server Action inputs, mirroring `logWearWithPhotoSchema`; regex-validated date strings (`/^\d{4}-\d{2}-\d{2}$/`); server-side future-date rejection independent of client `<input max>` (D-02). |
| V6 Cryptography | no | No new cryptographic material — signed URLs for photos are N/A (WEAR-02 is photo-less by design). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user watch ID in `logBackfillWear` input (IDOR) | Tampering / Information Disclosure | `watchDAL.getWatchById(user.id, watchId)` scoped lookup — returns uniform "Watch not found" on miss, matching the existing pattern's no-existence-leak guarantee. |
| Client-supplied `wornDate`/`today` used to bypass the future-date rule or falsely trigger/suppress activity logging | Tampering | Server independently compares `wornDate > today` (both client-supplied, both regex-validated) — this is a UX/product-correctness control, not a security boundary per se, but must not trust the `<input max>` attribute alone (260622-exo precedent). |
| Duplicate-day race (two concurrent backfill submissions for the same watch+date) | Denial of Service (minor) / Data Integrity | `wear_events_unique_day` unique constraint (DB-level, already exists) + explicit 23505 catch → friendly error, exact pattern already proven in `logWearWithPhoto`. |
| Leaderboard zero-wear rows leaking a private collection's watch names to a disallowed viewer | Information Disclosure | Gate on `settings.collectionPublic` for non-owner viewers before rendering leaderboard rows sourced from `ownedWatches`, mirroring the Collection tab's existing gate (Pitfall 5). |
| Stale profile cache masking a just-submitted backfill wear from the owner's own next render | (not a security issue — correctness/UX) | `updateTag` for the RYO invalidation path (Pitfall 2). |

## Sources

### Primary (HIGH confidence)
- `src/db/schema.ts` (read directly) — `wear_events` table shape, `wear_events_unique_day` constraint, `worn_date` as `text`
- `src/app/actions/wearEvents.ts` (read directly) — `markAsWorn`, `logWearWithPhoto`, `logWearWithVideo`, `getWornTodayIdsForUserAction` full implementations
- `src/data/wearEvents.ts` (read directly) — `getWearEventsForViewer`, `getWearEventByIdForViewer`, `getWornTodayIdsForUser`, `logWearEventWithPhoto`
- `src/lib/wear.ts` (read directly) — `todayLocalISO`, `daysSince`, the 260622-exo incident writeup in comments
- `src/lib/stats.ts` (read directly) — `wearCountByWatchMap`, `topMostWorn`/`topLeastWorn`
- `src/components/profile/{WornTabContent,WornTimeline,WornCalendar,LogTodaysWearButton,ViewTogglePill}.tsx` (read directly)
- `src/components/home/WatchPickerDialog.tsx` (read directly) — disabled-row preflight pattern
- `src/components/wywt/{ComposeStep,VisibilitySegmentedControl}.tsx` (read directly)
- `src/components/watch/ConfirmStep.tsx` (read directly) — WAI-ARIA roving-tabindex reference implementation
- `src/app/u/[username]/[tab]/page.tsx` (read directly) — full Worn tab data-loading branch, `unstable_instant`/`connection()` structural constraint
- `src/app/wear/[wearEventId]/page.tsx` (read directly) — confirmed unchanged by this phase
- `src/app/actions/profile.ts`, `src/app/actions/notifications.ts` (read directly, grepped) — `updateTag` RYO pattern precedent
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` (read directly, per AGENTS.md requirement to consult Next docs before prescribing APIs)
- `.planning/phases/84-wear-history-depth/84-CONTEXT.md` and `84-UI-SPEC.md` (read directly) — locked decisions, canonical refs, verified against live code in this pass

### Secondary (MEDIUM confidence)
- None used beyond the direct codebase reads above — this phase's research is entirely code-verification against an already-thorough CONTEXT.md/UI-SPEC, not external ecosystem research.

### Tertiary (LOW confidence)
- Assumption A1 (`ui/tabs.tsx` keyboard behavior) — not verified by reading the file in this pass; flagged in Assumptions Log and Open Questions for a one-file check at plan time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every referenced file was read directly in this session.
- Architecture: HIGH — the data flow, gating, and cache-invalidation patterns were traced through actual source files, not inferred from CONTEXT.md alone; two divergences from CONTEXT.md's assumptions were caught (Pitfalls 1 and 2).
- Pitfalls: HIGH for Pitfalls 1, 2, 4, 6, 7 (all directly verified against source); MEDIUM for Pitfall 3 (verified `ViewTogglePill` lacks the pattern; did not verify whether `ui/tabs.tsx` already has it — see A1); MEDIUM for Pitfall 5 (verified the gating gap exists in `[tab]/page.tsx`, but the exact fix mechanism is a planning decision, not a verified-safe pattern yet).

**Research date:** 2026-09-12
**Valid until:** 30 days (stable internal codebase, no external ecosystem drift risk — the only external dependency, Next.js 16, is pinned and its `updateTag` API is stable per its own docs)
