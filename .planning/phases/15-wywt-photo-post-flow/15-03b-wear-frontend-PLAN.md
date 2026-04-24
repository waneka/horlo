---
phase: 15
plan: 03b
type: execute
wave: 3
depends_on: ["15-03a"]
files_modified:
  - src/components/home/WatchPickerDialog.tsx
  - src/components/wywt/WywtPostDialog.tsx
  - src/components/wywt/ComposeStep.tsx
  - src/components/wywt/VisibilitySegmentedControl.tsx
  - src/components/layout/NavWearButton.tsx
  - src/components/home/WywtRail.tsx
  - tests/components/WywtPostDialog.test.tsx
autonomous: true
requirements_addressed:
  - WYWT-01
  - WYWT-02
  - WYWT-03
  - WYWT-04
  - WYWT-07
  - WYWT-08
  - WYWT-16
nyquist_compliant: true
tags: [wywt, dialog, compose, toast, visibility, camera, frontend]

must_haves:
  truths:
    - "Tapping the Wear CTA opens a two-step modal: Step 1 (picker) → Step 2 (compose); selecting a watch advances; 'Change' link returns to Step 1 preserving note+visibility+photo"
    - "Step 1 disables watches that appear in `wornTodayIds` (fetched via getWornTodayIdsForUserAction from Plan 03a when dialog opens) — disabled rows cannot be selected"
    - "Step 2 allows submit with NO photo (photo is optional) — `hasPhoto: false` path inserts row with photo_url=NULL"
    - "Step 2 character counter reads `N/200`; destructive red at 200; maxLength enforced"
    - "Step 2 visibility selector defaults to 'public'; three options with sub-label copy per UI-SPEC"
    - "On submit with photo: client processes via stripAndResize → uploads to Storage → calls logWearWithPhoto (Plan 03a) with hasPhoto=true → Server Action validates object exists → inserts row"
    - "On successful submit: dialog closes, Sonner toast 'Wear logged' appears (Plan 02 Toaster)"
    - "X button (photo preview) removes entirely → returns to pre-capture chooser state; Retake (camera path) re-opens live camera preview with a freshly-acquired MediaStream; Choose another (upload path) re-opens native file picker (D-07 distinction)"
    - "NavWearButton (header + bottom-nav) and WywtRail self-placeholder tile both open WywtPostDialog; LogTodaysWearButton and WywtRail non-self tiles remain unchanged"
  artifacts:
    - path: "src/components/home/WatchPickerDialog.tsx"
      provides: "Extended with optional `onWatchSelected?: (watchId: string) => void` and `wornTodayIds?: ReadonlySet<string>` props; existing markAsWorn path preserved byte-for-byte when onWatchSelected is absent"
      contains: "onWatchSelected"
    - path: "src/components/wywt/WywtPostDialog.tsx"
      provides: "Orchestrator Client Component owning step state, watch selection, wearEventId, photo, note, visibility; Step 1 renders WatchPickerDialog with onWatchSelected; Step 2 renders ComposeStep"
      exports: ["WywtPostDialog"]
    - path: "src/components/wywt/ComposeStep.tsx"
      provides: "Step 2 form: compact watch card header + Change link + photo zone (3 states: chooser / camera-live / preview) + note textarea with 0/200 counter + VisibilitySegmentedControl + submit button; three distinct handlers for X-remove / Retake / Choose-another"
      exports: ["ComposeStep"]
    - path: "src/components/wywt/VisibilitySegmentedControl.tsx"
      provides: "Three-button segmented control: Private / Followers / Public (default Public); active=bg-accent; sub-label row per D-12 copy"
      exports: ["VisibilitySegmentedControl"]
    - path: "src/components/layout/NavWearButton.tsx"
      provides: "Swap lazy import target from WatchPickerDialog to WywtPostDialog; add viewerId prop + plumb from callers"
      contains: "WywtPostDialog"
    - path: "src/components/home/WywtRail.tsx"
      provides: "Self-placeholder tile tap opens WywtPostDialog (was WatchPickerDialog); non-self tile tap unchanged"
      contains: "WywtPostDialog"
    - path: "tests/components/WywtPostDialog.test.tsx"
      provides: "Wave 0 RTL tests for WYWT-01, WYWT-02, WYWT-03, WYWT-07, WYWT-08, WYWT-16, and D-07 three-handler distinction (X / Retake / Choose another)"
      exports: []
  key_links:
    - from: "src/components/wywt/WywtPostDialog.tsx"
      to: "src/components/home/WatchPickerDialog.tsx"
      via: "Step 1 renders <WatchPickerDialog onWatchSelected={...} wornTodayIds={...} />"
      pattern: "onWatchSelected"
    - from: "src/components/wywt/WywtPostDialog.tsx"
      to: "src/app/actions/wearEvents.ts"
      via: "import { getWornTodayIdsForUserAction } from '@/app/actions/wearEvents' (shipped in Plan 03a)"
      pattern: "getWornTodayIdsForUserAction"
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
      via: "await logWearWithPhoto({...}) (shipped in Plan 03a)"
      pattern: "logWearWithPhoto"
    - from: "src/components/wywt/ComposeStep.tsx"
      to: "sonner"
      via: "import { toast } from 'sonner'; toast.success('Wear logged')"
      pattern: "toast.success\\('Wear logged'\\)"
    - from: "src/components/layout/NavWearButton.tsx"
      to: "src/components/wywt/WywtPostDialog.tsx"
      via: "const WywtPostDialog = lazy(() => import('@/components/wywt/WywtPostDialog'))"
      pattern: "wywt/WywtPostDialog"
