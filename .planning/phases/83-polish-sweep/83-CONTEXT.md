# Phase 83: Polish sweep - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship three small, low-risk UX cleanups that unblock the v9.0 pile before any schema work begins:

1. **POLISH-01** — Remove the `+` add-watch icon-button from the **desktop** top nav (`DesktopTopNav`). The add flow remains reachable via the existing dedicated `AddWatchCard` entries on the Collection and Wishlist tabs.
2. **POLISH-02** — Constrain both watch-selection dropdowns on the Worn tab (the log-a-wear picker AND the events filter) to `status === 'owned'` watches. Wishlist and grail watches are excluded.
3. **POLISH-03** — Soften the destructive-delete UX for wishlist and grail watches from "Delete" to "Remove from wishlist" copy on both the action button and the confirmation dialog.

Three UI-only changes. No schema, no cross-cutting refactor, no new capabilities. Owned-watch deletion UX is unchanged (Phase 85 owns that redesign via `previously_owned`).

</domain>

<decisions>
## Implementation Decisions

### POLISH-01 — Desktop `+` removal
- **D-01:** Remove the `<Link>` + `<Button variant="ghost" size="icon">` + `<Plus>` block at `src/components/layout/DesktopTopNav.tsx:98-105` (and the now-unused `Plus` import). Do not replace it with anything. The mobile `BottomNav` never had a `+` add-watch button and is untouched.
- **D-02:** No new hover/keyboard/aria affordance is needed to substitute for the removed button — the `AddWatchCard` entries on the profile Collection and Wishlist tabs remain the canonical entry point per the phase's success criterion.

### POLISH-02 — Worn tab dropdown scope
- **D-03:** Both watch-selection dropdowns on the Worn tab list `status === 'owned'` watches only:
  - the **log-a-wear picker** inside `LogTodaysWearButton` (rendered from `WornTabContent.tsx:157`), and
  - the **events filter** `Select` at `WornTabContent.tsx:140-155`.
- **D-04:** The "All watches" default option in the events filter stays as-is — historical wear events for a watch whose status was later demoted are still visible in the "All watches" view; only the by-watch filter option for demoted watches disappears.
- **D-05:** `WornTabContent` already receives an `ownedWatches: Watch[]` prop (page.tsx:493 = `watches.filter((w) => w.status === 'owned')`). The dropdown source should derive from `ownedWatches` (with the existing sort applied), not from `Object.values(watchMap)`. `watchMap` stays populated from **all** watches so event rows for demoted watches still render brand/model correctly in the timeline.
- **D-06:** No forward-looking helper for Phase 85's `previously_owned` is introduced here — the literal `status === 'owned'` predicate is correct for Phase 83's data model. Phase 85 handles its own dropdown-scope adjustments when it lands the new enum value.

### POLISH-03 — Wishlist remove copy
- **D-07:** "Remove from wishlist" copy applies to **both** `wishlist` and `grail` statuses (one string, one behavior). The existing `isWishlistLike = status === 'wishlist' || status === 'grail'` gate in `WatchDetail.tsx:135` stays and drives the softened UX. No status-adapted copy variant is introduced (grail keeps calling itself "wishlist" in this dialog — matches how the codebase already treats grail as wishlist-like).
- **D-08:** Owned-watch deletion is **not** touched. When `isWishlistLike` is false, the action button and dialog remain "Delete" / "Delete Watch" / destructive-styled. Phase 85 owns the owned-watch UX redesign.
- **D-09:** Softened copy (for `isWishlistLike === true`):
  - Action button on the page: `Remove from wishlist` (variant `outline`)
  - Dialog title: `Remove from wishlist`
  - Dialog body: `Remove {brand} {model} from your wishlist? You can add it back any time.`
  - Confirm button: `Remove from wishlist` (variant `destructive` — visual weight matches finality of the action inside the confirm step)
  - Cancel button: `Cancel` (unchanged)
