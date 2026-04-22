---
status: complete
phase: 09-follow-system-collector-profiles
source: [09-VERIFICATION.md]
started: 2026-04-21T19:20:00Z
updated: 2026-04-22T03:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Click Follow / Unfollow → count persistence across reload (SC #1)
expected: Follower count increments by 1 on initial click. After reload, the count persists at the incremented value and the button shows 'Following'. Clicking Unfollow decrements the count; after reload that persists too.
result: pass

### 2. Private-tab visual (LockedTabCard vs empty state) (SC #2)
expected: Read-only collection rendered first; after flipping collection_public to false, the collection tab shows LockedTabCard with '[User] keeps their collection private.' copy — not an empty state. Worn tab uses 'worn history' wording when worn_public=false.
result: pass

### 3. Follower/Following list interaction — row click vs button click (SC #3)
expected: Heading 'Followers' or 'Following' + subheading. Each row: avatar, displayName or @username, optional bio, 'N watches · M wishlist', inline Follow button. Clicking a row navigates to /u/{other}/collection. Clicking the Follow button does NOT navigate the row.
result: issue
reported: "the following/followers counts are not clickable"
severity: major
diagnosis: |
  ProfileHeader.tsx line 70 renders follower/following counts as plain text,
  not as links. List pages exist at /u/[username]/followers and
  /u/[username]/following — just need to wrap the counts in <Link>.
  LockedProfileState.tsx line 39 has the same issue.

### 4. Common Ground hero band + 6th tab presence/absence (SC #4, PROF-09)
expected: When viewing another collector (not self) with ≥1 shared watch and collection_public=true, Common Ground hero band renders between ProfileHeader and ProfileTabs with one of three pills (Strong/Some/Different overlap). ProfileTabs shows 6 tabs (Common Ground as the 6th). Clicking 'See full comparison →' navigates to /u/{other}/common-ground and shows explainer + shared-watches grid + taste-tag row + dual style/role bars.
expected_when_private: If owner.collection_public=false, hero band is absent AND the 6th tab is absent. Directly visiting /u/{other}/common-ground returns 404.
result: pass

### 5. Follower-count reconciliation without full refresh — including viewer's own profile (SC #5, FOLL-03)
expected: After successful Follow, router.refresh() reconciles the count inline — no hard reload needed. getFollowerCounts re-runs and the ProfileHeader count updates within one refresh cycle. Viewer's OWN profile following count should also reflect the new state on next navigation back.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking a follower/following count navigates to the corresponding list page"
  status: failed
  reason: "User reported: the following/followers counts are not clickable"
  severity: major
  test: 3
  artifacts:
    - src/components/profile/ProfileHeader.tsx:70
    - src/components/profile/LockedProfileState.tsx:39
  missing:
    - "Counts need to be wrapped in <Link href='/u/{username}/followers'> and <Link href='/u/{username}/following'>"
    - "List pages already exist at src/app/u/[username]/followers/page.tsx and /following/page.tsx — just wiring"
