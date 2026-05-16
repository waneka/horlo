---
status: complete
phase: 39b-audit-driven-discovery-polish-heavier-ux
source:
  - 39b-01-SUMMARY.md
  - 39b-02-SUMMARY.md
  - 39b-03-SUMMARY.md
  - 39b-04-SUMMARY.md
  - 39b-05-SUMMARY.md
started: 2026-05-13T20:16:24Z
updated: 2026-05-13T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold-start smoke — /search Watches tab returns seeded catalog rows
expected: On /search Watches tab, typing "omega" returns Omega catalog rows (Speedmaster, Seamaster, etc.). At least 5+ results within ~500ms. No empty state.
result: pass

### 2. ReferenceIdentityCard on /catalog/[catalogId] (fresh-account viewer)
expected: Fresh test account → /search → type "omega" → click a result → /catalog/[id] renders RIC with "Inferred taste signature" caption, era + archetype headline, 3 ScaleBars (Formality / Sportiness / Heritage), motif Badge chips. Below: 3-CTA empty-collection block.
result: pass
note: Originally framed for /watch/[id] (test re-scoped after discovering the `collection.length === 0` gate suppresses RIC for owner-populated viewers). The 100 seeded catalog rows had NULL confidence pre-backfill (commit 80d56e3 + 102-row enrichment); post-fix all rows render the card with confidence 0.62-0.95.

### 3. ReferenceIdentityCard on /watch/[id] (fresh-account viewer)
expected: Same RIC, same gate, but rendered from /watch/[id] instead of /catalog/[id]. Render path is byte-identical to test 2 per D-39b-04 identical-rendering lock (39b-VERIFICATION.md SC#2); static guard `tests/static/ReferenceIdentityCard.no-engine.test.ts` enforces structural parity.
result: pass
note: Passed by equivalence — test 2 exercised the same RIC component under the same `collection.length === 0 && confidence >= 0.5` gate. Live navigation to /watch/[other-user's-watch-id] not exercised because the cross-account navigation path requires public-profile + public-collection privacy alignment, and the underlying render path is contractually locked to test 2's.

### 4. LockedTabCard FollowButton + sign-in branches
expected: Fresh test account visits /u/[main-username]/collection when main's collectionPublic=false → LockedTabCard renders with inline Follow button + caption. (Or, logged-out: sign-in Link → /signin?returnTo=%2Fu%2F[main]%2Fcollection.)
result: pass
note: User flipped main account's collectionPublic to false to exercise the lock, then flipped back. Logged-in Follow branch verified live.

### 5. WornCalendar interactive day cells
expected: Calendar grid with thumbnails on event days. Click an event day → wear-detail panel shows watch + note. Keyboard (Tab + Enter/Space) works the same.
result: pass
note: User flagged that empty days are NOT clickable (no mouse, no keyboard tab). Verified via source — `WornCalendar.tsx:195` gates ALL interactive behavior on `dayEvents.length > 0`. Shipped behavior matches Phase 39b-03 scope as written. Follow-up gap (NOT a regression): the "No wear events on [date]" caption (line 254) exists but is only reachable via the test-only `initialSelectedDate` prop or by navigating to a zero-event month — there's no user path to surface it via click. Wiring empty-day clickability to trigger this caption would close the UX loop; candidate for v5.x backlog seed.

### 6. StatsTabContent — WornList rows clickable
expected: On /u/[main]/stats Most Worn list, each row is a Link with hover state; clicking navigates to /watch/[id]. HorizontalBarChart unchanged.
result: pass

### 7. OtherOwnersRoster on /catalog/[catalogId]
expected: Chip row of avatar+@username chips, hide-if-empty, count label "N collectors own this" only when totalCount > 5.
result: pass
note: User exercised live (option b — both accounts owning a shared catalog ref). Chip row + avatars + usernames rendered correctly. The count label was correctly suppressed (1-2 collectors, ≤5 threshold per `OtherOwnersRoster.tsx:51` D-39b-09). UAT description had two errors: label copy ("Owned by N collectors" → actual: "N collectors own this") and label visibility threshold (claimed always, actual: only when totalCount > 5). Shipped contract verified.

**Product feedback (D-39b-09 reversal):** User says the count label should render on ANY non-zero collector count, not just >5. Treat the shipped "≤5 → suppress label" rule as a UX miscall. Fix: remove `totalCount > 5 &&` gate at `OtherOwnersRoster.tsx:51`; handle singular ("1 collector owns this") vs plural ("N collectors own this") copy. Small follow-up, candidate for the same v5.x backlog seed as the WornCalendar empty-day gap.

### 8. SameFamilyRail on /watch/[id] and /catalog/[catalogId]
expected: "Same family" rail with up to 6 sibling catalog refs (e.g., 6 other Speedmaster Moonwatches), each clickable; sublabel with collector count; hides entirely when family has no siblings.
result: pass

### 9. LineageRail on /watch/[id] and /catalog/[catalogId]
expected: "Lineage" rail with predecessor/successor entries from seeded edges (e.g., Submariner 5513↔14060↔124060), each with Badge sublabel, clickable, capped at 6, hides when no edges.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

## Mid-Session Deviations (out-of-scope work landed during this UAT)

- **2026-05-13 (commits a2594a7 + 80d56e3):** Two prod-affecting bugs discovered while UAT was framing test 1 + test 2 and fixed inline. Both pre-date Phase 39b scope but were surfaced by Phase 39b-01's catalog bootstrap.
  - `a2594a7` — `/search` Watches tab returned empty for all 100 seeded catalog rows. Root cause: `searchCatalogWatches` AND-gated name-match on `(owners_count + 0.5 * wishlist_count) > 0`, stranding 0-popularity rows. Shipped via quick task `260513-hvu` (correct GSD path).
  - `80d56e3` — Catalog taste enrichment had been silently failing in prod with HTTP 400 from Anthropic API for an unknown duration. Root cause: `TASTE_TOOL.strict: true` required `additionalProperties: false` on the object AND forbade `minimum`/`maximum` on number properties — both constraints violated. Removed `strict: true` (Zod validation already covers schema integrity at line 144 of `enricher.ts`). Shipped inline with explicit user authorization to bypass GSD workflow (option 2 of A/B/C choice presented during UAT). Affects ALL taste enrichment surfaces: `scripts/backfill-taste.ts`, `scripts/reenrich-taste.ts`, `src/app/actions/watches.ts`, `src/app/api/extract-watch/route.ts`.
  - Post-fix: backfilled 102 prod catalog rows (100/100 succeeded, 0 failures, mean confidence 0.86, all ≥ 0.5).

- **2026-05-13 (UAT test 4 sidenote — NOT FIXED):** User reported profile pages (/u/[username]/collection, /wishlist, etc.) return a visible 404 in the browser on every initial click from top-nav, but render correctly on hard refresh. Server returns 200 with valid RSC payload (verified — full `CollectionTabContent` tree + correct `isOwner`/`viewerId`). Top-nav `UserMenu.tsx:111` links directly to `/u/[username]/collection` (NOT via the redirect file). Suspected cause: Next.js App Router prefetch cache poisoned by an earlier 404 (deploy timing window or pre-existing-username miss). Not in 39b scope — needs separate `/gsd-debug` session if it persists past prefetch-cache TTL.
