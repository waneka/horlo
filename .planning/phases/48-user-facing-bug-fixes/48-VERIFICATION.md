---
phase: 48-user-facing-bug-fixes
verified: 2026-05-19T22:05:00Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Manual dark-mode UAT — /search chip legibility"
    expected: "All 7 drawer chip groups and both inline removable chip blocks (zero-results branch AND results branch) render with legible text in dark mode. Hover state (hover:bg-accent/20) remains legible. Light mode shows no regression."
    why_human: "jsdom cannot resolve oklch() CSS custom property paint values. Task 3 of Plan 03 was auto-approved under --auto/chain mode per orchestrator policy. The static grep gates confirm the correct token is in the primitive, but visual confirmation that text-foreground in dark mode actually resolves to near-white on bg-accent/10 requires a real browser. See Plan 48-03 Task 3 for the full 9-step UAT protocol."
---

# Phase 48: User-Facing Bug Fixes — Verification Report

**Phase Goal:** Both live production bugs are resolved — wishlist watches are correctly labeled, and `/search` filter chips are legible in dark mode
**Verified:** 2026-05-19T22:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A wishlist/grail/sold watch viewed via /catalog/[catalogId] does NOT trigger the "You own this watch" callout | ✓ VERIFIED | `eq(watchesTable.status, 'owned')` present at line 293 of `src/app/catalog/[catalogId]/page.tsx`; 3 BUG-01 regression tests pass (11/11 in catalog-page.test.ts) |
| 2 | An actually-owned watch (status='owned') STILL renders the "You own this watch" callout — no regression | ✓ VERIFIED | Pre-existing D-08 owned-path test at line 165 of catalog-page.test.ts is unmodified and passing; `self-via-cross-user` count in page.tsx unchanged (3 hits, same branch, no new branches added) |
| 3 | A shared CVA-based Chip primitive exists at src/components/ui/chip.tsx | ✓ VERIFIED | File exists, 75 lines, `'use client'` on line 1; exports `Chip`, `chipVariants`, `ChipVariants`; removable variant uses `text-foreground` not `text-accent-foreground` |
| 4 | The removable variant of Chip uses text-foreground, NOT text-accent-foreground (BUG-02 static fix) | ✓ VERIFIED | `REMOVABLE = 'gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20'` — confirmed in source; `not.toContain('text-accent-foreground')` test assertion passes (7/7 unit tests green) |
| 5 | All 7 drawer chip components render via the shared Chip primitive | ✓ VERIFIED | All 7 files (Brand/Era/Genre/Archetype/Movement/CaseSize/Style) import `{ Chip } from '@/components/ui/chip'`; cn import removed from all 7; 'use client' on line 1 of all 7; 20 DrawerChips.test.tsx tests pass |
| 6 | Both removable chip blocks in SearchPageClient.tsx render via <Chip variant='removable'> | ✓ VERIFIED | 8 instances of `variant="removable"` in SearchPageClient.tsx (4 facets × 2 branches); Chip import present; X icon import removed; 8 SearchPageClientChips.test.tsx tests pass |
| 7 | Zero text-accent-foreground literal hits remain inside src/components/search/ | ✓ VERIFIED | `grep -rn "text-accent-foreground" src/components/search/` returns 0 hits (ComingSoonCard.tsx has 0 — its bg-accent/10 is icon-circle, not chip text; confirmed separate from chip surfaces) |
| 8 | Zero bg-accent/10 literal hits remain in chip surfaces inside src/components/search/ | ✓ VERIFIED | Only `ComingSoonCard.tsx` lines 52 and 70 remain — pre-existing icon-circle containers, not chip elements, not BUG-02 surfaces. SearchPageClient.tsx has 0 hits. This is the noted over-spec (scope note). |
| 9 | tests/app/catalog-page.test.ts mocks @/data/profiles so getProfileById returns null safely | ✓ VERIFIED | `grep -c "vi.mock('@/data/profiles'"` returns 1; `grep -c "BUG-01"` returns 4 (1 comment + 3 test names) |
| 10 | The Chip primitive unit test asserts the absence of text-accent-foreground in the removable variant | ✓ VERIFIED | `grep -c "not.toContain('text-accent-foreground')" tests/components/ui/chip.test.tsx` returns 1; 7/7 tests pass |
| 11 | No wishlist callout or new framing branch added (deferred per D-03/CONTEXT.md) | ✓ VERIFIED | `grep -c "On your wishlist\|on-your-wishlist\|onYourWishlist" src/app/catalog/[catalogId]/page.tsx` returns 0; self-via-cross-user count is 3 (unchanged — existing branch only) |
| 12 | Dark-mode visual check at /search confirms all chip groups + removable inline chips show legible text | ? UNCERTAIN | Task 3 auto-approved under --auto/chain mode; automated tests pass but oklch paint resolution requires real browser — deferred to human UAT |

