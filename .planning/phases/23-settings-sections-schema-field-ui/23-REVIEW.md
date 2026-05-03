---
phase: 23-settings-sections-schema-field-ui
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/app/actions/watches.ts
  - src/components/preferences/PreferencesClient.tsx
  - src/components/settings/AppearanceSection.tsx
  - src/components/settings/preferences/CollectionGoalCard.tsx
  - src/components/settings/preferences/OverlapToleranceCard.tsx
  - src/components/settings/PreferencesSection.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchForm.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-01
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 23 surfaces two settings sections (Collection goal + Overlap tolerance Cards), replaces the Appearance stub with a Theme card, adds an `isChronometer` Checkbox + `notesPublic` Public/Private pill to `WatchForm`, and adds a Certification row to `WatchDetail`. The UI work is clean — locked copy, locked classes, defensive `=== true` for nullable booleans, embedded prop on `PreferencesClient` is well-isolated, and `CollectionGoalCard` / `OverlapToleranceCard` follow the established Server-renders-Client-child pattern.

However, the FEAT-07 (`notesPublic` persistence) loop is **not closed end-to-end**. Plan 05's promised changes to `src/app/actions/watches.ts` (add `notesPublic` to `insertWatchSchema`, add `revalidatePath('/u/[username]', 'layout')` to `addWatch`/`editWatch`) were never committed — the worktree was reset and Plan 05 has no SUMMARY file, only a PLAN. The phase brief lists `src/app/actions/watches.ts` in the file scope and asserts "Adds notesPublic to Zod schema in actions/watches.ts; adds revalidatePath('/u/[username]', 'layout') to addWatch + editWatch", but the file on disk shows neither change. As a result, every WatchForm submit silently strips the user's Public/Private pill choice via Zod's default unknown-key strip.

A second smaller bug: `WatchForm.handleSubmit` constructs a defensive `submitData` (with `finalStatus = lockedStatus ?? formData.status`) but the `editWatch` branch on line 178 still passes raw `formData`, bypassing the defense.

## Critical Issues

### CR-01: notesPublic and /u/[username] revalidation never landed in watches.ts — FEAT-07 silently broken end-to-end

**File:** `src/app/actions/watches.ts:17-49` (Zod schema), `src/app/actions/watches.ts:241,284,316` (revalidatePath calls)

**Issue:**

The phase brief asserts that `src/app/actions/watches.ts` was modified to:
1. Add `notesPublic: z.boolean().optional()` to `insertWatchSchema`
2. Add `revalidatePath('/u/[username]', 'layout')` to `addWatch` and `editWatch`

Neither change is present in the committed file. `git diff f167b38..HEAD -- src/app/actions/watches.ts` returns empty (no commits touched the file). The Plan 05 SUMMARY was never produced (only `23-05-PLAN.md` exists; no `23-05-SUMMARY.md`), and `23-06-SUMMARY.md` explicitly documents this as "leftover work from a parallel-executor plan ... that did not commit its work before the worktree reset."

Concrete consequence — FEAT-07 ships visibly working in the form UI but is functionally broken on persist:

- `WatchForm` (line 66, 107, 599) writes `notesPublic` into `formData`.
- `handleSubmit` passes `formData` / `submitData` (which includes `notesPublic`) to `addWatch` / `editWatch`.
- `insertWatchSchema.safeParse(data)` runs in `addWatch` (line 64) and `updateWatchSchema.safeParse(data)` in `editWatch` (line 273).
- Zod's default mode silently STRIPS unknown keys (no `.passthrough()`, no `.strict()` in the schema).
- `parsed.data` therefore never contains `notesPublic`, so `watchDAL.createWatch` / `watchDAL.updateWatch` never receive it.
- The DB column keeps its default (true) on inserts and never updates on edits — every Private toggle is lost.

Cross-page revalidation is also missing — even if the Zod fix lands, the per-row `<NoteVisibilityPill>` on `/u/{username}/notes` will show stale data after a WatchForm edit until a full page refresh, because neither `addWatch` nor `editWatch` invalidates the user-scoped layout cache.

**Fix:**

