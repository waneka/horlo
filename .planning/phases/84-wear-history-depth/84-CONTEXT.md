# Phase 84: Wear history depth - Context

**Gathered:** 2026-09-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the Worn tab (`/u/[username]/worn`) teeth, with no new route:
1. **WEAR-01**: every wear row links to its existing `/wear/[id]` detail page.
2. **WEAR-02**: the owner can log a photo-less wear on a past date from the Worn tab.
3. **WEAR-03**: a wear-count aggregate section has a segmented window control (1 mo / 3 mo / 6 mo / 12 mo / All time).
4. **WEAR-04**: that section ranks the profile owner's owned watches by wear count within the selected window.

Out of scope (locked at v9.0 kickoff / REQUIREMENTS "Out of Scope"):
- Photo capture for backfilled wears. Photos stay on the same-day WYWT path.
- Per-watch aggregates on the watch detail page.
- Any new wear-detail route.

</domain>

<decisions>
## Implementation Decisions

### Backfill entry & form (WEAR-02)
- **D-01:** One entry point. The existing owner-only log-wear button on the Worn tab (`LogTodaysWearButton`, owned-only picker per Phase 83 POLISH-02) opens a form with a **date field defaulting to today**. There is no separate "Log past wear" button and no calendar-cell entry point.
- **D-02:** Date range is **any past date, never future**. Use native `<input type="date">` with `max` = browser-local today (`todayLocalISO()` from `src/lib/wear.ts`) and no lower bound. The server must also reject a future `wornDate`. Reason: the client supplies the date (260622-exo invariant), so the server can't trust the client's `max`.
- **D-03:** Form fields: **watch (owned only) + date + optional note (200-char limit, same as the photo flow) + visibility selector (public / followers / private)**. No photo.
- **D-04:** Visibility **defaults to Public**. This matches today's quick-log (`markAsWorn` always writes public) and the photo-flow default. Nothing is remembered between sessions.
- **D-05:** Duplicates are prevented up front. When the date changes, the picker re-checks which owned watches are already worn **on the selected date** (make the existing `getWornTodayIdsForUserAction` preflight date-aware) and disables them. The server keeps the `wear_events_unique_day(user_id, watch_id, worn_date)` constraint as the backstop and returns a friendly "Already logged this watch on that date." error if one slips through.

