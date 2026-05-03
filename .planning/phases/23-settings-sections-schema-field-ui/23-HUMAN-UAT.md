---
status: partial
phase: 23-settings-sections-schema-field-ui
source: [23-VERIFICATION.md]
started: 2026-05-01T09:08:50Z
updated: 2026-05-01T09:08:50Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Preferences persistence + brand-loyalist option
expected: Selected option remains 'Brand Loyalist' after refresh; saving indicator briefly visible; no error banner
result: [pending]
test: Visit /settings#preferences, click the Collection goal Select, choose 'Brand Loyalist — Same maker, different models', refresh the page, confirm the value persists

### 2. analyzeSimilarity reads new preference on next read
expected: Verdict label changes (e.g. fewer Hard Mismatch flags) — confirms `analyzeSimilarity()` reads the new preference on next render
result: [pending]
test: On /settings#preferences, change Overlap tolerance from Medium to High, then visit /watch/[id] for any owned watch and confirm the SimilarityBadge or CollectionFitCard verdict reflects the new tolerance

### 3. Cross-surface theme sync (D-06 duplicate-by-design)
expected: Both surfaces stay in sync via the horlo-theme cookie; no flash of unstyled content; theme changes immediately
result: [pending]
test: Visit /settings#appearance, click Light/Dark/System buttons in turn, then open the UserMenu (avatar dropdown top-right) and confirm the InlineThemeSegmented control there reflects the same selection

### 4. notesPublic cross-page revalidation (D-19)
expected: Cross-page revalidation works: revalidatePath('/u/[username]', 'layout') invalidates the user-scoped layout cache so the per-row pill re-renders with the new visibility immediately
result: [pending]
test: Edit a watch via /watch/[id]/edit; toggle the Public/Private pill below the Notes textarea to Private; submit; navigate to /u/{username}/notes; confirm the per-row NoteVisibilityPill on that watch's row reads 'Private'

### 5. Chronometer end-to-end (Checkbox toggle → Certification row appears)
expected: Row renders only when isChronometer === true; lucide Check icon at text-foreground (NOT text-accent); gap-1 between icon and label
result: [pending]
test: Edit a watch and check the 'Chronometer-certified (COSC or equivalent)' Checkbox in the Specifications card; submit; visit /watch/[id]; confirm a 'Certification: ✓ Chronometer' row appears in the Specifications dl

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none yet — awaiting human testing]
