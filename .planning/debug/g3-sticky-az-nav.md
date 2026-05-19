---
status: diagnosed
trigger: "G3-sticky-az-nav — A–Z jump-nav bar on /explore/brands does not stay pinned to top of viewport while scrolling"
created: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — the A–Z nav IS sticky and IS pinning, but it pins at `top: 0`, the exact position already occupied by the global top-nav header (also `sticky top-0`, z-50). The A–Z nav (z-10) pins behind the opaque header and is fully occluded — indistinguishable from "scrolls away" to the user.
test: Traced DOM ancestry; inspected Header / SlimTopNav / DesktopTopNav classes.
expecting: n/a — root cause confirmed.
next_action: Hand off to fix — change the A–Z nav `top-0` to a header-clearing offset (`top-12` mobile / `md:top-16` desktop).

## Symptoms

expected: The A–Z nav bar on /explore/brands stays pinned to the top of the viewport and remains visible while scrolling the brand list.
actual: The A–Z nav bar scrolls away with page content. page.tsx declares `sticky top-0` on the nav so CSS is present but ineffective.
errors: None.
reproduction: Open /explore/brands, scroll down past the first letter section, observe the A–Z nav bar.
started: Discovered during Phase 46 UAT (Test 2).

## Eliminated

- hypothesis: An ancestor element has overflow set to non-visible, silently disabling position:sticky.
  evidence: Full ancestry traced — html.h-full > body.min-h-full.flex.flex-col > main.flex-1 (layout.tsx) > main.container (page.tsx) > nav. No `overflow-*` class on any ancestor. globals.css contains zero `overflow` declarations. ThemeProvider renders only a React context (no DOM wrapper).
  timestamp: 2026-05-18T00:00:00Z

- hypothesis: A flex/grid parent constrains the sticky element's containing-block height.
  evidence: body is `flex flex-col`; main is `flex-1`. A flex-1 child grows to content height and the page scrolls on the viewport (no inner scroll container). Sticky inside a flex child works for top-pinning. The nav DOES pin — it is simply pinned out of sight (see root cause).
  timestamp: 2026-05-18T00:00:00Z

## Evidence

- timestamp: 2026-05-18T00:00:00Z
  checked: src/app/explore/brands/page.tsx
  found: nav has `sticky top-0 z-10` classes; nav is a direct child of `<main className="container mx-auto px-4 md:px-8 py-8 max-w-2xl">`. The letter sections sibling provides the scroll content.
  implication: Sticky element + class are correct. Issue must be elsewhere — ancestor overflow OR a competing sticky element.

- timestamp: 2026-05-18T00:00:00Z
  checked: src/app/layout.tsx, src/app/globals.css, src/components/theme-provider.tsx
  found: Ancestry is html.h-full > body.min-h-full.flex.flex-col.bg-background > main.flex-1.pb-[...] > (page) main.container. No overflow anywhere. layout.tsx renders <Header/> as a sibling ABOVE the page's <main>.
  implication: Not an overflow trap. Rules out the primary investigation hint.

- timestamp: 2026-05-18T00:00:00Z
  checked: src/components/layout/SlimTopNav.tsx, src/components/layout/DesktopTopNav.tsx
  found: SlimTopNav (mobile, <768px) renders `<header className="sticky top-0 z-50 ... h-12 ...">`. DesktopTopNav (>=768px) renders `<header className="sticky top-0 z-50 ... h-16 ...">`. Both are `sticky top-0` with z-index 50, opaque (`bg-background/80 backdrop-blur`).
  implication: The global top-nav header ALREADY occupies `top: 0` of the viewport scroll. The A–Z nav also targets `top: 0` but with z-10 (< 50). The A–Z nav becomes sticky and pins — directly behind the header — and is fully covered by the opaque header bar (48px mobile / 64px desktop). User sees the A–Z bar vanish under the header == "scrolls away".

- timestamp: 2026-05-18T00:00:00Z
  checked: scroll-mt usage in src/app/explore/brands/page.tsx
  found: Letter <section> elements use `scroll-mt-12` (3rem / 48px). This offsets anchor-jump landing by 48px (the mobile header height) so jumped-to letters are not hidden under the header.
  implication: The original author KNEW about the 48px header offset (applied it to scroll-margin for anchor jumps) but did not apply the equivalent offset to the sticky nav's own `top` value. The bug is an inconsistency: `scroll-mt-12` accounts for the header, `top-0` does not.

## Resolution

root_cause: |
  The A–Z jump-nav's `position: sticky` is NOT broken — it pins correctly. The bug
  is the pin TARGET. The nav uses `top-0`, which pins it to the very top of the
  viewport scroll region. But the global top-nav header (SlimTopNav on mobile,
  DesktopTopNav on desktop, rendered by src/app/layout.tsx > Header) is ALSO
  `sticky top-0` and sits at z-50 with an opaque `bg-background/80 backdrop-blur`
  background. The A–Z nav is z-10. So when the user scrolls, the A–Z nav pins to
  top: 0 — the exact pixels the header already occupies — and is rendered entirely
  behind the opaque 48px (mobile) / 64px (desktop) header. From the user's
  perspective the A–Z bar disappears, which reads as "it scrolls away."
  The author was aware of the header height (letter sections use `scroll-mt-12`
  = 48px so anchor jumps clear the header) but forgot to apply the same offset to
  the sticky nav itself.
fix: |
  Change the A–Z nav's sticky offset from `top-0` to a header-clearing offset:
  `top-12` (3rem = 48px, mobile header height) and `md:top-16` (4rem = 64px,
  desktop header height). i.e. className `sticky top-12 md:top-16 z-10 ...`.
  Optionally bump z-index if it must overlap other content, but z-10 is fine
  since it no longer competes with the header. No ancestor overflow change is
  needed. This is a 1-line edit in src/app/explore/brands/page.tsx line 73.
verification: (find_root_cause_only mode — fix not applied)
files_changed: []
