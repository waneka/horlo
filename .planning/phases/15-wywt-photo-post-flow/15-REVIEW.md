---
phase: 15-wywt-photo-post-flow
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/app/actions/wearEvents.ts
  - src/app/layout.tsx
  - src/app/wear/[wearEventId]/page.tsx
  - src/components/home/WatchPickerDialog.tsx
  - src/components/home/WywtRail.tsx
  - src/components/layout/NavWearButton.tsx
  - src/components/ui/ThemedToaster.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/components/wear/WearDetailMetadata.tsx
  - src/components/wywt/CameraCaptureView.tsx
  - src/components/wywt/ComposeStep.tsx
  - src/components/wywt/PhotoUploader.tsx
  - src/components/wywt/VisibilitySegmentedControl.tsx
  - src/components/wywt/WristOverlaySvg.tsx
  - src/components/wywt/WywtPostDialog.tsx
  - src/data/wearEvents.ts
  - src/lib/exif/heic-worker.ts
  - src/lib/exif/strip.ts
  - src/lib/storage/wearPhotos.ts
  - src/types/exifr.d.ts
  - tests/components/PhotoUploader.test.tsx
  - tests/components/ThemedToaster.test.tsx
  - tests/components/WristOverlaySvg.test.tsx
  - tests/components/WywtPostDialog.test.tsx
  - tests/integration/phase15-wear-detail-gating.test.ts
  - tests/integration/phase15-wywt-photo-flow.test.ts
  - tests/lib/exif-strip.test.ts
  - tests/lib/storage-path.test.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 15 (WYWT photo post flow) is well-architected and extensively documented. The
threat model is thorough, privacy gates are defense-in-depth (client + Server Action
list probe + DB RLS), and the iOS gesture-context rule (Pitfall 1) is enforced
architecturally by passing the MediaStream as a prop rather than acquired inside
the child. Tests cover both the 9-cell visibility matrix and the Server Action
happy/error paths.

The issues below are quality/correctness concerns — no critical security
vulnerabilities were found. Two warnings worth attention:

1. **Double EXIF strip + re-encode on submit** (WR-01): every photo blob is now
   processed by `stripAndResize` twice — once in PhotoUploader/CameraCaptureView
   and again in `ComposeStep.handleSubmit`. Each canvas round-trip is a lossy
   JPEG re-encode that degrades quality and wastes CPU.
2. **UTC vs local date drift** (WR-02): `today` is computed as
   `new Date().toISOString().split('T')[0]` on both client and server, which is
   UTC. Users near midnight in non-UTC zones will see confusing duplicate-day
   errors and mismatched preflight sets.

## Warnings

### WR-01: Double `stripAndResize` on submit — redundant lossy JPEG re-encode

**File:** `src/components/wywt/ComposeStep.tsx:220-227`
**Issue:** `PhotoUploader` (line 118) and `CameraCaptureView` (line 91) both
already invoke `stripAndResize` before handing the blob to `handlePhotoReady`.
`ComposeStep.handleSubmit` then re-runs `stripAndResize(photoBlob)` on that
already-stripped, already-capped blob. Canvas-based JPEG re-encoding always
decompresses and recompresses, so every submit introduces a second round of
generation-loss artifacts — visible as additional blocking/ringing around high
contrast edges on the uploaded 1080px image. It also wastes 50-300ms of main-
thread CPU per submit.

The docstring at `ComposeStep.tsx:57` already calls this step "(optional)" and
the unit test at `WywtPostDialog.test.tsx:586` (Test 17) explicitly asserts the
order `stripAndResize → uploadWearPhoto → logWearWithPhoto`, so removing the
submit-time strip requires updating that test.

**Fix:** Drop the strip step from submit since upstream handlers guarantee the
blob is already processed. If belt-and-suspenders is desired, short-circuit
when the blob is already <=1080 on the longest edge and already `image/jpeg`.

```tsx
// src/components/wywt/ComposeStep.tsx handleSubmit
if (photoBlob) {
  // Upstream PhotoUploader / CameraCaptureView already ran stripAndResize
  // before calling handlePhotoReady — do not re-encode (double JPEG
  // compression degrades quality).
  const upload = await uploadWearPhoto(viewerId, wearEventId, photoBlob)
  if ('error' in upload) {
    setError('Photo upload failed — please try again.')
    return
  }
}
```