Apply both changes from `23-05-PLAN.md`. In `src/app/actions/watches.ts`:

```typescript
// Line ~40 — add notesPublic to insertWatchSchema (alongside notes/imageUrl):
const insertWatchSchema = z.object({
  // ...existing fields...
  isChronometer: z.boolean().optional(),
  notes: z.string().optional(),
  notesPublic: z.boolean().optional(),  // FEAT-07 — Phase 23 D-17
  imageUrl: z.string().optional(),
  // ...
})

// Line ~241 (in addWatch), after revalidatePath('/'):
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')  // FEAT-07 — Phase 23 D-19

// Line ~284 (in editWatch), after revalidatePath('/'):
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')  // FEAT-07 — Phase 23 D-19
```

Note: `notes_public` is NOT NULL in DB with default `true`, so making the Zod field optional matches the column's nullability and the form's default-Public posture (D-16).

After the fix, also verify Plan 01's `tests/actions/watches.notesPublic.test.ts` scaffold turns GREEN (per Plan 05 acceptance contract).

## Warnings

### WR-01: editWatch path bypasses defensive submitData / finalStatus override

**File:** `src/components/watch/WatchForm.tsx:168-179`

**Issue:**

`handleSubmit` builds a defensive `submitData` object that pins `status` to `finalStatus = lockedStatus ?? formData.status` (line 169-174) — the comment on line 168 explicitly states "ensure lockedStatus wins even if formData.status drifted (e.g., HMR)". But on line 178, the edit branch passes raw `formData`, not `submitData`:

```typescript
const result =
  mode === 'edit' && watch
    ? await editWatch(watch.id, formData)        // raw formData — bypasses finalStatus
    : await addWatch(submitData)                  // submitData — defended
```

In current callers, `lockedStatus` is only passed in create mode by `AddWatchFlow`, so this is benign today — but it creates a footgun: any future caller that passes `lockedStatus` to an edit-mode `WatchForm` will silently lose the locked-status guarantee. Even today, the comment promises a defense the code does not deliver in edit mode.

This also affects FEAT-07 when fixed: `submitData` is the spread of `formData`, so `notesPublic` does flow through both branches today via `formData`. But the inconsistency is real — once Plan 05's Zod fix lands, callers will reasonably assume both branches deliver the same defended payload. They do not.

**Fix:**

Pass `submitData` to both branches so the `finalStatus` defense and any future submit-only payload extensions apply uniformly:

```typescript
const result =
  mode === 'edit' && watch
    ? await editWatch(watch.id, submitData)
    : await addWatch(submitData)
```

`photoSourcePath` is only added to `submitData` when `mode === 'create' && photoBlob`, so passing `submitData` to `editWatch` is safe — no extra fields leak in.

### WR-02: notesPublic checkbox behavior — toggle direction relies on `=== true` everywhere; double-negation reads confusingly

**File:** `src/components/watch/WatchForm.tsx:599`

**Issue:**

The Public/Private pill toggle is written as:

```typescript
onClick={() =>
  setFormData((prev) => ({ ...prev, notesPublic: !(prev.notesPublic === true) }))
}
```

`!(prev.notesPublic === true)` is logically equivalent to `prev.notesPublic !== true` and to `!prev.notesPublic` (when `notesPublic` is `boolean | undefined`). Three forms, all yielding the same result for our values, but the chosen form is the least readable. More importantly, the `aria-checked` (line 592), `aria-label` (line 593-597), and pill text (line 609) all use the strict `=== true` form, so the toggle's "current state" check and "next state" computation use different idioms — a future refactor that converts one to `!notesPublic` could subtly drift if `notesPublic` is ever assigned `null` (a real possibility for legacy rows per the D-13 defensive comment on line 107).

This is a code-quality issue, not a current bug — defensive `?? true` on hydrate (line 107) and `=== true` on display both behave correctly today.

**Fix:**

Use a single readable idiom for the toggle. Either of these is clearer:

```typescript
// Option A — explicit current→next:
onClick={() =>
  setFormData((prev) => ({ ...prev, notesPublic: prev.notesPublic !== true }))
}

// Option B — derive from the same expression used for display:
onClick={() => {
  const isPublic = formData.notesPublic === true
  setFormData((prev) => ({ ...prev, notesPublic: !isPublic }))
}}
```