---

<objective>
Ship the frontend composition layer for the WYWT photo post flow: `WywtPostDialog` orchestrator, `ComposeStep` form (photo zone states + distinct X/Retake/Choose-another handlers + note + visibility + submit), `VisibilitySegmentedControl`, backwards-compatible extension of `WatchPickerDialog` with `onWatchSelected` + `wornTodayIds` props, and call-site routing updates in `NavWearButton` + `WywtRail`.

Purpose: This plan consumes every server-side contract shipped by Plan 03a (`logWearWithPhoto`, `getWornTodayIdsForUserAction`) and every primitive shipped by Plan 01 (`stripAndResize`, `uploadWearPhoto`, `PhotoUploader`, `CameraCaptureView`, `WristOverlaySvg`) and Plan 02 (`<ThemedToaster />`). With 03a ordered before 03b (waves 2→3), `npx tsc --noEmit` succeeds on first commit because all imported symbols already exist.

Output: Seven source files + one Wave 0 test file with 15+ RTL tests. Full WYWT-01/02/03/04/07/08/16 acceptance (WYWT-12 + WYWT-15 integration tests are in Plan 03a; Plan 03b exercises them from the UI path). After this plan ships, users can post a wear event with a photo from NavWearButton or WywtRail.

## Decision coverage (for this plan)
- D-01 (step state machine) → Task 2 WywtPostDialog
- D-02 (WatchPickerDialog onWatchSelected) → Task 1
- D-03 (wornTodayIds preflight fetch from client) → Task 2
- D-04 (call-site routing) → Task 4 NavWearButton + WywtRail
- D-05 (Change link preserves state) → Task 2 + Task 3
- D-06 / D-07 (photo zone states — X vs Retake vs Choose-another distinction) → Task 3 ComposeStep (three distinct handlers)
- D-11 (note 200-char) → Task 3 ComposeStep
- D-12 (visibility selector + sub-label) → Task 3 VisibilitySegmentedControl
- D-18 (Logging… UX) → Task 3
- D-19 (toast on success) → Task 3 (via Plan 02 Toaster; Plan 03a handled revalidatePath)
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
@.planning/phases/15-wywt-photo-post-flow/15-03a-SUMMARY.md
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files the executor will read/modify:
@src/components/home/WatchPickerDialog.tsx
@src/components/home/WywtRail.tsx
@src/components/layout/NavWearButton.tsx
@src/lib/auth.ts
@src/lib/actionTypes.ts
@src/lib/wearVisibility.ts

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

From Plan 03a (already built — this plan depends on it — consume directly):
```typescript
// src/app/actions/wearEvents.ts
export async function logWearWithPhoto(input: {
  wearEventId: string
  watchId: string
  note: string | null
  visibility: WearVisibility
  hasPhoto: boolean
}): Promise<ActionResult<{ wearEventId: string }>>

export async function getWornTodayIdsForUserAction(
  input: { userId: string; today: string }
): Promise<string[]>  // array; client converts to Set
```

From existing codebase (verified):
```typescript
// src/lib/actionTypes.ts
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// src/lib/wearVisibility.ts
export type WearVisibility = 'public' | 'followers' | 'private'
```

NEW contracts this plan creates:

