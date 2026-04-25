---
status: complete
phase: 16-people-search
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md, 16-04-SUMMARY.md, 16-05-SUMMARY.md
started: 2026-04-25T18:00:00Z
updated: 2026-04-25T19:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Nav Search Input Restyle (D-24)
expected: On a desktop viewport (≥768px), the persistent search input in the top nav shows muted-fill background, leading magnifier icon, balanced width, and lifts on focus.
result: pass

### 2. HeaderNav Purge (D-23)
expected: The desktop top nav no longer shows inline Profile / Settings / Collection links between the wordmark and the search input. Profile and Settings are reachable only via the avatar dropdown (UserMenu) on the right.
result: pass

### 3. Nav Search Submit → /search Flow
expected: Typing a query into the nav search input on any page (e.g., "bob") and pressing Enter navigates to /search?q=bob. The page-level input on /search is pre-filled with "bob" and shows results within ~250ms.
result: pass

### 4. /search Renders 4 Tabs With All as Default
expected: Visiting /search shows four tabs in this order: All · Watches · People · Collections. The All tab is selected by default. The URL is just /search (no ?tab= param when on All).
result: pass

### 5. Watches and Collections Tabs Show Full-Page Coming-Soon
expected: Clicking the Watches tab shows a full-page "coming soon" card with an icon, heading, and explanatory copy. Same for Collections. Typing in the input while on either tab does NOT fire any search request (no network call to searchPeopleAction).
result: pass

### 6. Pre-Query State Shows Suggested Collectors
expected: With no query typed (or the input cleared), the All and People tabs show a "Collectors you might like" section with up to 8 suggested collector rows. There is NO "Load More" button (this differs from the home page suggested collectors).
result: pass

### 7. People Search Results Render Correctly
expected: Typing 2+ characters in the input on the All or People tab debounces 250ms, then renders matching collectors as rows. Each row shows: avatar, username, bio snippet (one line), taste overlap pill (e.g., "30% taste overlap"), and an inline Follow button.
result: pass

### 8. Match Highlighting on Username and Bio
expected: When results render for a query like "bo", the matching substring "bo" is bolded (wrapped in <strong>) wherever it appears in the username or bio snippet. Case-insensitive (matches "Bo", "BO", "bO" too). No raw HTML or scripts ever render — special characters render as literal text.
result: pass

### 9. No-Results State Shows Suggested Collectors
expected: Typing a query that matches no collectors (e.g., "zzzzzz") shows a "No collectors match 'zzzzzz'" message followed by the same "Collectors you might like" suggested-collectors block (up to 8 rows, no Load More).
result: pass

### 10. Loading Skeleton During Fetch
expected: Between typing the 2nd character and results rendering (~250ms+), 4 skeleton rows shaped like result rows appear (animate-pulse shimmer). Skeletons disappear when results arrive.
result: pass

### 11. Two-Character Minimum
expected: Typing exactly 1 character (e.g., "a") does NOT fire any search — no skeleton, no network call, no URL ?q= param. Only at 2+ characters does the search fire.
result: pass

### 12. Whole-Row Click Navigates to Profile
expected: Clicking anywhere on a result row (avatar, name, bio snippet area — but NOT the Follow button) navigates to that collector's profile (/u/{username}/collection). Clicking the Follow button toggles follow state without navigating.
result: pass

### 13. FollowButton Toggle Without Page Reload
expected: Clicking the Follow button on a result row toggles between "Follow" and "Following" states immediately (optimistic). The page does not reload. The button reflects the new state until you refresh or re-search.
result: pass

### 14. All-Tab Compact Footer Cards
expected: On the All tab only, below the People results (or pre-query suggested-collectors), two side-by-side compact "coming soon" cards appear (e.g., "Watches search coming soon" and "Collections search coming soon"). These compact footers do NOT appear on the People tab.
result: pass

### 15. Page-Level Input Autofocus + Pre-fill from ?q=
expected: Visiting /search directly (e.g., from the nav search submit) places focus in the page-level input automatically. Visiting /search?q=alice shows "alice" pre-filled in the input and immediately fires the search.
result: pass

### 16. Privacy: Private Profiles Hidden From Search
expected: A user whose profile_public = false does NOT appear in search results for non-followers (verify with a test user toggling Profile Visibility OFF in /preferences, then searching from a different account that doesn't follow them).
result: pass

## Summary

total: 16
passed: 16
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
