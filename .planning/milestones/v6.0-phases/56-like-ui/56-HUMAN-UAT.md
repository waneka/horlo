---
status: complete
phase: 56-like-ui
source: [56-VERIFICATION.md]
started: 2026-05-22
updated: 2026-05-22
---

## Current Test

[testing complete — 4/4 passed on prod (horlo.app)]

## Tests

### 1. Overlay CSS chain — signed-photo path (D-08)
expected: Visit a wear detail page that has a real photo (`/wear/<wearEventId>`). The photo renders at a 4:5 aspect ratio; avatar + username + timestamp overlay TOP-LEFT; brand + model overlay BOTTOM-LEFT; overlay text white and legible. Overlays must NOT appear over the loading skeleton (CR-01 fix — `status !== 'pending'` gate). Footer row with heart + count.
result: pass
notes: User confirmed on prod (horlo.app) — "looks great". CR-01 fix verified (no overlay-over-skeleton). Raised 4 enhancement requests during this test — see ## Enhancement Notes below (tracked for a follow-up polish round, NOT failures of this test).

### 2. Overlay CSS chain — no-photo bg-muted fallback (D-08)
expected: Visit a wear page whose photo failed to load or has no signed URL (the `bg-muted` fallback). The top and bottom overlays still render, with text in `text-foreground` (not white) so it is legible on the light muted surface. The OLD centered `{brand} {model}` text inside the fallback is gone (brand/model now live in the bottom overlay only).
result: pass
notes: User confirmed on prod. Phase 30 blind-spot path verified clean.

### 3. Anon like → login redirect (LIKE-02 / D-10, full browser flow)
expected: While logged OUT, open a wear detail page. The heart + count are visible; the count shows when ≥ 1. Clicking the heart navigates to `/login?next=%2Fwear%2F<wearEventId>` (no like recorded, no error toast). After logging in via that link, you land back on the wear page.
result: pass
notes: |
  Security intent SATISFIED, mechanism differs (and user PREFERS the actual behavior).
  Anon does NOT see the heart on the wear page — the pre-existing src/proxy.ts auth gate
  redirects all non-public routes to /login BEFORE the page renders (PUBLIC_PATHS = login/
  signup/forgot-password/reset-password/auth only). So /wear AND /watch are authed-only.
  Phase 56 did NOT change proxy.ts/public-paths.ts (last touched Phase 51). The button-level
  anon bounce was never reachable. DECISION CHANGE: CONTEXT D-10 ("anon sees count on wear")
  is SUPERSEDED — wear detail is auth-only like watch detail (user-endorsed 2026-05-22).

### 4. SEC-05 cross-viewer cache isolation
expected: As viewer A, like a watch (or wear). As a DIFFERENT viewer B (separate session/browser), load the same detail page: B sees the updated count but B's own heart is NOT in the liked state. A's like does not leak into B's `viewerHasLiked`.
result: pass
notes: User confirmed on prod — viewerId cache-key isolation holds; no cross-viewer like-state leakage.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Enhancement Notes

> Surfaced during Test 1 on prod. The phase goal is verified — these are net-new polish/scope
> for a follow-up round (likely a Phase 56.1 polish or `/gsd-plan-phase 56 --gaps`). NOT test failures.

- **EN-1 — Full-screen wear detail on mobile (hide top/bottom nav).** status: needs_decision.
  Net-new layout decision (not in 56 CONTEXT/UI-SPEC). Open questions: wear-detail only or watch-detail too? mobile breakpoint only? how does the user navigate back when nav is hidden (rely on browser/back affordance)? severity: enhancement.
- **EN-2 — Overlay text legibility: brighter white + text-shadow on both surfaces; timestamp slightly lighter.** status: ready.
  Refines D-08. Replace flat `text-white`/`text-foreground` with a brighter white + a subtle dark `text-shadow` (legible on light AND dark photos, more robust than the scrim alone). Timestamp currently muted — keep muted but raise lightness a step. severity: cosmetic/legibility.
- **EN-3 — Avatar links to collector page.** status: ready.
  Top overlay: username already links to `/u/<username>`; wrap the avatar in the same link. severity: minor (missing affordance).
- **EN-4 — Brand/model links to the watch detail page.** status: ready.
  Bottom overlay: make brand/model a link to `/watch/<watchId>` (the wear record carries the watch id). severity: minor (missing affordance).
- **EN-5 — Desktop wear-detail fits the viewport (no scroll for photo + note + footer).** status: needs_decision.
  On desktop the 4:5 photo at `md:max-w-[600px]` (~750px tall) pushes the like/footer row below the fold. The whole section (photo + note caption + comment/like footer) should be visible without scrolling. Likely lever: cap the photo container height by viewport (e.g. `max-h-[...vh]` / `object-contain`) so the footer always fits. Pairs with EN-1 (mobile full-screen) — both are "wear detail = viewport-fit view". severity: enhancement (layout).
- **EN-6 — Remove dead anon-handling code (wear page is auth-only).** status: ready.
  Decision change confirmed in Test 3: `/wear/[wearEventId]` is gated by `src/proxy.ts` (only PUBLIC_PATHS are anon-accessible), so `viewerId` is never null there. Remove the `__anon__` sentinel in the wear page's `getLikesForTargetCached(viewerId ?? '__anon__', …)` call (pass the authed `user.id` like the watch page does). `LikeButton`'s `viewerId: string|null` + null→`/login` bounce can stay as harmless defensive code or be simplified to `string` on both callsites. Update CONTEXT D-10 to note supersession. severity: cleanup (dead code; no behavior change).

## Gaps

[none — no test failures; see ## Enhancement Notes for follow-up polish items]
