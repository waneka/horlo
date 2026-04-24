# Phase 15: WYWT Photo Post Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 15-wywt-photo-post-flow
**Areas discussed:** Orchestration refactor, Step 2 form UX, Duplicate-day handling, Post-submit flow + /wear/[id] layout

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestration refactor | How the two-step flow wraps WatchPickerDialog; affects NavWearButton, BottomNav, WywtRail self-placeholder, LogTodaysWearButton | ✓ |
| Step 2 form UX | Photo section (Camera/Upload), overlay shape, note textarea, visibility selector composition | ✓ |
| Duplicate-day handling | Where the (user, watch, calendar_day) uniqueness error surfaces | ✓ |
| Post-submit flow + /wear/[id] layout | Landing destination after submit, upload UX, detail-page layout | ✓ |

**User's choice:** All 4 areas.

---

## Orchestration Refactor

### Q1: How should the two-step flow wrap WatchPickerDialog?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract WywtPostDialog wrapper | New dialog owns step state. WatchPickerDialog gets onWatchSelected prop (emits upward instead of calling markAsWorn). Clean composition. | ✓ |
| Extend WatchPickerDialog itself | showPhotoStep prop adds internal step state inside WatchPickerDialog. One component, more internal complexity. | |
| Two parallel dialogs | Keep WatchPickerDialog unchanged; WywtPostDialog has its own picker inside. No reuse. | |

**User's choice:** Extract WywtPostDialog wrapper (Recommended).

### Q2: How do we preserve the single-tap quick-log while enabling the new photo flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Optional onWatchSelected prop | Picker keeps markAsWorn default; onWatchSelected skips it and emits upward. Backwards-compatible. | ✓ |
| Always emit upward (breaking change) | Remove markAsWorn from WatchPickerDialog; every caller owns the action. LogTodaysWearButton refactored. | |
| Submit-label + mode prop | `mode: quick-log | photo-flow` prop branches internal behavior. Explicit API, mildly coupled. | |

**User's choice:** Optional onWatchSelected prop (Recommended).

### Q3: Which call sites adopt the new WywtPostDialog vs stay on single-tap quick-log?

| Option | Description | Selected |
|--------|-------------|----------|
| Nav only; rail + profile stay quick | NavWearButton opens WywtPostDialog; WywtRail self-placeholder + profile stay on old picker. | |
| All paths use WywtPostDialog | Every trigger opens the full photo flow; LogTodaysWearButton removed. Single canonical path. | |
| Nav + rail use WywtPostDialog; profile stays quick | Wear CTA and rail self-tile open WywtPostDialog; profile LogTodaysWearButton stays single-tap. | ✓ |

**User's choice:** Nav + rail use WywtPostDialog; profile stays quick.

### Q4: How should the "Change" link (WYWT-02) look on the Step 2 header?

| Option | Description | Selected |
|--------|-------------|----------|
| Card with image + Change link | Small watch card (image + brand/model) + text "Change" link (accent, underlined). | ✓ |
| Back arrow header only | iOS-style back arrow + watch name in header. No card. Compact. | |
| Card with chevron/pencil icon | Whole card tappable; chevron-right or pencil icon affordance. | |

**User's choice:** Card with image + Change link (Recommended).

---

## Step 2 Form UX

### Q5: Before a photo exists, how are Camera and Upload presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-button chooser, inline expand | Dashed zone with "Take wrist shot" + "Upload photo" buttons side-by-side; camera expands inline on tap. | ✓ |
| Stacked buttons above preview | Two full-width buttons stacked above empty preview frame. | |
| Single primary CTA + secondary menu | "Add photo" button opens native-style action sheet. | |

**User's choice:** Two-button chooser, inline expand (Recommended).

### Q6: After a photo exists, what affordances does the user need?

| Option | Description | Selected |
|--------|-------------|----------|
| Retake + Remove X | Preview fills zone; top-right X removes; "Retake"/"Choose another" text link below preview. | ✓ |
| Replace only, no remove | Only "Replace photo" button visible. No way to get back to empty state. | |
| Single tap-to-edit overlay | Tap preview to open popup: Retake / Upload new / Remove. | |

**User's choice:** Retake + Remove X (Recommended).

### Q7: What shape should the dotted wrist-framing overlay be?

| Option | Description | Selected |
|--------|-------------|----------|
| Dotted oval, ~70% width | Centered oval, natural wrist/watch shape. | |
| Dotted rounded rectangle | 80% width, 60% height, more structured. | |
| Corner brackets only | Four corner brackets, camera-app feel, least guidance. | |

**User's choice:** Custom SVG per user-provided screenshot + verbal clarification. Two horizontal lines = arm; two concentric circles = bezel (outer) + face (inner); hour + minute hands at **10:10** inside the inner circle; **small crown at 3 o'clock** on the outer circle. Nothing else — no hour markers, no lugs, no strap. Reference image copied to `.planning/phases/15-wywt-photo-post-flow/assets/overlay-reference.png`.

