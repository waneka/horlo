---
phase: 15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - src/lib/exif/strip.ts
  - src/lib/exif/heic-worker.ts
  - src/lib/storage/wearPhotos.ts
  - src/components/wywt/PhotoUploader.tsx
  - src/components/wywt/CameraCaptureView.tsx
  - src/components/wywt/WristOverlaySvg.tsx
  - tests/lib/exif-strip.test.ts
  - tests/lib/storage-path.test.ts
  - tests/components/PhotoUploader.test.tsx
autonomous: true
requirements_addressed:
  - WYWT-04
  - WYWT-05
  - WYWT-06
nyquist_compliant: true
tags: [photo, exif, worker, camera, upload, wywt]

must_haves:
  truths:
    - "A canvas-reencoded JPEG from any uploaded/captured image is 1080px max on the longest edge and contains NO EXIF tags"
    - "HEIC files converted via a Web Worker; heic2any WASM is emitted as a SEPARATE chunk (verified via Turbopack dev build)"
    - "Camera capture path uses getUserMedia as the FIRST await on the user-gesture tap handler (no preceding await)"
    - "MediaStream tracks stopped on every exit path (unmount, X-button remove, capture-complete)"
    - "Uploaded blob reaches Supabase Storage at path {userId}/{wearEventId}.jpg; RLS blocks cross-user path writes"
    - "WristOverlaySvg renders in viewBox=0 0 100 100 with percentage geometry (two arm lines, two concentric circles, hands at 10:10, crown at 3 o'clock, nothing else)"
  artifacts:
    - path: "src/lib/exif/strip.ts"
      provides: "stripAndResize(input: Blob, maxDim?: number, quality?: number): Promise<{blob: Blob, width: number, height: number}>"
      exports: ["stripAndResize"]
    - path: "src/lib/exif/heic-worker.ts"
      provides: "Web Worker module that dynamic-imports heic2any; posts {buffer, type} back via transferable"
      contains: "self.onmessage"
    - path: "src/lib/storage/wearPhotos.ts"
      provides: "uploadWearPhoto(userId, wearEventId, jpeg): Promise<{path}|{error}>"
      exports: ["uploadWearPhoto"]
    - path: "src/components/wywt/PhotoUploader.tsx"
      provides: "<input type=file> + isHeicFile detection + worker dispatcher; non-HEIC skips worker"
      exports: ["PhotoUploader"]
    - path: "src/components/wywt/CameraCaptureView.tsx"
      provides: "getUserMedia + video + canvas capture + inline SVG overlay; exposes onCaptured(blob) callback"
      exports: ["CameraCaptureView"]
    - path: "src/components/wywt/WristOverlaySvg.tsx"
      provides: "Pure presentational SVG overlay per UI-SPEC geometry"
      exports: ["WristOverlaySvg"]
    - path: "tests/lib/exif-strip.test.ts"
      provides: "Wave 0 test file — canvas re-encode produces JPEG with no EXIF tags + 1080px cap"
      exports: []
    - path: "tests/components/PhotoUploader.test.tsx"
      provides: "Wave 0 test file — HEIC detection + worker dispatch (mocked Worker)"
      exports: []
  key_links:
    - from: "src/components/wywt/PhotoUploader.tsx"
      to: "src/lib/exif/heic-worker.ts"
      via: "new Worker(new URL('../../lib/exif/heic-worker.ts', import.meta.url), { type: 'module' })"
      pattern: "new URL\\(.*heic-worker"
    - from: "src/components/wywt/PhotoUploader.tsx"
      to: "src/lib/exif/strip.ts"
      via: "import { stripAndResize }"
      pattern: "stripAndResize"
    - from: "src/components/wywt/CameraCaptureView.tsx"
      to: "src/lib/exif/strip.ts"
      via: "import { stripAndResize } then call after canvas capture"
      pattern: "stripAndResize"
    - from: "src/lib/storage/wearPhotos.ts"
      to: "src/lib/supabase/client.ts"
      via: "createSupabaseBrowserClient().storage.from('wear-photos').upload()"
      pattern: "wear-photos"
---

