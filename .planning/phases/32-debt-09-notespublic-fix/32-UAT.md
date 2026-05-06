---
status: testing
phase: 32-debt-09-notespublic-fix
source: [32-01-SUMMARY.md]
started: 2026-05-06T22:58:00Z
updated: 2026-05-06T22:58:00Z
---

## Current Test

number: 1
name: Toggle notesPublic on existing watch — pill updates without hard refresh
expected: |
  On a watch that has notes, edit it, toggle the "Notes are public" setting (or whatever the form labels it as), save. Navigate to /u/{your-username}/notes — the per-row visibility pill (NoteVisibilityPill) reflects the new state immediately, without you needing to manually refresh the page.
awaiting: user response

## Tests

### 1. Toggle notesPublic on existing watch — pill updates without hard refresh
expected: |
  On a watch that has notes, edit it, toggle the "Notes are public" setting (or whatever the form labels it as), save. Navigate to /u/{your-username}/notes — the per-row visibility pill (NoteVisibilityPill) reflects the new state immediately, without you needing to manually refresh the page.
result: [pending]

### 2. Add a new watch with notesPublic toggled
expected: |
  Add a new watch via the "Add Watch" flow (URL import or manual). On the form, set the notes visibility toggle to a non-default state and add some notes. Save. Navigate to /u/{your-username}/notes — the new watch's row shows the notes with the chosen visibility pill (matching what you just selected, not silently defaulted to public).
result: [pending]

### 3. notesPublic survives a page reload (DB persistence)
expected: |
  After test 1 or 2 above, hard-refresh /u/{your-username}/notes (Cmd+Shift+R or equivalent). The visibility pill on the modified watch row still shows your chosen state — i.e., the value was actually written to the database, not just to client-side state.
result: [pending]

### 4. Edit form does NOT throw a validation error on submit when notesPublic is included
expected: |
  Open any watch's edit form, change ANY field (note text, status, etc.) — without explicitly touching the notes-visibility toggle — and save. The form submits successfully (no Zod validation error, no "Invalid input" toast, no console error). This confirms the schema accepts notesPublic as optional and pre-fix submissions are no longer breaking.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]
