# Phase 55: Server Actions + Notification Dedup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 55-server-actions-notification-dedup
**Areas discussed:** Dedup migration + WR-03, NOTIF-13 grouping boundary, Cache invalidation breadth, Action return contract

---

## Dedup migration + WR-03

### Dedup index shape
| Option | Description | Selected |
|--------|-------------|----------|
| Two per-type indexes | Mirror `notifications_watch_overlap_dedup`: `…watch_like_dedup` on `payload->>'watch_id'` WHERE type='watch_like' + a wear_like twin on `payload->>'wear_event_id'`. | ✓ |
| One combined index | Single index spanning both like types; needs a COALESCE since the target id key differs per type. | |

### WR-03 fold
| Option | Description | Selected |
|--------|-------------|----------|
| Fold into this phase | Phase 55 is the next migration-touching phase; change the `enum_count <> 6` assertion to verify presence of the 4 Phase 53 values. | ✓ |
| Leave deferred | Keep WR-03 as a standalone quick task; migration carries only the dedup indexes. | |

### Prod push
| Option | Description | Selected |
|--------|-------------|----------|
| Push in Phase 55 | Same blocking human-action checkpoint as Phase 53-03 (`supabase db push --linked`). | ✓ |
| Local-only, batch later | Apply locally only; defer prod push (risk: write path lands before its index exists in prod). | |

**User's choice:** Two per-type indexes; fold WR-03; push in Phase 55.
**Notes:** Operator confirmed the dedup migration is acceptable scope for this phase even though Phase 54 was pure TypeScript.

---

## NOTIF-13 grouping boundary

### Storage model
| Option | Description | Selected |
|--------|-------------|----------|
| One row per actor+target | N likers = N deduped rows, like the existing follow notifications; Phase 58 GROUP BY target at render. | ✓ |
| Rollup row per target | Single mutable row per target appending actor ids; conflicts with the per-(actor,target) dedup index. | |

### 55 vs 58 boundary
| Option | Description | Selected |
|--------|-------------|----------|
| Data in 55, render in 58 | 55 guarantees the deduped, groupable data contract; "X and N others" aggregation/render lands in Phase 58. | ✓ |
| Build grouped read in 55 | Write the GROUP BY-target aggregation now even though no UI consumes it until 58. | |

**User's choice:** One row per actor+target; data in 55, render in 58.

---

## Cache invalidation breadth

### Comment thread caching
| Option | Description | Selected |
|--------|-------------|----------|
| Uncached (Option A) | Plain uncached Server Component in Suspense; no shared cache to leak, so comment actions need no comments-tag invalidation. | ✓ |
| Viewer-scoped cache (Option B) | `comments:{id}` + `viewer:{viewerId}` tags; correct but doubles cache entries for a low-traffic list. | |

### Invalidation contract scope
| Option | Description | Selected |
|--------|-------------|----------|
| Full contract now | Like actions invalidate `reactions:{type}:{id}` (max) + `viewer:{userId}:reactions` (updateTag) + `profile:{username}` (max); comment actions invalidate `profile:{username}`. 56/57 only attach matching cacheTags. | ✓ |
| Only this phase's tags | Invalidate just the two roadmap-named tags now; let 56/57 add the rest as they build readers. | |

**User's choice:** Uncached comment threads (Option A); full invalidation contract now.

---

## Action return contract

### Action returns
| Option | Description | Selected |
|--------|-------------|----------|
| Server-confirmed rows | `toggleLikeAction`→`{liked,count}`; `addCommentAction`/`editCommentAction`→`Comment`; `deleteCommentAction`→`{id}`. Enables in-place optimistic reconcile (Phase 57 SC#4). | ✓ |
| Success only | `ActionResult<void>`; UI relies purely on cache revalidation (turns reconcile into a re-fetch). | |

### Gate error signaling
| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated error code | `{ success:false, error, code:'gate' }` so Phase 57 branches to the GATE-03 locked-state without string-matching. | ✓ |
| Message string only | `{ success:false, error:'Follow X to comment' }` matching follows.ts; 57 relies on its pre-submit gate check. | |

**User's choice:** Server-confirmed rows; discriminated error code.

---

## Claude's Discretion

- `toggleLikeAction` internal toggle mechanism (read `viewerHasLiked` then create/delete vs a `toggleLike` DAL helper).
- Exact `ActionResult` extension shape for the `code:'gate'` discriminant.
- WR-03 fix mechanism (in-place edit of the Phase 53 migration vs a corrective migration) — intent is locked.
- Zod schema phrasing per action; `CREATE INDEX` vs `CONCURRENTLY`; migration filename/sequencing.

## Deferred Ideas

- "X and N others liked…" render + grouping → Phase 58 (D-05).
- Settings opt-out toggles UI (`notifyOnLike`/`notifyOnComment`) → Phase 58 (NOTIF-16).
- Comment-thread caching Option B (viewer-scoped) → not built; revisit only at scale (D-06).
- Future social work (liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies) → SOC-F1…F5, future milestone.
