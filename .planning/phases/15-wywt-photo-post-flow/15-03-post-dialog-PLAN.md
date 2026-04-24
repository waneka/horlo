---
phase: 15
plan: 03
type: execute
wave: 2
depends_on: ["15-01", "15-02"]
files_modified:
  - src/components/home/WatchPickerDialog.tsx
  - src/components/wywt/WywtPostDialog.tsx
  - src/components/wywt/ComposeStep.tsx
  - src/components/wywt/VisibilitySegmentedControl.tsx
  - src/components/layout/NavWearButton.tsx
  - src/components/home/WywtRail.tsx
  - src/app/actions/wearEvents.ts
  - src/data/wearEvents.ts
  - tests/integration/phase15-wywt-photo-flow.test.ts
  - tests/components/WywtPostDialog.test.tsx
autonomous: true
requirements_addressed:
  - WYWT-01
  - WYWT-02
  - WYWT-03
  - WYWT-04
  - WYWT-07
  - WYWT-08
  - WYWT-12
  - WYWT-15
  - WYWT-16
nyquist_compliant: true
tags: [wywt, dialog, server-action, storage, duplicate-day, toast, visibility, camera]

must_haves:
  truths:
    - "Tapping the Wear CTA opens a two-step modal: Step 1 (picker) → Step 2 (compose); selecting a watch advances; 'Change' link returns to Step 1 preserving note+visibility+photo"
    - "Step 1 disables watches that appear in `wornTodayIds` (fetched when dialog opens) — disabled rows cannot be selected"
    - "Step 2 allows submit with NO photo (photo is optional) — `hasPhoto: false` path inserts row with photo_url=NULL"
    - "Step 2 character counter reads `N/200`; destructive red at 200; maxLength enforced"
    - "Step 2 visibility selector defaults to 'public'; three options with sub-label copy per UI-SPEC"
    - "On submit with photo: client processes via stripAndResize → uploads to Storage → calls logWearWithPhoto with hasPhoto=true → Server Action validates object exists → inserts row"
    - "On submit duplicate-day: Server Action catches 23505, issues best-effort Storage delete (if hasPhoto), returns 'Already logged this watch today' error"
    - "On successful submit: dialog closes, revalidatePath('/') fires, Sonner toast 'Wear logged' appears"
    - "NavWearButton (header + bottom-nav) and WywtRail self-placeholder tile both open WywtPostDialog; LogTodaysWearButton and WywtRail non-self tiles remain unchanged"
  artifacts:
    - path: "src/components/home/WatchPickerDialog.tsx"
      provides: "Extended with optional `onWatchSelected?: (watchId: string) => void` and `wornTodayIds?: ReadonlySet<string>` props; existing markAsWorn path preserved byte-for-byte when onWatchSelected is absent"
      contains: "onWatchSelected"
    - path: "src/components/wywt/WywtPostDialog.tsx"
      provides: "Orchestrator Client Component owning step state, watch selection, wearEventId, photo, note, visibility; Step 1 renders WatchPickerDialog with onWatchSelected; Step 2 renders ComposeStep"
      exports: ["WywtPostDialog"]
    - path: "src/components/wywt/ComposeStep.tsx"
      provides: "Step 2 form: compact watch card header + Change link + PhotoUploader/CameraCaptureView zone + note textarea with 0/200 counter + VisibilitySegmentedControl + submit button"
      exports: ["ComposeStep"]
    - path: "src/components/wywt/VisibilitySegmentedControl.tsx"
      provides: "Three-button segmented control: Private / Followers / Public (default Public); active=bg-accent; sub-label row per D-12 copy"
      exports: ["VisibilitySegmentedControl"]
    - path: "src/app/actions/wearEvents.ts"
      provides: "New `logWearWithPhoto` Server Action alongside existing `markAsWorn` (unchanged); returns ActionResult<{wearEventId}>"
      exports: ["markAsWorn", "logWearWithPhoto"]
    - path: "src/data/wearEvents.ts"
      provides: "New `getWornTodayIdsForUser(userId, today): Promise<ReadonlySet<string>>` + `logWearEventWithPhoto` insert helper; existing `getWearEventsForViewer` and `getWearRailForViewer` unchanged"
      exports: ["getWornTodayIdsForUser", "logWearEventWithPhoto"]
    - path: "src/components/layout/NavWearButton.tsx"
      provides: "Swap lazy import target from WatchPickerDialog to WywtPostDialog; preserve appearance prop"
      contains: "WywtPostDialog"
    - path: "src/components/home/WywtRail.tsx"
      provides: "Self-placeholder tile tap opens WywtPostDialog (was WatchPickerDialog); non-self tile tap unchanged"
      contains: "WywtPostDialog"
    - path: "tests/components/WywtPostDialog.test.tsx"
      provides: "Wave 0 RTL tests for WYWT-01, WYWT-02, WYWT-03, WYWT-07, WYWT-08, WYWT-16"
      exports: []
    - path: "tests/integration/phase15-wywt-photo-flow.test.ts"
      provides: "Wave 0 integration — duplicate-day (WYWT-12), client-direct upload + server validation (WYWT-15), orphan-cleanup-on-23505"
      exports: []
  key_links:
    - from: "src/components/wywt/WywtPostDialog.tsx"
      to: "src/components/home/WatchPickerDialog.tsx"
      via: "Step 1 renders <WatchPickerDialog onWatchSelected={...} wornTodayIds={...} />"
      pattern: "onWatchSelected"
    - from: "src/components/wywt/ComposeStep.tsx"
      to: "src/lib/exif/strip.ts"
      via: "await stripAndResize(photoBlob) in submit handler"
      pattern: "stripAndResize"
    - from: "src/components/wywt/ComposeStep.tsx"
      to: "src/lib/storage/wearPhotos.ts"
      via: "await uploadWearPhoto(userId, wearEventId, blob) in submit handler"
      pattern: "uploadWearPhoto"
    - from: "src/components/wywt/ComposeStep.tsx"
      to: "src/app/actions/wearEvents.ts"
      via: "await logWearWithPhoto({...})"
      pattern: "logWearWithPhoto"
    - from: "src/components/wywt/ComposeStep.tsx"
      to: "sonner"
      via: "import { toast } from 'sonner'; toast.success('Wear logged')"
      pattern: "toast.success\\('Wear logged'\\)"
    - from: "src/app/actions/wearEvents.ts"
      to: "src/data/wearEvents.ts"
      via: "await logWearEventWithPhoto({id, userId, watchId, wornDate, note, photoUrl, visibility})"
      pattern: "logWearEventWithPhoto"
    - from: "src/components/layout/NavWearButton.tsx"
      to: "src/components/wywt/WywtPostDialog.tsx"
      via: "const WywtPostDialog = lazy(() => import('@/components/wywt/WywtPostDialog'))"
      pattern: "wywt/WywtPostDialog"
---

<objective>
Ship the two-step WYWT photo post flow: Server Action `logWearWithPhoto`, DAL helpers `getWornTodayIdsForUser` + `logWearEventWithPhoto`, `WywtPostDialog` orchestrator, `ComposeStep` form (photo section + note + visibility + submit), `VisibilitySegmentedControl`, backwards-compatible extension of `WatchPickerDialog` with `onWatchSelected` + `wornTodayIds` props, and call-site routing updates in `NavWearButton` + `WywtRail`.

Purpose: This plan is the composition layer. It wires together Plan 01 (photo pipeline primitives) and Plan 02 (Sonner toast infrastructure) into the user-facing two-step post flow. Duplicate-day handling is two-layer (preflight disable + server 23505); client-direct upload discipline enforced by the existence-check in the Server Action; post-submit UX runs through Sonner.

Output: Nine source files + two Wave 0 test files. Full WYWT-01/02/03/07/08/12/15/16 acceptance. After this plan ships, users can post a wear event with a photo from NavWearButton or WywtRail.