### Backfill feed behavior
- **D-06:** Only wears dated **today** (`wornDate === browser-local today`) write the `watch_worn` activity. Past-date wears write **no activity**, so a backfill session doesn't show followers old wears as new. Backfilled wears still appear on the Worn tab, the calendar, the leaderboard and `/wear/[id]`. The home WYWT rail already excludes them (48h `wornDate` window).
- **D-07:** **One form for both today and past dates.** "Log a wear" always opens the form, so today's quick-log gains note and visibility at the cost of one extra tap versus pick-and-go. The Worn-tab button's label/copy should reflect "log a wear" rather than "today" (exact copy is Claude's discretion or a UI-SPEC call).

### Leaderboard layout & data (WEAR-03 / WEAR-04)
- **D-08:** **Section above the Timeline/Calendar toggle**, always visible (not collapsible, not a third view). Timeline, Calendar and the watch filter below are unchanged, and the filter does not affect the leaderboard.
- **D-09:** Default window is **3 mo**. Use the existing `ViewTogglePill` (`role="tablist"`) pattern or `ui/tabs` for the segmented control.
- **D-10:** Row: **rank, small watch thumbnail, Brand Model, wear count, thin proportional bar** scaled to the top watch's count. The bar uses the **accent** token (`bg-accent`, paired `dark:` utility per project conventions); no raw palette classes, no `font-medium`.
- **D-11:** Rows cover **all owned watches, zero-wear included** (sorted to the bottom, labelled "0 wears"). Show the **top 5**, then a "Show all" expander. "Owned" means `status === 'owned'`. Wears of non-owned watches (wishlist/grail, or demoted) are excluded from rows.
- **D-12:** Tapping a row opens the watch detail page `/w/[id]`.
- **D-13:** Windows are **rolling days through browser-local today, inclusive**: 1 mo = 30, 3 mo = 90, 6 mo = 182, 12 mo = 365, All = no lower bound. Tie-break: **most recent wear date desc**, then **Brand Model A→Z**. Zero-wear rows are sorted A→Z.

### Viewer & linking rules (WEAR-01 + leaderboard visibility)
- **D-14:** **Visitors see the leaderboard too, computed only from wears they're allowed to see.** That's the same per-row gating as `getWearEventsForViewer`: owner sees all; otherwise `profile_public` required, public wears, plus followers-only when following. Private or hidden-from-viewer wears must never contribute to counts. Zero-count rows list the owner's owned watches, which is acceptable because that list is already visible to the visitor on the Collection tab. The planner must confirm that holds under the Collection tab's privacy gating, and mirror it if it doesn't.
- **D-15:** **Every wear row links to `/wear/[id]`** in both **Timeline entries** (`WornTimeline`) and the **Calendar's selected-day panel** (`WornCalendar`). Calendar day cells keep their select-a-day behavior. `/wear/[id]` already applies viewer gating and renders photo-less wears (falls back to watch image), so no changes there.

### Claude's Discretion
- How to implement the unified log action: extend `markAsWorn` with `wornDate`/note/visibility, reuse `logWearWithPhoto({hasPhoto:false})`, or add a dedicated action. Whatever is chosen must carry both the client's `today` and the chosen `wornDate` so the server can enforce D-02 (no future) and D-06 (activity only when `wornDate === today`), and keep the 260622-exo rule that the server never computes "today" itself.
- Fix the existing `markAsWorn` quirk where `onConflictDoNothing` swallows a duplicate but **still logs an activity**, if the new path touches it.
- Mobile presentation of the form (dialog vs sheet), empty states for the leaderboard ("No wears in this window" while zero rows still list owned watches), and loading states. A UI-SPEC (`/gsd-ui-phase 84`) may lock these.
- Whether leaderboard counts are computed in JS from the already-fetched wear events (the page already loads `getWearEventsForViewer`) or via a new aggregate DAL query. Per the <500 watches/user constraint, JS is fine unless research finds a reason otherwise.
- Cache invalidation for the new/extended action, matching existing wear actions (`revalidatePath('/')`, `revalidateTag('profile:<username>','max')`; `updateTag` for read-your-own-writes per project memory).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` — WEAR-01..04 and the Out of Scope table (no new wear route, no photos on backfill)
- `.planning/ROADMAP.md` §Phase 84 — goal + 4 success criteria
- `.planning/PROJECT.md` §Current Milestone — v9.0 kickoff decisions (aggregates live on the Worn tab as an across-collection view; `/wear/[id]` reused)
- `.planning/phases/83-polish-sweep/83-CONTEXT.md` — POLISH-02: Worn-tab pickers are owned-only (D-04 there keeps "All watches" filter behavior)

### Wear date & logging invariants
- `src/lib/wear.ts` (header comment, ~L10-40) — why the client supplies `today` (`todayLocalISO`) and the server must not compute it (quick task 260622-exo)
- `src/app/actions/wearEvents.ts` — `markAsWorn`, `logWearWithPhoto`, `getWornTodayIdsForUserAction`, activity logging
- `src/db/schema.ts` §wear_events (~L297-322) — `worn_date` is `text` ISO `YYYY-MM-DD`; `wear_events_unique_day` unique constraint; `visibility` enum
- `src/data/wearEvents.ts` — `getWearEventsForViewer` (~L208-275) viewer gating; `getWearEventByIdForViewer`

### Wear detail route
- `src/app/wear/[wearEventId]/page.tsx` — existing detail permalink (auth-only, viewer-gated, photo-less OK)
- `.planning/seeds/wear-view-unification.md` — two-route model; `/wear/[id]` is the conventional, scrollable DETAIL permalink

### Worn tab surfaces
- `src/app/u/[username]/[tab]/page.tsx` (~L426-495) — Worn tab data loading + photo signing
- `src/components/profile/WornTabContent.tsx`, `WornTimeline.tsx`, `WornCalendar.tsx`, `ViewTogglePill.tsx`
- `src/components/profile/LogTodaysWearButton.tsx`, `src/components/home/WatchPickerDialog.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ViewTogglePill<T>` (`src/components/profile/ViewTogglePill.tsx`): generic `role="tablist"` pill, already on the Worn tab. Natural fit for the 1/3/6/12/All window control.
- `src/lib/stats.ts`: `wearCountByWatchMap`, `topMostWorn` / `topLeastWorn` (pure JS). A base for leaderboard ranking; needs window filtering and the D-13 tie-break.
- `todayLocalISO()` / `daysSince` (`src/lib/wear.ts`): browser-local date helpers for `max` and rolling windows.
- `WatchPickerDialog` + `getWornTodayIdsForUserAction`: owned-only picker with already-worn disabling. Extend the preflight to take a date.
- Native `<input type="date">` precedent at `src/components/watch/WatchForm.tsx:805`. There's no date-picker library, and none should be added.
- `WearCard` / `WearDetailHero`: photo-less fallback already handled on `/wear/[id]`.

### Established Patterns
- Client-supplied date strings validated `/^\d{4}-\d{2}-\d{2}$/` on the server; server never derives "today".
- Viewer gating lives in the DAL (`getWearEventsForViewer`). The leaderboard must consume gated rows, never raw owner data, when the viewer isn't the owner.
- Worn tab props currently pass only `{id, watchId, wornDate, note, photoUrl}` to the client; `visibility` / `createdAt` are not passed. Add fields only if needed.
- Styling guardrails: `bg-accent` is the active/selected token (not `bg-primary`); outline Buttons need paired `dark:` overrides; `space-y-*` doesn't stack inline siblings; `font-semibold` not `font-medium` (no-raw-palette test).
- React #418: format any displayed dates with `timeZone: 'UTC'` + `'en-US'` in client components.

### Integration Points
- Worn tab page loader → `WornTabContent` (new leaderboard section mounts above the view toggle).
- `WornTimeline` / `WornCalendar` day-panel rows become `Link`s to `/wear/${id}`.
- Wear-log Server Action(s) → `logActivity('watch_worn', …)` gated on `wornDate === today` (D-06).
- Feed: `src/data/activities.ts` sorts by `createdAt`, which is why past-date activities are suppressed rather than back-dated.

</code_context>

<specifics>
## Specific Ideas

- Backfill is explicitly "I forgot to log this": a fast catch-up tool, not a posting flow. Hence no feed activity for past dates.
- The leaderboard should make neglected watches visible (zero-wear rows at the bottom), echoing the existing "sleeping beauties" idea without duplicating it.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

### Reviewed Todos (not folded)
- `drizzle-kit-pg-net-introspection-bug`: matched only on the generic keyword "phase"; unrelated to wear history (tooling bug). Not folded.

</deferred>

---

*Phase: 84-wear-history-depth*
*Context gathered: 2026-09-12*