**Score:** 11/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/catalog/[catalogId]/page.tsx` | findViewerWatchByCatalogId with status='owned' filter | ✓ VERIFIED | `eq(watchesTable.status, 'owned')` at line 293; commit 021c7b1 |
| `tests/app/catalog-page.test.ts` | BUG-01 regression coverage + @/data/profiles mock | ✓ VERIFIED | 11 passing tests (8 pre-existing + 3 new BUG-01); profiles mock wired via vi.hoisted + vi.mock + beforeEach |
| `src/components/ui/chip.tsx` | Chip + chipVariants + ChipVariants, removable uses text-foreground | ✓ VERIFIED | 75 lines; 'use client' line 1; all 3 exports present; REMOVABLE const uses text-foreground; commit 38912b8 |
| `tests/components/ui/chip.test.tsx` | 7 unit tests including BUG-02 regression guard | ✓ VERIFIED | 96 lines; 7 it() blocks; not.toContain('text-accent-foreground') present; 7/7 pass |
| `src/components/search/BrandChips.tsx` | Uses <Chip variant='toggle' selected={...}> | ✓ VERIFIED | Chip import present; cn import absent; 'use client' line 1 |
| `src/components/search/StyleChips.tsx` | Multi-select via <Chip variant='toggle' selected={selected.includes(tag)}> | ✓ VERIFIED | Chip import present; cn import absent |
| `src/components/search/SearchPageClient.tsx` | 8 <Chip variant='removable'> instances; zero text-accent-foreground; zero bg-accent/10 | ✓ VERIFIED | 8 variant="removable" instances; 0 text-accent-foreground; 0 bg-accent/10; Chip import at line 9; X import removed |
| `tests/components/search/DrawerChips.test.tsx` | Migration tests for 7 drawer chips | ✓ VERIFIED | Exists; 20 tests pass |
| `tests/components/search/SearchPageClientChips.test.tsx` | Migration tests for removable chip blocks | ✓ VERIFIED | Exists; 8 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `findViewerWatchByCatalogId` in page.tsx | drizzle watches table where() | `and(eq userId, eq catalogId, eq status='owned')` | ✓ WIRED | Line 293: `eq(watchesTable.status, 'owned')` — 3rd condition confirmed |
| `tests/app/catalog-page.test.ts` | `@/data/profiles getProfileById` | `vi.mock` with `vi.hoisted` mockGetProfileById returning null | ✓ WIRED | vi.mock('@/data/profiles') present; 1 hit |
| `src/components/ui/chip.tsx Chip component` | chipVariants CVA | `cn(chipVariants({ variant }), conditional selected classes, className)` | ✓ WIRED | Lines 57-61: `cn(chipVariants({ variant }), variant === 'toggle' && selected && SELECTED_CLASSES, className)` |
| `src/components/ui/chip.tsx removable variant` | lucide-react X icon + sr-only span | internal render when variant='removable' | ✓ WIRED | Lines 65-70: `<X className="size-3" aria-hidden />` + conditional sr-only span |
| `src/components/search/{7 chip files}` | `src/components/ui/chip.tsx <Chip>` | `import { Chip } from '@/components/ui/chip'` + `<Chip variant='toggle' selected={isSelected}>` | ✓ WIRED | All 7 files import Chip; cn removed from all 7 |
| `src/components/search/SearchPageClient.tsx (both chip blocks)` | `src/components/ui/chip.tsx <Chip variant='removable'>` | `import { Chip }` + 8 `<Chip variant="removable">` instances | ✓ WIRED | Chip import at line 9; 8 removable instances across both branches |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| BUG-01 regression suite (11 tests) | `npx vitest run tests/app/catalog-page.test.ts` | 11 passed, 0 failed | ✓ PASS |
| Chip primitive unit tests (7 tests incl. BUG-02 guard) | `npx vitest run tests/components/ui/chip.test.tsx` | 7 passed, 0 failed | ✓ PASS |
| Drawer chip migration tests (20 tests) | `npx vitest run tests/components/search/DrawerChips.test.tsx` | 20 passed, 0 failed | ✓ PASS |
| SearchPageClient chip migration tests (8 tests) | `npx vitest run tests/components/search/SearchPageClientChips.test.tsx` | 8 passed, 0 failed | ✓ PASS |
| BUG-01 fix present in source | `grep -c "eq(watchesTable.status, 'owned')" src/app/catalog/[catalogId]/page.tsx` | 1 | ✓ PASS |
| Zero bad tokens in search/ | `grep -rn "text-accent-foreground" src/components/search/` | 0 hits | ✓ PASS |
| 8 removable chip instances in SearchPageClient | `grep -c 'variant="removable"' src/components/search/SearchPageClient.tsx` | 8 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BUG-01 | Plan 48-01 | Wishlist watch on /catalog/[catalogId] never labeled "you own this watch" | ✓ SATISFIED | status='owned' Drizzle filter at page.tsx line 293; 3 regression tests covering wishlist/grail/sold; 11/11 tests pass |
| BUG-02 | Plans 48-02, 48-03 | /search filter chips legible in dark mode | ✓ SATISFIED (static) / ? UAT pending | text-foreground in chip.tsx REMOVABLE; zero text-accent-foreground in src/components/search/; 8 chip surfaces migrated; visual browser check deferred |

Both BUG-01 and BUG-02 are v5.2 requirements per REQUIREMENTS.md. Both are claimed by Phase 48 plans. No orphaned requirements detected. TAX-01 and ARCH-01 are Phase 49/50 — correctly out of scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/search/ComingSoonCard.tsx` | 52, 70 | `bg-accent/10` | ℹ Info | Pre-existing icon-circle containers; NOT chip elements; NOT a BUG-02 surface; pre-dates this phase. Plan 03 SUMMARY explicitly logs this as out-of-scope. No action needed. |