## Decision coverage (for this plan)
- D-01 (step state machine) → Task 2 WywtPostDialog
- D-02 (WatchPickerDialog onWatchSelected) → Task 1
- D-03 (wornTodayIds preflight) → Task 1 + Task 2
- D-04 (call-site routing) → Task 4 NavWearButton + WywtRail
- D-05 (Change link preserves state) → Task 2
- D-06 / D-07 (photo section states) → Task 3 ComposeStep
- D-11 (note 200-char) → Task 3 ComposeStep
- D-12 (visibility selector + sub-label) → Task 3 VisibilitySegmentedControl
- D-13 (preflight DAL) → Task 1 getWornTodayIdsForUser
- D-14 (server 23505) → Task 5 logWearWithPhoto
- D-15 / D-16 / D-17 (upload + orphan + no-photo path) → Task 5
- D-18 (Logging… UX) → Task 3
- D-19 (toast + revalidate) → Task 3 + Task 5
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-wywt-photo-post-flow/15-CONTEXT.md
@.planning/phases/15-wywt-photo-post-flow/15-RESEARCH.md
@.planning/phases/15-wywt-photo-post-flow/15-UI-SPEC.md
@.planning/phases/15-wywt-photo-post-flow/15-VALIDATION.md
@.planning/phases/15-wywt-photo-post-flow/15-01-SUMMARY.md
@.planning/phases/15-wywt-photo-post-flow/15-02-SUMMARY.md
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files the executor will read/modify:
@src/app/actions/wearEvents.ts
@src/data/wearEvents.ts
@src/data/activities.ts
@src/data/watches.ts
@src/components/home/WatchPickerDialog.tsx
@src/components/home/WywtRail.tsx
@src/components/layout/NavWearButton.tsx
@src/lib/auth.ts
@src/lib/actionTypes.ts
@src/lib/wearVisibility.ts
@src/lib/supabase/server.ts
@src/db/schema.ts

<interfaces>
<!-- Key types and contracts the executor needs. -->

From Plan 01 (already built, consume directly):
```typescript
// src/lib/exif/strip.ts
export async function stripAndResize(input: Blob, maxDim?: number, quality?: number): Promise<{blob: Blob, width: number, height: number}>

// src/lib/storage/wearPhotos.ts
export function buildWearPhotoPath(userId: string, wearEventId: string): string
export async function uploadWearPhoto(userId: string, wearEventId: string, jpeg: Blob): Promise<{path: string} | {error: string}>

// src/components/wywt/PhotoUploader.tsx
export function PhotoUploader(props: {onPhotoReady: (jpeg: Blob) => void, onError: (msg: string) => void, disabled?: boolean}): JSX.Element
export function isHeicFile(file: File): boolean

// src/components/wywt/CameraCaptureView.tsx
// CRITICAL: takes a pre-acquired MediaStream prop (iOS gesture rule)
export function CameraCaptureView(props: {stream: MediaStream, onPhotoReady: (jpeg: Blob) => void, onError: (msg: string) => void, onCancel: () => void, disabled?: boolean}): JSX.Element
```

From Plan 02 (already built, consume directly):
```typescript
// src/components/ui/ThemedToaster.tsx mounted in layout
// Client Components call: import { toast } from 'sonner'; toast.success('Wear logged')
```

From existing codebase (verified):
```typescript
// src/lib/actionTypes.ts
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// src/lib/wearVisibility.ts
export type WearVisibility = 'public' | 'followers' | 'private'

// src/lib/auth.ts
export async function getCurrentUser(): Promise<{id: string, email: string, ...}>  // throws UnauthorizedError

// src/data/activities.ts — signature after Phase 12
type WatchWornMetadata = { brand: string; model: string; imageUrl: string | null; visibility: WearVisibility }
export async function logActivity(userId: string, type: 'watch_worn', targetId: string, metadata: WatchWornMetadata): Promise<void>

// src/data/watches.ts
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null>

// src/db/schema.ts wear_events
// id (uuid, defaultRandom, primaryKey) · userId · watchId · wornDate (text ISO) · note · photoUrl · visibility · createdAt
// UNIQUE constraint `wear_events_unique_day` on (userId, watchId, wornDate)
```

NEW contracts this plan creates:

```typescript
// src/data/wearEvents.ts — add alongside existing
export async function getWornTodayIdsForUser(
  userId: string,
  today: string,  // ISO date '2026-04-24'
): Promise<ReadonlySet<string>>  // returns set of watch IDs worn today

export async function logWearEventWithPhoto(input: {
  id: string           // client-generated wearEventId; becomes wear_events.id
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
}): Promise<void>  // throws on 23505 unique violation (caller catches)

// src/app/actions/wearEvents.ts — add alongside existing markAsWorn
export async function logWearWithPhoto(input: {
  wearEventId: string  // client UUID
  watchId: string
  note: string | null
  visibility: WearVisibility
  hasPhoto: boolean
}): Promise<ActionResult<{ wearEventId: string }>>

// src/components/home/WatchPickerDialog.tsx — extended Props
interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  watches: Watch[]
  /** NEW: when provided, selection is emitted upward and markAsWorn is skipped. */
  onWatchSelected?: (watchId: string) => void
  /** NEW: watches already worn today render disabled + "Worn today" label. */
  wornTodayIds?: ReadonlySet<string>
}

// src/components/wywt/WywtPostDialog.tsx
export function WywtPostDialog(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ownedWatches: Watch[]
  viewerId: string  // required — passed in from server-rendered parents
}): JSX.Element

// src/components/wywt/ComposeStep.tsx
export function ComposeStep(props: {
  watch: Watch
  viewerId: string
  wearEventId: string
  photoBlob: Blob | null
  setPhotoBlob: (b: Blob | null) => void
  note: string
  setNote: (s: string) => void
  visibility: WearVisibility
  setVisibility: (v: WearVisibility) => void
  onChange: () => void     // return to picker, preserve photo/note/visibility
  onSubmitted: () => void  // close dialog + toast fired externally (or here)
}): JSX.Element

// src/components/wywt/VisibilitySegmentedControl.tsx
export function VisibilitySegmentedControl(props: {
  value: WearVisibility
  onChange: (v: WearVisibility) => void
  disabled?: boolean
}): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend WatchPickerDialog with onWatchSelected + wornTodayIds props; add getWornTodayIdsForUser + logWearEventWithPhoto DAL helpers</name>
  <files>src/components/home/WatchPickerDialog.tsx, src/data/wearEvents.ts</files>
  <read_first>
    - src/components/home/WatchPickerDialog.tsx (current 189-line file — understand list render at lines 141-160 and handleSubmit at 70-84)
    - src/data/wearEvents.ts (lines 9-19 existing logWearEvent — mirror its shape for logWearEventWithPhoto)
    - src/db/schema.ts lines 216-233 wearEvents table + unique constraint
    - RESEARCH.md §Pattern 3 — WatchPickerDialog prop extension (backwards-compatible patch)
    - RESEARCH.md §Pattern 6 — Duplicate-day handling (preflight DAL shape)
    - RESEARCH.md §specifics — "Preflight DAL query shape" paragraph
    - RESEARCH.md §Assumption A9 — narrow DAL feasibility
    - CONTEXT.md D-02, D-03, D-13, D-14
    - UI-SPEC.md §Interaction Contracts → "Step 1: PICKER" section
    - UI-SPEC.md §Copywriting Contract "Worn today" micro-label
    - UI-SPEC.md §Accessibility Contract — aria-disabled on worn-today rows
    - tests/components/home/ (look for existing WatchPickerDialog test if any — search with Grep first)
  </read_first>
  <behavior>
    For WatchPickerDialog extension:
    - Test 1 (backwards-compat): Without `onWatchSelected` + `wornTodayIds` props, existing behavior byte-identical: selecting + clicking "Log wear" calls markAsWorn and closes. (Snapshot/spy test via mocked markAsWorn.)
    - Test 2: With `onWatchSelected` provided: clicking "Log wear" calls `onWatchSelected(watchId)` and does NOT call `markAsWorn`.
    - Test 3: With `wornTodayIds = new Set(['watch-a'])`, the watch-a row renders with `aria-disabled="true"` and `opacity-50` class and contains "Worn today" text; clicking it does not set selection (selectedId remains null).

    For DAL helpers:
    - Test 4 (integration, gated on Supabase env vars): Insert 2 wear events for userA today with watchA and watchB; `getWornTodayIdsForUser(userA, today)` returns `Set(['watchA', 'watchB'])`; for yesterday returns empty set.
    - Test 5: `logWearEventWithPhoto({id, userId, watchId, wornDate: today, note: null, photoUrl: 'u/e.jpg', visibility: 'public'})` inserts a row with exactly those fields.
    - Test 6: Duplicate-day attempt throws; error has `code === '23505'`.
  </behavior>
  <action>
    Step 1 — Extend `src/components/home/WatchPickerDialog.tsx` per RESEARCH §Pattern 3:
    - Add to Props interface (preserve order of existing fields):
      ```typescript
      interface Props {
        open: boolean
        onOpenChange: (v: boolean) => void
        watches: Watch[]
        /** NEW: When provided, selection is emitted upward and markAsWorn is skipped. */
        onWatchSelected?: (watchId: string) => void
        /** NEW: Watches already logged for today — render disabled + "Worn today" label. */
        wornTodayIds?: ReadonlySet<string>
      }
      ```
    - Destructure the new props in the component signature.
    - In `handleSubmit` (lines 70-84), insert the emit-upward branch at the top BEFORE `setError(null)` and the transition:
      ```typescript
      const handleSubmit = () => {
        if (!selectedId) return
        if (onWatchSelected) {
          onWatchSelected(selectedId)
          // Do not reset internal state here — parent owns step transition.
          // markAsWorn is skipped entirely per D-02.
          return
        }
        setError(null)
        startTransition(async () => {
          const result = await markAsWorn(selectedId)
          // ... existing body unchanged
        })
      }
      ```
    - In the list render (lines 141-160), compute `isWornToday` per row and apply disabled classes + aria-disabled + "Worn today" label per UI-SPEC:
      ```tsx
      {filtered.map((w) => {
        const isWornToday = wornTodayIds?.has(w.id) ?? false
        return (
          <li key={w.id}>
            <button
              type="button"
              role="option"
              aria-selected={selectedId === w.id}
              aria-disabled={isWornToday}
              disabled={isWornToday}
              onClick={() => !isWornToday && setSelectedId(w.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                isWornToday
                  ? 'opacity-50 cursor-not-allowed'
                  : selectedId === w.id
                  ? 'bg-muted'
                  : 'hover:bg-muted/40'
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
    - Do NOT change the empty-state variant (no owned watches).
    - Do NOT change the Dismiss button copy or existing markAsWorn path.

    Step 2 — Add DAL helpers to `src/data/wearEvents.ts`:
    ```typescript
    /**
     * Preflight duplicate-day helper (WYWT-12, CONTEXT.md D-13).
     * Returns set of watch IDs the user has wear events for on `today`.
     * Passed to WatchPickerDialog via `wornTodayIds` prop.
     *
     * Owner-only query (no viewer gating) — only the actor's own picker
     * uses this DAL call; nothing cross-user. PROJECT.md caps watches at
     * <500/user so full scan per user+date is acceptable.
     */
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

    /**
     * Photo-bearing wear event insert (WYWT-15, CONTEXT.md D-15).
     * Mirrors logWearEvent but accepts the full payload including a client-
     * generated id, the photo path (or null), and the three-tier visibility.
     * Throws on 23505 unique-violation; caller (logWearWithPhoto Server
     * Action) catches and maps to ActionResult error.
     */
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
      // NOTE: no onConflictDoNothing — caller catches 23505 explicitly so the
      // orphan-delete branch fires. If we silently swallowed, the client
      // would think the insert succeeded and the user wouldn't see the error.
    }
    ```
    Imports already include `db`, `wearEvents`, `eq`, `and` at the top of the file; no new imports needed EXCEPT `import type { WearVisibility } from '@/lib/wearVisibility'` is already present (verify).

    Step 3 — Create tests:
    - `tests/components/WywtPostDialog.test.tsx` stub with the 3 WatchPickerDialog extension tests (we reuse the WywtPostDialog test file since these tests are adjacent to WywtPostDialog's pathway — OR create a separate `tests/components/WatchPickerDialog.test.tsx` if none exists; Executor's call but must cover all 3 behaviors).
    - Add integration tests 4/5/6 to `tests/integration/phase15-wywt-photo-flow.test.ts` (file to be extended in Task 5, so the skeleton for this file is created in this task). Gate on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` per `tests/integration/home-privacy.test.ts` pattern.

    Step 4 — Verify no regression in existing callers:
    ```bash
    grep -rn "WatchPickerDialog" src/ --include='*.tsx' --include='*.ts'
    ```
    Confirm each existing caller (NavWearButton, WywtRail) still compiles without passing the new optional props (backwards compatibility).
  </action>
  <verify>
    <automated>npm run test -- tests/components/WywtPostDialog.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - `WatchPickerDialog` Props interface has `onWatchSelected?: (watchId: string) => void` and `wornTodayIds?: ReadonlySet<string>` (optional, with JSDoc)
    - `handleSubmit` calls `onWatchSelected(selectedId)` and returns BEFORE `startTransition` when prop is present
    - Worn-today rows render with `aria-disabled="true"`, `disabled` attribute, opacity-50, and "Worn today" text
    - `getWornTodayIdsForUser` and `logWearEventWithPhoto` exported from `src/data/wearEvents.ts`
    - Existing `getWearEventsForViewer`, `getWearRailForViewer`, `logWearEvent`, `markAsWorn` DAL/action still byte-unchanged
    - `npx tsc --noEmit` exits 0
    - `npm run test -- tests/components/WywtPostDialog.test.tsx` exits 0 for the 3 WatchPickerDialog-extension tests
    - Existing `tests/integration/home-privacy.test.ts` still passes (no regression to the picker contract)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build WywtPostDialog orchestrator (two-step state machine, preflight fetch, preserved form state on Change)</name>
  <files>src/components/wywt/WywtPostDialog.tsx, tests/components/WywtPostDialog.test.tsx</files>
  <read_first>
    - src/components/home/WatchPickerDialog.tsx (just extended in Task 1; understand the Props shape)
    - src/components/wywt/ComposeStep.tsx (does NOT exist yet — Task 3 builds it; THIS task scaffolds a placeholder import so the tests can run RED first)
    - RESEARCH.md §Pattern 1 — Lazy-loaded dialog wrapper
    - RESEARCH.md §Pattern 2 — Two-step state machine with preserved form state (full code example)
    - CONTEXT.md D-01 (step state), D-03 (wornTodayIds prop), D-05 (Change link preserves state)
    - UI-SPEC.md §Interaction Contracts → "Step 1: PICKER" + "Step 2: COMPOSE"
    - VALIDATION.md rows WYWT-01, WYWT-02 (covered by tests/components/WywtPostDialog.test.tsx)
  </read_first>
  <behavior>
    - Test 1 (WYWT-01): Rendering `<WywtPostDialog open={true} ownedWatches={[mockWatchA, mockWatchB]} viewerId="u1" />` shows the picker (Step 1) first; selecting watchA advances to Step 2 (ComposeStep renders with watchA).
    - Test 2 (WYWT-02): From Step 2, clicking "Change" returns to Step 1; `selectedWatchId` is cleared; `note`, `visibility`, `photoBlob` state is preserved (assert via ComposeStep mock receiving the same prop values on re-render after watch re-selection).
    - Test 3 (preflight): On open, WywtPostDialog calls `getWornTodayIdsForUser(viewerId, today)` (mocked); resulting set is passed to WatchPickerDialog's `wornTodayIds` prop.
    - Test 4 (wearEventId stability): `wearEventId` is generated once per open session (useMemo with `open` dep); stays stable across step transitions within the same open; regenerates on next open.
    - Test 5 (close): Closing the dialog resets all state (watch selection, note, visibility to 'public', photo).
  </behavior>
  <action>
    Step 1 — Create `src/components/wywt/WywtPostDialog.tsx` Client Component per RESEARCH §Pattern 2:
    ```tsx
    'use client'

    import { useState, useMemo, useEffect } from 'react'
    import { Dialog, DialogContent } from '@/components/ui/dialog'
    import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
    import { ComposeStep } from './ComposeStep'
    import { getWornTodayIdsForUser } from '@/app/actions/wearEvents'  // see note below
    import type { Watch } from '@/lib/types'
    import type { WearVisibility } from '@/lib/wearVisibility'

    /**
     * WywtPostDialog — two-step orchestrator for the WYWT photo post flow.
     *
     * Step 1 renders the existing WatchPickerDialog with the NEW onWatchSelected
     * prop (Task 1) — selection advances to Step 2 instead of calling markAsWorn.
     * Step 2 renders ComposeStep for photo+note+visibility+submit.
     *
     * Preflight (D-03, D-13): on first open, fetch today's wear events via
     * getWornTodayIdsForUser Server Action and pass to the picker so already-
     * worn watches render disabled.
     *
     * Change link (D-05): resets selectedWatchId and step=picker but preserves
     * photoBlob, note, visibility — the user is adjusting their watch choice,
     * not their whole post.
     *
     * wearEventId (D-15 linchpin): generated ONCE per open session via
     * crypto.randomUUID() so the Storage path is known before the Server
     * Action insert. Server Action validates the object exists at
     * {userId}/{wearEventId}.jpg before inserting the row.
     */
    export function WywtPostDialog({
      open,
      onOpenChange,
      ownedWatches,
      viewerId,
    }: {
      open: boolean
      onOpenChange: (v: boolean) => void
      ownedWatches: Watch[]
      viewerId: string
    }) {
      const [step, setStep] = useState<'picker' | 'compose'>('picker')
      const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null)
      const wearEventId = useMemo(() => (open ? crypto.randomUUID() : ''), [open])
      const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
      const [note, setNote] = useState('')
      const [visibility, setVisibility] = useState<WearVisibility>('public')
      const [wornTodayIds, setWornTodayIds] = useState<ReadonlySet<string> | undefined>()

      // Preflight fetch on open (D-13). Fire-and-forget — if it fails, the
      // picker simply doesn't disable any rows and the server-side 23505
      // catch is the safety net.
      useEffect(() => {
        if (!open) return
        let cancelled = false
        const today = new Date().toISOString().split('T')[0]
        getWornTodayIdsForUser({ userId: viewerId, today })
          .then((ids) => {
            if (!cancelled) setWornTodayIds(ids)
          })
          .catch((err) => {
            console.error('[WywtPostDialog] preflight failed (non-fatal):', err)
            // Leave wornTodayIds undefined — picker renders all rows enabled;
            // server will 23505 if dup.
          })
        return () => { cancelled = true }
      }, [open, viewerId])

      // Close resets everything (D-05 Change only resets watch, but dialog
      // close discards the whole draft — no half-filled form across opens).
      const handleOpenChange = (next: boolean) => {
        if (!next) {
          setStep('picker')
          setSelectedWatchId(null)
          setPhotoBlob(null)
          setNote('')
          setVisibility('public')
          setWornTodayIds(undefined)
        }
        onOpenChange(next)
      }

      if (step === 'picker') {
        return (
          <WatchPickerDialog
            open={open}
            onOpenChange={handleOpenChange}
            watches={ownedWatches}
            wornTodayIds={wornTodayIds}
            onWatchSelected={(id) => {
              setSelectedWatchId(id)
              setStep('compose')
            }}
          />
        )
      }

      const selectedWatch = ownedWatches.find((w) => w.id === selectedWatchId)
      if (!selectedWatch) {
        // Defensive — shouldn't happen
        setStep('picker')
        return null
      }

      return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md">
            <ComposeStep
              watch={selectedWatch}
              viewerId={viewerId}
              wearEventId={wearEventId}
              photoBlob={photoBlob}
              setPhotoBlob={setPhotoBlob}
              note={note}
              setNote={setNote}
              visibility={visibility}
              setVisibility={setVisibility}
              onChange={() => {
                // D-05: preserve photo/note/visibility, reset watch only
                setSelectedWatchId(null)
                setStep('picker')
              }}
              onSubmitted={() => handleOpenChange(false)}
            />
          </DialogContent>
        </Dialog>
      )
    }
    ```

    Step 2 — NOTE about `getWornTodayIdsForUser`: this is a DAL function (server-only) but we're calling it from a Client Component. The executor must wrap it in a Server Action (add to `src/app/actions/wearEvents.ts` in Task 5). For now, import it conditionally:
    ```typescript
    // Preflight wrapper Server Action (add to src/app/actions/wearEvents.ts in Task 5):
    'use server'
    export async function getWornTodayIdsForUserAction(
      input: { userId: string; today: string }
    ): Promise<string[]> {   // Server Actions cannot return Sets; return array, WywtPostDialog converts
      const user = await getCurrentUser()
      if (user.id !== input.userId) return []  // defense: only returns the caller's own set
      const set = await wearEventDAL.getWornTodayIdsForUser(user.id, input.today)
      return [...set]
    }
    ```
    In WywtPostDialog, import the action, call it, and convert the array back to a Set via `new Set(ids)`. **Update the import + the .then callback accordingly in the WywtPostDialog code above.** The `<interfaces>` signature for `getWornTodayIdsForUser` remains the DAL one; the CLIENT uses the Server Action wrapper.

    Step 3 — Add Wave 0 tests to `tests/components/WywtPostDialog.test.tsx` for behaviors 1-5. Mock:
    - `@/components/home/WatchPickerDialog` — render a simple `<button data-testid="select-watch-a" onClick={() => props.onWatchSelected('watch-a')}>` + show disabled watches
    - `@/components/wywt/ComposeStep` — render a simple component that exposes props via data-attributes (`data-note`, `data-visibility`, `data-photo-present`) + a "Change" button that calls `onChange`
    - `@/app/actions/wearEvents` — mock `getWornTodayIdsForUserAction` to return `['watch-b']`

    Step 4 — Also add the ComposeStep file as a stub that just exports a `ComposeStep` component returning null — so TypeScript compiles; Task 3 fleshes it out. This unblocks running the tests for Task 2 before Task 3 code is written.
  </action>
  <verify>
    <automated>npm run test -- tests/components/WywtPostDialog.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - `src/components/wywt/WywtPostDialog.tsx` exports `WywtPostDialog` Client Component with the exact prop signature in <interfaces>
    - Step machine transitions: picker → compose via `onWatchSelected`; compose → picker via `onChange` with photo/note/visibility preserved
    - `wearEventId` generated via `crypto.randomUUID()` in `useMemo` with `open` dep — stable within a single open, regenerates across opens
    - Preflight calls the Server Action wrapper (to be added to wearEvents.ts in Task 5); gracefully handles failure by leaving `wornTodayIds` undefined
    - Closing the dialog resets all state
    - 5 tests in `tests/components/WywtPostDialog.test.tsx` covering behaviors 1-5 all GREEN
    - `npx tsc --noEmit` exits 0 (ComposeStep stub + getWornTodayIdsForUserAction stub both exist)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build ComposeStep + VisibilitySegmentedControl (photo zone states, note counter, visibility selector, submit with toast) — includes camera gesture glue</name>
  <files>src/components/wywt/VisibilitySegmentedControl.tsx, src/components/wywt/ComposeStep.tsx, tests/components/WywtPostDialog.test.tsx</files>
  <read_first>
    - src/components/wywt/PhotoUploader.tsx (Plan 01 Task 2)
    - src/components/wywt/CameraCaptureView.tsx (Plan 01 Task 3 — takes `stream: MediaStream` prop)
    - src/components/wywt/WristOverlaySvg.tsx (Plan 01 Task 3)
    - src/lib/exif/strip.ts (Plan 01 Task 1)
    - src/lib/storage/wearPhotos.ts (Plan 01 Task 3)
    - src/components/home/WatchPickerDialog.tsx (for layout conventions — DialogTitle/DialogContent wrapping, "Keep browsing" cancel copy)
    - src/components/preferences/PreferencesClient.tsx (look up: role="alert" inline-error pattern from DEBT-01)
    - RESEARCH.md §Pattern 8 — Sonner toast from Client Component (full submit handler example)
    - RESEARCH.md §Pitfall 1 — iOS gesture rule (getUserMedia FIRST in tap handler)
    - RESEARCH.md §Pitfall 2 — MediaStream cleanup
    - RESEARCH.md §Pitfall 3 — permission denied UX
    - CONTEXT.md D-05 (watch card + Change link), D-06 / D-07 (photo zone states), D-11 (note counter), D-12 (visibility sub-labels), D-18 (Logging… UX), D-19 (post-submit toast)
    - UI-SPEC.md §Interaction Contracts → Step 2: COMPOSE (full layout spec)
    - UI-SPEC.md §VisibilitySegmentedControl (button + icon + sub-label copy)
    - UI-SPEC.md §Copywriting Contract — EVERY copy string for compose step
    - UI-SPEC.md §Accessibility Contract — aria-label requirements
    - UI-SPEC.md §Color — accent use (only active segmented button + Change link)
    - UI-SPEC.md §Typography — character counter typography + destructive at 200
    - VALIDATION.md rows WYWT-03, WYWT-07, WYWT-08, WYWT-16
  </read_first>
  <behavior>
    VisibilitySegmentedControl:
    - Test 6: Renders 3 buttons labeled "Private" / "Followers" / "Public" each with an icon (Lock / Users / Globe2). Default value='public' shows Public as pressed (`aria-pressed="true"`, `bg-accent`).
    - Test 7: Clicking Followers fires `onChange('followers')`; the sub-label row updates to "Followers — people who follow you".
    - Test 8: Sub-label copy matches UI-SPEC exactly: Private → "Only you"; Followers → "Followers — people who follow you"; Public → "Anyone on Horlo".

    ComposeStep:
    - Test 9 (WYWT-03): Rendered with `photoBlob=null`; submit button is enabled (no-photo path valid); clicking submit triggers `logWearWithPhoto` with `hasPhoto: false`.
    - Test 10 (WYWT-07): Typing "hello" in note textarea updates counter to `5/200`; at 200 chars the counter text has `text-destructive` class; 201st keypress is blocked by maxLength.
    - Test 11 (WYWT-08): Initial visibility is 'public'; changing to 'followers' + submit → `logWearWithPhoto` called with `visibility: 'followers'`.
    - Test 12 (WYWT-16): On successful submit (mocked action returns `{success:true, data:{wearEventId}}`), `toast.success('Wear logged')` is called and `onSubmitted()` fires.
    - Test 13 (WYWT-02 preserved state): "Change" link in header calls `onChange()` → parent resets watch selection; note/visibility passed back in as the same values (asserted via re-render).
    - Test 14 (error surfacing): Mocked action returns `{success:false, error:'Already logged this watch today'}` → inline `role="alert"` banner shows the error string; `toast.success` is NOT called.
    - Test 15 (photo submit path): With `photoBlob` set, submit path calls `stripAndResize` → `uploadWearPhoto` → `logWearWithPhoto({hasPhoto:true})` in order (verified via mock call order).
  </behavior>
  <action>
    Step 1 — Create `src/components/wywt/VisibilitySegmentedControl.tsx`:
    ```tsx
    'use client'
    import { Lock, Users, Globe2 } from 'lucide-react'
    import { cn } from '@/lib/utils'
    import type { WearVisibility } from '@/lib/wearVisibility'

    const OPTIONS: Array<{
      value: WearVisibility
      label: string
      icon: typeof Lock
      ariaLabel: string
      subLabel: string
    }> = [
      { value: 'private', label: 'Private', icon: Lock, ariaLabel: 'Private — only you', subLabel: 'Only you' },
      { value: 'followers', label: 'Followers', icon: Users, ariaLabel: 'Followers only', subLabel: 'Followers — people who follow you' },
      { value: 'public', label: 'Public', icon: Globe2, ariaLabel: 'Public — anyone on Horlo', subLabel: 'Anyone on Horlo' },
    ]

    export function VisibilitySegmentedControl({
      value,
      onChange,
      disabled,
    }: {
      value: WearVisibility
      onChange: (v: WearVisibility) => void
      disabled?: boolean
    }) {
      const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[2]
      return (
        <div>
          <div
            role="group"
            aria-label="Post visibility"
            className="inline-flex rounded-md border border-border bg-muted p-1 gap-1"
          >
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-label={opt.ariaLabel}
                  aria-pressed={isActive}
                  disabled={disabled}
                  onClick={() => onChange(opt.value)}
                  className={cn(
                    'flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-transparent text-foreground hover:bg-muted-foreground/10',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {active.subLabel}
          </p>
        </div>
      )
    }
    ```

    Step 2 — Replace the `ComposeStep` stub with the full implementation at `src/components/wywt/ComposeStep.tsx`:

    Full signature per <interfaces>. Structure:
    ```tsx
    'use client'
    import { useState, useRef, useTransition } from 'react'
    import { toast } from 'sonner'
    import { X } from 'lucide-react'
    import { Dialog, DialogTitle } from '@/components/ui/dialog'
    import { Button } from '@/components/ui/button'
    import { Textarea } from '@/components/ui/textarea'
    import { PhotoUploader } from './PhotoUploader'
    import { CameraCaptureView } from './CameraCaptureView'
    import { VisibilitySegmentedControl } from './VisibilitySegmentedControl'
    import { stripAndResize } from '@/lib/exif/strip'
    import { uploadWearPhoto } from '@/lib/storage/wearPhotos'
    import { logWearWithPhoto } from '@/app/actions/wearEvents'
    import { cn } from '@/lib/utils'
    import type { Watch } from '@/lib/types'
    import type { WearVisibility } from '@/lib/wearVisibility'

    export function ComposeStep({
      watch,
      viewerId,
      wearEventId,
      photoBlob,
      setPhotoBlob,
      note,
      setNote,
      visibility,
      setVisibility,
      onChange,
      onSubmitted,
    }: /* props per <interfaces> */) {
      const [pending, startTransition] = useTransition()
      const [error, setError] = useState<string | null>(null)
      const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
      const [photoSource, setPhotoSource] = useState<'camera' | 'upload' | null>(null)
      const photoPreviewUrl = useMemo(
        () => (photoBlob ? URL.createObjectURL(photoBlob) : null),
        [photoBlob],
      )
      useEffect(() => {
        return () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl) }
      }, [photoPreviewUrl])

      // Pitfall 1 — iOS gesture: getUserMedia must be the FIRST await on the
      // tap handler. Do NOT await anything (setState, props, fetch) before it.
      const handleTapCamera = async () => {
        setError(null)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } },
            audio: false,
          })
          setCameraStream(stream)
          setPhotoSource('camera')
        } catch (err) {
          if (err instanceof Error && err.name === 'NotAllowedError') {
            setError('Camera access denied — use Upload photo instead.')
          } else {
            setError('Camera unavailable — use Upload photo instead.')
          }
        }
      }

      const handlePhotoReady = (jpeg: Blob) => {
        setPhotoBlob(jpeg)
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop())
          setCameraStream(null)
        }
      }
      const handleRemovePhoto = () => {
        setPhotoBlob(null)
        setPhotoSource(null)
      }
      const handleCancelCamera = () => {
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop())
          setCameraStream(null)
        }
        setPhotoSource(null)
      }

      const handleSubmit = () => {
        setError(null)
        startTransition(async () => {
          try {
            // Process + upload photo if present
            if (photoBlob) {
              const { blob } = await stripAndResize(photoBlob)
              const upload = await uploadWearPhoto(viewerId, wearEventId, blob)
              if ('error' in upload) {
                setError('Photo upload failed — please try again.')
                return
              }
            }
            const result = await logWearWithPhoto({
              wearEventId,
              watchId: watch.id,
              note: note.trim().length > 0 ? note.trim() : null,
              visibility,
              hasPhoto: !!photoBlob,
            })
            if (!result.success) {
              setError(result.error)
              return
            }
            // H-2: toast from Client Component only
            toast.success('Wear logged')
            onSubmitted()
          } catch (err) {
            console.error('[ComposeStep] submit error:', err)
            setError('Could not log that wear. Please try again.')
          }
        })
      }

      const counterAt200 = note.length >= 200
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">Log a wear</DialogTitle>
            <button
              type="button"
              onClick={onChange}
              disabled={pending}
              className="text-xs font-semibold text-accent underline underline-offset-2"
            >
              Change
            </button>
          </div>

          {/* Compact watch card header (D-05) */}
          <div className="flex items-center gap-3 p-2 bg-card rounded-md border border-border">
            {watch.imageUrl ? (
              <img src={watch.imageUrl} alt="" className="size-10 rounded-md object-cover" />
            ) : (
              <div className="size-10 rounded-md bg-muted" aria-hidden />
            )}
            <div className="flex flex-col">
              <span className="text-base font-semibold">{watch.brand}</span>
              <span className="text-sm text-muted-foreground">{watch.model}</span>
            </div>
          </div>

          {/* Photo section — 3 states: pre-capture / camera-live / preview */}
          {photoBlob ? (
            <div className="relative">
              <img
                src={photoPreviewUrl ?? ''}
                alt="Wear photo preview"
                className="w-full rounded-md object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={handleRemovePhoto}
                disabled={pending}
                className="absolute top-2 right-2 size-11 flex items-center justify-center rounded-full bg-background/80 hover:bg-background"
              >
                <X className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={pending}
                className="mt-2 text-xs font-semibold text-accent underline"
              >
                {photoSource === 'camera' ? 'Retake' : 'Choose another'}
              </button>
            </div>
          ) : cameraStream ? (
            <CameraCaptureView
              stream={cameraStream}
              onPhotoReady={handlePhotoReady}
              onError={(m) => { setError(m); handleCancelCamera() }}
              onCancel={handleCancelCamera}
              disabled={pending}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-border rounded-md bg-muted/30">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleTapCamera} disabled={pending} className="min-h-11">
                  Take wrist shot
                </Button>
                <PhotoUploader onPhotoReady={handlePhotoReady} onError={setError} disabled={pending} />
              </div>
              <p className="text-xs text-muted-foreground">Photo optional</p>
            </div>
          )}

          {/* Note (D-11) */}
          <div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Add a note…"
              disabled={pending}
              className="resize-none text-sm"
              aria-label="Wear note"
            />
            <p
              className={cn(
                'mt-1 text-right text-xs',
                counterAt200 ? 'text-destructive font-semibold' : 'text-muted-foreground font-normal',
              )}
            >
              {note.length}/200
            </p>
          </div>

          {/* Visibility (D-12) */}
          <VisibilitySegmentedControl value={visibility} onChange={setVisibility} disabled={pending} />

          {/* Error banner (DEBT-01 precedent) */}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onChange} disabled={pending}>
              Keep browsing
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? 'Logging…' : 'Log wear'}
            </Button>
          </div>
        </div>
      )
    }
    ```

    NOTES on the above scaffold:
    - `setPhotoBlob` / `setNote` / `setVisibility` are PARENT setters — writing to them preserves state across Change-back-and-forth (D-05).
    - `handleRemovePhoto` returns to the pre-capture zone without re-opening the picker — the user can pick a different photo source immediately.
    - The "Change" BUTTON in the header and the "Keep browsing" button BOTH call `onChange()` — semantically different but the current shape in WywtPostDialog treats them identically. If the executor prefers distinct handlers, wire `handleDismiss` separately (calls `handleOpenChange(false)` via an `onDismiss` prop). The UI-SPEC is silent; keep "Keep browsing" mapped to close/dismiss for consistency with the existing WatchPickerDialog. Update the code accordingly: add an `onDismiss` prop to ComposeStep and have WywtPostDialog pass `() => handleOpenChange(false)`. "Change" calls `onChange`.
    - Import `useMemo` and `useEffect` from 'react' for photoPreviewUrl.

    Step 3 — Add Wave 0 tests to `tests/components/WywtPostDialog.test.tsx` for behaviors 6-15. Mock:
    - `@/lib/exif/strip` — stripAndResize returns `{blob: mockBlob, width:1080, height:720}`
    - `@/lib/storage/wearPhotos` — uploadWearPhoto returns `{path: 'u/w.jpg'}`
    - `@/app/actions/wearEvents` — logWearWithPhoto returns `{success:true, data:{wearEventId:'w-uuid'}}` by default; override per-test for error paths
    - `sonner` — `toast.success` is a vi.fn spied on
    - `@/components/wywt/PhotoUploader` — render a `<button data-testid="simulate-upload" onClick={() => props.onPhotoReady(mockBlob)}>`
    - `@/components/wywt/CameraCaptureView` — render a `<button data-testid="simulate-capture" onClick={() => props.onPhotoReady(mockBlob)}>`
    - `navigator.mediaDevices.getUserMedia` — `vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream)` for camera tests

    Step 4 — Verify the complete test file passes. At minimum 15 tests across all 3 tasks in this plan end up in `tests/components/WywtPostDialog.test.tsx`.
  </action>
  <verify>
    <automated>npm run test -- tests/components/WywtPostDialog.test.tsx</automated>
  </verify>
  <done>
    - `src/components/wywt/VisibilitySegmentedControl.tsx` renders 3 buttons with the exact icons (Lock/Users/Globe2) + sub-label row; default 'public' visually active (bg-accent)
    - `src/components/wywt/ComposeStep.tsx` submit path with no photo works; with photo runs stripAndResize → uploadWearPhoto → logWearWithPhoto in order
    - `toast.success('Wear logged')` is called on success (exact string); NO `toast()` anywhere else (failure path uses inline `role="alert"` banner only)
    - Note textarea has `maxLength={200}`; counter at 200 renders with `text-destructive` + `font-semibold`
    - Camera tap handler calls `getUserMedia` as first await with `facingMode: 'environment'`; caught `NotAllowedError` surfaces the exact UI-SPEC copy "Camera access denied — use Upload photo instead."
    - "Change" button calls `onChange` prop (which WywtPostDialog's parent wires to reset watch selection, preserve note/visibility/photo)
    - All 10+ tests in `tests/components/WywtPostDialog.test.tsx` for WYWT-01/02/03/07/08/16 GREEN
    - No direct `toast()` call exists in a Server Action file (`grep -rn "toast(" src/app/actions/` returns 0 matches)
  </done>
</task>

<task type="auto">
  <name>Task 4: Swap call sites — NavWearButton + WywtRail now open WywtPostDialog (NOT WatchPickerDialog)</name>
  <files>src/components/layout/NavWearButton.tsx, src/components/home/WywtRail.tsx</files>
  <read_first>
    - src/components/layout/NavWearButton.tsx (full file — understand lazy + Suspense pattern)
    - src/components/home/WywtRail.tsx (full file — understand self-placeholder vs non-self branching)
    - src/components/wywt/WywtPostDialog.tsx (Task 2 — note the `viewerId` prop is required)
    - RESEARCH.md §Pattern 1 — Lazy-loaded dialog wrapper (shows the NavWearButton lazy swap)
    - CONTEXT.md D-04 (call-site routing: NavWearButton + WywtRail self-placeholder → WywtPostDialog; LogTodaysWearButton + non-self tiles UNCHANGED)
    - UI-SPEC.md §Component Inventory → NavWearButton + WywtRail rows — both marked "Extended"
  </read_first>
  <action>
    NavWearButton:
    - Keep the entire file IDENTICAL except:
      1. Swap the lazy import target from `WatchPickerDialog` to `WywtPostDialog`:
         ```tsx
         const WywtPostDialog = lazy(() =>
           import('@/components/wywt/WywtPostDialog').then((m) => ({
             default: m.WywtPostDialog,
           })),
         )
         ```
      2. Remove the `WatchPickerDialog` import (no longer used here).
      3. In the render, swap the usage:
         ```tsx
         {open && (
           <Suspense fallback={null}>
             <WywtPostDialog
               open={open}
               onOpenChange={setOpen}
               ownedWatches={ownedWatches}
               viewerId={???}
             />
           </Suspense>
         )}
         ```
    - PROBLEM: `NavWearButton` does NOT currently receive `viewerId`. Its current callers (`Header`, `BottomNavClient`) pass only `ownedWatches`. The executor MUST:
      a. Add `viewerId: string` to `NavWearButtonProps`
      b. Update every caller site (grep for `<NavWearButton` in `src/components/layout/`) to pass `viewerId`
      c. The callers are Server Components that have access to `user.id` via `getCurrentUser()` — pass it through as a prop
    - Update the JSDoc block at the top to reference Phase 15 (was "Plan 10-08" etc.). Add a line noting the swap: "Phase 15 D-04: lazy target swapped from `WatchPickerDialog` to `WywtPostDialog` so the nav-wear entry point now opens the photo flow. `LogTodaysWearButton` (profile page) remains on the quick-log picker path."

    WywtRail:
    - Keep the entire file IDENTICAL except:
      1. Swap the lazy import target for the self-placeholder dialog:
         ```tsx
         const WywtPostDialog = lazy(() =>
           import('@/components/wywt/WywtPostDialog').then((m) => ({
             default: m.WywtPostDialog,
           })),
         )
         ```
      2. Remove the `WatchPickerDialog` import.
      3. In the render, swap the `WatchPickerDialog` element with `WywtPostDialog` passing `viewerId={data.viewerId}` (WywtRail already has `data.viewerId` from `WywtRailData`):
         ```tsx
         <Suspense fallback={null}>
           {pickerOpen && (
             <WywtPostDialog
               open={pickerOpen}
               onOpenChange={setPickerOpen}
               ownedWatches={ownedWatches}
               viewerId={data.viewerId}
             />
           )}
         </Suspense>
         ```
      4. Rename the state variable from `pickerOpen` to `postOpen` for clarity (optional polish; keep pickerOpen if changing is too intrusive — the behavior is identical).
      5. DO NOT TOUCH the WywtOverlay lazy import, the non-self tile tap flow, or the `openAt(tile)` handler (Phase 10 pattern preserved per WYWT-18).
    - Verify with grep:
      ```bash
      grep -n "WatchPickerDialog" src/components/home/WywtRail.tsx src/components/layout/NavWearButton.tsx
      ```
      Should return 0 matches after the swap.

    Confirm LogTodaysWearButton and non-self tile pathways are unchanged:
    ```bash
    grep -n "WatchPickerDialog" src/components/profile/LogTodaysWearButton.tsx
    ```
    Should return matches (LogTodaysWearButton still uses picker — D-04 requirement).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npm run test</automated>
  </verify>
  <done>
    - `NavWearButton.tsx` lazy-imports `WywtPostDialog` (not WatchPickerDialog); `viewerId` prop added and plumbed from all callers
    - `WywtRail.tsx` lazy-imports `WywtPostDialog` for the self-placeholder pathway; non-self tile tap still opens WywtOverlay
    - `LogTodaysWearButton.tsx` UNCHANGED — still uses `WatchPickerDialog` with existing markAsWorn direct path (D-04 preservation)
    - `grep -rn "WatchPickerDialog" src/components/layout/` returns 0 matches
    - `grep -rn "WywtPostDialog" src/components/layout/ src/components/home/` returns ≥ 2 matches (both call sites)
    - `npx tsc --noEmit` exits 0 across whole repo
    - `npm run lint` exits 0
    - Full suite `npm run test` still passes (existing home-privacy, wishlist, etc. tests unchanged)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Server Action `logWearWithPhoto` + preflight Server Action wrapper + orphan cleanup + integration tests (duplicate-day + upload+validate)</name>
  <files>src/app/actions/wearEvents.ts, tests/integration/phase15-wywt-photo-flow.test.ts</files>
  <read_first>
    - src/app/actions/wearEvents.ts (current markAsWorn — mirror its shape; MUST remain byte-unchanged)
    - src/data/wearEvents.ts (getWornTodayIdsForUser + logWearEventWithPhoto added in Task 1)
    - src/data/activities.ts (logActivity signature + WatchWornMetadata)
    - src/data/watches.ts (getWatchById)
    - src/lib/auth.ts (getCurrentUser)
    - src/lib/supabase/server.ts (createSupabaseServerClient signature)
    - RESEARCH.md §Pattern 6 — Duplicate-day handling (23505 code, orphan delete)
    - RESEARCH.md §Pattern 7 — Client-direct upload + server validates (FULL code example for logWearWithPhoto)
    - RESEARCH.md §Pitfall 8 — Orphan Storage objects (best-effort remove)
    - RESEARCH.md §Open Question 2 — whether .list works under session client (A5 — plan a smoke test)
    - RESEARCH.md §Security Domain + §Assumption A5
    - CONTEXT.md D-14 (server 23505), D-15 (full pipeline), D-16 (no-photo), D-17 (orphan delete)
    - UI-SPEC.md §Interaction Contracts → error handling for duplicate-day
    - VALIDATION.md rows WYWT-12 + WYWT-15
    - tests/integration/home-privacy.test.ts (existing Supabase-gated integration pattern)
    - tests/integration/phase12-visibility-matrix.test.ts (another integration test shape)
    - supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql (verify list RLS)
  </read_first>
  <behavior>
    Server Action behaviors:
    - Test 16 (happy no-photo): `logWearWithPhoto({wearEventId, watchId, note:'nice', visibility:'public', hasPhoto:false})` → inserts wear_events row with `photoUrl:null`; returns `{success:true, data:{wearEventId}}`; `revalidatePath('/')` called; `logActivity('watch_worn', ..., {visibility:'public'})` fired.
    - Test 17 (happy with-photo): seed a `wear-photos/{userId}/{wearEventId}.jpg` object; call with `hasPhoto:true` → list probe finds it; inserts row with `photoUrl='{userId}/{wearEventId}.jpg'`; returns success.
    - Test 18 (client asserts hasPhoto but no file): DO NOT seed a Storage object; call with `hasPhoto:true` → list probe fails; returns `{success:false, error:'Photo upload failed — please try again'}`; NO row inserted; NO activity logged.
    - Test 19 (duplicate-day with photo): seed + insert a row for (user, watch, today); call again with the SAME (watchId, today) → 23505 caught; returns `{success:false, error:'Already logged this watch today'}`; orphan Storage object is REMOVED (list probe after returns empty).
    - Test 20 (duplicate-day no photo): call twice with `hasPhoto:false` → second returns the duplicate-day error; no orphan cleanup needed (nothing to clean).
    - Test 21 (unauthorized): `getCurrentUser` throws → returns `{success:false, error:'Not authenticated'}`.
    - Test 22 (cross-user watch): watchId belongs to another user → `getWatchById` returns null → returns `{success:false, error:'Watch not found'}` (mirrors markAsWorn CR-01 uniform not-found).
    - Test 23 (zod validation): invalid wearEventId (non-UUID) → returns `{success:false, error:'Invalid input'}`.
    - Test 24 (preflight wrapper): `getWornTodayIdsForUserAction({userId: self, today})` returns an array of watchIds worn today; `{userId: otherUser}` returns empty array (defense — only returns caller's own set).

    A5 smoke test:
    - Test 25: Using the session client (NOT service-role), `supabase.storage.from('wear-photos').list(userId, {search: `${wearEventId}.jpg`})` succeeds AND returns the object when it exists. If this test FAILS, switch the implementation to use service-role client and document in Summary.
  </behavior>
  <action>
    Step 1 — Add `logWearWithPhoto` + `getWornTodayIdsForUserAction` to `src/app/actions/wearEvents.ts`. Keep `markAsWorn` UNCHANGED (byte-identical at the top of the file). Append the new actions after `markAsWorn`.

    Use RESEARCH §Pattern 7 code verbatim (it's already tuned for this plan), with these adjustments:
    - `revalidatePath('/')` on success (D-19)
    - Import `createSupabaseServerClient` from `@/lib/supabase/server`
    - Import `WearVisibility` from `@/lib/wearVisibility`
    - `note: parsed.data.note?.trim() || null` (normalize whitespace-only to null; client already trims but defense in depth)
    - On 23505 catch, log a structured error: `console.error('[logWearWithPhoto] duplicate-day detected; orphan cleanup:', cleanupResult)`
    - Activity log: `await logActivity(user.id, 'watch_worn', watchId, { brand: watch.brand, model: watch.model, imageUrl: watch.imageUrl ?? null, visibility: parsed.data.visibility })` (Phase 12 D-10 contract)

    Zod schema (verbatim from RESEARCH):
    ```typescript
    const logWearWithPhotoSchema = z.object({
      wearEventId: z.string().uuid(),
      watchId: z.string().uuid(),
      note: z.string().max(200).nullable(),
      visibility: z.enum(['public', 'followers', 'private']),
      hasPhoto: z.boolean(),
    })
    ```

    Preflight wrapper:
    ```typescript
    const preflightSchema = z.object({
      userId: z.string().uuid(),
      today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })

    export async function getWornTodayIdsForUserAction(
      input: { userId: string; today: string }
    ): Promise<string[]> {
      const parsed = preflightSchema.safeParse(input)
      if (!parsed.success) return []
      let user
      try { user = await getCurrentUser() } catch { return [] }
      // Defense: only returns the caller's own set (D-13 — not a cross-user leak)
      if (user.id !== parsed.data.userId) return []
      const set = await wearEventDAL.getWornTodayIdsForUser(user.id, parsed.data.today)
      return [...set]
    }
    ```

    Step 2 — Add integration tests at `tests/integration/phase15-wywt-photo-flow.test.ts`. Mirror `tests/integration/home-privacy.test.ts`:
    - Gate on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — skip suite if absent (`it.skipIf`)
    - Use service-role client to seed users, watches, wear_events, Storage objects
    - Use the browser-scoped supabase client (session set on test user) when testing the `.list()` under session (A5 smoke)
    - Clean up after each test (delete seeded rows + storage objects)
    - Tests 16-25 from the behavior list above
    - Test 25 (A5) is the FIRST test in the file — if it fails, the executor MUST switch the Server Action's storage-list call to service-role and re-run. Document the result in summary.

    Step 3 — Manual UAT task: Add a final task (Task 6) is deferred to Plan 04 since the manual iOS UAT naturally lives with wear detail review. THIS plan's manual UAT items are "camera permission denied", "duplicate-day preflight disables + server catches", "Sonner toast visible on light + dark themes". These items should appear in Plan 04's final manual UAT task (it aggregates all manual checklist items across the phase).

    Step 4 — Verify with grep:
    ```bash
    grep -n "markAsWorn" src/app/actions/wearEvents.ts  # expect existing + unchanged
    grep -n "logWearWithPhoto" src/app/actions/wearEvents.ts  # expect new export
    grep -n "getWornTodayIdsForUserAction" src/app/actions/wearEvents.ts  # expect new export
    grep -n "toast" src/app/actions/wearEvents.ts  # expect 0 matches (Pitfall H-2)
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts</automated>
  </verify>
  <done>
    - `src/app/actions/wearEvents.ts` exports `markAsWorn` (unchanged), `logWearWithPhoto`, `getWornTodayIdsForUserAction`
    - `logWearWithPhoto` performs: auth check → zod parse → watch ownership check → (if hasPhoto) Storage list probe → insert via `logWearEventWithPhoto` DAL → fire-and-forget logActivity → `revalidatePath('/')` → return `{success:true, data:{wearEventId}}`
    - 23505 caught; error string EXACTLY `"Already logged this watch today"`; orphan Storage object removed best-effort
    - Non-23505 insert failure with hasPhoto also triggers best-effort orphan cleanup
    - No `toast(` anywhere in the file (grep confirms)
    - Integration tests 16-25 all pass when Supabase env vars present (or skip gracefully when absent — same pattern as home-privacy.test.ts)
    - A5 smoke test result (list under session client vs service-role) documented in plan summary
    - `npx tsc --noEmit` exits 0
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action | Zod validation at action entry; reject malformed input |
| Server Action → Storage | Server validates object exists before insert (client could lie about hasPhoto) |
| Server Action → DB | UNIQUE (user_id, watch_id, worn_date) + RLS |
| Browser → DOM (Sonner portal) | Toast message is a static literal; note rendering via React escaping |
| Client JS → MediaDevices | getUserMedia on gesture context only |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-04 | T (Client hasPhoto tampering) | HIGH | logWearWithPhoto | Server calls `supabase.storage.list(user.id, {search: `${wearEventId}.jpg`})` before insert; rejects when object absent. Returns generic "Photo upload failed" — no detailed info leak. |
| T-15-05 | T (Duplicate-day race — concurrent inserts) | MED | logWearEventWithPhoto / DB | DB UNIQUE constraint `wear_events_unique_day` + PG error code 23505 caught in Server Action. Orphan Storage cleanup on 23505. Preflight disable in Step 1 UI is defense-in-depth, not sole guard. |
| T-15-06 | T (Visibility-default tampering — client forces 'public' on a private draft) | MED | logWearWithPhoto zod | Zod enum `['public','followers','private']` validates; Server Action trusts input value (user-chosen visibility is the intent). No silent-fall-to-public coercion — invalid values rejected as 'Invalid input'. |
| T-15-07 | I (Duplicate-day error string leak) | LOW | logWearWithPhoto | Error string is a UX message, not a security boundary. User who just attempted an insert already knows the watch exists in their collection — no cross-user existence leak. |
| T-15-16 | I (Cross-user preflight leak via getWornTodayIdsForUserAction) | MED | getWornTodayIdsForUserAction | Server Action rejects (returns empty array) when `input.userId !== user.id` — only the caller's own set is returned. Zod validates userId and today string. |
| T-15-17 | E (Cross-user path write via client bug) | HIGH | uploadWearPhoto + Storage RLS | Client convention: `{userId}/{wearEventId}.jpg`. Storage RLS (Phase 11) enforces `(storage.foldername(name))[1] = auth.uid()::text` on INSERT — a compromised client cannot write to another user's folder. |
| T-15-18 | I (Orphan Storage object leaks if cleanup fails) | LOW | logWearWithPhoto catch branch | Best-effort cleanup; log-only on failure. Phase 11 D-04 MVP orphan-risk posture accepted. Storage objects in /{userId}/ folders are only readable via signed URLs; a bare path with no corresponding DB row never gets a URL minted → not externally discoverable. |
| T-15-19 | S (Server Action auth bypass) | HIGH | logWearWithPhoto | `getCurrentUser()` throws on no session; caught and returns 'Not authenticated'. Zod runs AFTER auth. |
| T-15-20 | I (Server Action logs sensitive input) | LOW | logWearWithPhoto console.error | Only err messages + error codes logged; no user input (note text, wearEventId) leaked in production logs. Verify executor only logs err objects and the literal strings in the action. |
</threat_model>

