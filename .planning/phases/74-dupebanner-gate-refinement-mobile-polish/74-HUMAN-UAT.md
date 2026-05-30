---
status: partial
phase: 74-dupebanner-gate-refinement-mobile-polish
source: [74-VERIFICATION.md]
started: 2026-05-30
updated: 2026-05-30
deploy_bundle: v8.1 (Phases 72 + 73 + 74) — single Vercel deploy, single UAT walk per CONTEXT D-15
---

## Current Test

[awaiting bundled v8.1 prod UAT walk on horlo.app — iPhone Safari required for MOB-01 items]

## Tests

### 1. DUPE-04 — Confirm screen feels clean under DupeBanner (visual)
expected: When DupeBanner mounts (`state.dupeContext != null`), the ConfirmStep primary CTA is absent from the DOM (no "Saving..." button, no disabled stub, no helper text). The banner IS the choice surface; the confirm screen below it should look intentional, not broken. Structural absence is asserted in jsdom; this item confirms it reads correctly to a human eye.
test_url: horlo.app — add a watch that triggers a dupe (either an already-owned reference or a wishlist reference)
result: [pending]

### 2. MOB-01 — iOS Safari input focus does not auto-zoom (SC#2)
expected: Tap any input/textarea/select on horlo.app from iPhone Safari (comment composer, search box, watch form fields, filters). The page MUST NOT auto-zoom on focus. Confirmed on: (a) comment composer at any watch detail page, (b) edit-comment textarea on a comment you own, (c) SearchEntry on `/watch/new`.
test_url: horlo.app — iPhone Safari (any user-facing input surface)
device: iPhone Safari (real device, not simulator)
result: [pending]

### 3. MOB-01 — Pinch-zoom still works (SC#3)
expected: After the font-size floor lands, two-finger pinch-zoom on any horlo.app page MUST still work. The viewport meta MUST NOT have `maximum-scale=1` / `user-scalable=no`. (Static guard at `tests/static/no-iOS-zoom-viewport.test.ts` enforces the meta-tag invariant; this UAT item confirms the runtime accessibility behavior.)
test_url: horlo.app — any page, iPhone Safari
device: iPhone Safari
result: [pending]

### 4. MOB-01 — No visual regressions in other form contexts (SC#4)
expected: The new `@layer base` font-size floor on `input, textarea, select` MUST NOT visibly enlarge/shrink form controls on desktop where shadcn primitives + utility classes already control sizing. Quick visual sweep: (a) WatchForm at `/watch/new` (desktop), (b) comment composer on a watch detail (desktop), (c) filter controls in the collection view (desktop). Should look identical to pre-fix.
test_url: horlo.app — desktop browser
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
