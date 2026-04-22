---
phase: 260421-rdb
plan: 01
subsystem: dal/privacy
tags: [privacy, dal, bugfix, network-home]
type: summary

dependency_graph:
  requires:
    - "watches table (src/db/schema.ts)"
    - "profile_settings table (src/db/schema.ts)"
    - "mapRowToWatch helper (src/data/watches.ts)"
    - "getWearRailForViewer privacy pattern (src/data/wearEvents.ts)"
  provides:
    - "getWatchByIdForViewer(viewerId, watchId) — privacy-aware DAL returning { watch, isOwner } | null"
    - "viewerCanEdit prop on WatchDetail gating owner-only UI"
  affects:
    - "src/app/watch/[id]/page.tsx — now serves cross-user public watches"
    - "src/components/watch/WatchDetail.tsx — owner-only actions conditional"

tech_stack:
  added: []
  patterns:
    - "Two-layer privacy enforcement (RLS at DB + DAL WHERE) — extended to watch detail route"
    - "OR-branch owner short-circuit inside single JOIN query (mirrors getWearRailForViewer)"
    - "Per-status visibility gate via inline SQL (collection_public vs wishlist_public)"
    - "Uniform null on missing-or-private (identical notFound() path avoids existence leak)"

key_files:
  created:
    - "tests/data/getWatchByIdForViewer.test.ts"
  modified:
    - "src/data/watches.ts"
    - "src/app/watch/[id]/page.tsx"
    - "src/components/watch/WatchDetail.tsx"

decisions:
  - "Single JOIN over two-step lookup — one round trip, owner branch short-circuits inside OR"
  - "viewerCanEdit defaults to true — preserves backward compat for any existing WatchDetail consumer"
  - "lastWornDate = null for non-owners — conservative worn_public default without adding a flag lookup"
  - "Retain getWatchById unchanged — edit page + markAsWorn action still need owner-only fetch"

metrics:
  duration: "~12 min"
  completed: "2026-04-21T19:52Z"
  tasks: 2
  files: 4
  commits: 2
  new_tests: 17
---

# 260421-rdb Fix 404 on watch detail pages Summary

**One-liner:** Added a privacy-aware `getWatchByIdForViewer` DAL with owner short-circuit + per-tab visibility gate, wired the `/watch/[id]` route to it, and gated owner-only actions behind a `viewerCanEdit` prop — restoring Network Home deep links to shared watches without leaking private ones.

## What was built

### `getWatchByIdForViewer` DAL (src/data/watches.ts)

Single JOIN query against `watches` + `profile_settings`. The WHERE clause enforces the complete privacy matrix:

| Relationship | profile_public | status flag | Result |
| ------------ | -------------- | ----------- | ------ |
| viewer == owner | any | any | `{ watch, isOwner: true }` |
| viewer != owner, owned/sold/grail | true | `collection_public=true` | `{ watch, isOwner: false }` |
| viewer != owner, wishlist | true | `wishlist_public=true` | `{ watch, isOwner: false }` |
| viewer != owner | false | any | `null` |
| viewer != owner, owned/sold/grail | true | `collection_public=false` | `null` |
| viewer != owner, wishlist | true | `wishlist_public=false` | `null` |
| anyone | — | — (missing) | `null` |

The SQL shape mirrors `getWearRailForViewer` — owner branch short-circuits via `OR (watches.userId = viewerId)`, so owners bypass the flag gate entirely, and the JOIN + WHERE is a single round trip. Inline `sql\`...\`` discriminates owned/sold/grail (→ `collection_public`) from wishlist (→ `wishlist_public`).

### Route wiring (src/app/watch/[id]/page.tsx)

- Swapped `getWatchById(user.id, id)` → `getWatchByIdForViewer(user.id, id)`.
- Destructured `{ watch, isOwner }` from the result.
- Non-owner receives `lastWornDate = null` (skipping the wear-events lookup entirely).
- Passes `viewerCanEdit={isOwner}` to `WatchDetail`.

### UI gating (src/components/watch/WatchDetail.tsx)

- New `viewerCanEdit?: boolean` prop (defaults to `true` for backward compat).
- Owner-only UI hidden when `viewerCanEdit === false`:
  - Last worn line (status owned/grail)
  - Flag as a good deal (wishlist/grail)
  - Actions cluster: Mark as Worn, Edit, Delete (+ delete confirm dialog)
- Server Actions (`editWatch`, `removeWatch`, `markAsWorn`) already double-verify ownership at the DAL layer — the UI gate is a UX fix, not the authoritative security boundary.

