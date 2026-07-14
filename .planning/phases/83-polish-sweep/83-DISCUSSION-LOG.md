# Phase 83: Polish sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 83-polish-sweep
**Areas discussed:** POLISH-02 scope, POLISH-03 grail treatment, POLISH-03 confirmation dialog copy, POLISH-03 action-button variant, Todo match (drizzle-kit pg_net)

---

## Selection round

Presented four candidate gray areas; the user selected all four for discussion.

| Option | Description | Selected |
|--------|-------------|----------|
| POLISH-02 scope | Filter dropdown vs. log-only dropdown scoping | ✓ |
| POLISH-03 grail treatment | Whether grail gets the softened copy too | ✓ |
| POLISH-03 confirmation dialog copy | Exact title/body/button copy for the softened dialog | ✓ |
| Todo match (drizzle-kit pg_net) | Fold / review-only / ignore an unrelated pending todo | ✓ |

---

## POLISH-02 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both dropdowns → owned only (Recommended) | Log picker AND events filter both list owned watches only. Consistent UX; wishlist/grail can't have wear events anyway. | ✓ |
| Only the log dropdown | Strict reading of POLISH-02. Filter select keeps showing every watch in the profile. Preserves ability to filter events by a demoted watch. | |
| Log → owned, filter → watches-that-have-events | Filter scoped to the set of watches actually referenced by any wear event. Data-driven, not status-driven. | |

**User's choice:** Both dropdowns → owned only.
**Notes:** Locked in CONTEXT.md as D-03/D-04/D-05. The "All watches" default option in the filter stays as-is so historical wear events from demoted watches are still visible in the "All" view — only the by-watch filter option for demoted watches disappears.

---

## POLISH-03 grail treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Same softened copy for both (Recommended) | Grail is wishlist-like throughout the codebase (isWishlistLike). Removing a grail watch says "Remove from wishlist" too. One string, one behavior. | ✓ |
| Status-adapted copy — "Remove from wishlist" / "Remove from grail" | Two strings, chosen by status. More precise but adds a second copy variant to maintain. | |
| Only literal `wishlist` softens; grail keeps "Delete" | Strict reading of the requirement. Grail action still says "Delete" — preserves current behavior for grail. | |

**User's choice:** Same softened copy for both.
**Notes:** Locked as D-07. The existing `isWishlistLike = wishlist || grail` predicate in `WatchDetail.tsx:135` stays and drives the softened UX.

---

## POLISH-03 confirmation dialog copy — clarification round

**User's first response (Other/freeform):** "wait - what does 'delete' mean in this context? it's not actually deleting from the catalog right? it's just removing from the wishlist? if so the whole verbage needs to be updated"

**Claude's clarification:** Verified `removeWatch` → `watchDAL.deleteWatch` — a real DELETE of the user's own `watches` row plus purge of any uploaded watch photos. The shared `watches_catalog` entry is untouched. For a wishlist watch, no meaningful user data is lost; the user can re-add the watch to their wishlist at any time.

## POLISH-03 confirmation dialog copy — resumed

| Option | Description | Selected |
|--------|-------------|----------|
| Short, no warning (Recommended) | Title: "Remove from wishlist". Body: "Remove {brand} {model} from your wishlist? You can add it back any time." Confirm: "Remove from wishlist" (destructive). Cancel: "Cancel". No "cannot be undone" — technically true but misleading for wishlist. | ✓ |
| Shorter, no warning | Same title/confirm/cancel; body without the re-add reassurance line. | |
| Skip dialog entirely for wishlist/grail | One-click remove; no confirmation. Cheapest UX but no misclick safety. | |

**User's choice:** Short, no warning.
**Notes:** Locked as D-09. The user's earlier clarification directly shaped the copy — "You can add it back any time" is factually accurate and reassures without the menacing "cannot be undone" warning.

---

## POLISH-03 action-button variant

| Option | Description | Selected |
|--------|-------------|----------|
| Keep destructive (red) for both wishlist and owned | Consistent visual across statuses; visual weight matches the button's role. Simplest — no code branching on status. | |
| Softer variant for wishlist, destructive for owned (Recommended) | `variant="outline"` for wishlist/grail (low-stakes), `variant="destructive"` for owned (real data loss). Visual weight matches the copy softening. | ✓ |
| You decide | Planner picks based on rest of page's visual hierarchy. | |

**User's choice:** Softer variant for wishlist, destructive for owned.
**Notes:** Locked as D-10. Same `<Button>` element with a conditional `variant` prop keyed on `isWishlistLike`.

---

## Todo match (drizzle-kit pg_net)

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore (Recommended) | Off-scope for a UI-copy polish phase. Leave the todo alone; no CONTEXT.md reference. | |
| Note as reviewed-but-not-folded | CONTEXT.md deferred section lists it as "reviewed for Phase 83; unrelated". | ✓ |
| Fold into Phase 83 | Adds tooling work to a UI polish phase; scope-mixing risk. | |

**User's choice:** Ignore.
**Notes:** User picked "Ignore" but CONTEXT.md records it under "Reviewed Todos (not folded)" for audit-trail completeness (matches the shape of what "note as reviewed" would have produced). No difference in outcome — the todo stays pending in `.planning/todos/pending/`.

---

## Claude's Discretion

Planner has flexibility on:

- **Plan decomposition** — one plan for all three POLISH items vs. three atomic plans. All three are tiny, independent, and touch disjoint files.
- **Commit shape and Vercel push cadence** — single bundled push is fine here (v8.1 polish-milestone pattern). Planner may split if UAT surfaces issues.

## Deferred Ideas

- **Owned-watch "Delete" UX redesign** — becomes odd once Phase 85 lands `previously_owned`. Belongs to Phase 85, not Phase 83.
- **Skip-dialog UX for wishlist removes** — considered and rejected in favor of confirmation-dialog misclick safety.
- **Wear-event visibility for demoted watches** — historical wears remain visible in the "All watches" Worn timeline view (D-04). Not a Phase 83 concern; data-model conversation for Phase 85 if it comes up.
- **Filter dropdown → "watches with events" data-driven scope** — considered (option 3 in the POLISH-02 question); rejected in favor of the simpler "owned only" rule.