<objective>
Ship the browser-side photo pipeline for Phase 15: install `sonner`, `heic2any`, `exifr`; build the shared EXIF-strip + 1080px-resize helper; build the HEIC Web Worker (with a Turbopack chunk-emission spike — Assumption A2); build the client-direct Supabase Storage upload helper; build the reusable `PhotoUploader`, `CameraCaptureView`, and `WristOverlaySvg` Client Components. Also create the Wave 0 test files that downstream plans depend on.

Purpose: Phase 15 composition plans (03, 04) depend on these primitives. Separating the photo pipeline into its own plan means these can be built in parallel with the `ThemedToaster` (Plan 02) and lets us verify the A2 spike — "does Turbopack emit `new URL('./heic-worker.ts', import.meta.url)` as a separate chunk?" — before we build anything that consumes HEIC conversion.

Output: six source files + three Wave 0 test files + package.json updates. `npm run test -- tests/lib/exif-strip.test.ts tests/components/PhotoUploader.test.tsx` is green. The A2 spike is captured as a task acceptance criterion and its verification command is automated.
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
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files the executor will touch or mirror:
@src/lib/supabase/client.ts
@src/lib/utils.ts
@package.json
@next.config.ts
@vitest.config.ts
@tests/integration/home-privacy.test.ts

<interfaces>
<!-- Key types and contracts the executor needs. No codebase exploration required. -->

From src/lib/actionTypes.ts (already exists):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

From src/lib/wearVisibility.ts (already exists):
```typescript
export type WearVisibility = 'public' | 'followers' | 'private'
```

NEW contracts this plan creates (downstream plans consume these):

src/lib/exif/strip.ts:
```typescript
export interface StripResult {
  blob: Blob
  width: number
  height: number
}
export async function stripAndResize(
  input: Blob,
  maxDim?: number,   // default 1080
  quality?: number,  // default 0.85
): Promise<StripResult>
```

src/lib/storage/wearPhotos.ts:
```typescript
export type UploadResult = { path: string } | { error: string }
export async function uploadWearPhoto(
  userId: string,
  wearEventId: string,
  jpeg: Blob,
): Promise<UploadResult>
```

src/components/wywt/PhotoUploader.tsx:
```typescript
export function PhotoUploader(props: {
  onPhotoReady: (jpeg: Blob) => void  // called AFTER HEIC conversion + EXIF strip + resize
  onError: (message: string) => void
  disabled?: boolean
}): JSX.Element
```

src/components/wywt/CameraCaptureView.tsx:
```typescript
export function CameraCaptureView(props: {
  onPhotoReady: (jpeg: Blob) => void  // called AFTER canvas capture + EXIF strip + resize (for uniformity)
  onError: (message: string) => void
  onCancel: () => void                // returns to pre-capture chooser state
  disabled?: boolean
}): JSX.Element
```

