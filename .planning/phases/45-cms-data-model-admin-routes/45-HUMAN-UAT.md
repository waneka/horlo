---
status: partial
phase: 45-cms-data-model-admin-routes
source: [45-VERIFICATION.md]
started: 2026-05-18
updated: 2026-05-18
---

## Current Test

[awaiting human testing]

## Tests

### 1. Owner reaches the admin routes
expected: Signed in as twwaneka@gmail.com, navigating to `/admin/lists` and `/admin/paths` renders the admin pages (no redirect).
result: [pending]

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
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