<verification>
## Plan-Level Verification

- `npx tsc --noEmit` exits 0
- `npm run lint` exits 0
- `npm run test` full suite green (including the 20+ new tests in WywtPostDialog.test.tsx + phase15-wywt-photo-flow.test.ts)
- `grep -rn "WatchPickerDialog" src/components/layout/` returns 0 matches
- `grep -rn "WywtPostDialog" src/components/` returns ≥ 3 matches (NavWearButton, WywtRail, WywtPostDialog itself)
- `grep -rn "toast(" src/app/actions/` returns 0 matches (Pitfall H-2 enforced)
- `grep -rn "import heic2any" src/ | grep -v heic-worker` returns 0 matches (Pitfall E-1 enforced from Plan 01)
- LogTodaysWearButton unchanged — `git diff HEAD src/components/profile/LogTodaysWearButton.tsx` is empty
- WywtOverlay and WywtSlide UNCHANGED (Phase 10 pattern preserved per WYWT-18)
- A5 smoke result documented in plan summary
</verification>

<success_criteria>
## Plan Success Criteria

1. Two-step modal flow: NavWearButton/WywtRail self-placeholder → WywtPostDialog → (picker with wornTodayIds preflight) → (compose step) → Server Action → toast 'Wear logged'
2. "Change" link returns to Step 1 preserving note + visibility + photo (D-05)
3. Submit-with-no-photo path works (hasPhoto:false → row with photo_url:null)
4. Submit-with-photo path: stripAndResize → uploadWearPhoto → logWearWithPhoto (all in order)
5. Duplicate-day: preflight disables already-worn watches in picker; server 23505 catch returns clear error; orphan Storage cleanup fires
6. Client-direct upload: Server Action `.list()` probe confirms the object exists before insert
7. Sonner "Wear logged" toast fires on success; inline `role="alert"` banner on failure (never both)
8. WYWT rail non-self tile tap still opens WywtOverlay (Phase 10 preserved)
9. LogTodaysWearButton unchanged (quick-log markAsWorn path preserved)
10. All Wave 0 test files (WywtPostDialog.test.tsx + phase15-wywt-photo-flow.test.ts) are green
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-03-SUMMARY.md` documenting:
- A5 smoke result: did `.list()` succeed under session client? If not, what did we fall back to?
- Any deviations from RESEARCH §Pattern 7 code (e.g., different error string, additional validation)
- Caller list for NavWearButton (which Server Components now pass `viewerId`) and the method used
- Total test count added in this plan (should be 25+)
</output>
