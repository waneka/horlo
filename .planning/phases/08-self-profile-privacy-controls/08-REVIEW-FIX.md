---
phase: 08-self-profile-privacy-controls
fixed_at: 2026-04-21T08:30:00Z
review_path: .planning/phases/08-self-profile-privacy-controls/08-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-04-21T08:30:00Z
**Source review:** .planning/phases/08-self-profile-privacy-controls/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 Critical + 7 Warning; Info findings excluded by fix_scope=critical_warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `markAsWorn` allows logging wear for another user's `watchId`

**Files modified:** `src/app/actions/wearEvents.ts`
**Commit:** 343d7c3
**Applied fix:**
- Added `z.string().uuid()` schema validation on the `watchId` argument so non-UUID input is rejected early with a generic "Watch not found" message (existence-leak-safe).
- Inserted an ownership precheck via `watchDAL.getWatchById(user.id, watchId)` BEFORE `logWearEvent` runs. A foreign watchId now short-circuits to the same "Watch not found" error rather than writing a cross-user `wear_events` row. The unique constraint `(user_id, watch_id, worn_date)` cannot catch this on its own because the insert carries the caller's `user_id`.
- Collapsed the activity-log block to reuse the already-fetched `watch` record instead of re-querying.

### WR-01: `notes` tab ignores `collection_public` for non-owners

**Files modified:** `src/app/u/[username]/[tab]/page.tsx`
**Commit:** 6d752ba
**Applied fix:** Added an early-return gate at the same layer as the Stats gate: when `tab === 'notes' && !isOwner && !settings.collectionPublic` the page now returns `<PrivateTabState tab="notes" />`. This closes the side-channel leak where public notes on a private collection were re-exposing brand/model/image + `<Link href="/watch/{id}">` to non-owners.

### WR-02: `noteDefault` Setting is non-functional UI

**Files modified:** `src/components/settings/SettingsClient.tsx`
**Commit:** 4968ee8
**Applied fix:** Applied option (b) from the review — gated the "New Note Visibility" `<Select>` behind `disabled` and added a "Coming soon" Badge alongside it. The localStorage persistence path is preserved (hydration + handler left intact) so re-enabling the control when `insertWatchSchema` is extended in a future phase is a one-line change. Option (a) was intentionally not taken because it expands scope beyond the review (requires `notesPublic` in `insertWatchSchema`/`updateWatchSchema`, form field plumbing, and edit-watch page updates).
**Flag:** requires human verification — product team should confirm "Coming soon" is the preferred interim UX vs. implementing full write-path wiring.

### WR-03: `notesUpdatedAt` bumped on visibility-only toggle

**Files modified:** `src/app/actions/notes.ts`
**Commit:** 3a8f6f7
**Applied fix:** Removed the `notesUpdatedAt: new Date()` assignment from the `updateNoteVisibility` SET clause. `updatedAt` (the row-level stamp) is still bumped, which matches the review's guidance. `removeNote` continues to bump `notesUpdatedAt` because clearing the note is a content change, which is correct.

### WR-04: `LogTodaysWearButton` button shown to non-owner viewers when wornPublic is on

**Files modified:** (none — addressed by CR-01)
**Commit:** 343d7c3
**Applied fix:** The review explicitly states "The defense-in-depth fix for CR-01 covers this." The `markAsWorn` ownership gate added in CR-01's commit is the authoritative fix — even if an attacker bypasses the UI `{isOwner && <LogTodaysWearButton />}` gate by scripting the Server Action directly, `markAsWorn` now rejects any `watchId` not owned by the caller.

### WR-05: `getProfileByUsername` is case-sensitive

**Files modified:** `src/data/profiles.ts`, `supabase/migrations/20260421000000_profile_username_lower_unique.sql` (new)
**Commit:** 175e333
**Applied fix:**
- `getProfileByUsername` now uses `sql\`lower(${profiles.username}) = lower(${username})\`` — `/u/Tyler` and `/u/tyler` resolve to the same profile.
- Added a new Supabase migration creating a `UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx ON profiles (lower(username))` to block mixed-case duplicate insertions going forward. `CREATE INDEX IF NOT EXISTS` makes the migration idempotent (matches CLAUDE.md guidance).
- No signup-path change needed: the existing profile trigger in `20260420000002_profile_trigger.sql` already lowercases usernames at insert.
**Flag:** requires human verification — migration needs to be applied to prod via `supabase db push --linked` per MEMORY.md, and confirmed that no existing prod data has mixed-case usernames that would block the unique index creation.

### WR-06: `getMostRecentWearDates` uses dynamic import inside hot path

**Files modified:** `src/data/wearEvents.ts`
**Commit:** 3d492d6
**Applied fix:** Added `inArray` to the existing static `import { eq, and, desc, inArray } from 'drizzle-orm'` at the top of the file and removed the `const { inArray } = await import('drizzle-orm')` line inside `getMostRecentWearDates`. No circular-dep concern (the dynamic import was imported from a package already statically imported on the line above).

### WR-07: `revalidatePath('/u/[username]/notes', 'page')` may not match the dynamic route

**Files modified:** `src/app/actions/notes.ts`
**Commit:** 24618f7
**Applied fix:** Changed both `revalidatePath('/u/[username]/notes', 'page')` call sites (in `updateNoteVisibility` and `removeNote`) to `revalidatePath('/u/[username]', 'layout')`. The layout variant was chosen over `revalidatePath('/u/[username]/[tab]', 'page')` because it also flushes sibling tabs (Stats renders a notes-dependent view), matching the review's "or revalidate the layout to be safe" option.
**Flag:** requires human verification — behavior should be smoke-tested by toggling a note's visibility and confirming the Notes tab AND the Stats tab reflect the change without a hard navigation.

## Skipped Issues

None.

---

_Fixed: 2026-04-21T08:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
