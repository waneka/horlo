# Phase 54: DAL — Reactions, Comments + Gate Logic - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 54-dal-reactions-comments-gate-logic
**Areas discussed:** RLS-layer resolution, Gate signaling contract, Likes read shape, Module layout

---

## RLS-layer resolution (CR-01)

**Q1 — How should the gate satisfy SEC-02's "both layers", given the DAL is the only live path?**

| Option | Description | Selected |
|--------|-------------|----------|
| (a) DAL-only + minimal RLS | DAL is the single source of truth for the wishlist gate; SEC-02 "both layers" = RLS anon-block (L1) + DAL gate (L2). Cleanest, matches the project invariant, no new migration. | ✓ |
| (b) Shared SECDEF helper | `SECURITY DEFINER` `can_comment_on_watch` fn called by BOTH the RLS policy and the DAL; RLS literally enforces GATE-01. True defense-in-depth but reverses Phase 53 D-07, adds migration + REVOKE discipline. | |

**User's choice:** (a) DAL-only + minimal RLS

**Q2 — Under Option (a), do we touch the shipped Phase 53 comments RLS, or leave it?**

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it fail-closed | Don't migrate prod RLS; Phase 53 policies stay fail-closed (never the live path), matching the `watches` precedent. Phase 54 stays pure TypeScript; document the DAL-is-the-gate invariant. | ✓ |
| Simplify the RLS now | Migration: INSERT → author IDOR guard, SELECT → `USING (true)`. Removes the dead gate per CR-01's literal rec but `USING (true)` reintroduces a latent leak and touches prod RLS in a TS-only phase. | |

**User's choice:** Leave it fail-closed
**Notes:** Decided on the basis of the existing `watches_select_own` precedent (owner-only RLS, fail-closed cross-user, DAL is the gate). Leaving the policy never leaks; the trade-off (a future supabase-js comment-write path would fail closed for all non-owners) is documented as a known landmine in `comments.ts`.

---

## Gate signaling contract

**Q1 — When createComment's gate rejects a non-mutual-follower at the DAL, how should it signal it?**

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct typed error | New `CommentGateError extends Error` (sibling to `UnauthorizedError`); Phase 55 maps it to the GATE-03 message. Matches the `assertOwner → throw` precedent. | ✓ |
| Reuse UnauthorizedError | Throw existing error with a gate message; action must string-match to distinguish auth-fail from gate-fail. | |
| Return result object | `createComment` returns `{ ok: false, reason: 'gate' }`; breaks the house DAL-throws convention. | |

**User's choice:** Distinct typed error (`CommentGateError`)

**Q2 — What does getCommentsForTarget return to a gated (non-mutual) viewer on a wishlist watch?**

| Option | Description | Selected |
|--------|-------------|----------|
| Empty array + shared predicate | One shared `canViewerCommentOnTarget(viewerId, target)` boolean drives create/read/UI; read stays a plain `Comment[]`, returns `[]` when gated (no content/count leak). | ✓ |
| Result object `{ comments, gated }` | Single call returns thread + gate state; still backed by the shared predicate but couples the read API to gate state. | |

**User's choice:** Empty array + shared predicate

---

## Likes read shape

**Q1 — What shape should getLikesForTarget return?**

| Option | Description | Selected |
|--------|-------------|----------|
| Combined `{ count, viewerHasLiked }` | One query (`count(*)` + `bool_or(user_id = viewer)`); simplest for Phase 56; SEC-05 handled by per-viewer cache scoping in Phase 55. | ✓ |
| Split: count + viewer-state | `getLikeCount(target)` + `hasViewerLiked(viewerId, target)`; maps to the two-tag cache taxonomy but doubles surface for marginal efficiency. | |

**User's choice:** Combined `{ count, viewerHasLiked }`

---

## Module layout

**Q1 — How should the reactions/comments DAL be organized across files and target types?**

| Option | Description | Selected |
|--------|-------------|----------|
| Target-discriminated API, new files | New `reactions.ts` + `comments.ts`; `{ type: 'watch'\|'wear', id }` discriminator; `isMutualFollow` in `follows.ts`. Matches roadmap naming + cache taxonomy. | ✓ |
| Per-target functions | `getWatchLikes`/`getWearLikes`, etc.; ~2x surface, diverges from roadmap naming. | |

**User's choice:** Target-discriminated API, new files

---

## Claude's Discretion

- Comment edit/delete DAL placement (Phase 54 vs Phase 55) — lean toward co-locating in `comments.ts` if built here.
- `deleteLike` / `toggleLike` helper granularity for the Phase 56 toggle.
- `CommentGateError` location (co-locate in `comments.ts` recommended).
- Exact Drizzle query phrasing for `isMutualFollow`, the count/`bool_or` aggregate, and index usage.

## Deferred Ideas

- **WR-03** — change the `enum_count <> 6` hard-coded assertion in `20260522000001_phase53_notification_enum.sql` to assert presence of the 4 Phase 53 values. Deferred (Phase 54 ships no migration; operator flagged non-urgent). Fold into the next migration-touching phase or a standalone quick task.
- Future social work (SOC-F1…F5: liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies) — tracked in REQUIREMENTS.md §"Future Requirements".
