---
status: partial
phase: 08-self-profile-privacy-controls
source: [08-VERIFICATION.md]
started: 2026-04-20T01:10:00Z
updated: 2026-04-20T01:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Profile navigation — owner view
expected: Signed-in user clicks Profile in HeaderNav, lands on /u/[me]/collection; URL reflects the redirect from /u/[me]
result: [pending]

### 2. Tab switching — URL-driven active state
expected: Clicking Wishlist / Worn / Notes / Stats tabs updates URL and highlights the active tab via usePathname; browser back/forward works
result: [pending]

### 3. Private profile — non-owner flow
expected: Owner toggles Profile Visibility off in Settings; a second browser session (different user) visiting /u/[me] sees LockedProfileState (avatar, bio, counts, disabled Follow button, "This profile is private." copy) with NO tab content
result: [pending]

### 4. Settings — optimistic privacy toggles
expected: Clicking any of the 4 PRIV toggles (Profile/Collection/Wishlist/Worn) flips the switch INSTANTLY without page reload; value persists across reload; failed saves snap back to server truth
result: [pending]

### 5. Note visibility pill — optimistic toggle
expected: On /u/[me]/notes, clicking the Public/Private pill on any note row flips instantly; refreshes show the persisted value; non-owner sees the pill disabled (read-only)
result: [pending]

### 6. Log Today's Wear flow
expected: On /u/[me]/worn, clicking "+ Log Today's Wear" opens a Dialog with watch Select; selecting a watch and confirming logs the wear (new event appears in timeline); owner-only — non-owner does not see the CTA
result: [pending]

### 7. Calendar month navigation
expected: On /u/[me]/worn Calendar view, prev/next chevrons (aria-labeled "Previous month" / "Next month") navigate months; today's cell has accent ring; worn days show watch thumbnails; +N badge appears for days with multiple events
result: [pending]

### 8. Stats cards + observations rendering
expected: On /u/[me]/stats with ≥3 owned watches: 4 cards render (Most Worn, Least Worn, Style Distribution, Role Distribution) with div-based horizontal bars, plus Collection Observations panel with sentence-level insights; with <3 owned watches, insufficient-data empty state shows instead
result: [pending]

### 9. Profile edit inline flow
expected: Owner clicks "Edit Profile" on header; header swaps to ProfileEditForm (displayName / avatarUrl / bio inputs); Save persists via updateProfile and returns to view mode with new values visible; Discard returns without saving
result: [pending]

### 10. Remove Note confirmation flow
expected: On /u/[me]/notes, clicking 3-dot menu on a note row shows ONLY "Edit Note" + "Remove Note" (no "Make Public/Private"); clicking Remove Note opens Dialog with "Remove this note?" + "Keep Note" / "Remove Note" buttons; confirming clears the note (row disappears); dropdown is hidden for non-owners
result: [pending]

### 11. New Note Visibility default persistence
expected: In /settings, change "New Note Visibility" dropdown to "Private", reload page, confirm dropdown still reads "Private" (localStorage hydration via useEffect). Note: WR-02 flagged this is currently non-functional beyond UI state (not wired to watch-creation path) — verify at least the dropdown state persists.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
