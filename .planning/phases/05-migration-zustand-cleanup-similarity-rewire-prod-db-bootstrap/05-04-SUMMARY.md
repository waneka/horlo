---
phase: 05
plan: 04
subsystem: watch-detail-edit-server-components
tags:
  - server-components
  - server-actions
  - refactor
requirements:
  - DATA-05
dependency-graph:
  requires:
    - "src/app/actions/watches.ts::addWatch/editWatch/removeWatch (Phase 3)"
    - "src/data/watches.ts::getWatchById/getWatchesByUser (Phase 3)"
    - "src/data/preferences.ts::getPreferencesByUser (Phase 3)"
    - "src/lib/auth.ts::getCurrentUser (Phase 4)"
    - "WatchDetail prop contract (Plan 05-01)"
  provides:
    - "Server-rendered watch/[id] and watch/[id]/edit pages"
    - "WatchForm + WatchDetail wired to Server Actions (no store CRUD)"
  affects:
    - "src/app/watch/[id]/page.tsx"
    - "src/app/watch/[id]/edit/page.tsx"
    - "src/components/watch/WatchForm.tsx"
    - "src/components/watch/WatchDetail.tsx"
tech-stack:
  added: []
  patterns:
    - "await params in async Server Component (Next.js 16 dynamic segment)"
    - "useTransition + Server Action + router.refresh() for inline mutations"
    - "useTransition + Server Action + router.push() for navigation mutations"
key-files:
  created: []
  modified:
    - "src/app/watch/[id]/page.tsx"
    - "src/app/watch/[id]/edit/page.tsx"
    - "src/components/watch/WatchForm.tsx"
    - "src/components/watch/WatchDetail.tsx"
decisions:
  - "markAsWorn via editWatch({ lastWornDate }) — no dedicated markAsWorn Server Action exists; editWatch has the same effect and already revalidates"
  - "Server Actions take unknown (validated via Zod), so the form state object is passed directly — no FormData shim needed"
  - "Inline mutations (markAsWorn, flag-as-deal) call router.refresh(); delete calls router.push('/') which re-renders the home Server Component"
metrics:
  tasks_completed: 3
  tasks_total: 3
  completed: "2026-04-14"
  duration: "~15min"
---

# Phase 05 Plan 04: Watch Detail + Edit → Server Components Summary

**One-liner:** Dynamic `/watch/[id]` and `/watch/[id]/edit` routes are now async Server Components, and WatchForm + WatchDetail call Server Actions through `useTransition` — the last non-filter Zustand CRUD calls in the app are gone.

## What Was Built

1. **`src/app/watch/[id]/page.tsx` → async Server Component.** Removed `'use client'`, `use()` params hook, `useWatchStore`, and `useIsHydrated`. Now calls `getCurrentUser()`, then fetches `watch`, `collection`, and `preferences` in parallel via the DAL, calls `notFound()` on null, and renders `<WatchDetail>` with all three props threaded through.
2. **`src/app/watch/[id]/edit/page.tsx` → async Server Component.** Same shape as the detail page but only fetches the single watch (edit form does not need collection/preferences).
3. **`src/components/watch/WatchForm.tsx` — Server Action rewire.** Removed `useWatchStore` import. Submit handler now uses `useTransition` + either `addWatch(formData)` or `editWatch(watch.id, formData)`. Handles the `ActionResult` success/error union, disables buttons while pending, shows an inline error on failure, and calls `router.push('/')` on success.
4. **`src/components/watch/WatchDetail.tsx` — Server Action rewire + required props.** Removed `useWatchStore`, `usePreferencesStore`, and the TEMP Plan 05-01 store fallback. `collection` and `preferences` are now required props. Delete calls `removeWatch` + `router.push('/')`. Mark-as-worn and flag-as-deal both call `editWatch` + `router.refresh()` so the Server Component re-fetches fresh data for the inline mutation.

## Decisions Made

