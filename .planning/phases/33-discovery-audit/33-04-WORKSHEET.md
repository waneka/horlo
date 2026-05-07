---
phase: 33-discovery-audit
plan: 04
artifact: pass-c-browser-walk-worksheet
status: awaiting-human-walk
target_rows: 28
floor_rows: 20
created: 2026-05-06
---

# Pass C — Browser Walk Worksheet

> Walk these ~28 high-stakes rows on **production horlo.app** (NOT local dev) from **BOTH** the owner account **AND** a fresh-signup fixture account, at **BOTH** desktop ~1280px **AND** mobile ~390px viewports.
>
> For each walked row: (1) visit the URL, (2) confirm the affordance behavior matches the row's tag in `33-DISCOVERY-AUDIT.md`, (3) **APPEND** a `prod:` evidence line to the row's `evidence` cell using the format: `prod: <URL> (<viewer>, <viewport>) — <observation>`, (4) tick off the row in this worksheet.
>
> **Floor:** ≥ 20 rows MUST have `prod:` evidence before resuming Plan 33-04 Task 2 (Pass D verdict authoring). Target is 25–30. Rule 5 of D-13 (decisions cite rows that exist) does NOT require prod: evidence, but auditor commitment is enforced by the floor (Plan 33-04 Task 2 acceptance criterion).

---

## Setup (one-time)

1. **Owner account (Profile A — primary collector)** — confirm at https://horlo.app/u/{owner}/collection that `followingCount ≥ 3 AND wearEventsCount ≥ 1 AND collection.length > 0`. If not, top up the data first; the audit gate decisions assume this state.
2. **Fresh-account fixture (Profile B — Incognito or 2nd Chrome profile)** — signup at https://horlo.app/signup with throwaway email (e.g., `phase33-audit+1@horlo.app`); verify email via `mail.horlo.app` Resend SMTP; **do NOT follow anyone, add any watches, or log any wear events**. Confirm `followingCount=0 AND wearEventsCount=0 AND collection.length=0` — this satisfies G-1 ExploreHero gate AND G-4/G-6 verdict-suppression branches simultaneously.
3. **Pre-audit step for G-12 common-ground** — from the owner account, follow ≥1 collector with confirmed catalog overlap (so /u/{follower}/common-ground produces a non-404 result). Note the username for use in row CG-A below.
4. **DevTools** — Cmd+Shift+M to toggle device toolbar; "iPhone 12 Pro" preset (~390px) for mobile rows; ≥1280px window for desktop rows.

**Tag downgrade rules** (from Plan 33-04 `<interfaces>`):

- Source-pass `Live` → browser-pass `Dead` — target 404s, errors, or no-ops (capture observed failure mode in evidence).
- Source-pass `Live` → browser-pass `Redundant` — same destination already cited (cite the prior DISC-AUDIT-NN).
- Source-pass `Dead` provisional (WR-07 wishlist.ts:206) → browser-pass confirms or reverts based on observed visual stale-ness after drag-reorder.
- New Missing row — if browser walk reveals an Rdio-expected click affordance with no source counterpart, ADD a row (next sequential DISC-AUDIT-NN, tag=Missing) citing SEED-004.

---

## Walk targets (~28 rows, organized by gate)

### G-1 — /explore ExploreHero (fresh-account-only render)

URL: https://horlo.app/explore

- [ ] **DISC-AUDIT-47** — `ExploreHero "Browse popular collectors" CTA` — visit /explore as **fresh-account, mobile (~390px)**. Confirm ExploreHero renders with sparse-state copy ("Find your first three" or similar). Click "Browse popular collectors" → confirm /explore/collectors loads (200, populated grid). Repeat at **fresh-account, desktop (~1280px)**. Then visit as **owner-populated** at desktop — confirm ExploreHero is SUPPRESSED (no sparse-state copy; rails render directly). Capture both viewports per V-1 split.

### G-3 — /catalog/{id} ownership framing ("You own this")

URL: https://horlo.app/catalog/{some-uuid}