## Privacy matrix implemented

Owner short-circuit + `profile_public` outer gate + per-tab flag:

```
(watches.userId = viewerId)                                  -- owner branch
OR (
    profile_settings.profilePublic = true                    -- outer gate
  AND (
        (watches.status = 'wishlist' AND wishlistPublic)    -- wishlist tab
     OR (watches.status IN ('owned','sold','grail') AND collectionPublic)
  )
)
```

Mirrors the Phase 10 WYWT DAL pattern exactly (two-layer per CLAUDE.md: RLS at DB + DAL WHERE at the postgres-role server-rendered pages).

## Testing

17 total test cases added in `tests/data/getWatchByIdForViewer.test.ts`:

**Unit (11, always run):**
1. Null on empty result
2. Owner returns `isOwner=true` even if all flags are false (short-circuit)
3. Non-owner + `profile_public=false` → null
4. Non-owner + owned + `collection_public=true` → non-owner result
5. Non-owner + owned + `collection_public=false` → null
6. Non-owner + wishlist + `wishlist_public=true` → non-owner result
7. Non-owner + wishlist + `wishlist_public=false` → null
8. Non-owner + sold uses `collection_public`
9. Non-owner + grail uses `collection_public`
10. `mapRowToWatch` round-trip (domain shape correct, `userId` stripped)
11. Single JOIN shape (1 select, 1 innerJoin, 1 where, 1 limit)

**Integration (6, gated on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):**
1. A views B's owned watch (all public) → non-owner
2. B views own watch → isOwner
3. `collection_public=false` → A null, B still sees own
4. `wishlist_public=false` → A null for wishlist but sees owned
5. `profile_public=false` → A null for both, B still sees own
6. Non-existent watchId → null regardless of viewer

Integration uses the trigger-aware seeding pattern from STATE.md (profile_settings auto-created by `on_public_user_created` — UPDATE, don't INSERT).

## Key decisions

- **lastWornDate = null for non-owners** (T-RDB-03). The `worn_public` flag is not consulted on the detail page; setting the prop to null for non-owners hides both the "Last worn" line and the Tracking-card cell's populated day count. This is the conservative default — if a later UX decision wants to honor `worn_public` for non-owners, it's a one-line lookup add.
- **getWatchById retained, not renamed** — the edit page (`src/app/watch/[id]/edit/page.tsx`) and `markAsWorn` server action still need the owner-scoped fetch. Renaming would have required touching multiple call sites with no privacy benefit.
- **viewerCanEdit defaults to true** — any future consumer that hasn't been updated yet still works (stays in owner mode). The route-level call passes the explicit `isOwner` value, so the default never fires on the actual `/watch/[id]` page.
- **Single JOIN over two-step** — mirrors the canonical `getWearRailForViewer` shape; one round trip, owner branch short-circuits inside the OR.

## Deviations from plan

None — the plan executed exactly as written. Both the failing-test (RED) and implementation (GREEN) steps produced the expected outcomes on the first run.

## Commits

- `f34b50d` test(260421-rdb): add failing test for getWatchByIdForViewer privacy matrix
- `0604e09` fix(260421-rdb): make watch detail page privacy-aware for non-owners

## Verification

- `npx vitest run tests/data/getWatchByIdForViewer.test.ts` → 11 passed / 6 skipped
- `npx vitest run tests/data/getWatchByIdForViewer.test.ts tests/data/getWearRailForViewer.test.ts tests/data/isolation.test.ts` → 19 passed / 18 skipped, no regressions
- `npx vitest run` (full suite) → 2070 passed / 50 skipped / 0 failed
- `npm run lint` → 104 problems total, unchanged from baseline (all pre-existing in unrelated files; my changes add 0 new errors/warnings)
- `npm run build` → successful Next.js 16 build with `cacheComponents`; `/watch/[id]` renders correctly

## Threat surface

All new surface is accounted for in the plan's threat_model. No new endpoints, no new trust boundaries. `getWatchByIdForViewer` is server-only (`import 'server-only'` already in place at top of `src/data/watches.ts`).

## Self-Check: PASSED

- `src/data/watches.ts` — FOUND, contains `getWatchByIdForViewer`
- `src/app/watch/[id]/page.tsx` — FOUND, now calls `getWatchByIdForViewer`
- `src/components/watch/WatchDetail.tsx` — FOUND, has `viewerCanEdit` prop + gates
- `tests/data/getWatchByIdForViewer.test.ts` — FOUND, 17 test cases
- Commit `f34b50d` — FOUND
- Commit `0604e09` — FOUND