And update Test 17 to remove the `stripOrder < uploadOrder` assertion (the
order becomes `uploadWearPhoto → logWearWithPhoto`, with `stripAndResize`
called once inside the PhotoUploader mock's path).

---

### WR-02: `today` computed from UTC — timezone drift causes duplicate-day false positives

**File:** `src/app/actions/wearEvents.ts:35`, `src/app/actions/wearEvents.ts:153`, `src/components/wywt/WywtPostDialog.tsx:80`
**Issue:** Three call sites compute the wear-event date via
`new Date().toISOString().split('T')[0]`. `toISOString()` always produces UTC,
so for any user in a non-UTC timezone the "today" used for the preflight query,
the DB insert, and the UNIQUE-constraint key drifts from the user's local
calendar day near the UTC day boundary.

Concrete failure: a user in UTC-8 (Pacific) at 5pm local on day D logs a wear.
UTC is already D+1. The wear's `wornDate` is D+1. At 9pm local same day the
user logs a second, different watch — UTC is still D+1 (until 4pm UTC+1 the
next day), so `wornDate = D+1` again. No collision yet.

But consider: at 5pm PT the next day, UTC is D+2. Same watch logged again →
`wornDate = D+2`. Collision with the D+1 row? No — D+2 != D+1. User sees
success.

Real failure: user logs watch W at 11pm PT day D → `wornDate = D+1 UTC`. User
logs the SAME watch W at 9am PT day D+1 → UTC is still D+1 → `wornDate = D+1`
again → 23505 collision → "Already logged this watch today" even though the
user sees two distinct calendar days.

Parallel bug: `WywtPostDialog.tsx:80` computes `today` identically for the
preflight. When the user opens the dialog at 9am PT on D+1, the preflight
returns D+1-UTC hits — which includes the 11pm-PT-day-D wear — so the picker
incorrectly disables the watch as "Worn today" when the user considers it
yesterday's wear.

**Fix:** Use local-date formatting. Either:

```ts
// Helper (new file or inline):
function todayLocalISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
```

Use this for both the preflight `today` in `WywtPostDialog.tsx` AND the
Server Action's `today`. Make a deliberate product decision: is the canonical
"wear day" the user's local day or the actor's server-UTC day? Whichever it
is, client and server MUST agree.

If UTC is intentional (e.g., to avoid a compromised client sending a different
timezone than the server), add a `Phase 15 Decision` doc entry explaining
this; otherwise align on local.

---

### WR-03: `ComposeStep` pre-capture chooser shows "Take wrist shot" but NOT the Upload button visibly

**File:** `src/components/wywt/ComposeStep.tsx:359-373, 379-393`
**Issue:** UI-SPEC §Copywriting Contract and D-06 describe the pre-capture
chooser as having TWO visible buttons: "Take wrist shot" AND "Upload photo".
The current render splits them: the chooser branch (lines 359-373) only
renders "Take wrist shot" plus the "Photo optional" hint, and the
`PhotoUploader` is rendered BELOW, also only when `!photoBlob && !cameraStream`
(so visible in the chooser state).

This technically works — both buttons appear when chooser is active — but the
visual layout groups them awkwardly:

```
┌─ dashed border ──────────┐
│     [Take wrist shot]     │
│     Photo optional        │
└───────────────────────────┘
         [Upload photo]       ← outside the dashed box
```

The dashed-border chooser visually claims the camera button only; Upload sits
orphaned below. UI-SPEC shows them side-by-side inside the same chooser zone.

**Fix:** Move the `PhotoUploader` into the chooser branch (while keeping the
ref-stable sr-only mount for the D-07 `Choose another` re-open path). One
approach: render BOTH buttons inside the dashed box, and keep a separate
hidden/sr-only `PhotoUploader` instance for ref-only usage:

```tsx
{/* PRE-CAPTURE CHOOSER */}
<div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-border rounded-md bg-muted/30">
  <div className="flex gap-2">
    <Button type="button" variant="outline" onClick={handleTapCamera} disabled={pending} className="min-h-11">
      Take wrist shot
    </Button>
    {/* Mirror the PhotoUploader button here — clicking proxies to inputRef */}
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => photoUploaderRef.current?.openPicker()}
      className="min-h-11"
    >
      Upload photo
    </Button>
  </div>
  <p className="text-xs text-muted-foreground">Photo optional</p>
</div>

{/* Always-mounted hidden PhotoUploader — owns the <input type="file"> */}
<div className="sr-only" aria-hidden>
  <PhotoUploader ref={photoUploaderRef} onPhotoReady={handleUploadReady} onError={setError} disabled={pending} />
</div>
```

Alternatively: accept the current layout and update UI-SPEC to document the
intentional stacking.

---

### WR-04: Camera stream leak if user rapidly clicks "Take wrist shot" twice

**File:** `src/components/wywt/ComposeStep.tsx:133-153`
**Issue:** `handleTapCamera` is an async function with `getUserMedia` as the
first await. The button that triggers it is rendered only when
`!photoBlob && !cameraStream` (pre-capture chooser), so a well-behaved click
can't double-fire. BUT: `cameraStream` is still null while `getUserMedia`'s
promise is pending (setState hasn't run yet). A second tap during that window
re-enters `handleTapCamera`, calls `getUserMedia` again, acquires a SECOND
`MediaStream`, and the final `setCameraStream(stream)` keeps whichever call
resolves last. The earlier stream's tracks never stop — LED stays on until
tab close.

Today the button stays rendered during the in-flight first call because React
hasn't yet processed the state transition. On mobile Safari the gesture
resolution is effectively synchronous so this is narrow, but on slower
devices / cold permission-prompt flows it's observable.

**Fix:** Track in-flight state and early-return:

```tsx
const [cameraOpening, setCameraOpening] = useState(false)

const handleTapCamera = async () => {
  if (cameraOpening || cameraStream) return  // guard re-entrance
  setError(null)
  setCameraOpening(true)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ /* ... */ })
    setCameraStream(stream)
    setPhotoSource('camera')
  } catch (err) {
    // ... existing error handling
  } finally {
    setCameraOpening(false)
  }
}
```

Also disable the Take wrist shot button while `cameraOpening`.

---

### WR-05: `logActivity` metadata can be stale after race with watch deletion

**File:** `src/app/actions/wearEvents.ts:128-131, 194-204`
**Issue:** `logWearWithPhoto` fetches the watch at line 128 for the IDOR check,
then runs Storage list-probe, then inserts the wear event, then logs the
activity using `watch.brand / watch.model / watch.imageUrl`. If the watch is
deleted between the `getWatchById` fetch and the activity insert, the
activity row carries stale brand/model metadata. The wear event itself would
also reference a non-existent watch (FK constraint would fire on insert if the
watches row is gone — but soft-deletes or ON DELETE SET NULL could permit it).

This is a narrow race (watch deletion concurrent with wear logging is not a
user-initiated workflow) but flagging because the pattern replicates from
`markAsWorn` which has the same shape.

**Fix:** Two options depending on consistency requirements:

1. Accept the race — document in D-10 that activity metadata is captured at
   log-time, not joined at read-time. This is what it already implicitly does.
2. Move activity logging into the same DB transaction as the wear insert,
   capturing brand/model via JOIN at insert time.

If option 1 is intended (likely — activities are denormalized Phase 12 D-10
snapshots), add a comment at line 194 stating "metadata snapshot reflects the
watch at ownership-check time; stale if deleted mid-flight" so future readers
don't assume it's a join at read.

---

## Info

### IN-01: `needsManualOrientationFix` heuristic is imprecise for landscape EXIF orientations 5-8

**File:** `src/lib/exif/strip.ts:146-163`
**Issue:** The heuristic decides "did createImageBitmap already rotate?" by
checking whether the bitmap looks portrait (h > w). For landscape originals
with orientation 5-8 (which should be displayed as landscape-rotated), the
heuristic's `!looksRotated` returns true on a landscape bitmap even when
createImageBitmap DID auto-orient — double-rotation.

Real-world impact is small because most camera-roll images with orientations
5-8 were captured portrait (hence the rotation tag). The comment at
`strip.ts:150-157` acknowledges the heuristic is approximate, but a user
submitting a tripod-landscape iPhone photo could see a 90° rotation bug on
older iOS Safari.

**Fix:** Either skip the manual rotation fallback entirely (accept that very
old iOS Safari shows wrong orientation) or detect the createImageBitmap-
returns-native-dims case by passing `{ imageOrientation: 'none' }` as a
control and comparing dimensions. The second path is expensive but correct.

Or: accept current trade-off and move this caveat into a comment block near
line 146 that explicitly calls out "landscape originals with rotation tags
may double-rotate on Safari <16.4".

---

### IN-02: Flaky test timing — fixed `setTimeout(0)` loops to await microtasks

**File:** `tests/components/PhotoUploader.test.tsx:148,168,190`
**Issue:** Multiple tests use
`for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))`
to wait for async pipelines to settle. This is a known anti-pattern — under
CI contention the 10 ticks may not be enough, and locally 1 tick is usually
too many.

**Fix:** Use Testing Library's `waitFor` (already imported in
`WywtPostDialog.test.tsx`) or `findBy*` queries which retry until a condition
passes:

```tsx
await waitFor(() => expect(onPhotoReady).toHaveBeenCalled())
```

---

### IN-03: `WywtPostDialog` maintains two state-reset paths that duplicate each other

**File:** `src/components/wywt/WywtPostDialog.tsx:102-133`
**Issue:** `handleOpenChange` resets all state when `next=false`. The
render-time `if (prevOpen !== open) { ... }` block does the SAME reset on the
true→false transition. Both fire for the common case (Dialog's close
affordance calls `onOpenChange(false)` → handleOpenChange resets + calls
parent's `onOpenChange(false)` → parent re-renders with open=false → render-
time block also resets).

Comment at line 114 correctly explains why both exist: path (a) is the
controlled-close via Dialog, path (b) is parent-driven unilateral close.
Functionally correct, but the duplicate reset logic means any future state
addition must be mirrored in both places.

**Fix:** Extract the reset into a helper:

```tsx
const resetDraft = useCallback(() => {
  setStep('picker')
  setSelectedWatchId(null)
  setPhotoBlob(null)
  setNote('')
  setVisibility('public')
  setWornTodayIds(undefined)
}, [])

const handleOpenChange = (next: boolean) => {
  if (!next) resetDraft()
  onOpenChange(next)
}

const [prevOpen, setPrevOpen] = useState(open)
if (prevOpen !== open) {
  setPrevOpen(open)
  if (!open) resetDraft()
}
```

---

### IN-04: `VisibilitySegmentedControl` silently falls back to "Public" for unknown values

**File:** `src/components/wywt/VisibilitySegmentedControl.tsx:66`
**Issue:** `const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[2]`
hides a bug: if an invalid `WearVisibility` string slips through TS (unlikely
given strict mode, but possible via `as any` or JSON parsing), the component
renders "Anyone on Horlo" sub-label silently. The user might not realize
their visibility is mis-set.

**Fix:** TypeScript's discriminated union should prevent this at compile
time. If additional safety is desired, throw in dev:

```tsx
const active = OPTIONS.find((o) => o.value === value)
if (!active) {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Unknown visibility value: ${value}`)
  }
  return null // or render Public as current fallback
}
```

Low priority — TS already enforces the enum.

---

### IN-05: `buildWearPhotoPath` does not validate `userId` shape

**File:** `src/lib/storage/wearPhotos.ts:28-39`
**Issue:** The path builder checks `!userId` (falsy) and validates
`wearEventId` against `UUID_RE`. But `userId` is only required to be
truthy — any string would pass, including `"../other-user/some-file"`. The
Server Action constructs the path server-side from the authenticated user.id
(always a UUID from Supabase), so this is not exploitable in production.
However, `uploadWearPhoto` is called CLIENT-side with a `viewerId` prop
threaded from the Server Component. A compromised client could pass any
string as `viewerId` and the path check would accept it — Storage RLS
(`storage.foldername(name)[1] = auth.uid()::text`) is the real enforcement.

Defense-in-depth: validate userId as UUID here.

**Fix:**

```ts
export function buildWearPhotoPath(userId: string, wearEventId: string): string {
  if (!userId || !UUID_RE.test(userId)) {
    throw new TypeError('userId must be a UUID')
  }
  if (!UUID_RE.test(wearEventId)) {
    throw new TypeError('wearEventId must be a UUID')
  }
  return `${userId}/${wearEventId}.jpg`
}
```

Update `tests/lib/storage-path.test.ts` to use a valid UUID for the user
(current tests use `'user-abc'` etc.).

---

### IN-06: `getWearEventByIdForViewer` runs a second DB query only for followers-visibility path

**File:** `src/data/wearEvents.ts:290-303`
**Issue:** When a row's visibility is `'followers'` and the viewer is
non-null, the DAL runs a second `SELECT follows` round-trip. The single-wear
detail page is a low-traffic endpoint, so this is fine, but for consistency
with `getWearEventsForViewer` (which batches the follow lookup), consider a
LEFT JOIN-based single-query variant.

**Fix:** Optional refactor — `LEFT JOIN follows ON ... WHERE ...` with the
three-tier predicate composed inline. Keep the current two-query shape if
the readability trade-off isn't worth the ~1 round-trip save. Acceptable as
is.

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
