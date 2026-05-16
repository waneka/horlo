---
status: complete
phase: 42-nyquist-hardening-sweep-uat-triage-parallel-track
source: [42-PRE-TRIAGE.md — CLOSED-candidate items]
started: 2026-05-16T06:32:41Z
updated: 2026-05-16T00:00:00Z
---

## Current Test

[complete — all 24 items verified 2026-05-16]

## Tests

### 1. Sparse-network hero render
expected: Visit `/explore` while logged in as a user with fewer than 3 follows AND zero wear events. The sparse-network welcome hero renders (not a blank page or the populated-network layout). Setup: use a fresh account or an account with <3 follows and no wear events logged.
original phase: 18
result: pass

### 2. See-all surfaces — Popular Collectors and Gaining Traction
expected: From `/explore`, click the "See all" link on the Popular Collectors rail → navigates to `/explore/collectors` with a populated full list of public profiles. Also click the "See all" link on the Gaining Traction rail → navigates to the full Gaining Traction page. Both pages render with data, not an error or empty state.
original phase: 18
result: pass

### 3. Mobile BottomNav — Explore slot
expected: On a mobile viewport (or iPhone browser), the bottom navigation bar shows the Explore slot at the correct position with the Compass (or equivalent) icon. Tapping it navigates to `/explore`.
original phase: 18
result: pass

### 4. Follow→/explore SWR revalidation
expected: From `/explore`, follow a new collector. After following, the Popular Collectors rail refreshes or updates to exclude the newly followed user (SWR revalidation fires). The surface reflects the new follow state without a hard page reload.
original phase: 18
result: pass

### 5. Add-watch→/explore SWR fan-out
expected: Add a new watch to your collection via the extract flow (`/watch/new`). After adding, visit `/explore`. The Trending Watches rail and Gaining Traction rail reflect catalog data that may include the newly cataloged watch (or at minimum the add does not break the rails). The fan-out revalidation does not cause errors or stale renders.
original phase: 18
result: pass

### 6. Popular Collectors rail correctness
expected: The Popular Collectors rail on `/explore` shows the most-followed public profiles (excluding self and already-followed users). Each collector card shows a follow count. The ordering is by follower count descending.
original phase: 18
result: pass

### 7. Trending Watches rail correctness
expected: The Trending Watches rail on `/explore` shows catalog watches with high ownership counts. Clicking a watch card navigates to `/catalog/{id}`. Rails are not empty (assuming catalog has data).
original phase: 18
result: pass

### 8. /explore/collectors full-list page
expected: Navigate directly to `/explore/collectors`. The full popular-collectors list page renders with multiple collector cards. No 404 or error. Pagination or "load more" works if applicable.
original phase: 18
result: pass

### 9. D-08 self-via-cross-user callout
expected: Log in as User A, then navigate to `/watch/{id}` for a watch owned by User A while accessing via a cross-user context (or in a fresh session as User A viewing their own watch on the public route). The correct self-identification callout appears (not a cross-user verdict frame). Setup requires two accounts or direct URL navigation.
original phase: 20
result: pass

### 10. FIT-02 phrasing quality on real collection data
expected: On `/watch/{id}` for a watch you own, the CollectionFitCard verdict copy reads naturally — not formulaic or repetitive. The contextual phrasings feel appropriate for the specific fit label (Core Fit, Role Duplicate, Hard Mismatch, etc.) shown on your real collection data.
original phase: 20
result: pass

### 11. Manual entry inline flow (entry + escape)
expected: On `/watch/new`, click "or enter manually" below the URL input → the inline WatchForm appears. Then verify you can ALSO escape back to URL entry mode using a Cancel / "Use URL instead" affordance (added by gap-closure plan 20.1-08). Both entry and escape work without a page refresh.
original phase: 20.1
result: pass

### 12. Extraction failure recovery
expected: On `/watch/new`, paste a URL that is known to fail extraction (a non-watch URL or a paywalled page). The flow shows a categorized error card (`ExtractErrorCard`) with a clear error category and a "Enter manually" continuation option. No dead-end; no raw error stack.
original phase: 20.1
result: pass

### 13. Deep-link /watch/new?catalogId smoke
expected: Navigate to `/watch/new?catalogId=<a valid catalog ID from your collection or the catalog>`. The add-watch flow pre-fills from the catalog entry (brand, model, image). The verdict step correctly shows the catalog-based fit against your collection. Setup: find a valid `catalogId` from a `/catalog/{id}` URL in your account.
original phase: 20.1
result: pass

### 14. Email change end-to-end (live Resend SMTP)
expected: On `/settings#account`, trigger an email address change to a real email address you control. Receive confirmation emails at both the old and new addresses. Click the confirmation link. Confirm the change lands on `/settings#account?status=email_changed` with a success toast. The new email address now shows as current in the Account section.
original phase: 22
result: pass