src/components/wywt/WristOverlaySvg.tsx:
```typescript
export function WristOverlaySvg(props: { className?: string }): JSX.Element
// Geometry: viewBox="0 0 100 100", two horizontal lines at y=38/y=62,
// two concentric circles (r=22 outer, r=17 inner) at 50/50, hands at 10:10,
// small rect crown at (72,49) w=4 h=3. Nothing else.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install deps, create stripAndResize helper, write Wave 0 exif-strip test (RED → GREEN)</name>
  <files>package.json, package-lock.json, src/lib/exif/strip.ts, tests/lib/exif-strip.test.ts</files>
  <read_first>
    - package.json (confirm current deps; verify sonner/heic2any/exifr not yet installed)
    - vitest.config.ts (confirm jsdom environment + test include globs)
    - tests/lib/timeAgo.test.ts (existing lib-test pattern — describe/it/expect + import shape)
    - RESEARCH.md §Pattern 5 — Shared canvas resize + EXIF-strip helper
    - RESEARCH.md §Pitfall 4 — EXIF orientation (createImageBitmap primary, exifr fallback)
    - RESEARCH.md §Pitfall 5 — EXIF GPS stripped on ALL paths
    - RESEARCH.md §Common Operation 3 — Lazy-load exifr/dist/lite
    - CONTEXT.md D-10 — EXIF stripping + 1080px resize (both paths, canvas.toBlob('image/jpeg', 0.85), target <500KB)
    - UI-SPEC.md §EXIF strip + resize pipeline
    - VALIDATION.md row WYWT-06 — automated command and Wave 0 requirement
    - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (Server Actions context)
  </read_first>
  <behavior>
    - Test 1: `stripAndResize(smallJpegBlob)` returns a Blob whose MIME is `image/jpeg` and whose `exifr.parse(blob)` returns undefined / empty (no tags)
    - Test 2: `stripAndResize(largeBlob)` with a synthetic 3000x2000 blob returns `width<=1080 && height<=1080`, preserving aspect ratio
    - Test 3: `stripAndResize(portraitWithExifGps)` strips the GPSLatitude tag — `exifr.parse(result.blob, {gps:true})` returns no GPSLatitude field
    - Test 4: Output blob size is <500KB for a 3000x2000 test image (`result.blob.size < 500_000`)
    - jsdom canvas limitation: if `canvas.toBlob` is not supported in jsdom, stub it with `vi.mock` on a per-test basis. The dev.to article pattern uses `@vitest/browser` — we will test via node-canvas polyfill OR via mocking; planner recommends installing `canvas` (Node polyfill for jsdom canvas) as devDependency if the native polyfill is missing, OR writing targeted mocks for `createImageBitmap` + `HTMLCanvasElement.prototype.toBlob`. Executor decides based on jsdom capability probe run first.
  </behavior>
  <action>
    Step 1 — install deps (required by this task and downstream tasks in this plan):
    ```bash
    npm install sonner@^2.0.7 heic2any@^0.0.4
    npm install --save-dev exifr@^7.1.3
    ```
    Verify versions match research (`npm view sonner version` → 2.0.7; `npm view heic2any version` → 0.0.4; `npm view exifr version` → 7.1.3). Commit lockfile alongside.

    Step 2 — create `src/lib/exif/strip.ts`. Exact signature:
    ```typescript
    export interface StripResult {
      blob: Blob
      width: number
      height: number
    }

    export async function stripAndResize(
      input: Blob,
      maxDim = 1080,
      quality = 0.85,
    ): Promise<StripResult>
    ```
    Implementation follows RESEARCH §Pattern 5:
    - Primary: `await createImageBitmap(input, { imageOrientation: 'from-image' })` (try/catch; fallback to `createImageBitmap(input)` if options arg throws on ancient browsers).
    - Compute `scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))`; `targetW = Math.round(bitmap.width * scale)`; `targetH = Math.round(bitmap.height * scale)`.
    - Create `document.createElement('canvas')` at targetW × targetH; `ctx.drawImage(bitmap, 0, 0, targetW, targetH)`.
    - Fallback: if `createImageBitmap` did not auto-orient (detect via `detectOrientation(input)` helper that lazy-imports `exifr/dist/lite.esm.js`'s `orientation()` function), apply the EXIF-derived canvas transform before `drawImage`. Use the exact transforms from RESEARCH §Common Operation 3 / §Pattern 5.
    - Encode via `new Promise<Blob|null>((r) => canvas.toBlob(r, 'image/jpeg', quality))`; throw if null.
    - Return `{ blob, width: targetW, height: targetH }`.
    - Include a comment block at top of file citing RESEARCH §Pattern 5 and Pitfall 4 (EXIF orientation research-flag resolution per STATE.md todo: createImageBitmap primary, exifr fallback).

    Step 3 — create `tests/lib/exif-strip.test.ts` Wave 0 file with the 4 behaviors above. Use vitest + exifr (installed as devDep). Test RED first → implement → test GREEN.

    Step 4 — commit after GREEN with message `feat(15-01): ship EXIF-strip + resize helper with Wave 0 test`.
  </action>
  <verify>
    <automated>npm run test -- tests/lib/exif-strip.test.ts</automated>
  </verify>
  <done>
    - `sonner`, `heic2any`, `exifr` present in package.json at the researched versions
    - `src/lib/exif/strip.ts` exports `stripAndResize` with the exact signature in <interfaces>
    - `tests/lib/exif-strip.test.ts` has ≥4 tests covering the 4 behaviors, all pass
    - `exifr.parse()` on the output blob confirms no EXIF tags remain
    - Output blob is `image/jpeg`, ≤1080px longest edge, <500KB for a 3000x2000 input
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build HEIC Web Worker + PhotoUploader component; Wave 0 PhotoUploader test; A2 Turbopack chunk-emission spike</name>
  <files>src/lib/exif/heic-worker.ts, src/components/wywt/PhotoUploader.tsx, tests/components/PhotoUploader.test.tsx</files>
  <read_first>
    - src/lib/exif/strip.ts (just built — understand its contract before wiring PhotoUploader)
    - RESEARCH.md §Pattern 4 — Web Worker for heic2any (`new URL('./heic-worker.ts', import.meta.url)`, dynamic `await import('heic2any')` inside worker)
    - RESEARCH.md §Pitfall 6 — HEIC MIME detection unreliable (check both MIME and extension)
    - RESEARCH.md §Assumptions Log A2 — Turbopack chunk emission verification
    - RESEARCH.md §Anti-Patterns — Eager-importing heic2any is forbidden
    - CONTEXT.md D-09 — HEIC lazy-loaded in Web Worker; non-HEIC skips worker
    - VALIDATION.md row WYWT-05 — automated command + manual UAT for bundle-chunk verification
    - tests/components/settings/ (pick any file as RTL component test pattern reference)
    - next.config.ts (confirm Turbopack enabled in dev)
  </read_first>
  <behavior>
    - Test 1 (unit): `isHeicFile({name: 'photo.heic', type: ''})` → true; `isHeicFile({name: 'photo.jpg', type: 'image/jpeg'})` → false; `isHeicFile({name: 'photo.HEIF', type: 'image/heif'})` → true
    - Test 2 (component, mocked Worker): Selecting a `.heic` file triggers `new Worker(...)`; the mocked worker posts back a JPEG blob; `onPhotoReady(blob)` is called with the post-strip result
    - Test 3 (component, mocked Worker): Selecting a `.jpg` file SKIPS the worker entirely (no `new Worker` call spy invocation); `stripAndResize` is called directly; `onPhotoReady(blob)` fires
    - Test 4 (component): Worker `onerror` triggers `onError('Could not convert HEIC photo. Please try another image.')`
  </behavior>
  <action>
    Step 1 — Create `src/lib/exif/heic-worker.ts` EXACTLY per RESEARCH §Pattern 4:
    ```typescript
    // src/lib/exif/heic-worker.ts
    self.onmessage = async (e: MessageEvent) => {
      const { buffer, toType, quality } = e.data as {
        buffer: ArrayBuffer
        toType: string
        quality: number
      }
      const { default: heic2any } = await import('heic2any')
      const blob = new Blob([buffer])
      const result = await heic2any({ blob, toType, quality })
      const output = Array.isArray(result) ? result[0] : result
      const ab = await output.arrayBuffer()
      ;(self as unknown as Worker).postMessage(
        { buffer: ab, type: output.type },
        [ab],
      )
    }
    export {}  // make this a module
    ```

    Step 2 — Create `src/components/wywt/PhotoUploader.tsx` Client Component:
    - `'use client'` directive
    - Exports `function isHeicFile(file: File): boolean` (same file; simpler than a new file):
      ```typescript
      export function isHeicFile(file: File): boolean {
        const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
        const ext = file.name.toLowerCase()
        const extOk = ext.endsWith('.heic') || ext.endsWith('.heif')
        return mimeOk || extOk
      }
      ```
    - Internal `convertHeic(file: File): Promise<Blob>` that does:
      ```typescript
      const worker = new Worker(
        new URL('../../lib/exif/heic-worker.ts', import.meta.url),
        { type: 'module' },
      )
      ```
      Posts `{buffer, toType: 'image/jpeg', quality: 0.85}` with `[buffer]` transferable; resolves on `worker.onmessage` (reconstitutes Blob from returned ArrayBuffer); rejects on `worker.onerror`; always calls `worker.terminate()` in both paths.
    - Render: `<label>` wrapping a hidden `<input type="file" accept="image/*,.heic,.heif">` + a "Upload photo" visible button (UI-SPEC §Copywriting Contract copy). Use lucide `Image` icon.
    - On file change: if HEIC → `convertHeic(file)` → then `stripAndResize(jpegBlob)` → `onPhotoReady(result.blob)`. Else → `stripAndResize(file)` directly → `onPhotoReady(result.blob)`. Catch all errors and pass to `onError`.
    - Error copy: "Could not convert HEIC photo. Please try another image." (for HEIC conversion failures); "Could not process photo. Please try another image." (for other errors).
    - Button is `<Button type="button" variant="outline">` from `@/components/ui/button`.
    - `disabled` prop disables the `<input>` and button.

    Step 3 — Create `tests/components/PhotoUploader.test.tsx` Wave 0 file with the 4 behaviors above. Mock `new Worker` via `vi.stubGlobal('Worker', ...)` constructor mock; mock `src/lib/exif/strip.ts` via `vi.mock('@/lib/exif/strip', () => ({ stripAndResize: vi.fn().mockResolvedValue({ blob: new Blob([], {type: 'image/jpeg'}), width: 1080, height: 720 }) }))`. Use RTL's `userEvent.upload()` to simulate file input.

    Step 4 — A2 SPIKE acceptance criterion: After implementing, run `npm run dev` and observe DevTools Network tab as a HEIC file is selected. The worker chunk should appear as a separate `.js` request (not merged into the main route bundle). Executor MUST capture this evidence in the summary either as a screenshot path or a copy-pasted Network-tab row listing for the worker chunk. If Turbopack merges the worker, fall back per RESEARCH §Open Question 1: static `/public/workers/heic-worker.js` + `new Worker('/workers/heic-worker.js')`. THIS IS A LIVE VERIFICATION; automated `<verify>` covers the unit tests but the A2 result must be captured in the Task summary before the task is marked done.
  </action>
  <verify>
    <automated>npm run test -- tests/components/PhotoUploader.test.tsx</automated>
  </verify>
  <done>
    - `src/lib/exif/heic-worker.ts` contains exactly the code in RESEARCH §Pattern 4 (including the `export {}` sentinel)
    - `src/components/wywt/PhotoUploader.tsx` exports `PhotoUploader` + `isHeicFile`; non-HEIC path verified to NOT construct a Worker; HEIC path verified to call Worker + `stripAndResize` + `onPhotoReady`
    - `tests/components/PhotoUploader.test.tsx` has ≥4 tests (the 4 behaviors), all GREEN via `npm run test -- tests/components/PhotoUploader.test.tsx`
    - No eager `import 'heic2any'` or `import heic2any from 'heic2any'` appears anywhere under `src/` outside `src/lib/exif/heic-worker.ts` — verify with `grep -rn "from 'heic2any'" src/ | grep -v heic-worker` returns empty
    - A2 spike result recorded in task summary: either "VERIFIED: Turbopack emits heic-worker as separate chunk (evidence: [Network tab row])" OR "FELL BACK: public/workers/heic-worker.js"
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build CameraCaptureView + WristOverlaySvg (iOS gesture rule, MediaStream cleanup, permission-denied UX, storage upload helper, storage-path test)</name>
  <files>src/components/wywt/WristOverlaySvg.tsx, src/components/wywt/CameraCaptureView.tsx, src/lib/storage/wearPhotos.ts, tests/lib/storage-path.test.ts</files>
  <read_first>
    - src/lib/supabase/client.ts (confirm createSupabaseBrowserClient signature)
    - src/lib/exif/strip.ts (built in Task 1; import in CameraCaptureView)
    - RESEARCH.md §Pitfall 1 — iOS Safari gesture consumed by await before getUserMedia
    - RESEARCH.md §Pitfall 2 — MediaStream track cleanup
    - RESEARCH.md §Pitfall 3 — Camera permission denied UX
    - RESEARCH.md §Pitfall 12 — Storage folder enforcement (path convention)
    - RESEARCH.md §Pattern 7 — Client-direct upload helper example
    - RESEARCH.md §Common Operation 1 + §Common Operation 2 — stopStream + captureFrame patterns
    - CONTEXT.md D-06 / D-07 / D-08 — photo zone states + overlay geometry
    - UI-SPEC.md §CameraCaptureView + WristOverlaySvg — geometry spec (viewBox=0 0 100 100, y=38/y=62, r=22/r=17, crown at 72,49 w=4 h=3)
    - UI-SPEC.md §Accessibility Contract — aria-labels for video, capture button, overlay aria-hidden
    - UI-SPEC.md §Copywriting Contract — "Camera access denied — use Upload photo instead.", "Capture", "Retake", "Remove photo"
    - VALIDATION.md row WYWT-04 — manual-only verification; note Wave 0 WYWT-04 is manual UAT, but CameraCaptureView still needs a storage-path unit test for WYWT-15 path construction
    - supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql (verify folder-enforcement policy that the upload path must satisfy)
  </read_first>
  <behavior>
    - WristOverlaySvg renders with exact geometry per UI-SPEC (describe output via JSDOM)
      - Test 1: svg has `viewBox="0 0 100 100"` and `aria-hidden="true"`
      - Test 2: contains 2 `<line>` elements with `y1=38/y2=38` and `y1=62/y2=62` respectively
      - Test 3: contains 2 `<circle>` at `cx=50 cy=50` with `r=22` and `r=17`
      - Test 4: contains the crown rect at `x=72 y=~49 width=4 height=3` (±1px tolerance)
    - storage-path helper constructs `${userId}/${wearEventId}.jpg` deterministically
      - Test 5: `buildWearPhotoPath('user-uuid', 'event-uuid')` returns `'user-uuid/event-uuid.jpg'`
      - Test 6: path validator rejects empty userId or non-UUID wearEventId (throws / returns error)
  </behavior>
  <action>
    Step 1 — Create `src/components/wywt/WristOverlaySvg.tsx` (pure presentational, can be a Server Component — no `'use client'` needed):
    ```tsx
    export function WristOverlaySvg({ className }: { className?: string }) {
      return (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className={className}
          aria-hidden="true"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          {/* Arm lines — horizontal, spanning full width */}
          <line x1="0" y1="38" x2="100" y2="38" />
          <line x1="0" y1="62" x2="100" y2="62" />
          {/* Bezel (outer) + face (inner), centered */}
          <circle cx="50" cy="50" r="22" />
          <circle cx="50" cy="50" r="17" />
          {/* Hour hand → 10 o'clock; minute hand → 2 o'clock */}
          <line x1="50" y1="50" x2="38" y2="27" />
          <line x1="50" y1="50" x2="62" y2="27" />
          {/* Crown at 3 o'clock */}
          <rect x="72" y="49" width="4" height="3" fill="rgba(255,255,255,0.85)" stroke="none" />
        </svg>
      )
    }
    ```
    Include a file-top comment citing UI-SPEC §CameraCaptureView+WristOverlaySvg and CONTEXT.md D-08 / asset reference `assets/overlay-reference.png`.

    Step 2 — Create `src/components/wywt/CameraCaptureView.tsx` Client Component per RESEARCH §Pitfall 1/2/3:
    - `'use client'`
    - State: `error: string | null`, `mode: 'idle' | 'camera' | 'captured'` (but the parent drives the compose-step layout; this component only owns camera state). Actually — simplify: this component ONLY manages the camera live stream + capture. It renders video + overlay + capture button when mounted; the parent controls mount/unmount.
    - `streamRef = useRef<MediaStream | null>(null)`; `videoRef = useRef<HTMLVideoElement | null>(null)`
    - On mount: start the camera. CRITICAL: `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } }, audio: false })` MUST be the first await. Do NOT set React state then await in an effect — the mount event already consumed the gesture, so the tap handler in the parent must trigger mount AND the first await in the mount useEffect must be `getUserMedia`. Use `useEffect` with no-dep array, call `getUserMedia` as the first statement inside an `async iife` inside the effect.
      - Wait — iOS Safari requires `getUserMedia` on the same call stack as the user tap. The `useEffect` runs AFTER the render commits, which has already crossed a microtask boundary. This is the critical bit: we MUST get the stream in the PARENT's tap handler (which mounts this component), and PASS THE STREAM IN AS A PROP. Revised API:
    - Revised signature:
      ```typescript
      export function CameraCaptureView(props: {
        stream: MediaStream                  // parent obtained via getUserMedia BEFORE mounting this component
        onPhotoReady: (jpeg: Blob) => void
        onError: (message: string) => void
        onCancel: () => void
        disabled?: boolean
      })
      ```
    - Parent's tap handler (in ComposeStep Plan 03 Task 3) will call `getUserMedia` FIRST and pass the stream in. Document this in a file-top comment: "This component does not call getUserMedia itself — that MUST happen in the caller's tap handler (first await on gesture) per Pitfall 1. Parent passes resolved stream as a prop."
    - Effect: `videoRef.current.srcObject = stream`; on unmount stop all tracks + null srcObject (Pitfall 2):
      ```tsx
      useEffect(() => {
        const video = videoRef.current
        if (video) video.srcObject = stream
        return () => {
          stream.getTracks().forEach((t) => t.stop())
          if (video) video.srcObject = null
        }
      }, [stream])
      ```
    - Capture handler: `async function handleCapture()`:
      1. Create offscreen canvas at `videoRef.current.videoWidth × videoRef.current.videoHeight`
      2. `ctx.drawImage(videoRef.current, 0, 0)`
      3. Convert to blob via `new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85))`
      4. Pipe through `stripAndResize` (uniform EXIF strip + resize — even though camera frames have no EXIF, keep pipeline uniform per Pitfall 5)
      5. Call `onPhotoReady(result.blob)`
    - Render:
      ```tsx
      <div className="relative w-full rounded-md overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" className="w-full object-cover" />
        <WristOverlaySvg className="absolute inset-0 pointer-events-none" />
        <div className="flex justify-center gap-2 mt-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>Cancel</Button>
          <Button type="button" onClick={handleCapture} disabled={disabled} aria-label="Capture photo" className="min-h-11">Capture</Button>
        </div>
      </div>
      ```

    Step 3 — Create `src/lib/storage/wearPhotos.ts` (client-callable; marked `'use client'`):
    ```typescript
    'use client'
    import { createSupabaseBrowserClient } from '@/lib/supabase/client'

    export type UploadResult = { path: string } | { error: string }

    export function buildWearPhotoPath(userId: string, wearEventId: string): string {
      if (!userId) throw new Error('userId required')
      if (!/^[0-9a-f-]{36}$/i.test(wearEventId)) {
        throw new Error('wearEventId must be a UUID')
      }
      return `${userId}/${wearEventId}.jpg`
    }

    export async function uploadWearPhoto(
      userId: string,
      wearEventId: string,
      jpeg: Blob,
    ): Promise<UploadResult> {
      const supabase = createSupabaseBrowserClient()
      const path = buildWearPhotoPath(userId, wearEventId)
      const { error } = await supabase.storage
        .from('wear-photos')
        .upload(path, jpeg, {
          contentType: 'image/jpeg',
          upsert: false,  // Pitfall F-4 — never overwrite; fresh upload per wear
        })
      if (error) return { error: error.message }
      return { path }
    }
    ```

    Step 4 — Create `tests/lib/storage-path.test.ts` Wave 0 file with the path-construction tests (Test 5, Test 6 in behavior above). Also add a WristOverlaySvg rendering test in `tests/components/PhotoUploader.test.tsx` (keep one test file for both since overlay is trivial) OR add a dedicated `tests/components/WristOverlaySvg.test.tsx` (planner prefers separate for clarity — executor's call, but must test the 4 geometry assertions).

    Step 5 — Commit.
  </action>
  <verify>
    <automated>npm run test -- tests/lib/storage-path.test.ts tests/components/PhotoUploader.test.tsx</automated>
  </verify>
  <done>
    - `src/components/wywt/WristOverlaySvg.tsx` renders the exact UI-SPEC geometry (viewBox=0 0 100 100, two lines at y=38/y=62, two circles r=22/r=17, crown rect at 72,49 w=4 h=3). NO extra shapes (no hour markers, no lugs, no strap) — verify with `grep -c 'line\|circle\|rect' src/components/wywt/WristOverlaySvg.tsx` ≤ 6
    - `src/components/wywt/CameraCaptureView.tsx` receives `stream: MediaStream` as a prop (documented that getUserMedia happens in parent's tap handler). MediaStream cleanup in unmount effect calls `.getTracks().forEach((t) => t.stop())` and sets `srcObject = null`
    - `src/lib/storage/wearPhotos.ts` exports `uploadWearPhoto` and `buildWearPhotoPath`; path convention is exactly `{userId}/{wearEventId}.jpg`; `upsert: false` set on upload call
    - Test file `tests/lib/storage-path.test.ts` covers path construction + UUID validation, all pass
    - `grep -n 'getUserMedia' src/components/wywt/CameraCaptureView.tsx` returns 0 matches (stream comes from parent — iOS gesture-context compliance enforced by architecture)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Supabase Storage | Client uploads blob via session-scoped Supabase client; RLS enforces folder |
| User gesture → getUserMedia | iOS Safari privileges camera only when first-await on gesture handler |
| HEIC file → Worker | Untrusted binary parsed by heic2any WASM; worker isolates main thread |
| Uploaded file → Canvas re-encode | EXIF stripping is the privacy boundary; ALL paths MUST cross it |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-01 | D (Camera gesture DoS) | MED | CameraCaptureView | Parent's tap handler calls getUserMedia FIRST (no preceding await); architecture enforces this by taking `stream` as a prop. Documented in file-top comment. |
| T-15-02 | T (Worker import poisoning) | HIGH | heic-worker.ts | Worker URL is resolved at build time via `new URL('./heic-worker.ts', import.meta.url)`. No arbitrary URL loading. A2 spike verifies Turbopack emits as separate chunk (no dynamic-import escape hatch to arbitrary URLs). |
| T-15-03 | I (EXIF GPS leak) | HIGH | src/lib/exif/strip.ts | Canvas re-encode on ALL upload paths strips EXIF by construction. Wave 0 test verifies with exifr.parse on output blob. No code path uploads the original file blob — only the stripAndResize output. |
| T-15-08 | T (Cross-user path write) | HIGH | src/lib/storage/wearPhotos.ts | `buildWearPhotoPath` hard-codes `${userId}/${wearEventId}.jpg`; Supabase Storage RLS (Phase 11 migration) rejects writes where `(storage.foldername(name))[1] != auth.uid()::text`. Defense in depth: client convention + server RLS. |
| T-15-09 | I (heic2any metadata leak) | LOW | heic-worker.ts | heic2any author statement: "resulting file doesn't have any metadata." Defense-in-depth: canvas re-encode after HEIC conversion also strips (Pitfall 5 uniform pipeline). |
| T-15-10 | D (MediaStream leaked — camera LED stays on) | LOW | CameraCaptureView | useEffect cleanup stops all tracks + nulls srcObject on unmount. Parent unmounts on dialog close / X remove / capture complete. |
| T-15-11 | T (Malformed file exhausts canvas memory) | LOW | stripAndResize | 1080px cap bounds memory; canvas.toBlob on oversized input throws — caught by caller's try/catch via onError callback. |
</threat_model>

<verification>
## Plan-Level Verification

- `npm run test -- tests/lib/exif-strip.test.ts tests/components/PhotoUploader.test.tsx tests/lib/storage-path.test.ts` exits 0
- `grep -rn "from 'heic2any'" src/ | grep -v heic-worker` returns empty (no eager import)
- `grep -c 'line\|circle\|rect' src/components/wywt/WristOverlaySvg.tsx` ≤ 6 (exactly the 4+2 shapes — no extras)
- `grep -n 'getUserMedia' src/components/wywt/CameraCaptureView.tsx` returns 0 matches (stream is a prop, not acquired here)
- A2 spike evidence captured in task summary (Turbopack chunk verification)
- `npm run lint` exits 0 on new files
- `npx tsc --noEmit` exits 0
</verification>

<success_criteria>
## Plan Success Criteria

1. `stripAndResize(blob)` produces a ≤1080px EXIF-free JPEG verifiable via exifr on the output
2. `isHeicFile(file)` detects HEIC by both MIME and extension; only HEIC files trigger the Worker
3. `new URL('./heic-worker.ts', import.meta.url)` pattern is confirmed (A2 spike) to emit a separate chunk under Next 16.2.3 Turbopack — OR fallback to `public/workers/` is documented
4. `WristOverlaySvg` renders the exact UI-SPEC geometry (no extra shapes)
5. `CameraCaptureView` takes a pre-acquired MediaStream as a prop (architectural enforcement of Pitfall 1 iOS gesture rule)
6. `uploadWearPhoto` uploads to `{userId}/{wearEventId}.jpg` with `upsert: false`
7. Three Wave 0 test files exist and are green: exif-strip, PhotoUploader, storage-path
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-01-SUMMARY.md` documenting:
- A2 spike result (chunk emission verified or fallback used)
- Exact versions installed (`sonner`, `heic2any`, `exifr`)
- Any deviations from the interface contracts in <interfaces>
- Any jsdom canvas shims used (for Task 1 testability)
</output>
