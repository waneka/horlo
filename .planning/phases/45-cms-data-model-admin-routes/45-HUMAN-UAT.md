---
status: partial
phase: 45-cms-data-model-admin-routes
source: [45-VERIFICATION.md]
started: 2026-05-18
updated: 2026-05-18
---

## Current Test

[human testing in progress — 1 pass, 4 gaps found 2026-05-18]

## Tests

### 1. Owner reaches the admin routes
expected: Signed in as twwaneka@gmail.com, navigating to `/admin/lists` and `/admin/paths` renders the admin pages (no redirect).
result: passed — owner reached the admin routes and authored content.

### 2. Non-owner is redirected from /admin
expected: Signed in as a non-owner (e.g. twwaneka+1@gmail.com), navigating to `/admin/lists` or `/admin/paths` redirects to `/`.
result: [pending]

### 3. Cover image upload pipeline
expected: In the curated-list editor, uploading a cover image strips EXIF, re-encodes, uploads to the `cms-covers` bucket, and renders via CDN URL at a 16:9 `object-cover` frame.
result: [pending]

### 4. Markdown sanitization
expected: A `javascript:` URL written into a list's intro markdown does not produce a clickable/executable link in the rendered preview (rehype-sanitize strips it).
result: [pending]

### 5. Path-type chips + publish guard
expected: The path editor's four path-type chips are single-select; a list/path with zero watches cannot be published (Publish disabled with explanatory tooltip).
result: [pending]

### 6. Hero-pin dialog flow
expected: Pinning a curated list as the hero (with/without expiry) and clearing the pin both round-trip correctly through `setPinnedHero` / `clearPinnedHero`.
result: [pending]

### 7. FK RESTRICT delete-block surfacing
expected: Attempting to delete a catalog watch referenced by a published list/path is blocked at the DB layer and surfaces a foreign-key error message. (Scope-limited in Phase 45 — there is no catalog-watch delete UI inside /admin; verify via DB or a future catalog-admin surface.)
result: [pending]

## Summary

total: 7
passed: 1
issues: 4
pending: 1
skipped: 1
blocked: 0

## Gaps

### GAP-1: Markdown preview does not render block elements
status: failed
severity: warning
detail: In the list editor markdown preview, `#` headings and `-` bulleted lists
  render as plain body text. Italic (`*text*`) works. Cause: `@tailwindcss/typography`
  is not installed and the preview container (`MarkdownEditor.tsx`) has no `prose`
  class — Tailwind Preflight resets heading sizes and list markers. Markdown IS
  parsed and sanitized correctly; this is a CSS-chain gap.
fix: Install `@tailwindcss/typography`; apply `prose prose-sm` (dark-mode aware) to
  the preview container and to the eventual public list-detail render so they match.

### GAP-2: Added watches do not appear until page refresh
status: failed
severity: warning
detail: In the list editor, searching for a watch and clicking it runs
  `addWatchToList` server-side but the UI does not update — the item list and the
  publish guard stay stale until a hard reload. Cause: CMS actions call
  `revalidateTag('explore:hero')` but never `revalidatePath` the admin editor route,
  and `ListEditorClient`/`PathEditorClient` handlers do not `router.refresh()` after
  the action resolves.
fix: Add `revalidatePath` for the admin editor routes to the relevant Server Actions
  (add/remove watch, reorder, commentary) and/or `router.refresh()` in the client
  handlers after a successful result.

### GAP-3: Newly saved list missing from /admin/lists until refresh
status: failed
severity: warning
detail: After creating/saving a list and navigating back to `/admin/lists`, the new
  list is absent until a hard reload. Same root cause as GAP-2 — `createList` /
  list mutations do not `revalidatePath('/admin/lists')` (and `/admin/paths` for the
  path index).
fix: Add `revalidatePath('/admin/lists')` and `revalidatePath('/admin/paths')` to the
  create/update/delete Server Actions for lists and paths.

### GAP-4: Watch cards show the catalog UUID instead of brand/model/reference
status: failed
severity: warning
detail: Watch cards in both the list editor and path editor display
  `Watch ID: {catalogId}` rather than the watch's brand, model, and reference.
  Cause: `getListItems` / path-node DAL functions do not join `watches_catalog`, so
  items carry only `catalogId`; the editor components render the truncated UUID.
fix: Join `watches_catalog` in the list-items and path-nodes DAL reads to return
  brand/model/reference; render those fields on the watch cards in
  `ListEditorClient` and `PathEditorClient`.

### Verified clean
- UAT item 1 (owner reaches admin routes) — passed.
- Items 2, 3, 5, 6 — not yet retested (pending; retest after gap closure).
- Item 7 (FK RESTRICT) — skipped: no catalog-watch delete UI in Phase 45 (D-09);
  DB-level guarantee only.