### 15. Password change — fresh session
expected: On `/settings#account`, from a fresh login session (session started within the last 24h), trigger a password change. The change applies without triggering the re-auth dialog. Confirm you can log in with the new password.
original phase: 22
result: pass

### 16. Password change — stale session re-auth
expected: On `/settings#account`, from a session older than 24h (log in, then wait more than 24h, or test in an environment where you can simulate a stale session token), trigger a password change. The re-auth dialog appears before the change applies. After re-authenticating, the password change succeeds.
original phase: 22
result: pass

### 17. /settings vertical-tabs visual layout
expected: Navigate to `/settings`. The page renders a single-page vertical-tabs layout with sections in canonical order: Account / Profile / Preferences / Privacy / Notifications / Appearance. Tab state is hash-driven (switching tabs does not cause a full page reload; the URL hash updates). Visual hierarchy is correct.
original phase: 22
result: pass

### 18. /preferences redirect
expected: Navigate directly to `/preferences` (not `/settings#preferences`). You are redirected to `/settings#preferences` — the Preferences tab is active. No 404.
original phase: 22
result: pass

### 19. Email-change banner persistence
expected: Trigger an email change on `/settings#account`. The "Confirmation sent to both old@ and new@" pending banner remains visible if you switch to a different settings tab and return to the Account tab — it does not prematurely clear on tab switch.
original phase: 22
result: pass

### 20. Preferences persistence — Brand Loyalist
expected: Visit `/settings#preferences`. In the Collection goal select, choose "Brand Loyalist — Same maker, different models". Refresh the page. Confirm the selected option persists as "Brand Loyalist". A saving indicator should briefly appear when the selection is made; no error banner.
original phase: 23
result: pass

### 21. analyzeSimilarity reads new preference on next render
expected: On `/settings#preferences`, change the Overlap tolerance from Medium to High (or any change). Then visit `/watch/{id}` for any watch in your owned collection. Confirm that the CollectionFitCard verdict label reflects the new tolerance (e.g., fewer Hard Mismatch flags at High tolerance vs Medium). The preference change propagates on next render without a full re-login.
original phase: 23
result: pass

### 22. Cross-surface theme sync
expected: Visit `/settings#appearance`. Click Light, then Dark, then System in the theme segmented control. For each selection: (a) the page theme applies immediately; (b) open the UserMenu (avatar dropdown in top-right) and confirm the `InlineThemeSegmented` control there shows the same selection. Both surfaces stay in sync via the `horlo-theme` cookie. No flash of unstyled content.
original phase: 23
result: fail
failure note: Light mode is not working — only dark mode applies. Clicking Light in the theme menu does not change the applied theme. After a page refresh, the Light preference is correctly persisted (Light shows as selected) but the dark theme CSS is still applied. Diagnosis: theme-preference persistence works; theme application for Light mode is broken (the rendered theme never leaves dark).

### 23. notesPublic cross-page revalidation
expected: Edit a watch via `/watch/{id}/edit`. Toggle the Public/Private pill below the Notes textarea to "Private" (if it was Public). Submit the form. Navigate to `/u/{your-username}/notes`. The per-row `NoteVisibilityPill` on that watch's note row shows "Private" immediately — no stale "Public" state. (Phase 32 fixed the server-action regression that blocked this item previously.)
original phase: 23
result: pass

### 24. Chronometer end-to-end
expected: Edit a watch via `/watch/{id}/edit`. In the Specifications card, check the "Chronometer-certified (COSC or equivalent)" checkbox. Submit the form. Visit `/watch/{id}`. A "Certification: ✓ Chronometer" row appears in the Specifications section. The check icon is at `text-foreground` (not gold/accent color). The gap between the icon and label "Chronometer" is `gap-1` (compact).
original phase: 23
result: pass

## Summary

total: 24
passed: 23
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### Gap 1: Light-mode theme application broken (item 22 — Cross-surface theme sync)

**Original phase:** 23
**UAT verdict:** fail (2026-05-16)
**Symptom:** Clicking "Light" in the theme segmented control (on `/settings#appearance` or the UserMenu `InlineThemeSegmented`) does not apply the light theme. The applied theme remains dark regardless of the Light selection.
**Preference persistence:** Works correctly — after a page refresh, Light is shown as the selected option. The `horlo-theme` cookie or localStorage preference record is being written. Only the *application* of the light theme CSS is broken.
**Root cause hypothesis:** The theme-application logic (likely the `<html>` class or `data-theme` attribute set by the theme provider) does not react to the Light selection at runtime. The selector or conditional that translates the stored preference into the applied CSS class may be missing the Light branch, or the provider only re-applies on mount (not on user selection).
**Disposition:** DEFERRED — carry to v5.x gap-closure sprint. The dark theme is functional; light mode is a regression that requires debugging the theme-application pathway (not persistence).
