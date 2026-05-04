---
phase: 27
slug: watch-card-collection-render-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `27-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| **Config file** | `vitest.config.ts` (existing, repo root) |
| **Quick run command** | `npx vitest run --reporter=dot src/components/profile src/data src/app/actions/wishlist.ts src/db` |
| **Full suite command** | `npm test` (runs `vitest run`) |
| **Estimated runtime** | ~30s focused / ~90s full suite |

---

## Sampling Rate

- **After every task commit:** Run focused quick run command (above)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND manual UAT of drag-and-drop on real mobile device + desktop browser
- **Max feedback latency:** 30 seconds (focused) / 90 seconds (full)

---

## Per-Task Verification Map

> Plans are not yet authored; the planner will assign Task IDs in the form `27-{plan}-{task}`. Each phase requirement is mapped to at least one automated test below; the planner MUST cite the corresponding test file in each task's `<acceptance_criteria>`.

| Requirement | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|------|------|----------|-----------|-------------------|-------------|--------|
| WISH-01 | schema | 1 | `sort_order` column exists, NOT NULL, default 0; index `(user_id, sort_order)` exists | migration smoke | `npx vitest run src/db/__tests__/phase27-schema.test.ts` | ❌ W0 | ⬜ pending |
| WISH-01 | schema | 1 | Backfill assigns `sort_order` 0..N per user for wishlist+grail rows in createdAt DESC order; no duplicates | data-shape | `npx vitest run src/db/__tests__/phase27-backfill.test.ts` | ❌ W0 | ⬜ pending |
| WISH-01 | dal | 1 | `bulkReorderWishlist` enforces owner-only via WHERE clause + post-update count check (throws "Owner mismatch" on row-count delta) | unit | `npx vitest run src/data/__tests__/watches-bulkReorder.test.ts` | ❌ W0 | ⬜ pending |
| WISH-01 | action | 2 | `reorderWishlist` Server Action: rejects unauthenticated, rejects non-strict payload (extra keys), rejects non-uuid ids, restricts to status `wishlist`/`grail` | unit | `npx vitest run src/app/actions/__tests__/reorderWishlist.test.ts` | ❌ W0 | ⬜ pending |
| WISH-01 | dal | 1 | `getWatchesByUser` returns wishlist watches in `sort_order ASC` then `createdAt DESC` | unit | `npx vitest run src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts` | ❌ W0 | ⬜ pending |
| WISH-01 | wishlist-tab | 3 | `WishlistTabContent` renders draggable cards (DndContext + SortableContext) for `isOwner=true`; renders plain cards for `isOwner=false` | component smoke | `npx vitest run src/components/profile/WishlistTabContent.test.tsx` (extend existing) | ✅ extend | ⬜ pending |
| WISH-01 | wishlist-tab | 3 | Drag rollback: server returns `{success:false}` → Sonner toast shown + optimistic order reverts | unit (component) | `npx vitest run src/components/profile/WishlistTabContent.test.tsx` (extend existing) | ✅ extend | ⬜ pending |
| WISH-01 | uat | 4 | Drag-and-drop happy path: drag card 0 → position 2, refresh page, order persists. iOS Safari touch test. Keyboard reorder via space + arrow keys with aria-live announcements. | E2E manual | Manual UAT — see Manual-Only Verifications below | manual | ⬜ pending |
| VIS-07 | grid | 1 | `WishlistTabContent` and `CollectionTabContent` render `grid-cols-2` on mobile (no `grid-cols-1` class on default viewport) | unit (component) | `npx vitest run src/components/profile/WishlistTabContent.test.tsx src/components/profile/__tests__/CollectionTabContent.test.tsx` | ✅ extend Wishlist; ❌ W0 Collection | ⬜ pending |
| VIS-08 | card | 2 | `ProfileWatchCard` price line: renders `Paid: $X` for owned with pricePaid; `Target: $X` for wishlist with targetPrice; `Market: $X` fallback when primary null but marketPrice present; line absent when both null. Covers 8 status × price-presence combos. | unit (component) | `npx vitest run src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` | ❌ W0 | ⬜ pending |
| VIS-08 | card | 2 | `ProfileWatchCard` Image `sizes` attribute equals `(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw` | unit (component) | (covered by ProfileWatchCard-priceLine.test.tsx — additional assertion) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/__tests__/phase27-schema.test.ts` — verify `sort_order` column + `(user_id, sort_order)` index post-migration (covers WISH-01 schema)
- [ ] `src/db/__tests__/phase27-backfill.test.ts` — verify backfill row-shape per user (covers WISH-01 backfill)
- [ ] `src/data/__tests__/watches-bulkReorder.test.ts` — owner-only enforcement at DAL (covers WISH-01 action layer)
- [ ] `src/app/actions/__tests__/reorderWishlist.test.ts` — Server Action surface: Zod, auth, status filter (covers WISH-01 action)
- [ ] `src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts` — read-path order (covers WISH-01 ORDER BY)
- [ ] `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` — price line + sizes attr (covers VIS-08)
- [ ] `src/components/profile/__tests__/CollectionTabContent.test.tsx` — `grid-cols-2` assertion (covers VIS-07)
- [ ] Extend existing `src/components/profile/WishlistTabContent.test.tsx` — owner DnD vs. non-owner plain + rollback path (covers WISH-01 + VIS-07)
- [ ] No framework install needed (Vitest + RTL + jsdom + msw already present)
- [ ] No new MSW handlers needed (Server Actions are mocked at the import level)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari touch drag | WISH-01 | No iOS device automation in this repo (no Playwright). | On iPhone Safari: long-press wishlist card ~250ms → card lifts → drag to new slot → release → refresh page → order persists. Repeat with `navigator.vibrate` enabled to confirm haptic on dragStart. |
| Keyboard accessibility | WISH-01 | jsdom does not exercise focus rings, real screen-reader announcements, or arrow-key visual feedback. | Tab to wishlist card → Space (pickup, focus ring + lift) → Arrow keys (move, aria-live announces "Moved item N to position M") → Space (drop) or Esc (cancel) → screen reader announces "Saved" or "Cancelled". |
| Click-through vs. drag dispatch | WISH-01 | Synthetic events in jsdom are not equivalent to real pointer events at the OS level — must verify on a physical device that a quick tap navigates and a 150ms+ hold initiates drag. | On desktop Chrome + iOS Safari: tap card without holding → navigates to `/watch/[id]`. Press-and-hold ≥150ms (desktop) / ≥250ms (mobile) → drag begins, no navigation fires. |
| Mobile 2-column visual quality | VIS-07 | Layout judgement is subjective until seen on a real phone. CONTEXT D-12 says "Ship and iterate". | Open `/u/[username]/wishlist` and `/u/[username]/collection` on a real iPhone and Android device. Verify: card content does not overflow at half-width, image aspect ratio remains 4:5, price line is legible, "Worn today" pill does not collide with model text. Note any visual issues for follow-up. |
| Worn-today pill rendering during drag | VIS-07/VIS-08 | Drag overlay must not strip the accent pill. | On desktop, mark a wishlist watch as "Worn today" (unlikely scenario but possible for owned cards if Collection-tab DnD is later added) → drag the card → confirm overlay shows `scale-105 shadow-xl` AND retains the pill. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files listed above
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s for focused / < 90s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

**Approval:** pending