```typescript
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
  onSubmitted: () => void  // close dialog after toast
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
  <name>Task 1: Extend WatchPickerDialog with onWatchSelected + wornTodayIds props (backwards-compatible)</name>
  <files>src/components/home/WatchPickerDialog.tsx, tests/components/WywtPostDialog.test.tsx</files>
  <read_first>
    - src/components/home/WatchPickerDialog.tsx (current 189-line file — understand list render at lines 141-160 and handleSubmit at 70-84)
    - RESEARCH.md §Pattern 3 — WatchPickerDialog prop extension (backwards-compatible patch)
    - CONTEXT.md D-02, D-03
    - UI-SPEC.md §Interaction Contracts → "Step 1: PICKER" section
    - UI-SPEC.md §Copywriting Contract "Worn today" micro-label
    - UI-SPEC.md §Accessibility Contract — aria-disabled on worn-today rows
    - tests/components/home/ (look for existing WatchPickerDialog test if any — search with Grep first)
  </read_first>
  <behavior>
    - Test 1 (backwards-compat): Without `onWatchSelected` + `wornTodayIds` props, existing behavior byte-identical: selecting + clicking "Log wear" calls markAsWorn and closes. (Snapshot/spy test via mocked markAsWorn.)
    - Test 2: With `onWatchSelected` provided: clicking "Log wear" calls `onWatchSelected(watchId)` and does NOT call `markAsWorn`.
    - Test 3: With `wornTodayIds = new Set(['watch-a'])`, the watch-a row renders with `aria-disabled="true"` and `opacity-50` class and contains "Worn today" text; clicking it does not set selection (selectedId remains null).
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

    Step 2 — Create `tests/components/WywtPostDialog.test.tsx` with the 3 WatchPickerDialog extension tests above as the first block in the file. (Tasks 2 and 3 will append more tests to the same file.)

    Step 3 — Verify no regression in existing callers:
    ```bash
    grep -rn "WatchPickerDialog" src/ --include='*.tsx' --include='*.ts'
    ```
    Confirm each existing caller (NavWearButton, WywtRail, LogTodaysWearButton) still compiles without passing the new optional props (backwards compatibility).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run test -- tests/components/WywtPostDialog.test.tsx</automated>
  </verify>
  <done>
    - `WatchPickerDialog` Props interface has `onWatchSelected?: (watchId: string) => void` and `wornTodayIds?: ReadonlySet<string>` (optional, with JSDoc)
    - `handleSubmit` calls `onWatchSelected(selectedId)` and returns BEFORE `startTransition` when prop is present
    - Worn-today rows render with `aria-disabled="true"`, `disabled` attribute, opacity-50, and "Worn today" text
    - 3 tests in `tests/components/WywtPostDialog.test.tsx` for WatchPickerDialog extension pass
    - `npx tsc --noEmit` exits 0
    - Existing `tests/integration/home-privacy.test.ts` still passes (no regression)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build WywtPostDialog orchestrator (two-step state machine, preflight fetch via Plan 03a Server Action, preserved form state on Change)</name>
  <files>src/components/wywt/WywtPostDialog.tsx, src/components/wywt/ComposeStep.tsx, tests/components/WywtPostDialog.test.tsx</files>
  <read_first>
    - src/components/home/WatchPickerDialog.tsx (just extended in Task 1; understand the Props shape)
    - src/app/actions/wearEvents.ts (Plan 03a shipped `getWornTodayIdsForUserAction` — confirm it's exported)
    - RESEARCH.md §Pattern 1 — Lazy-loaded dialog wrapper
    - RESEARCH.md §Pattern 2 — Two-step state machine with preserved form state (full code example)
    - CONTEXT.md D-01 (step state), D-03 (wornTodayIds prop), D-05 (Change link preserves state)
    - UI-SPEC.md §Interaction Contracts → "Step 1: PICKER" + "Step 2: COMPOSE"
    - VALIDATION.md rows WYWT-01, WYWT-02
    - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (Server Actions + startTransition + mutations pattern — confirms the shape for calling getWornTodayIdsForUserAction from a Client Component)
  </read_first>
  <behavior>
    - Test 4 (WYWT-01): Rendering `<WywtPostDialog open={true} ownedWatches={[mockWatchA, mockWatchB]} viewerId="u1" />` shows the picker (Step 1) first; selecting watchA advances to Step 2 (ComposeStep renders with watchA).
    - Test 5 (WYWT-02): From Step 2, clicking "Change" returns to Step 1; `selectedWatchId` is cleared; `note`, `visibility`, `photoBlob` state is preserved (assert via ComposeStep mock receiving the same prop values on re-render after watch re-selection).
    - Test 6 (preflight): On open, WywtPostDialog calls `getWornTodayIdsForUserAction({userId, today})` (mocked); resulting array is converted to a Set and passed to WatchPickerDialog's `wornTodayIds` prop.
    - Test 7 (wearEventId stability): `wearEventId` is generated once per open session (useMemo with `open` dep); stays stable across step transitions within the same open; regenerates on next open.
    - Test 8 (close): Closing the dialog resets all state (watch selection, note, visibility to 'public', photo).
  </behavior>
  <action>
    Step 1 — Create `src/components/wywt/WywtPostDialog.tsx` Client Component. IMPORTANT: import `getWornTodayIdsForUserAction` directly from `@/app/actions/wearEvents` (not from a DAL path). Plan 03a shipped this Server Action wrapper — Plan 03b consumes it. Convert the returned `string[]` to a `Set` inline:
    ```tsx
    'use client'

    import { useState, useMemo, useEffect } from 'react'
    import { Dialog, DialogContent } from '@/components/ui/dialog'
    import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
    import { ComposeStep } from './ComposeStep'
    import { getWornTodayIdsForUserAction } from '@/app/actions/wearEvents'
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
     * getWornTodayIdsForUserAction (Plan 03a Server Action wrapper around the
     * DAL helper) and pass the resulting watch-id Set to the picker so already-
     * worn watches render disabled. The Server Action returns string[] (Server
     * Actions cannot serialize Set); we convert to Set here for the picker prop.
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
      // catch (Plan 03a) is the safety net.
      useEffect(() => {
        if (!open) return
        let cancelled = false
        const today = new Date().toISOString().split('T')[0]
        getWornTodayIdsForUserAction({ userId: viewerId, today })
          .then((ids) => {
            if (!cancelled) setWornTodayIds(new Set(ids))
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

    IMPORTANT — this code block imports `getWornTodayIdsForUserAction` DIRECTLY (no rename step, no mid-task refactor). The Server Action was shipped in Plan 03a; by execution-order (Plan 03a is Wave 2, Plan 03b is Wave 3), the symbol is already exported when this code is first written to disk. `npx tsc --noEmit` passes on first commit.

    Step 2 — Create a ComposeStep STUB at `src/components/wywt/ComposeStep.tsx` that just exports a component returning null. This unblocks tsc + running Task 2's WywtPostDialog tests before Task 3 writes the full implementation. Stub body:
    ```tsx
    'use client'
    import type { JSX } from 'react'
    import type { Watch } from '@/lib/types'
    import type { WearVisibility } from '@/lib/wearVisibility'
    export function ComposeStep(_props: {
      watch: Watch
      viewerId: string
      wearEventId: string
      photoBlob: Blob | null
      setPhotoBlob: (b: Blob | null) => void
      note: string
      setNote: (s: string) => void
      visibility: WearVisibility
      setVisibility: (v: WearVisibility) => void
      onChange: () => void
      onSubmitted: () => void
    }): JSX.Element {
      return null as unknown as JSX.Element
    }
    ```

    Step 3 — Append to `tests/components/WywtPostDialog.test.tsx` the 5 tests for behaviors 4-8. Mock:
    - `@/components/home/WatchPickerDialog` — render a simple `<button data-testid="select-watch-a" onClick={() => props.onWatchSelected?.('watch-a')}>` + a marker showing `wornTodayIds` size
    - `@/components/wywt/ComposeStep` — render a component exposing props via data-attributes (`data-note`, `data-visibility`, `data-photo-present`) + a "Change" button that calls `onChange`
    - `@/app/actions/wearEvents` — mock `getWornTodayIdsForUserAction` to return `Promise.resolve(['watch-b'])`
  </action>
  <verify>
    <automated>npm run test -- tests/components/WywtPostDialog.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - `src/components/wywt/WywtPostDialog.tsx` exports `WywtPostDialog` Client Component with the exact prop signature in <interfaces>
    - Import statement: `import { getWornTodayIdsForUserAction } from '@/app/actions/wearEvents'` (direct import of Plan 03a symbol; NO intermediate DAL import, NO mid-task rename)
    - Step machine transitions: picker → compose via `onWatchSelected`; compose → picker via `onChange` with photo/note/visibility preserved
    - `wearEventId` generated via `crypto.randomUUID()` in `useMemo` with `open` dep — stable within a single open, regenerates across opens
    - Preflight calls `getWornTodayIdsForUserAction` and converts array → Set; gracefully handles failure by leaving `wornTodayIds` undefined
    - Closing the dialog resets all state
    - ComposeStep stub exists at `src/components/wywt/ComposeStep.tsx` (Task 3 replaces it)
    - 5 tests in `tests/components/WywtPostDialog.test.tsx` covering behaviors 4-8 all GREEN
    - `npx tsc --noEmit` exits 0 (no missing imports — Plan 03a symbols are already committed)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build ComposeStep + VisibilitySegmentedControl — D-07 three-handler split (X remove / Retake / Choose another), photo zone states, note counter, visibility, submit with toast</name>
  <files>src/components/wywt/VisibilitySegmentedControl.tsx, src/components/wywt/ComposeStep.tsx, tests/components/WywtPostDialog.test.tsx</files>
  <read_first>
    - src/components/wywt/PhotoUploader.tsx (Plan 01 Task 2 — note: PhotoUploader wraps its own <input type="file"> inside a <label>; Plan 03b needs a REF to the underlying input to programmatically re-open the picker on "Choose another". See Step 1.5 below for the minor extension.)
    - src/components/wywt/CameraCaptureView.tsx (Plan 01 Task 3 — takes `stream: MediaStream` prop)
    - src/components/wywt/WristOverlaySvg.tsx (Plan 01 Task 3)
    - src/lib/exif/strip.ts (Plan 01 Task 1)
    - src/lib/storage/wearPhotos.ts (Plan 01 Task 3)
    - src/app/actions/wearEvents.ts (Plan 03a — logWearWithPhoto export)
    - src/components/home/WatchPickerDialog.tsx (for layout conventions — DialogTitle/DialogContent wrapping, "Keep browsing" cancel copy)
    - src/components/preferences/PreferencesClient.tsx (look up: role="alert" inline-error pattern from DEBT-01)
    - RESEARCH.md §Pattern 8 — Sonner toast from Client Component (full submit handler example)
    - RESEARCH.md §Pitfall 1 — iOS gesture rule (getUserMedia FIRST in tap handler)
    - RESEARCH.md §Pitfall 2 — MediaStream cleanup
    - RESEARCH.md §Pitfall 3 — permission denied UX
    - CONTEXT.md D-05 (watch card + Change link), D-06 (pre-capture chooser), **D-07 (photo section AFTER capture — X button removes entirely → chooser; Retake re-opens live camera; Choose another re-opens file picker — THREE DISTINCT BEHAVIORS)**, D-11 (note counter), D-12 (visibility sub-labels), D-18 (Logging… UX), D-19 (post-submit toast)
    - UI-SPEC.md §Interaction Contracts → Step 2: COMPOSE (full layout spec — lines 139-141 state "X button removes photo and returns to pre-capture state; text link below reads 'Retake' (camera path) or 'Choose another' (upload path)")
    - UI-SPEC.md §VisibilitySegmentedControl (button + icon + sub-label copy)
    - UI-SPEC.md §Copywriting Contract — EVERY copy string for compose step, explicitly including "Retake" (D-07 camera path) + "Choose another" (D-07 upload path)
    - UI-SPEC.md §Accessibility Contract — aria-label requirements
    - UI-SPEC.md §Color — accent use (only active segmented button + Change link)
    - UI-SPEC.md §Typography — character counter typography + destructive at 200
    - VALIDATION.md rows WYWT-03, WYWT-07, WYWT-08, WYWT-16
    - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (Server Action + startTransition + ActionResult pattern — confirms the submit-handler shape calling logWearWithPhoto inside startTransition)
  </read_first>
  <behavior>
    VisibilitySegmentedControl:
    - Test 9: Renders 3 buttons labeled "Private" / "Followers" / "Public" each with an icon (Lock / Users / Globe2). Default value='public' shows Public as pressed (`aria-pressed="true"`, `bg-accent`).
    - Test 10: Clicking Followers fires `onChange('followers')`; the sub-label row updates to "Followers — people who follow you".
    - Test 11: Sub-label copy matches UI-SPEC exactly: Private → "Only you"; Followers → "Followers — people who follow you"; Public → "Anyone on Horlo".

    ComposeStep — core flow:
    - Test 12 (WYWT-03): Rendered with `photoBlob=null`; submit button is enabled (no-photo path valid); clicking submit triggers `logWearWithPhoto` with `hasPhoto: false`.
    - Test 13 (WYWT-07): Typing "hello" in note textarea updates counter to `5/200`; at 200 chars the counter text has `text-destructive` class; 201st keypress is blocked by maxLength.
    - Test 14 (WYWT-08): Initial visibility is 'public'; changing to 'followers' + submit → `logWearWithPhoto` called with `visibility: 'followers'`.
    - Test 15 (WYWT-16): On successful submit (mocked action returns `{success:true, data:{wearEventId}}`), `toast.success('Wear logged')` is called and `onSubmitted()` fires.
    - Test 16 (error surfacing): Mocked action returns `{success:false, error:'Already logged this watch today'}` → inline `role="alert"` banner shows the error string; `toast.success` is NOT called.
    - Test 17 (photo submit path order): With `photoBlob` set, submit path calls `stripAndResize` → `uploadWearPhoto` → `logWearWithPhoto({hasPhoto:true})` in order (verified via mock call order).

    ComposeStep — D-07 three-handler distinction (NEW tests — WARNING-07):
    - Test 18 (X button removes entirely): Seed `photoBlob=<jpeg>`, `photoSource='camera'`. Click the X button → `setPhotoBlob(null)` is called AND `setPhotoSource(null)` → the pre-capture chooser re-renders ("Take wrist shot" + Upload Photo buttons both visible). Same assertion with `photoSource='upload'` — X button returns to chooser from BOTH sources.
    - Test 19 (Retake re-opens live camera): Seed `photoBlob=<jpeg>`, `photoSource='camera'`. Click "Retake" link → `setPhotoBlob(null)` AND `navigator.mediaDevices.getUserMedia` is INVOKED AGAIN (not the pre-capture chooser; directly to live preview). `photoSource` remains 'camera'. Mock `getUserMedia` returns a fresh MediaStream; assert the `<CameraCaptureView>` mock receives this new stream.
    - Test 20 (Choose another re-opens file picker): Seed `photoBlob=<jpeg>`, `photoSource='upload'`. Click "Choose another" link → `setPhotoBlob(null)` AND the file-input element's `.click()` is called programmatically (via the ref passed to PhotoUploader). The pre-capture chooser does NOT re-render; the native file picker would open in a real browser. Assert via a spy on `HTMLInputElement.prototype.click` OR a PhotoUploader mock that records when its forwarded `click()` was invoked.
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

    Step 1.5 — Minor extension to `PhotoUploader` to support "Choose another" programmatic re-open. Plan 01 Task 2 built PhotoUploader with an internal `<input type="file">`. For D-07's "Choose another" to re-open the file picker, ComposeStep needs to programmatically call `.click()` on that input. Two options (executor picks one):
    - **Option A (preferred — minor API extension)**: Extend PhotoUploader's API with a forwarded ref or an imperative handle:
      ```tsx
      export const PhotoUploader = React.forwardRef<{ openPicker: () => void }, PhotoUploaderProps>(...)
      ```
      exposing `openPicker()` that calls the internal `inputRef.current?.click()`. ComposeStep holds a `useRef` and calls `.current?.openPicker()` in `handleChooseAnother`. Document this extension in the 15-03b-SUMMARY.md.
    - **Option B (simpler but uglier)**: ComposeStep renders its OWN hidden `<input type="file">` as the "Choose another" re-open target, separate from PhotoUploader's internal input. Duplicate the HEIC detection + stripAndResize pipeline inline. Not preferred (duplicates Plan 01 logic).

    Use Option A. Add a one-line note in 15-03b-SUMMARY.md that PhotoUploader was extended with forwardRef + useImperativeHandle.

    Step 2 — Replace the ComposeStep stub at `src/components/wywt/ComposeStep.tsx` with the full implementation. CRITICAL: D-07 requires THREE distinct handlers — DO NOT wire X, Retake, and Choose-another all to `handleRemovePhoto`. Structure:

    ```tsx
    'use client'
    import { useState, useRef, useMemo, useEffect, useTransition } from 'react'
    import { toast } from 'sonner'
    import { X } from 'lucide-react'
    import { DialogTitle } from '@/components/ui/dialog'
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
    }: {
      watch: Watch
      viewerId: string
      wearEventId: string
      photoBlob: Blob | null
      setPhotoBlob: (b: Blob | null) => void
      note: string
      setNote: (s: string) => void
      visibility: WearVisibility
      setVisibility: (v: WearVisibility) => void
      onChange: () => void
      onSubmitted: () => void
    }) {
      const [pending, startTransition] = useTransition()
      const [error, setError] = useState<string | null>(null)
      const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
      const [photoSource, setPhotoSource] = useState<'camera' | 'upload' | null>(null)
      const photoUploaderRef = useRef<{ openPicker: () => void } | null>(null)

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

      // Common callback from PhotoUploader / CameraCaptureView when a processed
      // JPEG blob is ready. Stops any active camera stream, stores the blob.
      const handlePhotoReady = (jpeg: Blob) => {
        setPhotoBlob(jpeg)
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop())
          setCameraStream(null)
        }
      }

      // PhotoUploader success path sets photoSource to 'upload'.
      const handleUploadReady = (jpeg: Blob) => {
        setPhotoSource('upload')
        handlePhotoReady(jpeg)
      }

      // D-07 handler #1: X button (on photo preview) → remove photo ENTIRELY,
      // return to the pre-capture chooser regardless of source. Applies to
      // both camera and upload paths.
      const handleRemovePhoto = () => {
        setPhotoBlob(null)
        setPhotoSource(null)
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop())
          setCameraStream(null)
        }
      }

      // D-07 handler #2: Retake link (camera path only) → discard current
      // photo and RE-ACQUIRE a fresh MediaStream, returning directly to the
      // live camera preview (NOT the pre-capture chooser). photoSource
      // remains 'camera' throughout. Re-uses handleTapCamera for the
      // getUserMedia call (iOS gesture is still active — link tap counts).
      const handleRetake = async () => {
        setPhotoBlob(null)
        // keep photoSource='camera' so the UI state stays on the camera branch
        await handleTapCamera()
      }

      // D-07 handler #3: Choose another link (upload path only) → discard
      // current photo and programmatically re-open the native file picker
      // via the PhotoUploader ref. Does NOT return to the chooser state;
      // the file picker opens directly. photoSource remains 'upload'.
      const handleChooseAnother = () => {
        setPhotoBlob(null)
        // keep photoSource='upload' so the UI renders the photo zone's upload
        // branch if the user cancels the file picker
        photoUploaderRef.current?.openPicker()
      }

      // Cancel button on the camera live preview — stops stream, returns to
      // pre-capture chooser (different from Retake: no photo was ever captured).
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
            // H-2: toast from Client Component only (Plan 03a Server Action does NOT import sonner)
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

          {/* Photo section — 3 states: pre-capture chooser / camera-live / preview */}
          {photoBlob ? (
            /* POST-CAPTURE PREVIEW — D-07 three-handler layout */
            <div className="relative">
              <img
                src={photoPreviewUrl ?? ''}
                alt="Wear photo preview"
                className="w-full rounded-md object-cover"
              />
              {/* D-07 X button: remove entirely → pre-capture chooser */}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={handleRemovePhoto}
                disabled={pending}
                className="absolute top-2 right-2 size-11 flex items-center justify-center rounded-full bg-background/80 hover:bg-background"
              >
                <X className="size-4" aria-hidden />
              </button>
              {/* D-07 Retake OR Choose another — mutually exclusive by photoSource */}
              {photoSource === 'camera' ? (
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={pending}
                  className="mt-2 text-xs font-semibold text-accent underline"
                >
                  Retake
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleChooseAnother}
                  disabled={pending}
                  className="mt-2 text-xs font-semibold text-accent underline"
                >
                  Choose another
                </button>
              )}
            </div>
          ) : cameraStream ? (
            /* CAMERA LIVE PREVIEW */
            <CameraCaptureView
              stream={cameraStream}
              onPhotoReady={handlePhotoReady}
              onError={(m) => { setError(m); handleCancelCamera() }}
              onCancel={handleCancelCamera}
              disabled={pending}
            />
          ) : (
            /* PRE-CAPTURE CHOOSER */
            <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-border rounded-md bg-muted/30">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleTapCamera} disabled={pending} className="min-h-11">
                  Take wrist shot
                </Button>
                <PhotoUploader
                  ref={photoUploaderRef}
                  onPhotoReady={handleUploadReady}
                  onError={setError}
                  disabled={pending}
                />
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

    Notes:
    - The "Keep browsing" button in the footer and the "Change" button in the header both call `onChange`. If the executor wants to distinguish them semantically (Keep browsing = close dialog; Change = back to picker), add a second prop `onDismiss?: () => void` and wire footer button to it. For now, both calling `onChange` is acceptable per the existing WywtPostDialog state machine (Change returns to picker, which already allows closing from picker).
    - `handleRetake` calls `handleTapCamera` which invokes `getUserMedia`. iOS Safari requires the getUserMedia call to be on a direct gesture handler, NOT after awaits. Clicking "Retake" IS a user gesture — the first (and only) await in `handleTapCamera` is `getUserMedia` itself, so the gesture context is preserved. Verified by Test 19.
    - `handleChooseAnother` calls `photoUploaderRef.current?.openPicker()` which calls `inputRef.current?.click()` inside PhotoUploader. Browsers require `.click()` on a file input to be inside a user-gesture handler — a link click IS a gesture, so this works. Verified by Test 20.

    Step 3 — Append Wave 0 tests for behaviors 9-20 to `tests/components/WywtPostDialog.test.tsx`. Mock:
    - `@/lib/exif/strip` — stripAndResize returns `{blob: mockBlob, width:1080, height:720}`
    - `@/lib/storage/wearPhotos` — uploadWearPhoto returns `{path: 'u/w.jpg'}`
    - `@/app/actions/wearEvents` — logWearWithPhoto returns `{success:true, data:{wearEventId:'w-uuid'}}` by default; override per-test for error paths; ALSO mock getWornTodayIdsForUserAction from this module for the WywtPostDialog preflight path
    - `sonner` — `toast.success` is a vi.fn spied on
    - `@/components/wywt/PhotoUploader` — render a mock that accepts `ref` (forwardRef) and exposes `openPicker: vi.fn()` via useImperativeHandle; also render a `<button data-testid="simulate-upload" onClick={() => props.onPhotoReady(mockBlob)}>`
    - `@/components/wywt/CameraCaptureView` — render a mock receiving `stream` prop + `<button data-testid="simulate-capture" onClick={() => props.onPhotoReady(mockBlob)}>`
    - `navigator.mediaDevices.getUserMedia` — `vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream)` for camera + retake tests

    For D-07 tests 18/19/20, the key assertions:
    ```typescript
    // Test 19 (Retake)
    const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValueOnce(mockStream1)  // initial Take wrist shot
      .mockResolvedValueOnce(mockStream2)  // Retake re-acquisition
    // ... interact: tap camera → capture → click Retake
    expect(getUserMediaSpy).toHaveBeenCalledTimes(2)  // proves Retake re-invoked getUserMedia
    // Also assert CameraCaptureView mock received mockStream2 after Retake

    // Test 20 (Choose another)
    const openPickerMock = vi.fn()
    vi.mock('@/components/wywt/PhotoUploader', () => ({
      PhotoUploader: React.forwardRef((props, ref) => {
        React.useImperativeHandle(ref, () => ({ openPicker: openPickerMock }))
        return <button data-testid="simulate-upload" onClick={() => props.onPhotoReady(mockBlob)} />
      }),
    }))
    // ... interact: upload photo → click Choose another
    expect(openPickerMock).toHaveBeenCalledTimes(1)  // proves re-open was triggered
    ```
  </action>
  <verify>
    <automated>npm run test -- tests/components/WywtPostDialog.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - `src/components/wywt/VisibilitySegmentedControl.tsx` renders 3 buttons with the exact icons (Lock/Users/Globe2) + sub-label row; default 'public' visually active (bg-accent)
    - `src/components/wywt/ComposeStep.tsx` has THREE DISTINCT handlers wired to their respective UI elements:
      - X button → `handleRemovePhoto` (clears blob+source, returns to chooser)
      - Retake link (camera path) → `handleRetake` (clears blob, re-calls handleTapCamera → re-acquires MediaStream → live preview)
      - Choose another link (upload path) → `handleChooseAnother` (clears blob, programmatically clicks file input via PhotoUploader ref)
    - Submit path with no photo works; with photo runs stripAndResize → uploadWearPhoto → logWearWithPhoto in order
    - `toast.success('Wear logged')` is called on success (exact string); NO `toast()` anywhere else (failure path uses inline `role="alert"` banner only)
    - Note textarea has `maxLength={200}`; counter at 200 renders with `text-destructive` + `font-semibold`
    - Camera tap handler calls `getUserMedia` as first await with `facingMode: 'environment'`; caught `NotAllowedError` surfaces the exact UI-SPEC copy "Camera access denied — use Upload photo instead."
    - PhotoUploader extended with forwardRef + useImperativeHandle exposing `openPicker()` — documented in SUMMARY
    - All 12+ tests for behaviors 9-20 in `tests/components/WywtPostDialog.test.tsx` GREEN; specifically Tests 18/19/20 verify the D-07 three-handler distinction
    - `grep -rn "handleRemovePhoto" src/components/wywt/ComposeStep.tsx` returns exactly 2 matches (declaration + X button `onClick`) — NOT wired to Retake or Choose another buttons
  </done>
</task>

<task type="auto">
  <name>Task 4: Swap call sites — NavWearButton + WywtRail now open WywtPostDialog (NOT WatchPickerDialog)</name>
  <files>src/components/layout/NavWearButton.tsx, src/components/home/WywtRail.tsx</files>
  <read_first>
    - src/components/layout/NavWearButton.tsx (full file — understand lazy + Suspense pattern; note: currently does NOT receive viewerId)
    - src/components/home/WywtRail.tsx (full file — understand self-placeholder vs non-self branching; WywtRail has `data.viewerId` from WywtRailData)
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
               viewerId={viewerId}
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

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client JS → DOM (Sonner portal) | Toast message is a static literal; note rendering via React escaping |
| Client JS → MediaDevices | getUserMedia on gesture context only |
| Client → Server Action | Handled in Plan 03a (zod validation, auth, hasPhoto existence probe) |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-01 | D (Camera gesture DoS — iOS Safari rejects getUserMedia after await) | MED | ComposeStep handleTapCamera / handleRetake | Both handlers are gesture-triggered (button tap + link tap) with `getUserMedia` as the FIRST await — verified by Test 19. No setState or props access before the await. |
| T-15-10 | D (MediaStream leaked — camera LED stays on) | LOW | ComposeStep | `handleRemovePhoto`, `handleCancelCamera`, and submit path all stop tracks before clearing `cameraStream`. CameraCaptureView unmount effect also stops tracks (defense in depth). |
| T-15-27 | I (Duplicate-day error string surfaced in inline banner) | LOW | ComposeStep error state | Error string comes from Plan 03a Server Action — static UX message "Already logged this watch today". Not a security boundary. The user who just attempted the insert already knows the watch exists in their collection. (Renumbered from T-15-07 to avoid collision with Plan 04's T-15-07 = "Photo existence leak via response differential" per RESEARCH §Security Domain canonical numbering.) |
| T-15-28 | T (D-07 handler confusion — clicking Retake silently reverts to file picker, or Choose another re-opens camera) | LOW | ComposeStep | Three distinct handlers (`handleRemovePhoto`, `handleRetake`, `handleChooseAnother`) wired to three distinct UI elements. Tests 18/19/20 verify the distinction. Clicking Retake after camera capture calls `getUserMedia` again; clicking Choose another after upload calls `inputRef.click()`. No cross-wiring. |
</threat_model>

<verification>
## Plan-Level Verification

- `npx tsc --noEmit` exits 0 (critical — Plan 03a symbols MUST already be present)
- `npm run lint` exits 0
- `npm run test -- tests/components/WywtPostDialog.test.tsx` — all 20+ tests pass
- `npm run test` full suite green (no regression in existing tests)
- `grep -rn "WatchPickerDialog" src/components/layout/` returns 0 matches
- `grep -rn "WywtPostDialog" src/components/` returns ≥ 3 matches (NavWearButton, WywtRail, WywtPostDialog itself)
- `grep -rn "toast(" src/app/actions/` returns 0 matches (Pitfall H-2 enforced — Plan 03a invariant, Plan 03b does not weaken)
- `grep -rn "import heic2any" src/ | grep -v heic-worker` returns 0 matches (Pitfall E-1 enforced from Plan 01)
- `grep -rn "handleRemovePhoto\|handleRetake\|handleChooseAnother" src/components/wywt/ComposeStep.tsx` returns ≥ 3 unique function definitions
- LogTodaysWearButton unchanged — `git diff HEAD src/components/profile/LogTodaysWearButton.tsx` is empty
- WywtOverlay and WywtSlide UNCHANGED (Phase 10 pattern preserved per WYWT-18)
</verification>

<success_criteria>
## Plan Success Criteria

1. Two-step modal flow: NavWearButton/WywtRail self-placeholder → WywtPostDialog → (picker with wornTodayIds preflight via Plan 03a action) → (compose step) → Plan 03a Server Action → toast 'Wear logged' (Plan 02 Toaster)
2. "Change" link returns to Step 1 preserving note + visibility + photo (D-05)
3. Submit-with-no-photo path works (hasPhoto:false → row with photo_url:null)
4. Submit-with-photo path: stripAndResize → uploadWearPhoto → logWearWithPhoto (all in order)
5. D-07 three-handler distinction: X button → pre-capture chooser; Retake → live camera; Choose another → file picker (Tests 18/19/20 verify)
6. Sonner "Wear logged" toast fires on success; inline `role="alert"` banner on failure (never both)
7. WYWT rail non-self tile tap still opens WywtOverlay (Phase 10 preserved)
8. LogTodaysWearButton unchanged (quick-log markAsWorn path preserved)
9. All Wave 0 tests in `tests/components/WywtPostDialog.test.tsx` (20+ tests) are green
10. `npx tsc --noEmit` passes on every task commit (Plan 03a symbols are already present)
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-03b-SUMMARY.md` documenting:
- Which PhotoUploader extension path was taken (forwardRef + useImperativeHandle is the recommended Option A)
- Caller list for NavWearButton (which Server Components now pass `viewerId`) and the method used
- Total test count added in this plan (should be 18+ — Task 1's 3 + Task 2's 5 + Task 3's 12)
- Any deviations from D-07 three-handler spec
- Any deviations from the RESEARCH §Pattern 2 state-machine example
</output>
