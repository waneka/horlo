---
status: partial
phase: 09-follow-system-collector-profiles
source: [09-VERIFICATION.md]
started: 2026-04-21T19:20:00Z
updated: 2026-04-21T19:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Click Follow / Unfollow → count persistence across reload (SC #1)
expected: Follower count increments by 1 on initial click. After reload, the count persists at the incremented value and the button shows 'Following'. Clicking Unfollow decrements the count; after reload that persists too.
result: [pending]

### 2. Private-tab visual (LockedTabCard vs empty state) (SC #2)
expected: Read-only collection rendered first; after flipping collection_public to false, the collection tab shows LockedTabCard with '[User] keeps their collection private.' copy — not an empty state. Worn tab uses 'worn history' wording when worn_public=false.
result: [pending]

### 3. Follower/Following list interaction — row click vs button click (SC #3)
expected: Heading 'Followers' or 'Following' + subheading. Each row: avatar, displayName or @username, optional bio, 'N watches · M wishlist', inline Follow button. Clicking a row navigates to /u/{other}/collection. Clicking the Follow button does NOT navigate the row.
result: [pending]

### 4. Common Ground hero band + 6th tab presence/absence (SC #4, PROF-09)
expected: When viewing another collector (not self) with ≥1 shared watch and collection_public=true, Common Ground hero band renders between ProfileHeader and ProfileTabs with one of three pills (Strong/Some/Different overlap). ProfileTabs shows 6 tabs (Common Ground as the 6th). Clicking 'See full comparison →' navigates to /u/{other}/common-ground and shows explainer + shared-watches grid + taste-tag row + dual style/role bars.
expected_when_private: If owner.collection_public=false, hero band is absent AND the 6th tab is absent. Directly visiting /u/{other}/common-ground returns 404.
result: [pending]

### 5. Follower-count reconciliation without full refresh — including viewer's own profile (SC #5, FOLL-03)
expected: After successful Follow, router.refresh() reconciles the count inline — no hard reload needed. getFollowerCounts re-runs and the ProfileHeader count updates within one refresh cycle. Viewer's OWN profile following count should also reflect the new state on next navigation back.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