No TBD, FIXME, or XXX markers found in any files modified by this phase. No stub patterns (empty returns, placeholder text, hardcoded empty arrays) introduced. No TODO markers in modified files.

### Human Verification Required

#### 1. Dark-Mode Chip Legibility UAT at /search

**Test:** Run `rm -rf .next && npm run dev`, open `http://localhost:3000/search` in a browser, toggle to dark mode (confirm `.dark` class on `<html>`), and walk through the 9-step protocol from Plan 48-03 Task 3:

1. Open filter drawer. For each of the 7 chip groups (Movement, Case Size, Style, Brand, Era, Genre, Archetype): confirm unselected chips show legible near-white text on dark gray pill.
2. Click a chip in each group — selected state shows near-black text on solid golden accent pill (this is expected and unchanged).
3. Apply 2+ filters, close drawer. Confirm removable chips appear above results with legible near-white text on tinted accent surface.
4. Hover a removable chip — background lightens to bg-accent/20, text remains legible.
5. Click the X on a removable chip — filter clears.
6. Force a zero-results state (obscure brand + era). Confirm removable chips above the empty-state message render with same legibility (tests BOTH branches were migrated).
7. Toggle back to light mode. Confirm all chip groups and removable chips render with adequate contrast — no light-mode regression.
8. Run `npm run lint && npx vitest run` one final time to confirm green state post-interaction.

**Expected:** All 7 drawer chip groups and both removable chip block locations render with legible text in both dark and light mode. Contrast on removable chips (bg-accent/10 + text-foreground) is comparable to WCAG AAA (>7:1) in dark mode. No light-mode regression.

**Why human:** jsdom cannot resolve `oklch(...)` CSS custom property values at test time. The static analysis confirms `text-foreground` is the token used in the primitive, but whether the CSS variable chain actually resolves to near-white in dark mode requires a real browser. This UAT was auto-approved under `--auto/chain` mode per orchestrator policy and is the only remaining gate for BUG-02 to be fully closed.

### Gaps Summary

No BLOCKER gaps. All automated must-haves verified in the codebase.

The single open item is the manual dark-mode UAT (Truth #12), which was auto-approved under `--auto/chain` mode per orchestrator policy. The automated static gates strongly predict success:
- The chip primitive source uses `text-foreground` (not `text-accent-foreground`) in the REMOVABLE const
- The unit test `not.toContain('text-accent-foreground')` passes
- Zero instances of `text-accent-foreground` remain in `src/components/search/`

The user should walk through the UAT protocol above before treating BUG-02 as fully production-closed.

---

_Verified: 2026-05-19T22:05:00Z_
_Verifier: Claude (gsd-verifier)_