- [ ] **DISC-AUDIT-72** — `"You own this" callout Link` — owner-populated, visit a /catalog/{id} where the **owner OWNS** the catalog ref (i.e., one of owner's collection watches is derived from this catalog row — pick a Submariner or similar from /u/{owner}/collection and click through to its catalog detail OR navigate via /search). Confirm "You own this" framing renders + `ownerHref` Link click → /watch/{viewer-owned-id} (200). Confirm CatalogPageActions are ABSENT in this branch.

### G-4 — /catalog/{id} verdict suppression (cross-user framing, collection>0 vs =0)

URL: https://horlo.app/catalog/{some-uuid} where viewer does NOT own

- [ ] **DISC-AUDIT-70** — `Verdict label/pill on CollectionFitCard` — owner-populated, visit a /catalog/{id} where owner does NOT own. Confirm Verdict Badge renders (Core Fit / Hard Mismatch / etc.).
- [ ] **DISC-AUDIT-73** — `CatalogPageActions: Add to Wishlist CTA` — same URL as 70, owner-populated. Click "Add to Wishlist" → confirm toast + redirect to /u/{owner}/wishlist (200). Confirm wishlist contains the new watch.
- [ ] **DISC-AUDIT-74** — `CatalogPageActions: Add to Collection CTA` — same URL, owner-populated. Click "Add to Collection" → confirm /watch/new?catalogId=...&intent=owned&returnTo=... loads (200) with prefilled catalog data. Cancel rather than submit (audit is read-only).
- [ ] **DISC-AUDIT-75** — `CatalogPageActions: Skip CTA` — same URL, owner-populated. Click "Skip" → confirm router.back() returns to previous page.
- [ ] **DISC-AUDIT-130** — `Verdict + CatalogPageActions absent (G-4 fresh-account suppression branch)` — visit SAME URL as fresh-account. Confirm header + image render BUT **no verdict, no CatalogPageActions, no walk-forward affordance**. Capture mobile viewport too — confirm CatalogPageActions design intent (V-6 SRCH-16 future bottom-sheet) does NOT yet ship; bottoms render same as desktop.

### G-6 — /watch/{id} verdict suppression

URL: https://horlo.app/watch/{some-uuid}

- [ ] **DISC-AUDIT-81** — `WatchDetail Verdict label/pill on CollectionFitCard` — owner-populated, visit a /watch/{another-user}/{id} (cross-user; viewer has populated collection). Confirm Verdict Badge renders.
- [ ] **DISC-AUDIT-131** — `Verdict / CollectionFitCard absent (G-6 fresh-account suppression)` — visit SAME URL as fresh-account. Confirm watch detail renders BUT no verdict, no CollectionFitCard, no walk-to-similar affordance via mostSimilar list (DISC-AUDIT-82 counterpart absent).

### G-7 — /watch/{id} same-user vs cross-user framing

URLs: https://horlo.app/watch/{owner's watch} (same-user) AND https://horlo.app/watch/{another-user's watch} (cross-user)

- [ ] **DISC-AUDIT-77** — `Edit Link on WatchDetail (owner-only)` — owner-populated viewing OWN watch (same-user). Confirm Edit Link visible. Then visit cross-user URL — confirm Edit Link ABSENT.
- [ ] **DISC-AUDIT-78** — `Delete dialog trigger on WatchDetail (owner-only)` — owner-populated viewing OWN watch. Confirm Delete trigger visible. Cross-user — confirm absent. (Do NOT actually delete; close dialog with Cancel button DISC-AUDIT-80.)

### G-8 — /u/{user}/collection LockedTabCard

URL: https://horlo.app/u/{owner-with-private-collection}/collection (toggle owner's `collectionPublic=false` in /settings if needed)

- [ ] **DISC-AUDIT-97** — `LockedTabCard Connect CTA — none rendered` — fresh-account viewing owner's private collection. Confirm LockedTabCard renders with lock icon + "keeps their collection private" text. Confirm there is NO Connect/Follow CTA inside the lock card (Missing-tag justification).
- [ ] **DISC-AUDIT-133** — `LockedTabCard render itself` — same URL, fresh-account. Confirm the lock UI itself renders correctly (Pitfall 2 Live counterpart of DISC-AUDIT-97). The lock UI being correctly designed-as-locked IS the affordance.

### G-12 — /u/{user}/common-ground (404 vs render)

URLs: owner viewing follower-with-overlap; fresh-account viewing owner-with-no-overlap

- [ ] **DISC-AUDIT-125** — `CommonGroundTabContent shared-watch ProfileWatchCard whole-card Link` — owner-populated viewing /u/{follower-with-overlap}/common-ground. Confirm shared-watch grid renders; click a card → /watch/{watchId} (200).
- [ ] **DISC-AUDIT-127** — `Common Ground 404 fallback` — fresh-account viewing /u/{owner}/common-ground (no overlap). Confirm Next.js default 404 page renders. Confirm there is NO walk-back affordance to /explore or "see other collectors" (Missing-tag SEED-004 violation).

### G-13 — /u/{user}/insights (owner-only)

URL: https://horlo.app/u/{owner}/insights

- [ ] **DISC-AUDIT-128** — `InsightsTabContent (owner-only G-13)` — owner-populated visiting OWN /insights. Confirm sections render (BalanceChart, SleepingBeauties, GoodDeals, etc.). Then fresh-account visiting /u/{owner}/insights via direct URL — confirm 404. Then confirm fresh-account ProfileTabs OMITS the Insights link entirely (two-layer privacy → see DISC-AUDIT-132).

### G-15 — /u/{user}/notes per-row notesPublic (DEBT-09 territory)

URL: https://horlo.app/u/{owner}/notes (owner has mix of `notesPublic=true` and `notesPublic=false` rows)

- [ ] **DISC-AUDIT-112** — `NoteRow brand+model Link` — owner-populated viewing OWN notes. Confirm all rows visible (regardless of notesPublic). Each row's brand+model Link → /watch/{watch.id} (200).
- [ ] **DISC-AUDIT-113** — `NoteVisibilityPill (DEBT-09 affordance)` — owner viewing OWN notes. Confirm NoteVisibilityPill renders per row; click pill → confirm visibility toggle round-trips (DEBT-09 Phase 32 fix). Then fresh-account viewing /u/{owner}/notes — confirm only `notesPublic !== false` rows render (G-15 per-row gate); confirm NoteVisibilityPill renders in disabled state for non-owner.

### G-19 — /u/{user}/* ProfileTabs visibility

URL: https://horlo.app/u/{owner}/collection

- [ ] **DISC-AUDIT-84** — `ProfileTabs Tab triggers — owner-populated full set` — owner visiting OWN profile. Confirm 7 tabs render: Collection / Wishlist / Worn / Notes / Stats / CommonGround / Insights (the last two conditional on overlap and isOwner respectively).
- [ ] **DISC-AUDIT-132** — `ProfileTabs Tab triggers — fresh-account reduced set` — fresh-account viewing /u/{owner}/collection (assume overlap=hasAny=false for clean test; or =true with the pre-audit follow). Confirm Insights tab is OMITTED (two-layer privacy with G-13). With overlap=false → 5 base tabs (Collection/Wishlist/Worn/Notes/Stats); with overlap=true → 6 tabs (5 base + CommonGround).

### WR-07 flagship Dead row confirmation

URL: https://horlo.app/u/{owner}/wishlist

- [ ] **DISC-AUDIT-99** — `SortableProfileWatchCard drag-handle (owner-only reorder)` — owner-populated viewing OWN wishlist. Drag-reorder a wishlist row (move row 3 above row 1). **DO NOT manually refresh.** Click around to /u/{owner}/collection then back to /u/{owner}/wishlist. Observe whether the new order is visible OR the old order persists. Then hard refresh (Cmd+Shift+R) and observe whether the new order finally appears.
  - **Expected** (per Plan 32 + RESEARCH.md WR-07 landmine): drag commits to DB but page does not refresh until manual reload — confirms the silent no-op user-visible regression. Capture in evidence: `prod: https://horlo.app/u/{owner}/wishlist (owner-populated, desktop) — drag-reordered row 3 above row 1; navigated to /collection then back; row 1 visually still on top; hard refresh restored row 3 on top → confirms WR-07 silent no-op user-visible regression`.
  - **If unexpected** (drag-reorder visibly refreshes without manual reload): downgrade tag from `Dead` to `Live` in DISC-AUDIT-99 row; document the unexpected good-news observation; flag as a possible upstream Next.js 16 cache-component behavior change worth investigating outside the audit.

### V-8 — Phase 30 aspect-ratio CSS-chain spot-check (mobile only)

(per `feedback_ui_spec_css_chain_blind_spot.md`)

- [ ] **V-8 spot** — at **mobile (~390px)** only, visit /, /u/{owner}/collection, /explore, and /u/{owner}/worn (calendar AND timeline view). Inspect rendered images on **WywtSlide** (home WywtRail), **ProfileWatchCard** (collection grid), **DiscoveryWatchCard** (explore rails). Look for: (a) wrong aspect ratio (image stretched / squished), (b) visible black-bar letterbox from `object-fit: contain` mismatched to a `aspect-ratio` declaration, (c) image cropping that hides identifying watch features.
  - **If observed**: ADD a Dead row (next sequential DISC-AUDIT-NN, tag=Dead) citing the visual failure: `prod: https://horlo.app/u/{owner}/collection (owner-populated, 390px) — ProfileWatchCard.tsx renders watch image with visible top+bottom black bars; CSS chain aspect-ratio:1/1 + object-fit:contain produces letterbox at non-square photo aspect ratio. SEED-004 violation: image carries reduced visual identity; user cannot identify watch from card`.
  - **If not observed** (the Phase 30 work was correct after all): no action; record in DISC-AUDIT-93/52/22 evidence cells `prod: <URL> (390px) — no aspect-ratio black-bar regression observed`.

---

## After walk

1. Run `bash .planning/phases/33-discovery-audit/checks/quick.sh` — must exit 0. (Should pass — only evidence cells were appended; no schema changes.)
2. Count prod: rows: `grep -c '^| DISC-AUDIT-.*prod:' .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — confirm ≥ 20 (target 25–30).
3. Confirm WR-07 row carries prod: `grep 'wishlist\.ts:206.*prod:' .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — confirm ≥ 1 line.
4. Resume Plan 33-04 by running `/gsd-execute-phase 33` — Task 2 (Pass D — author 4 D-17 decision verdicts) is autonomous and will run automatically.

---

## Checklist summary

**Total walkable rows in this worksheet:** 28 specific row IDs + 1 V-8 spot-check = 29 verifiable observations.

| Gate | Rows | Page loads (owner+fresh × dt+mb where applicable) |
|------|------|---------------------------------------------------|
| G-1 (ExploreHero) | DISC-AUDIT-47 | 4 (fresh dt+mb, owner-suppressed dt+mb) |
| G-3 (You own this) | DISC-AUDIT-72 | 1 (owner dt) |
| G-4 (catalog verdict) | DISC-AUDIT-70, 73, 74, 75, 130 | 5 (owner dt + fresh dt+mb) |
| G-6 (watch verdict) | DISC-AUDIT-81, 131 | 2 (owner dt + fresh dt) |
| G-7 (same/cross-user watch) | DISC-AUDIT-77, 78 | 2 (own + cross dt) |
| G-8 (collection lock) | DISC-AUDIT-97, 133 | 1 (fresh dt) |
| G-12 (common-ground 404) | DISC-AUDIT-125, 127 | 2 (owner-with-overlap dt + fresh-no-overlap dt) |
| G-13 (insights owner-only) | DISC-AUDIT-128 | 2 (owner-self dt + fresh-direct dt) |
| G-15 (notes per-row) | DISC-AUDIT-112, 113 | 2 (owner dt + fresh dt) |
| G-19 (ProfileTabs) | DISC-AUDIT-84, 132 | 2 (owner dt + fresh dt) |
| WR-07 (wishlist reorder) | DISC-AUDIT-99 | 1 (owner dt drag + nav + refresh) |
| V-8 (mobile aspect-ratio) | (spot-check) | 4 (mobile-only — /, collection, explore, worn) |
| **TOTAL** | **28 + V-8 spot** | **~28 page loads** |

Estimated walk time: ~1.5 hours.