- **D-10:** Action-button variant differs by status: `variant="outline"` for wishlist/grail (low-stakes — the shared `watches_catalog` row is untouched; only the user's own `watches` row and their uploaded photos are removed; user can re-add any time), `variant="destructive"` for owned (real data-loss risk). Same button element, conditional `variant` prop.
- **D-11:** The `handleDelete` handler and `removeWatch` server action are **not** renamed. Only the user-facing copy changes; internal naming stays as-is to keep the diff surgical.

### Cross-cutting
- **D-12:** No new tests introduced. `WornTabContent.test.tsx`, `WishlistTabContent.test.tsx`, and any tests around `WatchDetail`'s delete flow get their assertions updated to reflect the new copy and the owned-only dropdown source. Existing owned-watch delete-flow test coverage remains untouched.
- **D-13:** Verification cadence per project rules — `npm run dev` walk against local Supabase for desktop (POLISH-01 desktop-only, POLISH-02 dropdown, POLISH-03 dialog); iPhone Safari on prod for POLISH-02 mobile dropdown + POLISH-03 mobile dialog (mobile UI verifies on prod per `feedback_mobile_ui_verify_on_prod`).

### Claude's Discretion
- **Plan decomposition** — the planner picks whether to ship POLISH-01/02/03 as one plan or three. All three are tiny, independent, and touch disjoint files (`DesktopTopNav.tsx` vs. `WornTabContent.tsx` + `page.tsx` vs. `WatchDetail.tsx`), so either shape is defensible.
- **Commit shape and Vercel push cadence** — a single bundled push is fine here (mirrors the v8.1 polish-milestone pattern per `project_v8_1_complete`). Planner may split if a UAT walk finds issues.

### Reviewed Todos (not folded)
- `drizzle-kit-pg-net-introspection-bug` — keyword-only match (score 0.4 on "phase"). Supabase/drizzle-kit local-dev tooling bug from Phase 76, unrelated to nav/dropdown/copy polish. Stays pending in `.planning/todos/pending/`; not folded into Phase 83.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase authority
- `.planning/ROADMAP.md` — Phase 83 entry (goal, dependencies, requirements, success criteria)
- `.planning/REQUIREMENTS.md` — POLISH-01 / POLISH-02 / POLISH-03 requirement text
- `.planning/PROJECT.md` §Current Milestone — v9.0 kickoff decisions (2026-07-13); confirms `previously_owned` is a Phase 85 concern, no scope creep, Phase 83 is the pre-schema polish gate

### Target source files (must-read to plan the diffs)
- `src/components/layout/DesktopTopNav.tsx` — POLISH-01 surface (`+` button at lines 98-105, `Plus` import at line 5)
- `src/components/profile/WornTabContent.tsx` — POLISH-02 surface (events filter Select at 140-155, LogTodaysWearButton mount at 157, `watchOptions` derivation at 70-77)
- `src/components/profile/LogTodaysWearButton.tsx` — POLISH-02 dropdown consumer
- `src/app/u/[username]/[tab]/page.tsx` — POLISH-02 data-source boundary (`watchMap` built at line 434, `ownedWatches` filter at line 493 passed to `WornTabContent`)
- `src/components/watch/WatchDetail.tsx` — POLISH-03 surface (`isWishlistLike` at 135, Delete DialogTrigger at 302-305, dialog title/body/buttons at 307-329)

### Reference types & actions
- `src/lib/types.ts` — `WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'` (Phase 85 adds `previously_owned`; Phase 83 uses today's enum literally)
- `src/app/actions/watches.ts:779-819` — `removeWatch` (real DELETE of the user's `watches` row via `watchDAL.deleteWatch`; purges uploaded watch-photos storage objects; `watches_catalog` row is untouched — informs D-09's "you can add it back any time" copy)

### Project-wide rules that apply here
- `CLAUDE.md` §Local-First Development — `npm run dev` + local Supabase before push
- `AGENTS.md` — "This is NOT the Next.js you know" (App Router, Next 16 idioms — `updateTag` for read-your-own-writes is already used in `removeWatch`; not touched here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddWatchCard` (`src/components/profile/AddWatchCard.tsx`) — the "dedicated entry point" the POLISH-01 success criterion references. Two variants (`collection` / `wishlist`) already live on the Collection and Wishlist tab bodies; no changes needed.
- `ownedWatches` prop on `WornTabContent` — already computed at `page.tsx:493` as `watches.filter((w) => w.status === 'owned')`. Reuse for D-05; no new derivation needed.
- `isWishlistLike` in `WatchDetail.tsx:135` — already exists; drives the D-07 grail/wishlist conflation.
- Shadcn `Dialog`, `Button` variants (`destructive`, `outline`), `Select` — all already used on the target surfaces. No new primitives.

### Established Patterns
- **Desktop vs. mobile nav split** — `DesktopTopNav` renders `md:block` chrome; `BottomNav` renders `md:hidden` chrome. POLISH-01 is desktop-only by construction; no mobile change lurks.
- **Client Components for interactive UI** — `DesktopTopNav`, `WornTabContent`, `LogTodaysWearButton`, `WatchDetail` are all `'use client'`. No RSC boundary to negotiate.
- **`watchMap` = all watches; `ownedWatches` = filtered** — Worn tab page already maintains this separation. D-05 leans into it: keep `watchMap` complete so the timeline can label historical demoted-watch events; use `ownedWatches` for pickers.
- **Server Action + `updateTag('viewer:${user.id}:recs')`** — `removeWatch` already does this correctly. Not touched.

### Integration Points
- **DesktopTopNav** — Also removes the unused `Plus` lucide import (no other consumer in that file).
- **page.tsx `[tab]/page.tsx`** — Change the prop shape passed to `WornTabContent` so the dropdown draws from `ownedWatches`. Verify no other consumer of `WornTabContent` exists (`grep -rln "WornTabContent"` should return only the page and its test file).
- **WatchDetail.tsx** — Adjust JSX for the action button (`variant` + label conditional on `isWishlistLike`) and the dialog contents (title, description, confirm button, no changes to the `Dialog` primitive or `handleDelete` handler).

</code_context>

<specifics>
## Specific Ideas

- User specifically clarified during discussion that the wishlist "Delete" is misleading — it doesn't delete from the shared catalog; it only detaches the user's per-user `watches` row. That informed D-09's exact copy: "You can add it back any time" is factually accurate and reassures the user without a menacing "cannot be undone" warning.
- D-10 (wishlist action button → `outline`, owned stays `destructive`) matches the codebase pattern where visual weight tracks stakes; owned-watch deletion truly is a permanent loss of user data (wear photos, notes), and its destructive-red button stays.

</specifics>

<deferred>
## Deferred Ideas

- **Owned-watch "Delete" UX redesign** — the "Delete" copy on owned watches becomes an odd survivor once Phase 85 lands `previously_owned` (users will typically mark-as-previously-owned rather than delete). Belongs to Phase 85's LIFE surface, not Phase 83.
- **Skip-dialog UX for wishlist removes** — considered and rejected in favor of keeping the confirmation dialog (D-09) for misclick safety. Revisit only if analytics show wishlist removes are painfully slow.
- **Wear-event visibility for demoted watches** — historical wear events from a watch that was later demoted to wishlist/grail still render in the Worn timeline's "All watches" view (D-04). Not a bug per Phase 83's scope; a data-model conversation for Phase 85 if it comes up.
- **Filter dropdown → "watches with events" data-driven scope** — considered (option 3 in the POLISH-02 question); rejected in favor of the simpler "owned only" rule to keep both dropdowns aligned. Would reconsider only if a real user hits a confusing empty filter result.

</deferred>

---

*Phase: 83-polish-sweep*
*Context gathered: 2026-07-14*