**Notes:** User asked whether Claude could recreate from the screenshot or if they should redo in Figma. Claude confirmed the geometry is buildable as inline SVG with relative viewBox coords — no Figma handoff needed. User then clarified the simplified concentric-circles-only spec (vs the screenshot's edge-lug marks which should NOT be recreated).

### Q8: How is the three-tier visibility selector laid out?

| Option | Description | Selected |
|--------|-------------|----------|
| Radio rows with icons + descriptions | Three full-width rows with icon + label + one-line description. Most discoverable. | |
| Segmented control (iOS-style) | Three-button inline toggle group + sub-label describing active choice. Compact. | ✓ |
| Dropdown select | Shadcn Select + helper text. Most compact, least discoverable. | |

**User's choice:** Segmented control (iOS-style). Sub-label row below active button describes the choice (addresses Followers tier introduction risk from FEATURES.md).

### Q9: How does the 0/200 character counter surface on the note textarea?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-right counter, muted | "0/200" below textarea, right-aligned, muted foreground; destructive at 200. | ✓ |
| Inline with label above | Label + counter on same row above textarea. | |
| Only visible at >150 chars | Counter hidden until 75% of limit. | |

**User's choice:** Bottom-right counter, muted (Recommended).

---

## Duplicate-day Handling

### Q10: Where does the (user, watch, calendar_day) uniqueness error surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Preflight: disable already-worn watches in step 1 | Picker queries today's wears; marks already-worn watches disabled with "Worn today" badge. Prevents error entirely. | ✓ |
| Post-submit inline error in the modal | Server Action detects conflict after submit; modal shows inline error and bounces to Step 1. Wastes composed work. | |
| Silent ON CONFLICT + toast "Already logged today" | onConflictDoNothing + affected-rows check + toast. Lenient but wastes storage. | |

**User's choice:** Preflight: disable already-worn watches in step 1 (Recommended).

**Notes:** User initially paused to clarify the camera overlay spec (the concentric-circles simplification) before answering this question. After overlay spec was clarified, user picked the preflight option. Server Action still defense-in-depth checks the constraint per D-14.

---

## Post-submit Flow + /wear/[id] Layout

### Q11: Where does the user land after a successful wear post?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on current page + toast | Close modal, fire "Wear logged" toast, user stays. Lightweight, matches habit-loop framing. | ✓ |
| Navigate to /wear/[id] | Close modal, route to the new detail page. Heavier feel. | |
| Navigate to profile worn tab | Close modal, route to /u/[me]/worn. Reinforces collection history. | |

**User's choice:** Stay on current page + toast (Recommended).

### Q12: What does the user see during the Storage upload?

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled submit with spinner + "Logging…" | Matches existing WatchPickerDialog pattern. Simple, accurate. | ✓ |
| Optimistic close + "Uploading…" toast | Close modal immediately, toast updates on success/failure. Faster-feeling, risk of early nav. | |
| Fake progress bar inside modal | Indeterminate progress bar tweens fake 0-95% over 2s. Dishonest. | |

**User's choice:** Disabled submit with spinner + "Logging…" (Recommended).

### Q13: How is /wear/[wearEventId] laid out?

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile-first full-bleed image, metadata below | Mobile: image fills viewport (4:5 or 1:1); below is metadata stack. Desktop: image caps ~600px centered. | ✓ |
| Two-column desktop, stacked mobile | Desktop: image left, metadata right. Mobile stacks. More "article-like". | |
| Reuse WywtSlide shape as standalone page | Minimal new code; less distinct from overlay experience. | |

**User's choice:** Mobile-first full-bleed image, metadata below (Recommended).

### Q14: Does /wear/[id] need a photo-less fallback layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Watch hero instead of photo | When photo_url is null, use watches.imageUrl in the hero. Maintains visual rhythm. | ✓ |
| Collapsed header + metadata-only | No photo → no hero. Just metadata block. Honest but layout differs. | |
| Generic watch-icon placeholder | Muted placeholder with watch lucide icon. Feels like missing image. | |

**User's choice:** Watch hero instead of photo (Recommended).

---

## Done Prompt

**User's choice:** "go ahead with context. i'd also like guidance on exposing localhost so i can view this feature on my actual device during development"

**Notes:** User requested dev-exposure guidance for device testing. Captured in CONTEXT.md §Specifics (device-testing note recommending `ngrok` or `cloudflared` tunnels — HTTPS is required for iOS Safari `getUserMedia`; `localhost` is exempt but doesn't resolve from other devices on the LAN).

---

## Claude's Discretion

Captured in 15-CONTEXT.md §Claude's Discretion:
- Exact file locations for new components
- SVG overlay stroke weight / color / dashed vs solid
- Hero aspect ratio (4:5 vs 1:1)
- Signed URL TTL for /wear/[id]
- Web Worker boundary for heic2any
- Whether getWearEventByIdForViewer extracts a shared visibility predicate helper
- revalidatePath / revalidateTag scope on wear log success
- Segmented-control icon set (recommend lucide Lock / Users / Globe2)
- Watch card in Step 2 header link behavior
- Post-capture "Remove X" vs "Retake" button styling

## Deferred Ideas

Captured in 15-CONTEXT.md §Deferred:
- Photo edit-after-post (WYWT-FUT-01)
- Live AR wrist-pose overlay (WYWT-FUT-02)
- Delete wear event action (WYWT-FUT-03)
- Likes / comments / carousel (permanent out-of-scope)
- Confirmation dialog before submit (friction anti-pattern)
- `wear` notification type click-through
- Feed-row / search-result links to /wear/[id]
- Signed URL cache invalidation
- Scheduled orphan-storage cleanup cron
- Share-link / copy-URL affordance on /wear/[id]
- First-use tooltip on Followers tier