Option A is shortest and matches the strict-comparison family used elsewhere in the file.

## Info

### IN-01: PreferencesClient — case-size pre-fill defaults (`?? 46`, `?? 34`) are unsourced magic numbers

**File:** `src/components/preferences/PreferencesClient.tsx:339,367`

**Issue:**

When the user types into the min input but `preferredCaseSizeRange.max` is undefined, the code falls back to `46` (line 339); symmetric `34` for max input (line 367). These constants are not derived from the explicit `CASE_SIZE_MIN = 20` / `CASE_SIZE_MAX = 55` constants defined on line 78-79, nor from any `lib/constants.ts` source. A reader has to guess the rationale (probably "common dress watch range").

This is **pre-existing code** — Phase 23's diff to this file was a refactor that lifted the engine-knob Selects out, not a touch to the case-size logic. Recording as Info for context only.

**Fix (defer or address opportunistically):**

Promote the defaults to named constants alongside the existing min/max:

```typescript
const CASE_SIZE_MIN = 20
const CASE_SIZE_MAX = 55
const CASE_SIZE_DEFAULT_MIN = 34   // typical dress-watch floor
const CASE_SIZE_DEFAULT_MAX = 46   // typical sport-watch ceiling
```

### IN-02: PreferencesSection mounts three independent saving surfaces with no shared loading state

**File:** `src/components/settings/PreferencesSection.tsx:23-34`

**Issue:**

`PreferencesSection` renders `CollectionGoalCard`, `OverlapToleranceCard`, and `PreferencesClient` (embedded) as siblings. Each component owns its own `isSaving` / `saveError` state and issues independent `savePreferences` calls. If a user changes Collection goal AND a taste tag in quick succession, two "Saving..." indicators may appear in different parts of the page, and two error banners could surface independently. The user has no single "did all my edits land" signal.

This is by design (per Phase 23 D-04 — embedded prop suppresses outer chrome but preserves inner save UI), and `savePreferences` revalidates `/preferences` + `/settings` on success, so the next navigation reconciles all state. No correctness bug.

Recording for awareness — if user feedback indicates the multi-banner experience is confusing, a future phase could lift the saving/error state into a shared context or to the section parent.

**Fix:**

No action required. If revisited, consider one of:
- Hoist save state to `PreferencesSection` and pass down handlers
- Accept independent state as intentional (current posture)

### IN-03: SET-12 verification documents an issue but Plan 06 SUMMARY's "Issues Encountered" section is the only record

**File:** `.planning/phases/23-settings-sections-schema-field-ui/23-06-SUMMARY.md` (out-of-scope artifact — recorded as code-context Info)

**Issue:**

The Phase 23 brief explicitly lists `src/app/actions/watches.ts` as a modified file with two specific changes. The Plan 06 SUMMARY's "Issues Encountered" section documents that those changes existed only as uncommitted worktree state and were not preserved. This is the kind of cross-plan handoff failure that should surface in a top-level deferred-items.md entry, not buried in an unrelated verification plan's Issues section. Future readers tracing FEAT-07 status will look at `deferred-items.md` first — and find no mention of the missing watches.ts changes.

**Fix:**

Append to `.planning/phases/23-settings-sections-schema-field-ui/deferred-items.md`:

```markdown
## Plan 23-05 — never committed (parallel-executor handoff lost)

- **`src/app/actions/watches.ts`** — Plan 05's two changes (notesPublic Zod field + revalidatePath('/u/[username]', 'layout') in addWatch/editWatch) were prepared as uncommitted worktree state during a parallel run, then lost when the worktree was reset before Plan 06. No 23-05-SUMMARY.md was produced. **Impact: FEAT-07 ships with broken persistence — WatchForm pill toggles are silently stripped by Zod and the /u/[username]/notes per-row pill shows stale data.** Critical-severity bug — must land before FEAT-07 is considered complete.
```

This is a documentation hygiene item — the Critical fix in CR-01 is what actually closes FEAT-07.

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