- **`markAsWorn` Server Action does not exist — use `editWatch` with a `lastWornDate` patch.** The plan assumed `markAsWorn` was already exported from `src/app/actions/watches.ts`, but `grep markAsWorn src/app/actions/watches.ts` returns nothing — only the Zustand store had that method. `editWatch(watch.id, { lastWornDate: new Date().toISOString() })` produces the identical DAL effect, the action already calls `revalidatePath('/')`, and no new action surface is introduced. Logged below as a deviation (Rule 3).
- **Server Actions take `unknown`, not `FormData`.** The action signatures in `src/app/actions/watches.ts` are `addWatch(data: unknown)` and `editWatch(watchId, data: unknown)` — they validate with Zod internally. The plan text referenced `FormData`, but the actual contract is more permissive. The form already holds a typed state object that mirrors the Zod schema, so I pass it directly. No shim, no serialization. The plan's intent (submit → Server Action → revalidate → navigate) is preserved.
- **Inline mutations call `router.refresh()`; delete calls `router.push('/')`.** Pitfall 3 from 05-RESEARCH.md: `revalidatePath('/')` runs server-side during the action, but the client router does not re-fetch the current Server Component unless you explicitly refresh. `router.push('/')` works for delete because the navigation itself triggers a fresh render of the home Server Component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `markAsWorn` Server Action does not exist**
- **Found during:** Task 3 (WatchDetail rewire)
- **Issue:** Plan referenced `markAsWorn` as an exported Server Action in `src/app/actions/watches.ts`. The file contains only `addWatch`, `editWatch`, and `removeWatch` — no `markAsWorn`.
- **Fix:** Used `editWatch(watch.id, { lastWornDate: new Date().toISOString() })` in the mark-as-worn handler. Same DAL effect (update `lastWornDate`), same revalidation (`revalidatePath('/')` in `editWatch`), no new action surface added.
- **Files modified:** `src/components/watch/WatchDetail.tsx`
- **Commit:** `2fadd50`

**2. [Rule 3 — Blocking] Server Action contract is `unknown`, not `FormData`**
- **Found during:** Task 2 (WatchForm rewire)
- **Issue:** Plan showed `<form action={handleSubmit}>` with `FormData`. Actual `addWatch` / `editWatch` signatures take `data: unknown` and validate with a Zod schema that expects a typed object.
- **Fix:** Kept the existing `<form onSubmit>` + typed `formData` state, passed the object directly to the action. The Zod schema in the action validates the shape. No FormData conversion needed.
- **Files modified:** `src/components/watch/WatchForm.tsx`
- **Commit:** `0abce62`

## Verification

- `grep "'use client'" src/app/watch/[id]/page.tsx src/app/watch/[id]/edit/page.tsx` — no output PASS
- `grep "use(params)" src/app/watch/[id]/page.tsx src/app/watch/[id]/edit/page.tsx` — no output PASS
- `grep "await params"` present on both pages — PASS
- `grep "notFound" src/app/watch/[id]/page.tsx` — PASS
- `grep -rn "useIsHydrated" src/app/` — no output PASS (Plan 05-03 cleared list pages; Plan 05-04 clears the watch/[id] routes — validation grep gate #4 now fully passes)
- `grep -E "useWatchStore|\\.addWatch\\(|\\.updateWatch\\(" src/components/watch/WatchForm.tsx` — no output PASS
- `grep -q "useTransition" src/components/watch/WatchForm.tsx` — PASS (2 occurrences)
- `grep "from '@/app/actions/watches'" src/components/watch/WatchForm.tsx` — PASS
- `grep -E "useWatchStore|usePreferencesStore" src/components/watch/WatchDetail.tsx` — no output PASS
- `grep "TEMP Plan 05-01" src/components/watch/WatchDetail.tsx` — no output PASS
- `grep "router.refresh" src/components/watch/WatchDetail.tsx` — PASS (2 occurrences)
- `grep "from '@/app/actions/watches'" src/components/watch/WatchDetail.tsx` — PASS
- `npm run build` — exits 0 PASS
- `npm test -- --run` — 697 passed | 3 skipped PASS

## Known Stubs

None. All code paths wire real data through the Server Component boundary.

## Commits

| Task | Commit    | Message |
| ---- | --------- | ------- |
| 1    | `517b00c` | refactor(05-04): convert watch/[id] pages to Server Components |
| 2    | `0abce62` | refactor(05-04): rewire WatchForm to call Server Actions |
| 3    | `2fadd50` | refactor(05-04): rewire WatchDetail to Server Actions with router.refresh() |

## Self-Check: PASSED

- FOUND: src/app/watch/[id]/page.tsx (Server Component, await params, notFound)
- FOUND: src/app/watch/[id]/edit/page.tsx (Server Component, await params)
- FOUND: commit 517b00c
- FOUND: commit 0abce62
- FOUND: commit 2fadd50
- All grep acceptance criteria pass
- Build clean, full test suite (697) green
- `useIsHydrated` gone from entire `src/app/` tree
